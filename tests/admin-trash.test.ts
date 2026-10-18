import { env, SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { hash } from "../src/worker/security";
import { purgeTrash, TRASH_RETENTION_MS } from "../src/worker/trash";
import { tombstone } from "../src/worker/service";
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

const action = async (action: string, subject: string, id = "admin") =>
  SELF.fetch("http://localhost/api/admin/action", {
    method: "POST",
    headers: await headers(id),
    body: JSON.stringify({ action, subject }),
  });
const row = (slug = "sample") =>
  env.DB.prepare("SELECT * FROM links WHERE slug=?").bind(slug).first<any>();
const account = () =>
  env.DB.prepare("SELECT * FROM users WHERE id='owner'").first<any>();

describe("admin trash lifecycle", () => {
  it("stops a deleted link immediately and restores its metadata, owner, expiry and statistics", async () => {
    await link("sample");
    await env.DB.prepare("INSERT INTO analytics VALUES(?,?,?,?,?)")
      .bind("sample", vietnamDay(now), "Google", "Máy tính", 4)
      .run();
    const before = await row();
    const response = await action("delete_link", "sample");
    expect(response.status).toBe(200);
    const trashed = await row();
    expect(trashed).toMatchObject({
      status: "deleted",
      deletion_previous_status: "active",
      owner_id: "owner",
      target: before.target,
    });
    expect(((await response.json()) as any).restore_until).toBe(
      trashed.deleted_at + TRASH_RETENTION_MS,
    );
    expect((await SELF.fetch("http://localhost/sample")).status).toBe(404);
    expect(((await (await get("links")).json()) as any).total).toBe(0);
    const trash = (await (await get("links?status=trashed")).json()) as any;
    expect(trash.links[0]).toMatchObject({
      effective_status: "trashed",
      can_restore: true,
      owner_id: "owner",
    });
    expect(
      ((await (await get("links?status=deleted")).json()) as any).total,
    ).toBe(0);
    const ownerHeaders = await headers("owner");
    expect(
      (
        (await (
          await SELF.fetch("http://localhost/api/links", {
            headers: ownerHeaders,
          })
        ).json()) as any
      ).links,
    ).toHaveLength(0);
    for (const [method, path] of [
      ["GET", "stats"],
      ["PATCH", "edit"],
      ["DELETE", "delete"],
    ])
      expect(
        (
          await SELF.fetch(`http://localhost/api/links/sample/${path}`, {
            method,
            headers: ownerHeaders,
            ...(method === "GET" ? {} : { body: "{}" }),
          })
        ).status,
      ).toBe(404);
    await tombstone(env, "sample", "expired"); // A stale owner/maintenance read cannot purge trash.
    expect((await row()).target).toBe(before.target);
    expect((await action("restore_link", "sample")).status).toBe(200);
    expect(await row()).toEqual(before);
    expect(
      (
        await SELF.fetch("http://localhost/sample", {
          method: "HEAD",
          redirect: "manual",
        })
      ).status,
    ).toBe(302);
    expect(
      (await env.DB.prepare(
        "SELECT clicks FROM analytics WHERE slug='sample'",
      ).first())!.clicks,
    ).toBe(4);
    expect(
      (await env.DB.prepare("SELECT count(*) n FROM creation_events").first())!
        .n,
    ).toBe(1);
    expect(
      (await env.DB.prepare("SELECT action FROM admin_audit ORDER BY id").all())
        .results,
    ).toEqual([{ action: "delete_link" }, { action: "restore_link" }]);
  });
  it("preserves a blocked status and never renews a fixed deadline when restored", async () => {
    await link("blocked");
    await link("sample");
    await env.DB.prepare(
      "UPDATE links SET status='blocked' WHERE slug='blocked'",
    ).run();
    await env.DB.prepare(
      "UPDATE links SET fixed_expires_at=? WHERE slug='sample'",
    )
      .bind(now - 1000)
      .run();
    for (const slug of ["blocked", "sample"]) {
      expect((await action("delete_link", slug)).status).toBe(200);
      expect((await action("restore_link", slug)).status).toBe(200);
    }
    expect((await row("blocked")).status).toBe("blocked");
    expect((await SELF.fetch("http://localhost/sample")).status).toBe(410);
    expect((await row()).fixed_expires_at).toBe(now - 1000);
  });
  it("revokes account sessions, cascades atomically and only undoes the same deletion group", async () => {
    for (const slug of ["sample", "blocked", "independent"]) await link(slug);
    await env.DB.prepare("UPDATE users SET blocked=1 WHERE id='owner'").run();
    await env.DB.prepare(
      "UPDATE links SET status='blocked' WHERE slug='blocked'",
    ).run();
    await action("delete_link", "independent");
    const independent = await row("independent");
    const cookie = (await headers("owner")).Cookie;
    expect((await action("delete_user", "owner")).status).toBe(200);
    const deleted = await account();
    expect(deleted.deleted_at).toBeGreaterThan(0);
    expect(await row()).toMatchObject({
      deleted_at: deleted.deleted_at,
      deletion_user_id: "owner",
    });
    expect(await row("independent")).toEqual(independent);
    expect(
      (await env.DB.prepare(
        "SELECT count(*) n FROM sessions WHERE user_id='owner'",
      ).first())!.n,
    ).toBe(0);
    expect(
      (
        await SELF.fetch("http://localhost/api/links", {
          headers: { Cookie: cookie },
        })
      ).status,
    ).toBe(401);
    expect((await action("restore_link", "sample")).status).toBe(409);
    expect((await action("restore_link", "independent")).status).toBe(409);
    expect(
      ((await (await get("users?state=trashed")).json()) as any).users[0],
    ).toMatchObject({ id: "owner", link_count: 3, can_restore: true });
    expect(((await (await get("users")).json()) as any).totalUsers).toBe(2);
    expect((await action("restore_user", "owner")).status).toBe(200);
    expect(await account()).toMatchObject({ deleted_at: null, blocked: 1 });
    expect(await row()).toMatchObject({ status: "active", deleted_at: null });
    expect(await row("blocked")).toMatchObject({
      status: "blocked",
      deleted_at: null,
    });
    expect(await row("independent")).toEqual(independent);
    expect(
      (await env.DB.prepare(
        "SELECT count(*) n FROM sessions WHERE user_id='owner'",
      ).first())!.n,
    ).toBe(0);
  });
  it("keeps retry deadlines stable and refuses permanent tombstones or double restores", async () => {
    await link("sample");
    await action("delete_link", "sample");
    const snapshot = await row();
    expect((await action("delete_link", "sample")).status).toBe(409);
    expect(await row()).toEqual(snapshot);
    await action("restore_link", "sample");
    expect((await action("restore_link", "sample")).status).toBe(409);
    await tombstone(env, "sample");
    expect((await action("restore_link", "sample")).status).toBe(409);
    expect((await action("delete_link", "sample")).status).toBe(409);
    expect((await action("delete_user", "missing")).status).toBe(409);
  });
  it("enforces admin authorization, CSRF and protects the admin account", async () => {
    await link("sample");
    for (const name of [
      "delete_link",
      "restore_link",
      "purge_link",
      "delete_user",
      "restore_user",
      "purge_user",
    ]) {
      expect(
        (
          await SELF.fetch("http://localhost/api/admin/action", {
            method: "POST",
            headers: {
              Origin: "http://localhost:8787",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ action: name, subject: "sample" }),
          })
        ).status,
      ).toBe(403);
      expect((await action(name, "sample", "owner")).status).toBe(403);
      expect(
        (
          await SELF.fetch("http://localhost/api/admin/action", {
            method: "POST",
            headers: { ...(await headers()), "X-CSRF-Token": "wrong" },
            body: JSON.stringify({ action: name, subject: "sample" }),
          })
        ).status,
      ).toBe(403);
    }
    expect((await action("delete_user", "admin")).status).toBe(409);
    expect((await action("purge_user", "admin")).status).toBe(409);
    const users = ((await (await get("users")).json()) as any).users;
    expect(users.find((u: any) => u.id === "admin").can_delete).toBe(false);
    expect((await row()).status).toBe("active");
  });
  it("does not delete before 30 days, rejects late undo, and purges content without releasing codes", async () => {
    await link("sample");
    await env.DB.prepare("INSERT INTO analytics VALUES(?,?,?,?,?)")
      .bind("sample", vietnamDay(now), "Google", "Máy tính", 2)
      .run();
    await action("delete_user", "owner");
    const deletedAt = (await account()).deleted_at;
    await purgeTrash(env, deletedAt + TRASH_RETENTION_MS - 1);
    expect((await row()).target).not.toBeNull();
    expect(await account()).not.toBeNull();
    await purgeTrash(env, deletedAt + TRASH_RETENTION_MS);
    expect(await account()).toBeNull();
    expect(await row()).toMatchObject({
      status: "deleted",
      target: null,
      owner_id: null,
      label: null,
      deleted_at: null,
      deletion_previous_status: null,
      deletion_user_id: null,
    });
    expect(
      (await env.DB.prepare(
        "SELECT count(*) n FROM analytics WHERE slug='sample'",
      ).first())!.n,
    ).toBe(0);
    expect((await action("restore_link", "sample")).status).toBe(409);
    expect((await action("restore_user", "owner")).status).toBe(409);
    await expect(link("sample", null)).rejects.toThrow(/UNIQUE/);
  });
  it("rejects restoration after the deadline even when cron has not yet purged data", async () => {
    await link("sample");
    await action("delete_user", "owner");
    const old = Date.now() - TRASH_RETENTION_MS - 1000;
    await env.DB.prepare("UPDATE users SET deleted_at=? WHERE id='owner'")
      .bind(old)
      .run();
    await env.DB.prepare("UPDATE links SET deleted_at=? WHERE slug='sample'")
      .bind(old)
      .run();
    expect((await action("restore_user", "owner")).status).toBe(409);
    expect((await action("restore_link", "sample")).status).toBe(409);
    expect(
      ((await (await get("users?state=trashed")).json()) as any).users[0]
        .can_restore,
    ).toBe(false);
    expect((await row()).target).not.toBeNull();
  });
  it("rolls back account, link and session changes if the audit cannot be saved", async () => {
    await link("sample");
    await headers("owner");
    await env.DB.prepare(
      "CREATE TRIGGER fail_trash_audit BEFORE INSERT ON admin_audit BEGIN SELECT RAISE(ABORT,'test rollback'); END",
    ).run();
    try {
      expect((await action("delete_user", "owner")).status).toBe(503);
      expect((await account()).deleted_at).toBeNull();
      expect((await row()).status).toBe("active");
      expect(
        (await env.DB.prepare(
          "SELECT count(*) n FROM sessions WHERE user_id='owner'",
        ).first())!.n,
      ).toBe(1);
    } finally {
      await env.DB.prepare("DROP TRIGGER fail_trash_audit").run();
    }
  });
  it("prevents raced login/create after account deletion and leaves restored data alone during cleanup", async () => {
    await link("sample");
    await action("delete_user", "owner");
    const deletedAt = (await account()).deleted_at;
    await expect(
      env.DB.prepare("INSERT INTO sessions VALUES('fake-session','owner',?)")
        .bind(now + 1000)
        .run(),
    ).rejects.toThrow(/account:deleted/);
    await expect(link("racing-create")).rejects.toThrow(/account:deleted/);
    await action("restore_user", "owner");
    await purgeTrash(env, deletedAt + TRASH_RETENTION_MS + 1);
    expect((await row()).target).toBe("https://example.com/page");
    expect(await account()).not.toBeNull();
  });
  it("supports guest trash and keeps a stable account deletion deadline on retries", async () => {
    await link("guest-link", null);
    expect((await action("delete_link", "guest-link")).status).toBe(200);
    expect((await action("restore_link", "guest-link")).status).toBe(200);
    expect(await row("guest-link")).toMatchObject({
      owner_id: null,
      status: "active",
    });
    await action("delete_user", "owner");
    const deleted = await account();
    expect((await action("delete_user", "owner")).status).toBe(409);
    expect(await account()).toEqual(deleted);
  });
  it("bounds purge batches and keeps an account until all its links are cleaned", async () => {
    for (let i = 0; i < 51; i++) await link(`batch-${i}`);
    await action("delete_user", "owner");
    const deletedAt = (await account()).deleted_at;
    const first = (await (await get("links?status=trashed")).json()) as any;
    expect(first.links).toHaveLength(25);
    const second = (await (
      await get(`links?status=trashed&cursor=${encodeURIComponent(first.next)}`)
    ).json()) as any;
    expect(second.links).toHaveLength(25);
    expect(
      new Set([...first.links, ...second.links].map((l) => l.slug)).size,
    ).toBe(50);
    await purgeTrash(env, deletedAt + TRASH_RETENTION_MS);
    expect(await account()).not.toBeNull();
    expect(
      (await env.DB.prepare(
        "SELECT count(*) n FROM links WHERE owner_id='owner'",
      ).first())!.n,
    ).toBe(1);
    await purgeTrash(env, deletedAt + TRASH_RETENTION_MS);
    expect(await account()).toBeNull();
    expect(
      (await env.DB.prepare(
        "SELECT count(*) n FROM links WHERE status='deleted'",
      ).first())!.n,
    ).toBe(51);
  });
  it.each(["owner", null])(
    "permanently deletes fresh link trash for %s without releasing its code or quota",
    async (owner) => {
      await link("sample", owner);
      await link("untouched", "other");
      await env.DB.prepare("INSERT INTO analytics VALUES(?,?,?,?,?)")
        .bind("sample", vietnamDay(now), "Zalo", "Điện thoại", 4)
        .run();
      await action("delete_link", "sample");
      expect((await action("purge_link", "sample")).status).toBe(200);
      expect(await row()).toMatchObject({
        status: "deleted",
        owner_id: null,
        target: null,
        host: null,
        label: null,
        creator_key: null,
        deleted_at: null,
        deletion_previous_status: null,
        deletion_user_id: null,
      });
      expect((await row("untouched")).target).not.toBeNull();
      expect(await account()).not.toBeNull();
      expect(
        await env.DB.prepare(
          "SELECT * FROM analytics WHERE slug='sample'",
        ).first(),
      ).toBeNull();
      expect(
        (await env.DB.prepare(
          "SELECT count(*) n FROM creation_events",
        ).first())!.n,
      ).toBe(2);
      expect((await SELF.fetch("http://localhost/sample")).status).toBe(404);
      expect((await action("restore_link", "sample")).status).toBe(409);
      expect((await action("purge_link", "sample")).status).toBe(409);
      await expect(link("sample", null)).rejects.toThrow(/UNIQUE/);
      expect(
        (
          await env.DB.prepare(
            "SELECT action FROM admin_audit ORDER BY id",
          ).all()
        ).results,
      ).toEqual([{ action: "delete_link" }, { action: "purge_link" }]);
    },
  );
  it("permanently deletes a fresh account with more than one cron batch, including separately trashed links", async () => {
    for (let i = 0; i < 51; i++) await link(`immediate-${i}`);
    await link("independent");
    await action("delete_link", "independent");
    await link("unrelated", "other");
    await env.DB.batch([
      env.DB.prepare("INSERT INTO analytics VALUES(?,?,?,?,?)").bind(
        "independent",
        vietnamDay(now),
        "Zalo",
        "Điện thoại",
        3,
      ),
      env.DB.prepare("INSERT INTO analytics VALUES(?,?,?,?,?)").bind(
        "immediate-0",
        vietnamDay(now),
        "Google",
        "Máy tính",
        1,
      ),
      env.DB.prepare("INSERT INTO analytics VALUES(?,?,?,?,?)").bind(
        "unrelated",
        vietnamDay(now),
        "Google",
        "Máy tính",
        7,
      ),
    ]);
    const cookie = (await headers("owner")).Cookie;
    await action("delete_user", "owner");
    const listed = ((await (await get("users?state=trashed")).json()) as any)
      .users[0];
    expect(listed).toMatchObject({
      id: "owner",
      link_count: 52,
      can_purge: true,
    });
    expect((await action("purge_user", "owner")).status).toBe(200);
    expect(await account()).toBeNull();
    expect(
      (await env.DB.prepare(
        "SELECT count(*) n FROM links WHERE target IS NULL AND owner_id IS NULL AND deleted_at IS NULL AND status='deleted'",
      ).first())!.n,
    ).toBe(52);
    expect(
      (await env.DB.prepare("SELECT slug,clicks FROM analytics").all()).results,
    ).toEqual([{ slug: "unrelated", clicks: 7 }]);
    expect((await row("unrelated")).status).toBe("active");
    expect(
      await env.DB.prepare(
        "SELECT * FROM sessions WHERE user_id='owner'",
      ).first(),
    ).toBeNull();
    expect(
      (
        await SELF.fetch("http://localhost/api/links", {
          headers: { Cookie: cookie },
        })
      ).status,
    ).toBe(401);
    expect((await action("restore_user", "owner")).status).toBe(409);
    expect((await action("restore_link", "independent")).status).toBe(409);
    expect((await action("purge_user", "owner")).status).toBe(409);
    expect(
      (await env.DB.prepare(
        "SELECT count(*) n FROM admin_audit WHERE action='purge_user'",
      ).first())!.n,
    ).toBe(1);
  });
  it("allows purging empty accounts and overdue trash", async () => {
    await action("delete_user", "owner");
    expect((await action("purge_user", "owner")).status).toBe(200);
    expect(await account()).toBeNull();
    await link("overdue", null);
    await action("delete_link", "overdue");
    await env.DB.prepare("UPDATE links SET deleted_at=? WHERE slug='overdue'")
      .bind(now - TRASH_RETENTION_MS - 1000)
      .run();
    expect((await action("purge_link", "overdue")).status).toBe(200);
    expect((await row("overdue")).target).toBeNull();
  });
  it("does not resurrect a permanently deleted link when its account is restored", async () => {
    await link("sample");
    await link("retained");
    await action("delete_user", "owner");
    expect((await action("purge_link", "sample")).status).toBe(200);
    expect((await action("restore_user", "owner")).status).toBe(200);
    expect(await row()).toMatchObject({
      target: null,
      status: "deleted",
      owner_id: null,
    });
    expect((await row("retained")).status).toBe("active");
  });
  it("refuses active or restored records, missing records and protected admins without touching data", async () => {
    await link("sample");
    for (const name of ["purge_link", "purge_user"]) {
      expect(
        (await action(name, name === "purge_user" ? "owner" : "sample")).status,
      ).toBe(409);
      expect((await action(name, "missing")).status).toBe(409);
    }
    await action("delete_user", "owner");
    await action("restore_user", "owner");
    expect((await action("purge_user", "owner")).status).toBe(409);
    expect((await action("purge_link", "sample")).status).toBe(409);
    expect((await row()).target).not.toBeNull();
    expect((await account()).deleted_at).toBeNull();
    expect((await action("purge_user", "admin")).status).toBe(409);
    const users = ((await (await get("users")).json()) as any).users;
    expect(users.find((u: any) => u.id === "admin").can_purge).toBe(false);
  });
  it.each(["purge_link", "purge_user"])(
    "rolls back all data removal if %s cannot save its audit",
    async (name) => {
      await link("sample");
      await env.DB.prepare("INSERT INTO analytics VALUES(?,?,?,?,?)")
        .bind("sample", vietnamDay(now), "Google", "Máy tính", 5)
        .run();
      await action("delete_user", "owner");
      const beforeLink = await row(),
        beforeUser = await account();
      await env.DB.prepare(
        "CREATE TRIGGER fail_purge_audit BEFORE INSERT ON admin_audit BEGIN SELECT RAISE(ABORT,'test rollback'); END",
      ).run();
      try {
        expect(
          (await action(name, name === "purge_user" ? "owner" : "sample"))
            .status,
        ).toBe(503);
        expect(await row()).toEqual(beforeLink);
        expect(await account()).toEqual(beforeUser);
        expect(
          (await env.DB.prepare(
            "SELECT clicks FROM analytics WHERE slug='sample'",
          ).first())!.clicks,
        ).toBe(5);
      } finally {
        await env.DB.prepare("DROP TRIGGER fail_purge_audit").run();
      }
    },
  );
});
