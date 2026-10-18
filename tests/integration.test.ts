import {
  env,
  SELF,
  createExecutionContext,
  waitOnExecutionContext,
} from "cloudflare:test";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { addMonths } from "../src/shared/rules";
import { hash } from "../src/worker/security";
import { maintenance, incidentHold } from "../src/worker/service";
import worker from "../src/worker/index";
const now = Date.now();
async function insert(slug: string, owner: string | null = "u1", time = now) {
  return env.DB.prepare(
    "INSERT INTO links(slug,owner_id,target,host,created_at,last_access_at,idle_expires_at,months,creator_key) VALUES(?,?,?,?,?,?,?,?,?)",
  )
    .bind(
      slug,
      owner,
      "https://example.com/page",
      "example.com",
      time,
      time,
      addMonths(time, owner ? 12 : 3),
      owner ? 12 : 3,
      owner ? null : "network",
    )
    .run();
}
beforeEach(async () => {
  await incidentHold(env, "clear");
  await env.DB.batch([
    env.DB.prepare("DELETE FROM analytics"),
    env.DB.prepare("DELETE FROM links"),
    env.DB.prepare("DELETE FROM creation_events"),
    env.DB.prepare("DELETE FROM sessions"),
    env.DB.prepare("DELETE FROM users"),
    env.DB.prepare("DELETE FROM blocked_targets"),
    env.DB.prepare("DELETE FROM analytics_gaps"),
    env.DB.prepare(
      "UPDATE policy SET automatic_level=0,metrics_at=?,last_backup_at=?,heartbeat=?,global_limit=200,guest_limit=3,user_limit=20,active_limit=100,expiry_hold=0,create_enabled=1,guest_enabled=1,analytics_enabled=1",
    ).bind(Date.now(), Date.now(), Date.now()),
  ]);
  await env.DB.prepare(
    "INSERT INTO users(id,email,name,created_at) VALUES(?,?,?,?)",
  )
    .bind("u1", "one@example.com", "Một", now)
    .run();
});
afterEach(() => vi.restoreAllMocks());
describe("D1 và đường chuyển hướng thật", () => {
  it("không index link người dùng và lỗi, vẫn giữ chuyển hướng và quyền API", async () => {
    await insert("seo-private-link");
    for (const [path, status] of [
      ["/seo-private-link", 302],
      ["/seo-does-not-exist", 404],
      ["/api/links", 401],
      ["/api/admin/links", 403],
    ] as const) {
      const response = await SELF.fetch("http://localhost" + path, {
        method: "HEAD",
        redirect: "manual",
      });
      expect(response.status).toBe(status);
      expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      if (status === 302)
        expect(response.headers.get("Location")).toBe(
          "https://example.com/page",
        );
    }
  });
  it("thống kê báo tạm dừng khi hệ thống tự giảm tải dù công tắc thủ công vẫn bật", async () => {
    await insert("quota-stats");
    const token = "e".repeat(64);
    await env.DB.prepare(
      "INSERT INTO sessions(hash,user_id,expires_at) VALUES(?,?,?)",
    )
      .bind(await hash(token), "u1", Date.now() + 86400000)
      .run();
    await env.DB.prepare(
      "UPDATE policy SET automatic_level=80,analytics_enabled=1 WHERE id=1",
    ).run();
    const response = await SELF.fetch(
      "http://localhost/api/links/quota-stats/stats",
      { headers: { Cookie: "oh_session=" + token } },
    );
    expect(response.status).toBe(200);
    expect(((await response.json()) as { enabled: boolean }).enabled).toBe(
      false,
    );
  });
  it("đăng xuất production thu hồi phiên và xóa cookie __Host với Secure", async () => {
    const token = "d".repeat(64);
    await env.DB.prepare(
      "INSERT INTO sessions(hash,user_id,expires_at) VALUES(?,?,?)",
    )
      .bind(await hash(token), "u1", Date.now() + 86400000)
      .run();
    const production = {
      ...env,
      ENVIRONMENT: "production",
      APP_ORIGIN: "https://oh.io.vn",
    };
    const cookie = { Cookie: "__Host-oh_session=" + token };
    const identity = await worker.fetch(
      new Request("https://oh.io.vn/api/me", { headers: cookie }),
      production,
      createExecutionContext(),
    );
    const { csrf } = (await identity.json()) as { csrf: string };
    const result = await worker.fetch(
      new Request("https://oh.io.vn/api/logout", {
        method: "POST",
        headers: {
          ...cookie,
          Origin: "https://oh.io.vn",
          "Content-Type": "application/json",
          "X-CSRF-Token": csrf,
        },
        body: "{}",
      }),
      production,
      createExecutionContext(),
    );
    expect(result.status).toBe(200);
    expect(result.headers.get("Set-Cookie")).toContain("__Host-oh_session=;");
    expect(result.headers.get("Set-Cookie")).toContain("Secure");
    expect(result.headers.get("Set-Cookie")).toContain("Max-Age=0");
    expect(
      await env.DB.prepare("SELECT hash FROM sessions WHERE hash=?")
        .bind(await hash(token))
        .first(),
    ).toBeNull();
  });
  it("API tạo khách kiểm tra Turnstile rồi ghi link với hạn 3 tháng", async () => {
    const actualFetch = globalThis.fetch;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) =>
      String(input).includes(
        "challenges.cloudflare.com/turnstile/v0/siteverify",
      )
        ? Response.json({
            success: true,
            hostname: "localhost",
            action: "create",
          })
        : actualFetch(input, init),
    );
    const result = await SELF.fetch("http://localhost/api/links", {
      method: "POST",
      headers: {
        Origin: "http://localhost:8787",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        target: "https://example.com/api-test",
        turnstile: "test-token",
      }),
    });
    expect(result.status).toBe(201);
    const body = (await result.json()) as { slug: string; months: number };
    expect(body.months).toBe(3);
    expect(body.slug).toHaveLength(8);
    expect(
      (
        await SELF.fetch("http://localhost/" + body.slug, {
          redirect: "manual",
        })
      ).headers.get("Location"),
    ).toBe("https://example.com/api-test");
  });
  it("production tạo link khách từ token hợp lệ và từ chối token dùng lại", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        Response.json({
          success: true,
          hostname: "oh.io.vn",
          action: "create",
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          success: false,
          "error-codes": ["timeout-or-duplicate"],
        }),
      );
    const production = {
      ...env,
      ENVIRONMENT: "production",
      APP_ORIGIN: "https://oh.io.vn",
      TURNSTILE_SECRET_KEY: "unit-fixture-not-a-provider-secret",
    };
    const request = () =>
      new Request("https://oh.io.vn/api/links", {
        method: "POST",
        headers: {
          Origin: "https://oh.io.vn",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          target: "https://example.com/guest",
          turnstile: "single-use-token",
        }),
      });
    const created = await worker.fetch(
      request(),
      production,
      createExecutionContext(),
    );
    expect(created.status).toBe(201);
    const body = (await created.json()) as { slug: string; months: number };
    expect(body.months).toBe(3);
    expect(
      (await env.DB.prepare("SELECT owner_id FROM links WHERE slug=?")
        .bind(body.slug)
        .first())!.owner_id,
    ).toBeNull();
    expect(
      (await worker.fetch(request(), production, createExecutionContext()))
        .status,
    ).toBe(400);
    expect(
      (await env.DB.prepare("SELECT count(*) AS count FROM links").first<{
        count: number;
      }>())!.count,
    ).toBe(1);
  });
  it.each([
    { success: false, "error-codes": ["timeout-or-duplicate"] },
    { success: true, hostname: "wrong.example", action: "create" },
    { success: true, hostname: "oh.io.vn", action: "wrong-action" },
  ])(
    "production không tạo link khi Turnstile không hợp lệ: %j",
    async (verification) => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        Response.json(verification),
      );
      const result = await worker.fetch(
        new Request("https://oh.io.vn/api/links", {
          method: "POST",
          headers: {
            Origin: "https://oh.io.vn",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            target: "https://example.com/page",
            turnstile: "invalid-token",
          }),
        }),
        {
          ...env,
          ENVIRONMENT: "production",
          APP_ORIGIN: "https://oh.io.vn",
          TURNSTILE_SECRET_KEY: "unit-fixture-not-a-provider-secret",
        },
        createExecutionContext(),
      );
      expect(result.status).toBe(400);
      expect(
        (await env.DB.prepare("SELECT count(*) AS count FROM links").first<{
          count: number;
        }>())!.count,
      ).toBe(0);
    },
  );
  it.each(["network", "http", "malformed", "provider"])(
    "lỗi dịch vụ Turnstile trả 503, không tạo link: %s",
    async (kind) => {
      const remote = vi.spyOn(globalThis, "fetch");
      if (kind === "network")
        remote.mockRejectedValue(new Error("connection failed"));
      else if (kind === "http")
        remote.mockResolvedValue(new Response("unavailable", { status: 503 }));
      else if (kind === "malformed")
        remote.mockResolvedValue(Response.json({}));
      else
        remote.mockResolvedValue(
          Response.json({ success: false, "error-codes": ["internal-error"] }),
        );
      const result = await worker.fetch(
        new Request("https://oh.io.vn/api/links", {
          method: "POST",
          headers: {
            Origin: "https://oh.io.vn",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            target: "https://example.com/page",
            turnstile: "unused-token",
          }),
        }),
        {
          ...env,
          ENVIRONMENT: "production",
          APP_ORIGIN: "https://oh.io.vn",
          TURNSTILE_SECRET_KEY: "unit-fixture-not-a-provider-secret",
        },
        createExecutionContext(),
      );
      expect(result.status).toBe(503);
      expect(((await result.json()) as { error: string }).error).toContain(
        "Dịch vụ xác minh",
      );
      expect(
        (await env.DB.prepare("SELECT count(*) AS count FROM links").first<{
          count: number;
        }>())!.count,
      ).toBe(0);
    },
  );
  it("sửa thông tin không đổi mã khi API không gửi mã mới", async () => {
    await insert("owner-link");
    const token = "b".repeat(64);
    await env.DB.prepare(
      "INSERT INTO sessions(hash,user_id,expires_at) VALUES(?,?,?)",
    )
      .bind(await hash(token), "u1", Date.now() + 86400000)
      .run();
    const cookie = { Cookie: "oh_session=" + token };
    const identity = (await (
      await SELF.fetch("http://localhost/api/me", { headers: cookie })
    ).json()) as { csrf: string };
    const headers = {
      ...cookie,
      Origin: "http://localhost:8787",
      "Content-Type": "application/json",
      "X-CSRF-Token": identity.csrf,
    };
    const edited = await SELF.fetch(
      "http://localhost/api/links/owner-link/edit",
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          target: "https://example.org/updated",
          label: "New label",
        }),
      },
    );
    expect(edited.status).toBe(200);
    expect(
      (
        await SELF.fetch("http://localhost/owner-link", { redirect: "manual" })
      ).headers.get("Location"),
    ).toBe("https://example.org/updated");
    expect(
      (
        await SELF.fetch("http://localhost/api/links/owner-link/delete", {
          method: "DELETE",
          headers,
          body: "{}",
        })
      ).status,
    ).toBe(200);
    expect(
      (await SELF.fetch("http://localhost/owner-link", { redirect: "manual" }))
        .status,
    ).toBe(404);
    await expect(insert("owner-link")).rejects.toThrow();
  });
  it("mất ghi D1 giữ chuyển hướng và chốt sự cố ở kho độc lập", async () => {
    await insert("write-failure");
    const brokenDB = {
      prepare: (sql: string) =>
        sql.startsWith("UPDATE links SET last_access_at")
          ? {
              bind: () => ({
                run: async () => {
                  throw new Error("simulated storage outage");
                },
              }),
            }
          : env.DB.prepare(sql),
    } as D1Database;
    const ctx = createExecutionContext();
    const response = await worker.fetch(
      new Request("http://localhost/write-failure"),
      { ...env, DB: brokenDB },
      ctx,
    );
    await waitOnExecutionContext(ctx);
    expect(response.status).toBe(302);
    expect(await incidentHold(env)).toBe(true);
    await env.DB.prepare(
      "UPDATE links SET idle_expires_at=? WHERE slug='write-failure'",
    )
      .bind(Date.now() - 1)
      .run();
    await env.DB.prepare("UPDATE policy SET expiry_hold=0,heartbeat=?")
      .bind(Date.now())
      .run();
    expect(
      (
        await SELF.fetch("http://localhost/write-failure", {
          method: "HEAD",
          redirect: "manual",
        })
      ).status,
    ).toBe(302);
    await maintenance(env);
    expect(
      (await env.DB.prepare(
        "SELECT status FROM links WHERE slug='write-failure'",
      ).first<{ status: string }>())!.status,
    ).toBe("active");
  });
  it("quota 24 giờ là cửa sổ trượt, không đặt lại lúc nửa đêm", async () => {
    await insert("old-event", null, now - 86400001);
    await insert("current-one", null);
    await insert("current-two", null);
    await insert("current-three", null);
    await expect(insert("over-limit", null)).rejects.toThrow("quota:actor");
  });
  it("tự dừng tạo khi giám sát hoặc sao lưu quá cũ", async () => {
    await env.DB.prepare("UPDATE policy SET metrics_at=0").run();
    await expect(insert("no-metrics")).rejects.toThrow("quota:paused");
    await env.DB.prepare("UPDATE policy SET metrics_at=?,last_backup_at=0")
      .bind(Date.now())
      .run();
    await expect(insert("no-backup")).rejects.toThrow("quota:paused");
  });
  it("giới hạn khách nguyên tử dù tạo đồng thời", async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, (_, i) => insert("guest" + i, null)),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(3);
    expect(
      (await env.DB.prepare("SELECT count(*) AS n FROM links").first<{
        n: number;
      }>())!.n,
    ).toBe(3);
  });
  it("giới hạn toàn dịch vụ chính xác trên nhiều tài khoản", async () => {
    await env.DB.prepare("UPDATE policy SET global_limit=2 WHERE id=1").run();
    const results = await Promise.allSettled([
      insert("alpha"),
      insert("bravo"),
      insert("charlie"),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(2);
  });
  it("mã bị xóa không được tái sử dụng", async () => {
    await insert("never-again");
    await env.DB.prepare(
      "UPDATE links SET target=NULL,status='deleted' WHERE slug='never-again'",
    ).run();
    await expect(insert("never-again")).rejects.toThrow();
  });
  it("GET chuyển thẳng 302 và gia hạn; HEAD không gia hạn", async () => {
    const old = now - 86400000;
    await insert("working", "u1", old);
    const head = await SELF.fetch("http://localhost/working", {
      method: "HEAD",
      redirect: "manual",
    });
    expect(head.status).toBe(302);
    expect(
      (await env.DB.prepare(
        "SELECT last_access_at AS t FROM links WHERE slug='working'",
      ).first<{ t: number }>())!.t,
    ).toBe(old);
    const get = await SELF.fetch("http://localhost/working", {
      headers: { "User-Agent": "Mozilla/5.0 Windows" },
      redirect: "manual",
    });
    expect(get.status).toBe(302);
    expect(get.headers.get("Location")).toBe("https://example.com/page");
    expect(get.headers.get("Cache-Control")).toBe("no-store");
    expect(
      (await env.DB.prepare(
        "SELECT last_access_at AS t FROM links WHERE slug='working'",
      ).first<{ t: number }>())!.t,
    ).toBeGreaterThan(old);
  });
  it("không hồi sinh link hết hạn, hạn cố định vẫn áp dụng khi hoãn", async () => {
    await insert("expired");
    await env.DB.prepare(
      "UPDATE links SET idle_expires_at=? WHERE slug='expired'",
    )
      .bind(now - 1)
      .run();
    expect(
      (await SELF.fetch("http://localhost/expired", { redirect: "manual" }))
        .status,
    ).toBe(410);
    await env.DB.prepare("UPDATE policy SET expiry_hold=1").run();
    expect(
      (
        await SELF.fetch("http://localhost/expired", {
          method: "HEAD",
          redirect: "manual",
        })
      ).status,
    ).toBe(302);
    await env.DB.prepare(
      "UPDATE links SET fixed_expires_at=? WHERE slug='expired'",
    )
      .bind(now - 1)
      .run();
    expect(
      (await SELF.fetch("http://localhost/expired", { redirect: "manual" }))
        .status,
    ).toBe(410);
  });
  it("tắt thống kê vẫn gia hạn", async () => {
    await insert("no-stats", "u1", now - 86400000);
    await env.DB.prepare("UPDATE policy SET analytics_enabled=0").run();
    expect(
      (await SELF.fetch("http://localhost/no-stats", { redirect: "manual" }))
        .status,
    ).toBe(302);
    expect(
      (await env.DB.prepare(
        "SELECT last_access_at AS t FROM links WHERE slug='no-stats'",
      ).first<{ t: number }>())!.t,
    ).toBeGreaterThan(now - 86400000);
    expect(
      (await env.DB.prepare("SELECT count(*) AS n FROM analytics").first<{
        n: number;
      }>())!.n,
    ).toBe(0);
  });
  it("snapshot cũ bảo vệ hết hạn và dọn dữ liệu", async () => {
    await insert("preserved");
    await env.DB.prepare(
      "UPDATE links SET idle_expires_at=? WHERE slug='preserved'",
    )
      .bind(now - 1)
      .run();
    await env.DB.prepare("UPDATE policy SET heartbeat=?")
      .bind(now - 3 * 3600000)
      .run();
    expect(
      (
        await SELF.fetch("http://localhost/preserved", {
          method: "HEAD",
          redirect: "manual",
        })
      ).status,
    ).toBe(302);
    await maintenance(env);
    expect(
      (await env.DB.prepare("SELECT expiry_hold FROM policy").first<{
        expiry_hold: number;
      }>())!.expiry_hold,
    ).toBe(1);
    expect(
      (await env.DB.prepare(
        "SELECT status FROM links WHERE slug='preserved'",
      ).first<{ status: string }>())!.status,
    ).toBe("active");
  });
  it("chặn hostname gồm tên miền con ngay trên redirect", async () => {
    await insert("blocked");
    await env.DB.prepare(
      "INSERT INTO blocked_targets(kind,value) VALUES('host','example.com')",
    ).run();
    expect(
      (await SELF.fetch("http://localhost/blocked", { redirect: "manual" }))
        .status,
    ).toBe(403);
  });
  it("ngăn đọc và xóa link người khác, bắt origin/CSRF", async () => {
    await insert("private");
    const token = "a".repeat(64);
    await env.DB.prepare(
      "INSERT INTO users(id,email,name,created_at) VALUES(?,?,?,?)",
    )
      .bind("u2", "two@example.com", "Hai", now)
      .run();
    await env.DB.prepare(
      "INSERT INTO sessions(hash,user_id,expires_at) VALUES(?,?,?)",
    )
      .bind(await hash(token), "u2", now + 86400000)
      .run();
    const headers = { Cookie: "oh_session=" + token };
    expect(
      (
        await SELF.fetch("http://localhost/api/links/private/stats", {
          headers,
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await SELF.fetch("http://localhost/api/links/private/delete", {
          method: "DELETE",
          headers: {
            ...headers,
            "Content-Type": "application/json",
            Origin: "https://evil.example",
          },
          body: "{}",
        })
      ).status,
    ).toBe(403);
    expect(
      (await SELF.fetch("http://localhost/api/links/private/stats")).status,
    ).toBe(401);
  });
  it("không nhận callback OAuth giả", async () => {
    const result = await SELF.fetch(
      "http://localhost/auth/callback?state=fake&code=fake",
      { redirect: "manual" },
    );
    expect(result.headers.get("Location")).toBe("/?error=login");
  });
});

// Exercise rename against D1, not browser fixtures: analytics, tombstones,
// authorization, collisions and quota accounting must move together.
describe("đổi mã link", () => {
  let requestNetwork = 1;
  async function headers() {
    const token = "a".repeat(64);
    await env.DB.prepare(
      "INSERT OR REPLACE INTO sessions(hash,user_id,expires_at) VALUES(?,?,?)",
    )
      .bind(await hash(token), "u1", Date.now() + 86400000)
      .run();
    const cookie = { Cookie: "oh_session=" + token };
    const identity = (await (
      await SELF.fetch("http://localhost/api/me", { headers: cookie })
    ).json()) as { csrf: string };
    return {
      ...cookie,
      "CF-Connecting-IP": `192.0.2.${requestNetwork++}`,
      Origin: "http://localhost:8787",
      "Content-Type": "application/json",
      "X-CSRF-Token": identity.csrf,
    };
  }
  async function edit(
    from: string,
    slug: string,
    overrides: Record<string, unknown> = {},
  ) {
    return SELF.fetch(`http://localhost/api/links/${from}/edit`, {
      method: "PATCH",
      headers: await headers(),
      body: JSON.stringify({
        slug,
        target: "https://example.org/renamed",
        label: "Tên mới",
        ...overrides,
      }),
    });
  }
  it("giữ thống kê, chủ sở hữu, thời hạn và hạn mức; mã cũ ngừng hoạt động và không cấp lại", async () => {
    await insert("old-code");
    await env.DB.prepare(
      "INSERT INTO analytics VALUES('old-code','2026-10-18','Zalo','Điện thoại',7)",
    ).run();
    const before = await env.DB.prepare(
      "SELECT * FROM links WHERE slug='old-code'",
    ).first();
    const quota = await env.DB.prepare(
      "SELECT count(*) AS n FROM creation_events",
    ).first();
    // Rename works at the creation cap and even with creation paused.
    await env.DB.prepare(
      "UPDATE policy SET create_enabled=0,user_limit=0,active_limit=0,automatic_level=90",
    ).run();
    const result = await edit("old-code", "NEW-code");
    expect(result.status).toBe(200);
    expect(await result.json()).toMatchObject({ slug: "new-code" });
    const current = await env.DB.prepare(
      "SELECT * FROM links WHERE slug='new-code'",
    ).first();
    expect(current).toMatchObject({
      owner_id: before!.owner_id,
      created_at: before!.created_at,
      last_access_at: before!.last_access_at,
      idle_expires_at: before!.idle_expires_at,
      months: 12,
      status: "active",
    });
    expect(
      await env.DB.prepare("SELECT slug,clicks FROM analytics").first(),
    ).toEqual({ slug: "new-code", clicks: 7 });
    expect(
      await env.DB.prepare("SELECT count(*) AS n FROM creation_events").first(),
    ).toEqual(quota);
    expect(
      await env.DB.prepare(
        "SELECT owner_id,target,host,label,status FROM links WHERE slug='old-code'",
      ).first(),
    ).toEqual({
      owner_id: null,
      target: null,
      host: null,
      label: null,
      status: "deleted",
    });
    expect(
      (await SELF.fetch("http://localhost/old-code", { redirect: "manual" }))
        .status,
    ).toBe(404);
    expect(
      (
        await SELF.fetch("http://localhost/new-code", {
          redirect: "manual",
          method: "HEAD",
        })
      ).headers.get("Location"),
    ).toBe("https://example.org/renamed");
    expect((await edit("new-code", "old-code")).status).toBe(409);
    await env.DB.prepare(
      "UPDATE policy SET create_enabled=1,user_limit=20,active_limit=100,automatic_level=0",
    ).run();
    await expect(insert("old-code")).rejects.toThrow();
    expect(
      (
        await SELF.fetch("http://localhost/api/links/new-code/stats", {
          headers: await headers(),
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await SELF.fetch("http://localhost/api/links/old-code/stats", {
          headers: await headers(),
        })
      ).status,
    ).toBe(404);
    const list = (await (
      await SELF.fetch("http://localhost/api/links", {
        headers: await headers(),
      })
    ).json()) as { links: { slug: string }[] };
    expect(list.links.map((l) => l.slug)).toEqual(["new-code"]);
    expect(
      (
        await SELF.fetch("http://localhost/api/links/new-code/delete", {
          method: "DELETE",
          headers: await headers(),
          body: "{}",
        })
      ).status,
    ).toBe(200);
    expect(
      await env.DB.prepare("SELECT count(*) AS n FROM analytics").first(),
    ).toEqual({ n: 0 });
  });
  it.each(["ab", "has space", "địa-chỉ", "admin", "x".repeat(65)])(
    "từ chối mã không hợp lệ %s",
    async (slug) => {
      await insert("original");
      expect((await edit("original", slug)).status).toBe(400);
      expect(
        (await env.DB.prepare(
          "SELECT target FROM links WHERE slug='original'",
        ).first())!.target,
      ).toBe("https://example.com/page");
    },
  );
  it("xung đột mã rollback cả địa chỉ đích và thống kê", async () => {
    await insert("original");
    await insert("taken");
    await env.DB.prepare(
      "INSERT INTO analytics VALUES('original','2026-10-18','Zalo','Máy tính',3)",
    ).run();
    expect((await edit("original", "taken")).status).toBe(409);
    expect(
      (await env.DB.prepare(
        "SELECT target FROM links WHERE slug='original'",
      ).first())!.target,
    ).toBe("https://example.com/page");
    expect(
      await env.DB.prepare("SELECT slug,clicks FROM analytics").first(),
    ).toEqual({ slug: "original", clicks: 3 });
    expect((await edit("original", "ORIGINAL")).status).toBe(200);
  });
  it("không cho khách, tài khoản khác, thiếu CSRF hoặc tài khoản khóa đổi mã", async () => {
    await insert("mine");
    await insert("guest", null);
    expect(
      (
        await SELF.fetch("http://localhost/api/links/mine/edit", {
          method: "PATCH",
          headers: {
            Origin: "http://localhost:8787",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            slug: "changed",
            target: "https://example.org",
          }),
        })
      ).status,
    ).toBe(401);
    expect((await edit("guest", "changed")).status).toBe(404);
    await env.DB.prepare(
      "INSERT INTO users VALUES('u2','two@example.com','Two',0,0)",
    ).run();
    await insert("theirs", "u2");
    expect((await edit("theirs", "changed")).status).toBe(404);
    const h = await headers();
    h["X-CSRF-Token"] = "invalid";
    expect(
      (
        await SELF.fetch("http://localhost/api/links/mine/edit", {
          method: "PATCH",
          headers: h,
          body: JSON.stringify({
            slug: "changed",
            target: "https://example.org",
          }),
        })
      ).status,
    ).toBe(403);
    await env.DB.prepare("UPDATE users SET blocked=1 WHERE id='u1'").run();
    expect((await edit("mine", "changed")).status).toBe(403);
  });
  it.each(["blocked", "expired", "deleted", "idle", "fixed"])(
    "không đổi mã link %s",
    async (state) => {
      await insert("stopped");
      if (state === "idle")
        await env.DB.prepare(
          "UPDATE links SET idle_expires_at=0 WHERE slug='stopped'",
        ).run();
      else if (state === "fixed")
        await env.DB.prepare(
          "UPDATE links SET fixed_expires_at=0 WHERE slug='stopped'",
        ).run();
      else
        await env.DB.prepare("UPDATE links SET status=? WHERE slug='stopped'")
          .bind(state)
          .run();
      expect((await edit("stopped", "changed")).status).toBe(409);
    },
  );
  it("hai yêu cầu cạnh tranh cùng mã mới chỉ một yêu cầu thành công", async () => {
    await insert("first");
    await insert("second");
    const h = await headers();
    const results = await Promise.all(
      ["first", "second"].map((slug) =>
        SELF.fetch(`http://localhost/api/links/${slug}/edit`, {
          method: "PATCH",
          headers: h,
          body: JSON.stringify({
            slug: "winner",
            target: "https://example.org",
          }),
        }),
      ),
    );
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(
      await env.DB.prepare(
        "SELECT count(*) AS n FROM links WHERE owner_id='u1' AND status='active'",
      ).first(),
    ).toEqual({ n: 2 });
    expect(
      await env.DB.prepare("PRAGMA foreign_key_check").all(),
    ).toMatchObject({ results: [] });
  });
});
