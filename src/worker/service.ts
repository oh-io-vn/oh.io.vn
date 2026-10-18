import type { Env, Policy, Link } from "./types";
import { monitor } from "./monitor";
import { blockTargetValue, canonicalHostname } from "../shared/rules";
export const policy = (env: Env) =>
  env.DB.prepare("SELECT * FROM policy WHERE id=1").first<Policy>();
export const expiryHeld = (p: Policy, now: number) =>
  !!p.expiry_hold || p.heartbeat < now - 7200000;
export async function incidentHold(
  env: Env,
  action?: "hold" | "clear",
): Promise<boolean> {
  try {
    const stub = env.EXPIRY_GUARD.get(env.EXPIRY_GUARD.idFromName("global"));
    const result = await stub.fetch("https://guard/" + (action ?? "state"), {
      method: action ? "POST" : "GET",
    });
    return ((await result.json()) as { hold: boolean }).hold;
  } catch {
    return true;
  } // If the independent guard cannot be read, preserve inactivity-expired links.
}
export async function blocked(env: Env, url: URL): Promise<boolean> {
  const parts = canonicalHostname(url.hostname).split(".");
  const hosts = parts.flatMap((_, i) => {
    const host = parts.slice(i).join(".");
    return [host, host + "."];
  });
  const target = blockTargetValue(url);
  const dottedTarget = new URL(target);
  dottedTarget.hostname += ".";
  // Match older entries that contain a fragment or a DNS root dot as well.
  // Keep path, scheme and query distinctions: they can identify different resources.
  const fragments = (value: string) =>
    value.replaceAll("[", "[[]").replaceAll("?", "[?]").replaceAll("*", "[*]") +
    "#*";
  // Each branch uses the (kind,value) index; do not normalize every stored row
  // on every redirect, which would turn a block check into a table scan.
  const found = await env.DB.prepare(
    `SELECT 1 AS found FROM blocked_targets WHERE kind='host' AND value IN (SELECT value FROM json_each(?))
      UNION ALL SELECT 1 FROM blocked_targets WHERE kind='url' AND value IN (?,?)
      UNION ALL SELECT 1 FROM blocked_targets WHERE kind='url' AND value GLOB ?
      UNION ALL SELECT 1 FROM blocked_targets WHERE kind='url' AND value GLOB ? LIMIT 1`,
  )
    .bind(
      JSON.stringify(hosts),
      target,
      dottedTarget.toString(),
      fragments(target),
      fragments(dottedTarget.toString()),
    )
    .first();
  return !!found;
}
export async function tombstone(env: Env, slug: string, status = "deleted") {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM analytics WHERE slug=?").bind(slug),
    env.DB.prepare(
      "UPDATE links SET status=?,owner_id=NULL,target=NULL,host=NULL,label=NULL,creator_key=NULL WHERE slug=?",
    ).bind(status, slug),
  ]);
}
export const publicLink = (l: Link) => ({
  ...l,
  expires_at: Math.min(l.idle_expires_at, l.fixed_expires_at ?? Infinity),
});
export async function maintenance(env: Env) {
  const now = Date.now();
  const p = await policy(env);
  if (!p) return;
  await monitor(env).catch(() => console.error("metrics_refresh_failed"));
  // A stale heartbeat latches the hold. Recovery needs an explicit admin decision.
  const incident = await incidentHold(env);
  if (p.heartbeat < now - 7200000 || incident)
    await env.DB.prepare("UPDATE policy SET expiry_hold=1 WHERE id=1").run();
  await env.DB.batch([
    env.DB.prepare(
      "DELETE FROM sessions WHERE hash IN (SELECT hash FROM sessions WHERE expires_at<? LIMIT 500)",
    ).bind(now),
    env.DB.prepare(
      "DELETE FROM creation_events WHERE rowid IN (SELECT rowid FROM creation_events WHERE created_at<=? LIMIT 1000)",
    ).bind(now - 86400000),
    env.DB.prepare(
      "UPDATE links SET creator_key=NULL WHERE slug IN (SELECT slug FROM links WHERE creator_key IS NOT NULL AND created_at<=? LIMIT 500)",
    ).bind(now - 86400000),
    env.DB.prepare(
      "DELETE FROM analytics WHERE rowid IN (SELECT rowid FROM analytics WHERE day<? LIMIT 100)",
    ).bind(
      new Date(now - 29 * 86400000 + 7 * 3600000).toISOString().slice(0, 10),
    ),
    env.DB.prepare(
      "DELETE FROM analytics_gaps WHERE ended_at IS NOT NULL AND ended_at<?",
    ).bind(now - 30 * 86400000),
    env.DB.prepare(
      "DELETE FROM admin_audit WHERE id IN (SELECT id FROM admin_audit WHERE created_at<? LIMIT 500)",
    ).bind(now - 7 * 86400000),
  ]);
  const expired = await env.DB.prepare(
    "SELECT slug FROM links WHERE status='active' AND (fixed_expires_at<=? OR (?=0 AND idle_expires_at<=?)) LIMIT 10",
  )
    .bind(now, expiryHeld(p, now) || incident ? 1 : 0, now)
    .all<{ slug: string }>();
  for (const l of expired.results) await tombstone(env, l.slug, "expired");
  // Do not clear the hold merely because writes work again.
  await env.DB.batch([
    env.DB.prepare("UPDATE policy SET heartbeat=? WHERE id=1").bind(now),
    env.DB.prepare(
      "UPDATE analytics_gaps SET ended_at=? WHERE ended_at IS NULL AND reason='Sự cố ghi thống kê'",
    ).bind(now),
  ]);
}
