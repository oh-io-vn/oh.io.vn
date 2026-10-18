import {
  env,
  createExecutionContext,
  waitOnExecutionContext,
} from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import worker from "../src/worker/index";
import { hash, hmac } from "../src/worker/security";
import { blocked } from "../src/worker/service";
import { targetValue } from "../src/shared/rules";
import type { Env } from "../src/worker/types";

// All requests execute against isolated Miniflare D1 and fake identities.
const origin = "http://localhost:8787";
const tokens = {
  owner: "a".repeat(64),
  other: "b".repeat(64),
  admin: "c".repeat(64),
};
let bindings: Env;
async function request(
  path: string,
  init: RequestInit = {},
  custom = bindings,
) {
  const ctx = createExecutionContext();
  const response = await worker.fetch(
    new Request(origin + path, init),
    custom,
    ctx,
  );
  await waitOnExecutionContext(ctx);
  return response;
}
async function headers(id?: keyof typeof tokens) {
  return {
    Origin: origin,
    "Content-Type": "application/json",
    ...(id
      ? {
          Cookie: `oh_session=${tokens[id]}`,
          "X-CSRF-Token": await hmac(env.HMAC_SECRET, "csrf:" + tokens[id]),
        }
      : {}),
  };
}
async function link(slug = "owned-link", target = "https://example.com/safe") {
  const now = Date.now();
  await env.DB.prepare(
    "INSERT INTO links(slug,owner_id,target,host,created_at,last_access_at,idle_expires_at,months) VALUES(?,?,?,?,?,?,?,12)",
  )
    .bind(
      slug,
      "owner",
      target,
      new URL(target).hostname,
      now,
      now,
      now + 86400000,
    )
    .run();
}
async function block(kind: "host" | "url", value: string) {
  await env.DB.prepare("INSERT INTO blocked_targets(kind,value) VALUES(?,?)")
    .bind(kind, value)
    .run();
}
beforeEach(async () => {
  bindings = {
    ...env,
    ADMIN_GOOGLE_SUBS: "admin",
    BURST: { limit: async () => ({ success: true }) },
    API_READ_BURST: { limit: async () => ({ success: true }) },
  };
  await env.DB.batch([
    ...[
      "analytics",
      "links",
      "creation_events",
      "sessions",
      "users",
      "blocked_targets",
      "admin_audit",
    ].map((table) => env.DB.prepare(`DELETE FROM ${table}`)),
    env.DB.prepare(
      "UPDATE policy SET admin_sub=NULL,automatic_level=0,metrics_at=?,last_backup_at=?,heartbeat=?,global_limit=200,guest_limit=20,user_limit=20,active_limit=100,expiry_hold=0,create_enabled=1,guest_enabled=1,analytics_enabled=1",
    ).bind(Date.now(), Date.now(), Date.now()),
  ]);
  for (const [id, token] of Object.entries(tokens)) {
    await env.DB.prepare(
      "INSERT INTO users(id,email,name,created_at) VALUES(?,?,?,?)",
    )
      .bind(id, `${id}@example.com`, id, Date.now())
      .run();
    await env.DB.prepare(
      "INSERT INTO sessions(hash,user_id,expires_at) VALUES(?,?,?)",
    )
      .bind(await hash(token), id, Date.now() + 86400000)
      .run();
  }
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    if (
      String(input) ===
      "https://challenges.cloudflare.com/turnstile/v0/siteverify"
    )
      return Response.json({
        success: true,
        hostname: "localhost",
        action: "create",
      });
    throw new Error("Unexpected external network request in security test");
  });
});
afterEach(() => vi.restoreAllMocks());

describe("destination blocklist normalization", () => {
  it.each([
    "https://oh.io.vn../code",
    "https://sub.oh.io.vn../code",
    "http://localhost../",
    "https://device.internal../",
  ])(
    "rejects alternate spellings of own/internal destinations: %s",
    (value) => {
      expect(() => targetValue(value)).toThrow();
    },
  );
  it.each([
    ["host", "example.com", "https://example.com../blocked"],
    [
      "url",
      "https://example.com/blocked",
      "https://example.com/blocked#different",
    ],
  ] as const)(
    "rejects create, owner edit, admin edit and redirect for %s variants",
    async (kind, value, target) => {
      await block(kind, value);
      expect.soft(await blocked(bindings, targetValue(target))).toBe(true);
      const created = await request("/api/links", {
        method: "POST",
        headers: await headers(),
        body: JSON.stringify({ target, turnstile: "local-test" }),
      });
      expect.soft(created.status).toBe(400);
      await link();
      for (const [path, id] of [
        ["/api/links/owned-link/edit", "owner"],
        ["/api/admin/links/owned-link/edit", "admin"],
      ] as const) {
        expect
          .soft(
            (
              await request(path, {
                method: "PATCH",
                headers: await headers(id),
                body: JSON.stringify({ target }),
              })
            ).status,
          )
          .toBe(400);
        expect
          .soft(
            (
              await env.DB.prepare(
                "SELECT target FROM links WHERE slug='owned-link'",
              ).first()
            )?.target,
          )
          .toBe("https://example.com/safe");
      }
      // Exercise links already saved before the admin added a block.
      await link("old-link", targetValue(target).toString());
      const redirected = await request("/old-link", {
        method: "HEAD",
        redirect: "manual",
      });
      expect.soft(redirected.status).toBe(403);
      expect.soft(redirected.headers.has("Location")).toBe(false);
    },
  );
  it("honors legacy blocks with fragments and preserves distinctions between queries and paths", async () => {
    await block("url", "https://example.com/blocked?q=1#old");
    expect(
      await blocked(bindings, new URL("https://example.com/blocked?q=1#new")),
    ).toBe(true);
    expect(
      await blocked(bindings, new URL("https://example.com/blocked?q=2")),
    ).toBe(false);
    expect(
      await blocked(bindings, new URL("https://example.com/another?q=1")),
    ).toBe(false);
    expect(targetValue("https://example.org/page#section").hash).toBe(
      "#section",
    );
  });
  it("treats glob characters literally and honors legacy DNS-root spellings", async () => {
    await block("url", "https://example.com./[a]*?q=1#old");
    expect(
      await blocked(bindings, new URL("https://example.com/[a]*?q=1#new")),
    ).toBe(true);
    expect(
      await blocked(bindings, new URL("https://example.com/abc?q=1")),
    ).toBe(false);
    await block("host", "blocked.example.");
    expect(
      await blocked(bindings, new URL("https://sub.blocked.example./page")),
    ).toBe(true);
    expect(
      await blocked(bindings, new URL("https://notblocked.example/page")),
    ).toBe(false);
    // Many short DNS labels must not exceed D1's bound-parameter limit.
    expect(
      await blocked(
        bindings,
        new URL(`https://${"a.".repeat(65)}blocked.example/path`),
      ),
    ).toBe(true);
  });
  it("stores canonical URL blocks and lets the admin remove legacy fragment entries", async () => {
    const adminHeaders = await headers("admin");
    const subject = "https://example.com./blocked#old";
    const added = await request("/api/admin/action", {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({ action: "add_block", kind: "url", subject }),
    });
    expect(added.status).toBe(200);
    expect(
      (await env.DB.prepare("SELECT value FROM blocked_targets").first())
        ?.value,
    ).toBe("https://example.com/blocked");
    await block("url", "https://example.net/legacy#section");
    const removed = await request("/api/admin/action", {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({
        action: "remove_block",
        kind: "url",
        subject: "https://example.net/legacy#section",
      }),
    });
    expect(removed.status).toBe(200);
    expect(
      await blocked(bindings, new URL("https://example.net/legacy#new")),
    ).toBe(false);
  });
});

describe("security boundaries", () => {
  it.each(["/api/config", "/api/me", "/api/admin/users"])(
    "throttles API reads before D1: %s",
    async (path) => {
      const prepare = vi.fn(() => {
        throw new Error("D1 must not be touched");
      });
      const rate = vi.fn(async () => ({ success: false }));
      const guarded = {
        ...bindings,
        API_READ_BURST: { limit: rate },
        DB: { prepare } as unknown as D1Database,
      };
      const response = await request(path, {}, guarded);
      expect(response.status).toBe(429);
      expect(response.headers.get("Retry-After")).toBe("60");
      expect(prepare).not.toHaveBeenCalled();
    },
  );
  it("throttles writes before session and policy queries", async () => {
    const prepare = vi.fn(() => {
      throw new Error("D1 must not be touched");
    });
    const response = await request(
      "/api/links",
      { method: "POST", headers: await headers("owner"), body: "{}" },
      {
        ...bindings,
        BURST: { limit: async () => ({ success: false }) },
        DB: { prepare } as unknown as D1Database,
      },
    );
    expect(response.status).toBe(429);
    expect(prepare).not.toHaveBeenCalled();
  });
  it.each(["missing", "forged", "expired", "blocked"])(
    "denies private data and edits for %s sessions",
    async (state) => {
      await link();
      const h = new Headers(await headers("owner"));
      if (state === "missing") h.delete("Cookie");
      if (state === "forged") h.set("Cookie", "oh_session=" + "f".repeat(64));
      if (state === "expired")
        await env.DB.prepare("UPDATE sessions SET expires_at=?")
          .bind(Date.now() - 1)
          .run();
      if (state === "blocked")
        await env.DB.prepare(
          "UPDATE users SET blocked=1 WHERE id='owner'",
        ).run();
      expect((await request("/api/links", { headers: h })).status).toBe(401);
      expect(
        (await request("/api/links/owned-link/stats", { headers: h })).status,
      ).toBe(401);
      expect([401, 403]).toContain(
        (
          await request("/api/links/owned-link/edit", {
            method: "PATCH",
            headers: h,
            body: JSON.stringify({ target: "https://example.net/changed" }),
          })
        ).status,
      );
      expect((await request("/api/admin/users", { headers: h })).status).toBe(
        403,
      );
      expect(
        (
          await env.DB.prepare(
            "SELECT target FROM links WHERE slug='owned-link'",
          ).first()
        )?.target,
      ).toBe("https://example.com/safe");
    },
  );
  it.each([
    "other-origin",
    "missing-origin",
    "missing-csrf",
    "wrong-csrf",
    "text-body",
  ])("rejects unsafe writes: %s", async (variant) => {
    await link();
    const h = new Headers(await headers("owner"));
    if (variant === "other-origin") h.set("Origin", "https://attacker.example");
    if (variant === "missing-origin") h.delete("Origin");
    if (variant === "missing-csrf") h.delete("X-CSRF-Token");
    if (variant === "wrong-csrf") h.set("X-CSRF-Token", "wrong");
    if (variant === "text-body") h.set("Content-Type", "text/plain");
    const response = await request("/api/links/owned-link/delete", {
      method: "DELETE",
      headers: h,
      body: "{}",
    });
    expect(response.status).toBe(403);
    expect(
      (
        await env.DB.prepare(
          "SELECT status FROM links WHERE slug='owned-link'",
        ).first()
      )?.status,
    ).toBe("active");
  });
  it.each(["{", "null", "[]", '"text"'])(
    "rejects malformed/non-object JSON: %s",
    async (body) => {
      expect(
        (
          await request("/api/links", {
            method: "POST",
            headers: await headers(),
            body,
          })
        ).status,
      ).toBe(400);
    },
  );
  it("bounds streamed UTF-8 bodies without trusting Content-Length", async () => {
    const data = new TextEncoder().encode(
      JSON.stringify({ label: "ệ".repeat(3000) }),
    );
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(data.slice(0, 4000));
        controller.enqueue(data.slice(4000));
        controller.close();
      },
    });
    expect(
      (
        await request("/api/links", {
          method: "POST",
          headers: await headers(),
          body,
        })
      ).status,
    ).toBe(413);
  });
  it("ignores mass assignment of ownership, state, lifetime and admin privileges", async () => {
    const created = await request("/api/links", {
      method: "POST",
      headers: await headers("owner"),
      body: JSON.stringify({
        target: "https://example.org/new",
        slug: "safe-code",
        turnstile: "local-test",
        owner_id: "admin",
        months: 100,
        status: "blocked",
        admin: true,
      }),
    });
    expect(created.status).toBe(201);
    const row = await env.DB.prepare(
      "SELECT owner_id,months,status FROM links WHERE slug='safe-code'",
    ).first();
    expect(row).toEqual({ owner_id: "owner", months: 12, status: "active" });
    expect(
      (await request("/api/admin/users", { headers: await headers("owner") }))
        .status,
    ).toBe(403);
  });
  it("requires the backup bearer credential before reading or acknowledging data", async () => {
    const prepare = vi.fn(() => {
      throw new Error("D1 must not be touched");
    });
    for (const [path, method] of [
      ["/api/internal/backup", "GET"],
      ["/api/internal/backup-complete", "POST"],
    ]) {
      const response = await request(
        path,
        { method, headers: { Authorization: "Bearer wrong-local-token" } },
        {
          ...bindings,
          BACKUP_TOKEN: "synthetic-backup-only",
          DB: { prepare } as unknown as D1Database,
        },
      );
      expect(response.status).toBe(401);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
    }
    expect(prepare).not.toHaveBeenCalled();
  });
  it("exports a synthetic backup without session or network hashes", async () => {
    await link();
    await env.DB.prepare(
      "UPDATE links SET creator_key='fake-private-network'",
    ).run();
    const response = await request(
      "/api/internal/backup",
      { headers: { Authorization: "Bearer synthetic-backup-only" } },
      { ...bindings, BACKUP_TOKEN: "synthetic-backup-only" },
    );
    expect(response.status).toBe(200);
    const backup = await response.text();
    expect(backup).not.toContain("fake-private-network");
    expect(backup).not.toContain(await hash(tokens.owner));
    expect(Object.keys(JSON.parse(backup).tables).sort()).toEqual([
      "blocked_targets",
      "links",
      "policy",
      "users",
    ]);
  });
  it("keeps internal database diagnostics out of responses and logs", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await request(
      "/api/config",
      {},
      {
        ...bindings,
        DB: {
          prepare() {
            throw new Error("synthetic-sensitive-query");
          },
        } as unknown as D1Database,
      },
    );
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("synthetic-sensitive");
    expect(JSON.stringify(error.mock.calls)).not.toContain(
      "synthetic-sensitive",
    );
  });
});
