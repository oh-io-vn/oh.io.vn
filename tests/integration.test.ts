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
  it("tài khoản chỉ sửa/xóa link của chính mình và mã không thay đổi", async () => {
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
          slug: "another-slug",
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
