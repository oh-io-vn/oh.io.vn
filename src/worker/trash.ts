import type { Context } from "hono";
import type { App, Env, Policy } from "./types";

export const TRASH_RETENTION_MS = 30 * 86400000;
export const restoreUntil = (deletedAt: number | null | undefined) =>
  deletedAt == null ? null : deletedAt + TRASH_RETENTION_MS;
export const protectedAdmin = (env: Env, policy: Policy, id: string) =>
  env.ADMIN_GOOGLE_SUBS.split(",").includes(id) || policy.admin_sub === id;

// Called only after the shared admin, CSRF and write-rate-limit middleware.
export async function trashAction(
  c: Context<App>,
  action: string,
  subject: string,
) {
  const now = Date.now();
  const cutoff = now - TRASH_RETENTION_MS;
  const account = action.endsWith("_user");
  const restore = action.startsWith("restore_");
  if (account && protectedAdmin(c.env, c.get("policy"), subject))
    return c.json({ error: "Không thể xóa tài khoản quản trị." }, 409);

  let update: D1PreparedStatement;
  if (account) {
    update = restore
      ? c.env.DB.prepare(
          "UPDATE users SET deleted_at=NULL WHERE id=? AND deleted_at>?",
        ).bind(subject, cutoff)
      : c.env.DB.prepare(
          "UPDATE users SET deleted_at=? WHERE id=? AND deleted_at IS NULL AND id IS NOT (SELECT admin_sub FROM policy WHERE id=1)",
        ).bind(now, subject);
  } else {
    update = restore
      ? c.env.DB.prepare(
          `UPDATE links SET status=deletion_previous_status,deleted_at=NULL,
            deletion_previous_status=NULL,deletion_user_id=NULL
          WHERE slug=? AND deleted_at>? AND deletion_previous_status IS NOT NULL
            AND NOT EXISTS(SELECT 1 FROM users WHERE id=links.owner_id AND deleted_at IS NOT NULL)`,
        ).bind(subject, cutoff)
      : c.env.DB.prepare(
          `UPDATE links SET deletion_previous_status=status,status='deleted',deleted_at=?,deletion_user_id=NULL
          WHERE slug=? AND status<>'deleted' AND deleted_at IS NULL
            AND NOT EXISTS(SELECT 1 FROM users WHERE id=links.owner_id AND deleted_at IS NOT NULL)`,
        ).bind(now, subject);
  }
  const [result] = await c.env.DB.batch([
    update,
    c.env.DB.prepare(
      "INSERT INTO admin_audit(actor,action,subject,created_at) SELECT ?,?,?,? WHERE changes()>0",
    ).bind(c.get("user")!.id, action, subject, now),
  ]);
  if (!result.meta.changes)
    return c.json(
      {
        error: restore
          ? "Không thể hoàn tác: dữ liệu không còn trong thời hạn 30 ngày hoặc tài khoản chủ link đang ở thùng rác. Hãy tải lại danh sách."
          : "Không thể xóa: dữ liệu không còn tồn tại hoặc đã ở thùng rác. Hãy tải lại danh sách.",
      },
      409,
    );
  return c.json({
    ok: true,
    restore_until: restore ? null : now + TRASH_RETENTION_MS,
  });
}

// Bounded cron cleanup. Every write rechecks the deadline in its transaction,
// so a stale candidate cannot erase an item restored by another request.
export async function purgeTrash(env: Env, now = Date.now()) {
  const cutoff = now - TRASH_RETENTION_MS;
  const due = await env.DB.prepare(
    "SELECT slug FROM links WHERE deleted_at<=? ORDER BY deleted_at LIMIT 50",
  )
    .bind(cutoff)
    .all<{ slug: string }>();
  for (const { slug } of due.results) {
    await env.DB.batch([
      env.DB.prepare(
        "DELETE FROM analytics WHERE slug IN (SELECT slug FROM links WHERE slug=? AND deleted_at<=?)",
      ).bind(slug, cutoff),
      env.DB.prepare(
        `UPDATE links SET status='deleted',owner_id=NULL,target=NULL,host=NULL,label=NULL,creator_key=NULL,
          deleted_at=NULL,deletion_previous_status=NULL,deletion_user_id=NULL
        WHERE slug=? AND deleted_at<=?`,
      ).bind(slug, cutoff),
    ]);
  }
  // A large account may need several runs; never orphan links or delete early.
  await env.DB.batch([
    env.DB.prepare(
      "DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE deleted_at<=?)",
    ).bind(cutoff),
    env.DB.prepare(
      `DELETE FROM users WHERE id IN (SELECT id FROM users u WHERE deleted_at<=?
        AND NOT EXISTS(SELECT 1 FROM links WHERE owner_id=u.id) LIMIT 50)`,
    ).bind(cutoff),
  ]);
}
