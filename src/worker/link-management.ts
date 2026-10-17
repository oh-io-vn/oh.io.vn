import type { Context } from "hono";
import type { App, Link } from "./types";
import { expiryHeld, blocked } from "./service";
import { readBody } from "./security";
import {
  targetValue,
  slugValue,
  fixedExpiry,
  vietnamDay,
} from "../shared/rules";

export async function editLink(c: Context<App>, admin = false) {
  const l = await c.env.DB.prepare("SELECT * FROM links WHERE slug=?")
    .bind(c.req.param("slug"))
    .first<Link>();
  if (!l || (!admin && l.owner_id !== c.get("user")!.id))
    return c.json({ error: "Không tìm thấy link." }, 404);
  const now = Date.now();
  const held = expiryHeld(c.get("policy"), now);
  if (
    l.status !== "active" ||
    (l.fixed_expires_at !== null && l.fixed_expires_at <= now) ||
    (!held && l.idle_expires_at <= now)
  )
    return c.json({ error: "Link đã ngừng hoạt động nên không thể sửa." }, 409);
  const b = await readBody(c);
  let target: URL, slug: string, fixed: number | null;
  try {
    target = targetValue(b.target, c.env.APP_ORIGIN);
    slug = b.slug === undefined ? l.slug : slugValue(b.slug);
    fixed = fixedExpiry(b.fixed_expires_at, now);
    if (await blocked(c.env, target)) throw new Error("Địa chỉ đã bị chặn.");
  } catch (e) {
    return c.json({ error: (e as Error).message }, 400);
  }
  // Fail closed if a Worker is deployed before migration 0003. Never release
  // an old code without the reservation trigger and cascading analytics FK.
  if (
    slug !== l.slug &&
    !(await c.env.DB.prepare(
      "SELECT 1 FROM sqlite_schema WHERE type='trigger' AND name='reserve_renamed_slug'",
    ).first())
  )
    return c.json(
      { error: "Chức năng đổi mã đang được cập nhật. Hãy thử lại sau." },
      503,
    );
  try {
    // The single update, FK cascade and tombstone trigger are atomic. Recheck
    // ownership/status/expiry here in case the record changed after the read.
    const update = c.env.DB.prepare(
      "UPDATE links SET slug=?,target=?,host=?,label=?,fixed_expires_at=? WHERE slug=? AND owner_id IS ? AND status='active' AND (fixed_expires_at IS NULL OR fixed_expires_at>?) AND (?=1 OR idle_expires_at>?)",
    ).bind(
      slug,
      target.toString(),
      target.hostname,
      typeof b.label === "string" ? b.label.trim().slice(0, 120) : null,
      fixed,
      l.slug,
      l.owner_id,
      now,
      Number(held),
      now,
    );
    const result = admin
      ? (
          await c.env.DB.batch([
            update,
            c.env.DB.prepare(
              "INSERT INTO admin_audit(actor,action,subject,created_at) SELECT ?, 'edit_link', ?, ? WHERE changes()>0",
            ).bind(
              c.get("user")!.id,
              l.slug === slug ? slug : `${l.slug} -> ${slug}`,
              now,
            ),
          ])
        )[0]
      : await update.run();
    if (!result.meta.changes)
      return c.json(
        {
          error:
            "Link đã thay đổi hoặc ngừng hoạt động. Hãy tải lại danh sách.",
        },
        409,
      );
    return c.json({ ok: true, slug, url: c.env.APP_ORIGIN + "/" + slug });
  } catch (e) {
    const detail = String((e as Error).cause ?? e);
    if (detail.includes("UNIQUE"))
      return c.json(
        { error: "Mã này đã được sử dụng. Hãy chọn mã khác." },
        409,
      );
    throw e;
  }
}

export async function linkStats(c: Context<App>) {
  const link = await c.env.DB.prepare("SELECT owner_id FROM links WHERE slug=?")
    .bind(c.req.param("slug"))
    .first<{ owner_id: string | null }>();
  if (!link) return c.json({ error: "Không tìm thấy link." }, 404);
  const since = vietnamDay(Date.now() - 29 * 86400000);
  const [data, gaps] = await c.env.DB.batch([
    c.env.DB.prepare(
      "SELECT day,source,device,clicks FROM analytics WHERE slug=? AND day>=? ORDER BY day DESC",
    ).bind(c.req.param("slug"), since),
    c.env.DB.prepare(
      "SELECT * FROM analytics_gaps WHERE ended_at IS NULL OR ended_at>=? ORDER BY started_at",
    ).bind(Date.now() - 30 * 86400000),
  ]);
  return c.json({
    rows: data.results,
    tracked: !!link.owner_id,
    gaps: gaps.results,
    since,
    enabled:
      !!c.get("policy").analytics_enabled &&
      c.get("policy").automatic_level < 80,
  });
}
