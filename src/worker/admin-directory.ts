import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { App, Link } from "./types";
import { expiryHeld, publicLink } from "./service";
import { editLink, linkStats } from "./link-management";
import { protectedAdmin, restoreUntil } from "./trash";

export const adminDirectory = new Hono<App>();
// Parent middleware authorizes every /api/admin/* request before this router.
const columns = `l.slug,l.owner_id,l.target,l.host,l.label,l.created_at,
  l.last_access_at,l.idle_expires_at,l.fixed_expires_at,l.months,l.status,
  l.deleted_at,l.deletion_user_id,
  u.email AS owner_email,u.name AS owner_name,u.deleted_at AS owner_deleted_at`;
type DirectoryLink = Link & {
  owner_email: string | null;
  owner_name: string | null;
  owner_deleted_at: number | null;
};
const effectiveStatus = `CASE WHEN l.deleted_at IS NOT NULL THEN 'trashed' WHEN l.status='active' AND
  (l.fixed_expires_at<=? OR (?=0 AND l.idle_expires_at<=?))
  THEN 'expired' ELSE l.status END`;
const serialize = (l: DirectoryLink, held: boolean, now: number) => ({
  ...publicLink(l),
  restore_until: restoreUntil(l.deleted_at),
  can_restore:
    l.deleted_at != null &&
    restoreUntil(l.deleted_at)! > now &&
    l.owner_deleted_at == null,
  effective_status:
    l.deleted_at != null
      ? "trashed"
      : l.status === "active" &&
          ((l.fixed_expires_at !== null && l.fixed_expires_at <= now) ||
            (!held && l.idle_expires_at <= now))
        ? "expired"
        : l.status,
  effective_expires_at: held
    ? l.fixed_expires_at
    : Math.min(l.idle_expires_at, l.fixed_expires_at ?? Infinity),
});
function cursor(value: string | undefined): [number, string] {
  if (!value) return [Number.MAX_SAFE_INTEGER, ""];
  const separator = value.indexOf(":");
  const time = Number(value.slice(0, separator));
  const id = value.slice(separator + 1);
  if (
    separator < 1 ||
    !Number.isSafeInteger(time) ||
    time < 0 ||
    !id ||
    id.length > 254
  )
    throw new HTTPException(400, {
      message: "Mốc phân trang không hợp lệ. Hãy tải lại danh sách.",
    });
  return [time, id];
}
adminDirectory.get("/links", async (c) => {
  const q = (c.req.query("q") ?? "").trim().slice(0, 254);
  const owner = (c.req.query("owner") ?? "").slice(0, 254);
  const status = c.req.query("status") ?? "all";
  if (
    !["all", "active", "expired", "blocked", "deleted", "trashed"].includes(
      status,
    )
  )
    return c.json({ error: "Trạng thái link không hợp lệ." }, 400);
  const now = Date.now(),
    held = expiryHeld(c.get("policy"), now);
  const [time, id] = cursor(c.req.query("cursor"));
  // Values are bound, including search and owner. Never expose creator_key or sessions.
  const where = `(?='' OR l.owner_id=?) AND
    (?='' OR instr(lower(l.slug),lower(?))>0 OR instr(lower(COALESCE(l.label,'')),lower(?))>0
    OR instr(lower(COALESCE(l.target,'')),lower(?))>0 OR instr(lower(COALESCE(u.email,'')),lower(?))>0)
    AND ${status === "all" ? "l.status<>'deleted'" : `(${effectiveStatus})=?`}`;
  const values = [
    owner,
    owner,
    q,
    q,
    q,
    q,
    q,
    ...(status === "all" ? [] : [now, Number(held), now, status]),
  ];
  const from = `FROM links l LEFT JOIN users u ON u.id=l.owner_id WHERE ${where}`;
  const [page, count, accounts, ownerInfo] = await c.env.DB.batch<
    Record<string, unknown>
  >([
    c.env.DB.prepare(
      `SELECT ${columns} ${from} AND (l.created_at<? OR (l.created_at=? AND l.slug>?)) ORDER BY l.created_at DESC,l.slug LIMIT 26`,
    ).bind(...values, time, time, id),
    c.env.DB.prepare(`SELECT count(*) AS total ${from}`).bind(...values),
    c.env.DB.prepare(
      "SELECT count(*) AS total FROM users WHERE deleted_at IS NULL",
    ),
    c.env.DB.prepare(
      "SELECT id,email,name,blocked,created_at,deleted_at FROM users WHERE id=?",
    ).bind(owner),
  ]);
  if (owner && !ownerInfo.results.length)
    return c.json({ error: "Tài khoản không còn tồn tại." }, 404);
  const rows = page.results as unknown as DirectoryLink[];
  return c.json({
    links: rows.slice(0, 25).map((l) => serialize(l, held, now)),
    total: count.results[0].total,
    totalUsers: accounts.results[0].total,
    owner: ownerInfo.results[0] ?? null,
    next: rows.length > 25 ? `${rows[24].created_at}:${rows[24].slug}` : null,
    expiryHeld: held,
  });
});
adminDirectory.get("/users", async (c) => {
  const q = (c.req.query("q") ?? "").trim().slice(0, 254);
  const state = c.req.query("state") ?? "all";
  if (!["all", "active", "blocked", "trashed"].includes(state))
    return c.json({ error: "Trạng thái tài khoản không hợp lệ." }, 400);
  const [time, id] = cursor(c.req.query("cursor"));
  const where = `(?='' OR instr(lower(u.email),lower(?))>0 OR instr(lower(u.name),lower(?))>0)
    AND u.deleted_at IS ${state === "trashed" ? "NOT " : ""}NULL
    ${state === "all" || state === "trashed" ? "" : "AND u.blocked=?"}`;
  const values = [
    q,
    q,
    q,
    ...(state === "all" || state === "trashed"
      ? []
      : [state === "blocked" ? 1 : 0]),
  ];
  const [page, count, total] = await c.env.DB.batch<Record<string, unknown>>([
    c.env.DB.prepare(
      `SELECT u.id,u.email,u.name,u.blocked,u.created_at,u.deleted_at,
      (SELECT count(*) FROM links l WHERE l.owner_id=u.id) AS link_count
      FROM users u WHERE ${where} AND (u.created_at<? OR (u.created_at=? AND u.id>?))
      ORDER BY u.created_at DESC,u.id LIMIT 26`,
    ).bind(...values, time, time, id),
    c.env.DB.prepare(
      `SELECT count(*) AS total FROM users u WHERE ${where}`,
    ).bind(...values),
    c.env.DB.prepare(
      "SELECT count(*) AS total FROM users WHERE deleted_at IS NULL",
    ),
  ]);
  const rows = page.results;
  return c.json({
    users: rows.slice(0, 25).map((u) => ({
      ...u,
      restore_until: restoreUntil(u.deleted_at as number | null),
      can_restore:
        u.deleted_at != null &&
        restoreUntil(u.deleted_at as number)! > Date.now(),
      can_delete:
        u.deleted_at == null &&
        !protectedAdmin(c.env, c.get("policy"), String(u.id)),
    })),
    total: count.results[0].total,
    totalUsers: total.results[0].total,
    next: rows.length > 25 ? `${rows[24].created_at}:${rows[24].id}` : null,
  });
});
adminDirectory.get("/links/:slug", async (c) => {
  const link = await c.env.DB.prepare(
    `SELECT ${columns} FROM links l LEFT JOIN users u ON u.id=l.owner_id WHERE l.slug=?`,
  )
    .bind(c.req.param("slug"))
    .first<DirectoryLink>();
  if (!link) return c.json({ error: "Không tìm thấy link." }, 404);
  const now = Date.now(),
    held = expiryHeld(c.get("policy"), now);
  return c.json({ link: serialize(link, held, now), expiryHeld: held });
});
adminDirectory.patch("/links/:slug/edit", (c) => editLink(c, true));
adminDirectory.get("/links/:slug/stats", linkStats);
