import { env, SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { hash } from "../src/worker/security";
import { vietnamDay } from "../src/shared/rules";

const now = Date.now();
let network = 1;
async function user(id: string, blocked = 0) {
  await env.DB.prepare(
    "INSERT INTO users(id,email,name,blocked,created_at) VALUES(?,?,?,?,?)",
  )
    .bind(id, `${id}@example.com`, `Tên ${id}`, blocked, now)
    .run();
}
async function link(slug: string, owner: string | null = "owner") {
  await env.DB.prepare(
    `INSERT INTO links(slug,owner_id,target,host,label,created_at,last_access_at,idle_expires_at,months,creator_key)
    VALUES(?,?,?,?,?,?,?,?,?,?)`,
  )
    .bind(
      slug,
      owner,
      "https://example.com/page",
      "example.com",
      "Tài liệu",
      now,
      now,
      now + 86400000,
      owner ? 12 : 3,
      owner ? null : "private-network-hash",
    )
    .run();
}
async function headers(id = "admin") {
  const token = (id === "admin" ? "a" : id === "owner" ? "b" : "c").repeat(64);
  await env.DB.prepare(
    "INSERT OR REPLACE INTO sessions(hash,user_id,expires_at) VALUES(?,?,?)",
  )
    .bind(await hash(token), id, now + 86400000)
    .run();
  const cookie = { Cookie: `oh_session=${token}` };
  const identity = await SELF.fetch("http://localhost/api/me", {
    headers: cookie,
  });
  const { csrf } = (await identity.json()) as { csrf: string };
  return {
    ...cookie,
    Origin: "http://localhost:8787",
    "Content-Type": "application/json",
    "X-CSRF-Token": csrf,
    "CF-Connecting-IP": `198.51.100.${network++}`,
  };
}
const get = async (path: string, id = "admin") =>
  SELF.fetch(`http://localhost/api/admin/${path}`, {
    headers: await headers(id),
  });
const edit = async (slug: string, body: object, id = "admin") =>
  SELF.fetch(`http://localhost/api/admin/links/${slug}/edit`, {
    method: "PATCH",
    headers: await headers(id),
    body: JSON.stringify({ target: "https://example.org/updated", ...body }),
  });
beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM analytics"),
    env.DB.prepare("DELETE FROM links"),
    env.DB.prepare("DELETE FROM creation_events"),
    env.DB.prepare("DELETE FROM sessions"),
    env.DB.prepare("DELETE FROM users"),
    env.DB.prepare("DELETE FROM admin_audit"),
    env.DB.prepare("DELETE FROM blocked_targets"),
    env.DB.prepare(
      "UPDATE policy SET admin_sub='admin',automatic_level=0,metrics_at=?,last_backup_at=?,heartbeat=?,global_limit=2000,user_limit=1000,guest_limit=1000,active_limit=1000,expiry_hold=0,create_enabled=1,guest_enabled=1,analytics_enabled=1",
    ).bind(now, now, now),
  ]);
  await user("admin");
  await user("owner");
  await user("other");
});
describe("admin link and account directories", () => {
  it("locks and unlocks an account without changing its links, revoking sessions", async () => {
    await link("account-link");
    await headers("owner");
    const adminHeaders = await headers();
    const action = (blocked: boolean) =>
      SELF.fetch("http://localhost/api/admin/action", {
        method: "POST",
        headers: adminHeaders,
        body: JSON.stringify({
          action: "block_user",
          subject: "owner",
          blocked,
        }),
      });
    expect((await action(true)).status).toBe(200);
    expect(
      await env.DB.prepare(
        "SELECT blocked FROM users WHERE id='owner'",
      ).first(),
    ).toEqual({ blocked: 1 });
    expect(
      await env.DB.prepare(
        "SELECT count(*) AS count FROM sessions WHERE user_id='owner'",
      ).first(),
    ).toEqual({ count: 0 });
    expect(
      await env.DB.prepare(
        "SELECT status FROM links WHERE slug='account-link'",
      ).first(),
    ).toEqual({ status: "active" });
    expect((await get("links", "owner")).status).toBe(403);
    expect((await action(false)).status).toBe(200);
    expect(
      await env.DB.prepare(
        "SELECT blocked FROM users WHERE id='owner'",
      ).first(),
    ).toEqual({ blocked: 0 });
    expect(
      await env.DB.prepare(
        "SELECT count(*) AS count FROM admin_audit WHERE actor='admin' AND action='block_user' AND subject='owner'",
      ).first(),
    ).toEqual({ count: 2 });
  });
  it("blocks a link, retaining ownership and stats and rejecting unsafe admin requests", async () => {
    await link("lock-link");
    await env.DB.prepare(
      "INSERT INTO analytics(slug,day,source,device,clicks) VALUES(?,?,?,?,?)",
    )
      .bind("lock-link", vietnamDay(now), "Khác", "Máy tính", 3)
      .run();
    const body = JSON.stringify({ action: "block_link", subject: "lock-link" });
    const adminHeaders = await headers();
    const noCsrf = { ...adminHeaders, "X-CSRF-Token": "" };
    expect(
      (
        await SELF.fetch("http://localhost/api/admin/action", {
          method: "POST",
          headers: noCsrf,
          body,
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await SELF.fetch("http://localhost/api/admin/action", {
          method: "POST",
          headers: await headers("owner"),
          body,
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await SELF.fetch("http://localhost/api/admin/action", {
          method: "POST",
          headers: adminHeaders,
          body,
        })
      ).status,
    ).toBe(200);
    const detail = (await (await get("links/lock-link")).json()) as any;
    expect(detail.link.status).toBe("blocked");
    expect(detail.link.owner_id).toBe("owner");
    expect(detail.link.target).toBe("https://example.com/page");
    const stats = (await (await get("links/lock-link/stats")).json()) as any;
    expect(stats.rows[0].clicks).toBe(3);
    const list = (await (await get("links?status=active")).json()) as any;
    expect(list.total).toBe(0);
    expect(
      await env.DB.prepare(
        "SELECT actor,action,subject FROM admin_audit",
      ).first(),
    ).toEqual({ actor: "admin", action: "block_link", subject: "lock-link" });
  });
  it("rolls back the link edit when its audit cannot be written", async () => {
    await link("atomic-edit");
    await env.DB.prepare(
      "CREATE TRIGGER fail_admin_audit BEFORE INSERT ON admin_audit BEGIN SELECT RAISE(ABORT,'audit unavailable'); END",
    ).run();
    try {
      expect((await edit("atomic-edit", { slug: "atomic-new" })).status).toBe(
        503,
      );
      expect(
        await env.DB.prepare(
          "SELECT target,status FROM links WHERE slug='atomic-edit'",
        ).first(),
      ).toEqual({ target: "https://example.com/page", status: "active" });
      expect(
        await env.DB.prepare(
          "SELECT slug FROM links WHERE slug='atomic-new'",
        ).first(),
      ).toBeNull();
    } finally {
      await env.DB.prepare("DROP TRIGGER fail_admin_audit").run();
    }
  });
  it.each(["links", "users", "links/member", "links/member/stats"])(
    "protects %s from guests, non-admins and blocked admins",
    async (path) => {
      await link("member");
      expect(
        (await SELF.fetch(`http://localhost/api/admin/${path}`)).status,
      ).toBe(403);
      expect((await get(path, "owner")).status).toBe(403);
      await env.DB.prepare("UPDATE users SET blocked=1 WHERE id='admin'").run();
      expect((await get(path)).status).toBe(403);
    },
  );
  it("lists owners and guests without exposing network hashes or session data", async () => {
    await link("member");
    await link("guest", null);
    const response = await get("links");
    expect(response.status).toBe(200);
    const body = (await response.json()) as any;
    expect(body.total).toBe(2);
    expect(body.totalUsers).toBe(3);
    expect(body.links.find((l: any) => l.slug === "member").owner_email).toBe(
      "owner@example.com",
    );
    expect(
      body.links.find((l: any) => l.slug === "guest").owner_email,
    ).toBeNull();
    expect(JSON.stringify(body)).not.toMatch(
      /creator_key|private-network|session/,
    );
  });
  it("paginates ties without duplicate or missing links and reports filtered totals", async () => {
    for (let i = 0; i < 27; i++)
      await link(`page-${String(i).padStart(2, "0")}`);
    await link("unrelated", "other");
    const first = (await (
      await get("links?owner=owner&q=PAGE-")
    ).json()) as any;
    const second = (await (
      await get(
        `links?owner=owner&q=PAGE-&cursor=${encodeURIComponent(first.next)}`,
      )
    ).json()) as any;
    expect(first.total).toBe(27);
    expect(first.links).toHaveLength(25);
    expect(second.links).toHaveLength(2);
    expect(second.next).toBeNull();
    expect(
      new Set([...first.links, ...second.links].map((l) => l.slug)).size,
    ).toBe(27);
    expect(first.owner.email).toBe("owner@example.com");
  });
  it("lists total accounts, per-account links and paginated search matches", async () => {
    for (let i = 0; i < 27; i++)
      await user(`person-${String(i).padStart(2, "0")}`);
    await link("owned-one");
    await link("owned-two");
    await link("guest", null);
    const owners = (await (await get("users?q=OWNER@")).json()) as any;
    expect(owners.totalUsers).toBe(30);
    expect(owners.total).toBe(1);
    expect(owners.users[0].link_count).toBe(2);
    const first = (await (await get("users?q=person-")).json()) as any;
    const last = (await (
      await get(`users?q=person-&cursor=${encodeURIComponent(first.next)}`)
    ).json()) as any;
    expect(first.users).toHaveLength(25);
    expect(last.users).toHaveLength(2);
    expect(new Set([...first.users, ...last.users].map((u) => u.id)).size).toBe(
      27,
    );
  });
  it("filters blocked accounts, owner links and literal SQL-like search input", async () => {
    await env.DB.prepare("UPDATE users SET blocked=1 WHERE id='owner'").run();
    expect(
      ((await (await get("users?state=blocked")).json()) as any).users.map(
        (u: any) => u.id,
      ),
    ).toEqual(["owner"]);
    expect(
      ((await (await get("links?q=%27%20OR%201%3D1--")).json()) as any).total,
    ).toBe(0);
    expect((await get("links?owner=missing")).status).toBe(404);
  });
  it("shows effective expiry before cron and respects expiry hold and fixed deadlines", async () => {
    await link("idle");
    await link("fixed");
    await link("active");
    await env.DB.prepare("UPDATE links SET idle_expires_at=? WHERE slug='idle'")
      .bind(now - 1000)
      .run();
    await env.DB.prepare(
      "UPDATE links SET fixed_expires_at=? WHERE slug='fixed'",
    )
      .bind(now - 1000)
      .run();
    const expired = (await (await get("links?status=expired")).json()) as any;
    expect(expired.total).toBe(2);
    await env.DB.prepare("UPDATE policy SET expiry_hold=1").run();
    const held = (await (await get("links?status=active")).json()) as any;
    expect(held.links.map((l: any) => l.slug).sort()).toEqual([
      "active",
      "idle",
    ]);
    expect(held.links[0].effective_expires_at).toBeNull();
    expect(
      ((await (await get("links?status=expired")).json()) as any).total,
    ).toBe(1);
  });
  it("keeps tombstones searchable without inventing an owner", async () => {
    await link("old-code");
    expect((await edit("old-code", { slug: "new-code" })).status).toBe(200);
    const deleted = (await (await get("links?status=deleted")).json()) as any;
    expect(deleted.total).toBe(1);
    expect(deleted.links[0].owner_id).toBeNull();
    expect(deleted.links[0].target).toBeNull();
    expect(((await (await get("links")).json()) as any).total).toBe(1);
  });
  it.each([
    "links?cursor=garbage",
    "users?cursor=-5:x",
    "links?status=bogus",
    "users?state=bogus",
  ])("rejects invalid filters %s", async (path) => {
    expect((await get(path)).status).toBe(400);
  });
  it("returns fresh detail and stats for another owner's link; missing links are 404", async () => {
    await link("member");
    await env.DB.prepare("INSERT INTO analytics VALUES(?,?,?,?,?)")
      .bind("member", vietnamDay(now), "Google", "Máy tính", 4)
      .run();
    const detail = (await (await get("links/member")).json()) as any;
    expect(detail.link.owner_name).toBe("Tên owner");
    expect(detail.link.last_access_at).toBe(now);
    const stats = (await (await get("links/member/stats")).json()) as any;
    expect(stats.rows[0].clicks).toBe(4);
    expect(stats.tracked).toBe(true);
    await link("guest", null);
    expect(
      ((await (await get("links/guest/stats")).json()) as any).tracked,
    ).toBe(false);
    expect((await get("links/missing")).status).toBe(404);
    expect((await get("links/missing/stats")).status).toBe(404);
  });
  it("edits another owner's code, destination, name and fixed expiry while preserving owner and stats", async () => {
    await link("old-code");
    await env.DB.prepare("INSERT INTO analytics VALUES(?,?,?,?,?)")
      .bind("old-code", vietnamDay(now), "Google", "Máy tính", 4)
      .run();
    const fixed = now + 3600000;
    expect(
      (
        await edit("old-code", {
          slug: "new-code",
          label: "Mới",
          fixed_expires_at: new Date(fixed).toISOString(),
        })
      ).status,
    ).toBe(200);
    const updated = (await (await get("links/new-code")).json()) as any;
    expect(updated.link.owner_id).toBe("owner");
    expect(updated.link.label).toBe("Mới");
    expect(updated.link.fixed_expires_at).toBe(fixed);
    expect(updated.link.target).toBe("https://example.org/updated");
    expect(updated.link.created_at).toBe(now);
    expect(
      ((await (await get("links/new-code/stats")).json()) as any).rows[0]
        .clicks,
    ).toBe(4);
    expect(
      await env.DB.prepare(
        "SELECT actor,action,subject FROM admin_audit",
      ).first(),
    ).toEqual({
      actor: "admin",
      action: "edit_link",
      subject: "old-code -> new-code",
    });
    expect((await SELF.fetch("http://localhost/old-code")).status).toBe(404);
    expect(
      (await env.DB.prepare("SELECT count(*) n FROM creation_events").first())!
        .n,
    ).toBe(1);
  });
  it("edits guest links without claiming ownership", async () => {
    await link("guest", null);
    expect((await edit("guest", { label: "Khách" })).status).toBe(200);
    const data = (await (await get("links/guest")).json()) as any;
    expect(data.link.owner_id).toBeNull();
    expect(data.link.label).toBe("Khách");
  });
  it("does not bypass CSRF, ordinary owner permissions or stopped-link rules", async () => {
    await link("member");
    expect((await edit("member", {}, "owner")).status).toBe(403);
    const auth = await headers();
    expect(
      (
        await SELF.fetch("http://localhost/api/admin/links/member/edit", {
          method: "PATCH",
          headers: { ...auth, "X-CSRF-Token": "wrong" },
          body: JSON.stringify({ target: "https://example.org/" }),
        })
      ).status,
    ).toBe(403);
    const own = await headers("other");
    expect(
      (
        await SELF.fetch("http://localhost/api/links/member/edit", {
          method: "PATCH",
          headers: own,
          body: JSON.stringify({ target: "https://example.org/" }),
        })
      ).status,
    ).toBe(404);
    await env.DB.prepare(
      "UPDATE links SET status='blocked' WHERE slug='member'",
    ).run();
    expect((await edit("member", {})).status).toBe(409);
    expect(
      (await env.DB.prepare("SELECT count(*) n FROM admin_audit").first())!.n,
    ).toBe(0);
  });
  it("rejects blocked destinations and collisions without an audit or partial changes", async () => {
    await link("member");
    await link("taken");
    expect((await edit("member", { slug: "taken" })).status).toBe(409);
    await env.DB.prepare(
      "INSERT INTO blocked_targets VALUES('host','example.org')",
    ).run();
    expect((await edit("member", {})).status).toBe(400);
    expect(
      (await env.DB.prepare(
        "SELECT target FROM links WHERE slug='member'",
      ).first())!.target,
    ).toBe("https://example.com/page");
    expect(
      (await env.DB.prepare("SELECT count(*) n FROM admin_audit").first())!.n,
    ).toBe(0);
  });
});
