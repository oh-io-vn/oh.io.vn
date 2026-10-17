import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { deleteCookie, getCookie } from "hono/cookie";
import { auth } from "./auth";
import {
  checkWrite,
  csrf,
  currentUser,
  hash,
  networkKey,
  randomSlug,
  readBody,
  sessionName,
  verifyTurnstile,
} from "./security";
import {
  blocked,
  expiryHeld,
  incidentHold,
  maintenance,
  policy,
  publicLink,
  tombstone,
} from "./service";
export { ExpiryGuard } from "./guard";
import {
  addMonths,
  deviceGroup,
  fixedExpiry,
  knownBot,
  slugValue,
  sourceGroup,
  targetValue,
  vietnamDay,
} from "../shared/rules";
import type { App, Env, Link } from "./types";
const app = new Hono<App>();
app.use("*", async (c, next) => {
  await next();
  c.header("Cache-Control", "no-store");
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("X-Frame-Options", "DENY");
  c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (c.req.path.startsWith("/api") || c.req.path.startsWith("/auth"))
    c.header("X-Robots-Tag", "noindex, nofollow");
});
app.onError((error, c) => {
  if (error instanceof HTTPException)
    return c.json({ error: error.message }, error.status);
  console.error("request_failed", { category: error.name });
  return c.json({ error: "Dịch vụ đang bận. Vui lòng thử lại sau." }, 503);
});
app.route("/auth", auth);
app.use("/api/*", async (c, next) => {
  if (
    c.req.path === "/api/internal/backup" ||
    c.req.path === "/api/internal/backup-complete"
  ) {
    await next();
    return;
  }
  const user = await currentUser(c);
  c.set("user", user);
  const p = await policy(c.env);
  if (!p) throw new Error("Missing service policy");
  c.set("policy", p);
  c.set(
    "admin",
    !!user &&
      !user.blocked &&
      (c.env.ADMIN_GOOGLE_SUBS.split(",").includes(user.id) ||
        p?.admin_sub === user.id),
  );
  if (!["GET", "HEAD"].includes(c.req.method)) {
    if (!(await checkWrite(c)))
      return c.json({ error: "Yêu cầu không hợp lệ. Hãy tải lại trang." }, 403);
    if (user?.blocked && c.req.path !== "/api/logout")
      return c.json(
        { error: "Tài khoản đã bị khóa. Liên hệ hi@oh.io.vn." },
        403,
      );
    const result = await c.env.BURST.limit({ key: await networkKey(c) });
    if (!result.success)
      return c.json(
        { error: "Bạn đang thao tác quá nhanh. Thử lại sau một phút." },
        429,
      );
  }
  await next();
});
app.get("/api/config", async (c) => {
  const p = c.get("policy"),
    now = Date.now();
  return c.json({
    siteKey: c.env.TURNSTILE_SITE_KEY,
    loginEnabled: !!c.env.GOOGLE_CLIENT_ID,
    createEnabled:
      !!p.create_enabled &&
      p.automatic_level < 90 &&
      p.metrics_at > now - 7200000 &&
      p.last_backup_at > now - 129600000,
    guestEnabled: !!p.guest_enabled && p.automatic_level < 80,
    analyticsEnabled: !!p.analytics_enabled && p.automatic_level < 80,
    guestLimit: p.guest_limit,
    userLimit: p.user_limit,
    activeLimit: p.active_limit,
  });
});
app.get("/api/me", async (c) => {
  const u = c.get("user");
  return c.json({
    user: u ? { name: u.name, email: u.email, blocked: !!u.blocked } : null,
    admin: c.get("admin"),
    csrf: await csrf(c),
  });
});
app.post("/api/logout", async (c) => {
  const token = getCookie(c, sessionName(c.env));
  if (token)
    await c.env.DB.prepare("DELETE FROM sessions WHERE hash=?")
      .bind(await hash(token))
      .run();
  deleteCookie(c, sessionName(c.env), {
    path: "/",
    secure: c.env.ENVIRONMENT === "production",
    httpOnly: true,
    sameSite: "Lax",
  });
  return c.json({ ok: true });
});
app.post("/api/links", async (c) => {
  const body = await readBody(c),
    user = c.get("user");
  let target: URL, slug: string | undefined, fixed: number | null;
  try {
    target = targetValue(body.target, c.env.APP_ORIGIN);
    slug = body.slug ? slugValue(body.slug) : undefined;
    fixed = fixedExpiry(body.fixed_expires_at, Date.now());
    if (!user && (slug || body.label || fixed))
      throw new Error("Đăng nhập Google để tùy chỉnh link.");
  } catch (e) {
    return c.json({ error: (e as Error).message }, 400);
  }
  if (await blocked(c.env, target))
    return c.json(
      { error: "Địa chỉ này đã bị chặn do vi phạm quy định." },
      400,
    );
  if (!(await verifyTurnstile(c, body.turnstile)))
    return c.json(
      { error: "Xác minh chưa thành công. Vui lòng thử lại." },
      400,
    );
  const actor = await networkKey(c);
  const now = Date.now(),
    months = user ? 12 : 3;
  for (let attempt = 0; attempt < 4; attempt++) {
    const code = slug ?? randomSlug();
    try {
      await c.env.DB.prepare(
        "INSERT INTO links(slug,owner_id,target,host,label,created_at,last_access_at,idle_expires_at,fixed_expires_at,months,creator_key) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
      )
        .bind(
          code,
          user?.id ?? null,
          target.toString(),
          target.hostname,
          typeof body.label === "string"
            ? body.label.trim().slice(0, 120)
            : null,
          now,
          now,
          addMonths(now, months),
          fixed,
          months,
          user ? null : actor,
        )
        .run();
      return c.json(
        {
          slug: code,
          url: c.env.APP_ORIGIN + "/" + code,
          expires_at: Math.min(addMonths(now, months), fixed ?? Infinity),
          months,
        },
        201,
      );
    } catch (e) {
      const message = String((e as Error).cause ?? e);
      if (message.includes("UNIQUE")) {
        if (slug)
          return c.json(
            { error: "Mã này đã được sử dụng. Hãy chọn mã khác." },
            409,
          );
        continue;
      }
      if (message.includes("quota:")) {
        const reason = message.match(/quota:([a-z_]+)/)?.[1];
        const messages: Record<string, string> = {
          paused: "Tạm ngừng tạo link mới để bảo vệ tài nguyên.",
          guest_paused:
            "Tạm ngừng tạo link khách. Bạn có thể đăng nhập để thử lại.",
          global:
            "Đã hết hạn mức tạo link của toàn dịch vụ trong 24 giờ. Vui lòng quay lại sau.",
          actor:
            "Bạn đã hết hạn mức tạo link trong 24 giờ. Hạn mức khôi phục dần sau 24 giờ kể từ mỗi lần tạo.",
          active: "Bạn đã đạt giới hạn link đang hoạt động.",
          blocked: "Tài khoản đã bị khóa.",
        };
        c.header("Retry-After", "3600");
        return c.json(
          { error: messages[reason ?? ""] ?? "Đã đạt giới hạn sử dụng." },
          429,
        );
      }
      throw e;
    }
  }
  return c.json({ error: "Chưa tạo được mã. Vui lòng thử lại." }, 503);
});
app.get("/api/links", async (c) => {
  const user = c.get("user");
  if (!user || user.blocked)
    return c.json({ error: "Vui lòng đăng nhập." }, 401);
  const search = (c.req.query("q") ?? "").slice(0, 120),
    cursor = (c.req.query("cursor") ?? "").split(":"),
    cursorTime = Number(cursor[0]) || Date.now() + 1,
    cursorSlug = cursor[1] ?? "";
  const rows = await c.env.DB.prepare(
    "SELECT * FROM links WHERE owner_id=? AND (created_at<? OR (created_at=? AND slug>?)) AND (?='' OR instr(slug,?)>0 OR instr(COALESCE(label,''),?)>0 OR instr(COALESCE(target,''),?)>0) ORDER BY created_at DESC,slug LIMIT 51",
  )
    .bind(
      user.id,
      cursorTime,
      cursorTime,
      cursorSlug,
      search,
      search,
      search,
      search,
    )
    .all<Link>();
  return c.json({
    links: rows.results.slice(0, 50).map(publicLink),
    next:
      rows.results.length > 50
        ? `${rows.results[49].created_at}:${rows.results[49].slug}`
        : null,
    expiryHeld: expiryHeld(c.get("policy"), Date.now()),
  });
});
app.use("/api/links/:slug/*", async (c, next) => {
  const u = c.get("user");
  if (!u || u.blocked) return c.json({ error: "Vui lòng đăng nhập." }, 401);
  const l = await c.env.DB.prepare(
    "SELECT * FROM links WHERE slug=? AND owner_id=?",
  )
    .bind(c.req.param("slug"), u.id)
    .first<Link>();
  if (!l) return c.json({ error: "Không tìm thấy link." }, 404);
  await next();
});
app.patch("/api/links/:slug/edit", async (c) => {
  const l = (await c.env.DB.prepare(
    "SELECT * FROM links WHERE slug=? AND owner_id=?",
  )
    .bind(c.req.param("slug"), c.get("user")!.id)
    .first<Link>())!;
  const p = c.get("policy"),
    now = Date.now();
  if (
    l.status !== "active" ||
    (l.fixed_expires_at !== null && l.fixed_expires_at <= now) ||
    (!expiryHeld(p, now) && l.idle_expires_at <= now)
  )
    return c.json({ error: "Link đã ngừng hoạt động, không thể sửa." }, 409);
  const b = await readBody(c);
  try {
    const target = targetValue(b.target, c.env.APP_ORIGIN);
    if (await blocked(c.env, target)) throw new Error("Địa chỉ đã bị chặn.");
    const fixed = fixedExpiry(b.fixed_expires_at, now);
    await c.env.DB.prepare(
      "UPDATE links SET target=?,host=?,label=?,fixed_expires_at=? WHERE slug=? AND owner_id=? AND status='active'",
    )
      .bind(
        target.toString(),
        target.hostname,
        typeof b.label === "string" ? b.label.trim().slice(0, 120) : null,
        fixed,
        l.slug,
        c.get("user")!.id,
      )
      .run();
    return c.json({ ok: true });
  } catch (e) {
    return c.json({ error: (e as Error).message }, 400);
  }
});
app.delete("/api/links/:slug/delete", async (c) => {
  await tombstone(c.env, c.req.param("slug"));
  return c.json({ ok: true });
});
app.get("/api/links/:slug/stats", async (c) => {
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
    gaps: gaps.results,
    since,
    enabled: !!c.get("policy").analytics_enabled,
  });
});
app.use("/api/admin/*", async (c, next) => {
  if (!c.get("admin"))
    return c.json({ error: "Không có quyền quản trị." }, 403);
  await next();
});
app.get("/api/admin/overview", async (c) => {
  const [p, counts, audit] = await Promise.all([
    Promise.resolve(c.get("policy")),
    c.env.DB.prepare(
      "SELECT status,count(*) AS count FROM links GROUP BY status",
    ).all(),
    c.env.DB.prepare(
      "SELECT action,subject,created_at FROM admin_audit ORDER BY id DESC LIMIT 30",
    ).all(),
  ]);
  return c.json({ policy: p, links: counts.results, audit: audit.results });
});
app.get("/api/admin/search", async (c) => {
  const q = (c.req.query("q") ?? "").slice(0, 254);
  if (!q) return c.json({ links: [], users: [] });
  const links = await c.env.DB.prepare(
    "SELECT * FROM links WHERE slug=? OR owner_id IN (SELECT id FROM users WHERE email=?) LIMIT 100",
  )
    .bind(q, q)
    .all();
  const users = await c.env.DB.prepare(
    "SELECT id,email,name,blocked FROM users WHERE email=? OR id=? LIMIT 1",
  )
    .bind(q, q)
    .all();
  return c.json({ links: links.results, users: users.results });
});
app.get("/api/admin/blocklist", async (c) =>
  c.json(
    (
      await c.env.DB.prepare(
        "SELECT kind,value FROM blocked_targets LIMIT 500",
      ).all()
    ).results,
  ),
);
app.post("/api/admin/action", async (c) => {
  const b = await readBody(c),
    now = Date.now();
  const action = String(b.action),
    subject = String(b.subject ?? "").slice(0, 4096);
  if (action === "block_link")
    await c.env.DB.prepare(
      "UPDATE links SET status='blocked' WHERE slug=? AND status='active'",
    )
      .bind(subject)
      .run();
  else if (action === "block_user")
    await c.env.DB.batch([
      c.env.DB.prepare("UPDATE users SET blocked=? WHERE id=?").bind(
        b.blocked === false ? 0 : 1,
        subject,
      ),
      c.env.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(subject),
    ]);
  else if (action === "block_user_links")
    await c.env.DB.prepare(
      "UPDATE links SET status='blocked' WHERE owner_id=? AND status='active'",
    )
      .bind(subject)
      .run();
  else if (action === "add_block" || action === "remove_block") {
    const kind = b.kind === "url" ? "url" : "host";
    let value = subject;
    try {
      if (kind === "url")
        value = targetValue(value, c.env.APP_ORIGIN).toString();
      else {
        const url = targetValue("https://" + value, c.env.APP_ORIGIN);
        if (url.pathname !== "/" || url.search || url.port) throw new Error();
        value = url.hostname;
      }
    } catch {
      return c.json({ error: "Địa chỉ chặn không hợp lệ." }, 400);
    }
    await c.env.DB.prepare(
      action === "add_block"
        ? "INSERT OR IGNORE INTO blocked_targets(kind,value) VALUES(?,?)"
        : "DELETE FROM blocked_targets WHERE kind=? AND value=?",
    )
      .bind(kind, value)
      .run();
  } else if (action === "policy") {
    const old = c.get("policy");
    const fields = [
      "create_enabled",
      "guest_enabled",
      "analytics_enabled",
      "expiry_hold",
      "guest_limit",
      "user_limit",
      "active_limit",
      "global_limit",
    ] as const;
    const values = fields.map((f) =>
      b[f] === undefined ? old[f] : Number(b[f]),
    );
    if (
      values.some(
        (v, i) => !Number.isInteger(v) || v < 0 || v > (i < 4 ? 1 : 10000),
      )
    )
      return c.json({ error: "Cấu hình không hợp lệ." }, 400);
    // Clearing an incident gives every still-active link a fresh full inactivity window.
    // This intentionally favors preservation when exact access data was lost.
    if (old.expiry_hold && !values[3]) {
      const rows = await c.env.DB.prepare(
        "SELECT slug,months FROM links WHERE status='active'",
      ).all<{ slug: string; months: number }>();
      for (let i = 0; i < rows.results.length; i += 100)
        await c.env.DB.batch(
          rows.results
            .slice(i, i + 100)
            .map((l) =>
              c.env.DB.prepare(
                "UPDATE links SET idle_expires_at=MAX(idle_expires_at,?) WHERE slug=?",
              ).bind(addMonths(now, l.months), l.slug),
            ),
        );
      await incidentHold(c.env, "clear");
    }
    await c.env.DB.prepare(
      `UPDATE policy SET ${fields.map((f) => f + "=?").join(",")},updated_at=? WHERE id=1`,
    )
      .bind(...values, now)
      .run();
    if (old.analytics_enabled !== values[2])
      await c.env.DB.prepare(
        values[2]
          ? "UPDATE analytics_gaps SET ended_at=? WHERE ended_at IS NULL"
          : "INSERT INTO analytics_gaps(started_at,reason) VALUES(?,'Thống kê tạm dừng để bảo vệ tài nguyên')",
      )
        .bind(now)
        .run();
  } else return c.json({ error: "Thao tác không hợp lệ." }, 400);
  await c.env.DB.prepare(
    "INSERT INTO admin_audit(actor,action,subject,created_at) VALUES(?,?,?,?)",
  )
    .bind(
      c.get("user")!.id,
      action,
      action === "policy" ? "settings" : subject,
      now,
    )
    .run();
  return c.json({ ok: true });
});
app.post("/api/internal/backup-complete", async (c) => {
  const token = c.req.header("Authorization")?.replace(/^Bearer /, "");
  if (
    !c.env.BACKUP_TOKEN ||
    !token ||
    (await hash(token)) !== (await hash(c.env.BACKUP_TOKEN))
  )
    return c.json({ error: "Unauthorized" }, 401);
  await c.env.DB.prepare("UPDATE policy SET last_backup_at=? WHERE id=1")
    .bind(Date.now())
    .run();
  return c.json({ ok: true });
});
app.get("/api/internal/backup", async (c) => {
  const token = c.req.header("Authorization")?.replace(/^Bearer /, "");
  if (
    !c.env.BACKUP_TOKEN ||
    !token ||
    (await hash(token)) !== (await hash(c.env.BACKUP_TOKEN))
  )
    return c.json({ error: "Unauthorized" }, 401);
  const allowed = ["users", "links", "blocked_targets", "policy"] as const;
  // D1 batch executes in one transaction: related tables share the same snapshot.
  const batches = await c.env.DB.batch<Record<string, unknown>>(
    allowed.map((t) => c.env.DB.prepare(`SELECT * FROM ${t} LIMIT 2001`)),
  );
  if (batches.some((b) => b.results.length > 2000))
    return c.json(
      {
        error:
          "Backup pilot row cap reached; increase storage budget before opening creates.",
      },
      507,
    );
  const tables = Object.fromEntries(
    allowed.map((t, i) => [
      t,
      batches[i].results.map((r) =>
        t === "links" ? { ...r, creator_key: null } : r,
      ),
    ]),
  );
  const result = JSON.stringify({ version: 1, created_at: Date.now(), tables });
  if (new TextEncoder().encode(result).length > 2 * 1024 * 1024)
    return c.json(
      {
        error:
          "Backup pilot byte cap reached; increase storage budget before opening creates.",
      },
      507,
    );
  return c.body(result, 200, { "Content-Type": "application/json" });
});
app.get("/api/*", (c) => c.json({ error: "Không tìm thấy chức năng." }, 404));
app.all("/:slug", async (c) => {
  if (!["GET", "HEAD"].includes(c.req.method))
    return c.text("Phương thức không hỗ trợ.", 405);
  const slug = c.req.param("slug");
  if (!/^[a-z0-9_-]{3,64}$/.test(slug))
    return c.text("Không tìm thấy link.", 404);
  const l = await c.env.DB.prepare("SELECT * FROM links WHERE slug=?")
    .bind(slug)
    .first<Link>();
  if (!l || l.status !== "active" || !l.target)
    return c.text(
      "Link không tồn tại hoặc đã ngừng hoạt động. Về trang chủ: https://oh.io.vn",
      404,
    );
  const now = Date.now(),
    p = (await policy(c.env))!;
  if (
    (l.fixed_expires_at !== null && l.fixed_expires_at <= now) ||
    (!expiryHeld(p, now) &&
      l.idle_expires_at <= now &&
      !(await incidentHold(c.env)))
  )
    return c.text("Link đã hết hạn. Về trang chủ: https://oh.io.vn", 410);
  if (await blocked(c.env, new URL(l.target)))
    return c.text("Link đã bị vô hiệu hóa do vi phạm quy định.", 403);
  const ua = c.req.header("User-Agent") ?? "";
  if (c.req.method === "GET" && !knownBot(ua)) {
    try {
      await c.env.DB.prepare(
        "UPDATE links SET last_access_at=?,idle_expires_at=MAX(idle_expires_at,?) WHERE slug=? AND last_access_at<=? AND status='active'",
      )
        .bind(now, addMonths(now, l.months), slug, now)
        .run();
    } catch {
      await incidentHold(c.env, "hold");
      await c.env.DB.prepare("UPDATE policy SET expiry_hold=1 WHERE id=1")
        .run()
        .catch(() => {});
      console.error("renewal_write_failed");
    }
    if (l.owner_id && p.analytics_enabled && p.automatic_level < 80)
      c.executionCtx.waitUntil(
        c.env.DB.prepare(
          "INSERT INTO analytics(slug,day,source,device) VALUES(?,?,?,?) ON CONFLICT(slug,day,source,device) DO UPDATE SET clicks=clicks+1",
        )
          .bind(
            slug,
            vietnamDay(now),
            sourceGroup(c.req.header("Referer") ?? null),
            deviceGroup(ua),
          )
          .run()
          .catch(async () => {
            console.error("analytics_write_failed");
            await c.env.DB.prepare(
              "INSERT OR IGNORE INTO analytics_gaps(started_at,reason) VALUES(?, 'Sự cố ghi thống kê')",
            )
              .bind(Math.floor(now / 3600000) * 3600000)
              .run()
              .catch(() => {});
          }),
      );
  }
  return c.redirect(l.target, 302);
});
app.notFound((c) => c.text("Không tìm thấy trang.", 404));
export default {
  fetch: app.fetch,
  scheduled: async (
    _event: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ) => ctx.waitUntil(maintenance(env)),
};
