import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const require = createRequire(
  process.env.PLAYWRIGHT_PACKAGE || import.meta.url,
);
const { chromium } = require("playwright");
const origin = process.env.UI_ORIGIN || "http://localhost:8791";
assert(["localhost", "127.0.0.1", "[::1]"].includes(new URL(origin).hostname));
const out = process.env.UI_OUTPUT || ".local/admin-trash";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage();
  const errors = [],
    measurements = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const now = Date.now(),
    deadline = now + 30 * 86400000;
  const originalUser = {
    id: "member",
    name: "Tài khoản kiểm thử có tên dài",
    email: "member@example.invalid",
    blocked: 0,
    created_at: now,
    link_count: 1,
    can_delete: true,
    can_purge: false,
    deleted_at: null,
  };
  const originalLink = {
    slug: "tai-lieu",
    label: "Tài liệu kiểm thử",
    target: "https://example.com/huong-dan",
    owner_id: "member",
    owner_email: "member@example.invalid",
    owner_name: originalUser.name,
    created_at: now,
    last_access_at: now,
    idle_expires_at: now + 86400000,
    fixed_expires_at: null,
    expires_at: now + 86400000,
    effective_expires_at: now + 86400000,
    status: "active",
    effective_status: "active",
    deleted_at: null,
  };
  let user,
    link,
    actions = [],
    fail = false,
    failRefresh = false,
    delay = 0;
  const reset = () => {
    user = structuredClone(originalUser);
    link = structuredClone(originalLink);
    actions = [];
    fail = false;
    failRefresh = false;
  };
  reset();
  await page.route("**/api/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      path = url.pathname;
    const json = (body, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    if (path === "/api/me")
      return json({
        user: { name: "Admin", email: "admin@example.invalid" },
        admin: true,
        csrf: "fixture",
      });
    if (path === "/api/admin/action") {
      assert.equal(req.headers()["x-csrf-token"], "fixture");
      const b = req.postDataJSON();
      actions.push(b);
      if (delay) await new Promise((r) => setTimeout(r, delay));
      if (fail) return json({ error: "Chưa lưu được. Hãy thử lại." }, 503);
      if (b.action === "delete_link")
        Object.assign(link, {
          status: "deleted",
          effective_status: "trashed",
          deleted_at: now,
          restore_until: deadline,
          can_restore: true,
        });
      if (b.action === "restore_link") Object.assign(link, originalLink);
      if (b.action === "purge_link")
        Object.assign(link, {
          target: null,
          label: null,
          owner_id: null,
          deleted_at: null,
          status: "deleted",
          effective_status: "deleted",
        });
      if (b.action === "delete_user") {
        Object.assign(user, {
          deleted_at: now,
          restore_until: deadline,
          can_restore: true,
          can_purge: true,
        });
        Object.assign(link, {
          status: "deleted",
          effective_status: "trashed",
          deleted_at: now,
          owner_deleted_at: now,
          restore_until: deadline,
          can_restore: false,
        });
      }
      if (b.action === "restore_user") {
        Object.assign(user, originalUser);
        Object.assign(link, originalLink, { owner_deleted_at: null });
      }
      if (b.action === "purge_user") {
        user = null;
        link = null;
      }
      return json({
        ok: true,
        restore_until: b.action.startsWith("delete_") ? deadline : null,
      });
    }
    if (path === "/api/admin/links" || path === "/api/admin/users") {
      if (failRefresh) return json({ error: "Chưa tải được danh sách." }, 503);
      const isUsers = path.endsWith("users"),
        filter = url.searchParams.get(isUsers ? "state" : "status");
      const entry = isUsers ? user : link;
      const show =
        entry &&
        (filter === "trashed"
          ? entry.deleted_at != null
          : entry.deleted_at == null && entry.status !== "deleted");
      return json({
        [isUsers ? "users" : "links"]: show ? [entry] : [],
        total: show ? 1 : 0,
        totalUsers: user && user.deleted_at == null ? 1 : 0,
        owner: url.searchParams.get("owner") ? user : null,
        next: null,
        expiryHeld: false,
      });
    }
    if (path === "/api/admin/links/tai-lieu")
      return json({ link, expiryHeld: false });
    return json({ error: "Unexpected fixture route" }, 404);
  });
  const ready = () =>
    page.waitForSelector('#directory-results:not([aria-busy="true"])');
  const go = async (query) => {
    await page.goto(origin + "/admin/?" + query);
    await ready();
    await page.evaluate(() => document.fonts.ready);
  };
  const click = (action) =>
    page.locator(`[data-directory-action="${action}"]`).click();
  const confirmed = async () => {
    await page.locator("#confirm-admin-action").click();
    await page.locator("#admin-confirm-dialog").waitFor({ state: "hidden" });
    await ready();
  };
  const capture = async (name) => {
    const measure = await page.evaluate(() =>
      [
        document.documentElement,
        ...document.querySelectorAll("dialog[open]"),
      ].map((el) => ({ width: el.clientWidth, scroll: el.scrollWidth })),
    );
    await page.screenshot({
      path: `${out}/${name}.png`,
      fullPage: (await page.locator("dialog[open]").count()) === 0,
      animations: "disabled",
    });
    if (measure.some((m) => m.scroll > m.width))
      console.log(
        await page.evaluate(() =>
          [...document.querySelectorAll("body *")]
            .filter((el) => el.getBoundingClientRect().right > innerWidth)
            .map((el) => ({
              tag: el.tagName,
              id: el.id,
              cls: el.className,
              right: el.getBoundingClientRect().right,
            }))
            .slice(0, 15),
        ),
      );
    assert(
      measure.every((m) => m.scroll <= m.width),
      `${name}: overflow`,
    );
    const tiny = await page.locator("button:visible").evaluateAll((nodes) =>
      nodes
        .filter((n) => {
          const r = n.getBoundingClientRect();
          return r.width < 44 || r.height < 44;
        })
        .map((n) => n.textContent),
    );
    assert.deepEqual(tiny, [], "Buttons must retain touch targets");
    measurements.push({ name, measure });
  };
  for (const width of [1440, 768, 390, 375, 320]) {
    reset();
    await page.setViewportSize({ width, height: width < 700 ? 844 : 1000 });
    await go("view=links");
    await capture(`links-${width}`);
    assert.equal(
      await page
        .locator('[data-directory-action="delete-link"]')
        .evaluate((el) => getComputedStyle(el).color),
      "rgb(165, 50, 50)",
    );
    await page.locator('[data-directory-action="delete-link"] svg').click();
    assert.equal(actions.length, 0);
    assert.match(
      await page.locator("#admin-confirm-description").textContent(),
      /30 ngày/,
    );
    await capture(`delete-link-${width}`);
    await page.keyboard.press("Escape");
    assert.equal(
      await page.locator(":focus").getAttribute("data-directory-action"),
      "delete-link",
    );
    await click("delete-link");
    await confirmed();
    assert.equal(actions.length, 1);
    assert.equal(await page.locator(".directory-row").count(), 0);
    assert.match(
      await page.locator("#directory-message").textContent(),
      /Có thể hoàn tác trước/,
    );
    await page.locator("#directory-trash").click();
    await ready();
    assert.match(page.url(), /status=trashed/);
    await capture(`trash-link-${width}`);
    await click("restore-link");
    assert.equal(
      await page
        .locator("#confirm-admin-action")
        .evaluate((el) => el.classList.contains("danger-button")),
      false,
    );
    await confirmed();
    assert.equal(link.status, "active");
    await go("view=users");
    await click("delete-user");
    await capture(`delete-user-${width}`);
    await confirmed();
    assert(user.deleted_at);
    await page.locator("#directory-trash").click();
    await ready();
    await capture(`trash-user-${width}`);
    await page.locator(".user-row a").click();
    await ready();
    assert.equal(
      await page.locator('[data-directory-action="restore-link"]').count(),
      0,
    );
    assert.match(
      await page.locator("#directory-owner").textContent(),
      /Khôi phục tài khoản trước/,
    );
    await go("view=users&state=trashed");
    await click("restore-user");
    await capture(`restore-user-${width}`);
    await confirmed();
    assert.equal(user.deleted_at, null);
    assert.equal(link.status, "active");
    // Both irreversible actions are explicit, cancelable, and only in trash.
    assert.equal(
      await page.locator('[data-directory-action="purge-user"]').count(),
      0,
    );
    await go("view=links");
    assert.equal(
      await page.locator('[data-directory-action="purge-link"]').count(),
      0,
    );
    await click("delete-link");
    await confirmed();
    await go("view=links&status=trashed&q=tai-lieu&owner=member");
    const beforePurge = actions.length;
    await page.locator('[data-directory-action="purge-link"] svg').click();
    assert.equal(actions.length, beforePurge);
    assert.match(
      await page.locator("#admin-confirm-description").textContent(),
      /Không thể hoàn tác/,
    );
    assert.equal(
      await page
        .locator("#confirm-admin-action")
        .evaluate((el) => el.classList.contains("danger-button")),
      true,
    );
    assert.equal(await page.locator(":focus").textContent(), "Hủy");
    await capture(`purge-link-${width}`);
    await page.keyboard.press("Escape");
    assert.equal(actions.length, beforePurge);
    assert.equal(
      await page.locator(":focus").getAttribute("data-directory-action"),
      "purge-link",
    );
    await page.keyboard.press("Enter");
    await confirmed();
    assert.deepEqual(actions.at(-1), {
      action: "purge_link",
      subject: "tai-lieu",
    });
    assert.equal(await page.locator(".directory-row").count(), 0);
    assert.match(page.url(), /status=trashed/);
    assert.match(page.url(), /q=tai-lieu/);
    assert.match(page.url(), /owner=member/);
    assert.equal(
      await page.locator(":focus").getAttribute("id"),
      "directory-message",
    );
    await go("view=users");
    await click("delete-user");
    await confirmed();
    await go("view=users&state=trashed");
    assert.equal(
      await page
        .locator('[data-directory-action="purge-user"]')
        .evaluate((el) => getComputedStyle(el).color),
      "rgb(165, 50, 50)",
    );
    await click("purge-user");
    assert.match(
      await page.locator("#admin-confirm-subject").textContent(),
      /member@example.invalid/,
    );
    assert.match(
      await page.locator("#admin-confirm-description").textContent(),
      /kể cả link đã đưa vào thùng rác riêng/,
    );
    await capture(`purge-user-${width}`);
    await confirmed();
    assert.deepEqual(actions.at(-1), {
      action: "purge_user",
      subject: "member",
    });
    assert.equal(await page.locator(".directory-row").count(), 0);
    assert.match(
      await page.locator("#directory-message").textContent(),
      /Đã xóa vĩnh viễn tài khoản/,
    );
  }
  reset();
  await page.setViewportSize({ width: 390, height: 844 });
  await go("view=links");
  await click("delete-link");
  fail = true;
  await page.locator("#confirm-admin-action").click();
  await page
    .locator("#admin-confirm-message")
    .filter({ hasText: "Chưa lưu được" })
    .waitFor();
  assert.equal(link.status, "active");
  await capture("delete-error");
  fail = false;
  delay = 700;
  failRefresh = true;
  const count = actions.length;
  await page.locator("#confirm-admin-action").click();
  assert(await page.locator("#confirm-admin-action").isDisabled());
  await page.keyboard.press("Enter");
  await page.keyboard.press("Escape");
  assert(await page.locator("#admin-confirm-dialog").isVisible());
  await page.locator("#admin-confirm-dialog").waitFor({ state: "hidden" });
  assert.equal(actions.length, count + 1);
  assert.match(
    await page.locator("#directory-message").textContent(),
    /Đã chuyển link.*Chưa tải được/,
  );
  delay = 0;
  failRefresh = false;
  await go("view=links&status=trashed");
  await page.evaluate(() => (document.documentElement.style.fontSize = "200%"));
  await capture("trash-link-text-200");
  await click("restore-link");
  await capture("restore-link-text-200");
  await page.keyboard.press("Escape");
  link.can_restore = false;
  link.restore_until = now - 1000;
  await go("view=links&status=trashed");
  assert.equal(
    await page.locator('[data-directory-action="restore-link"]').count(),
    0,
  );
  assert.match(
    await page.locator(".directory-row").textContent(),
    /Đã hết hạn hoàn tác/,
  );
  await capture("expired-trash");
  await click("purge-link");
  fail = true;
  await page.locator("#confirm-admin-action").click();
  await page
    .locator("#admin-confirm-message")
    .filter({ hasText: "Chưa lưu được" })
    .waitFor();
  assert.equal(link.effective_status, "trashed");
  await capture("purge-error");
  fail = false;
  delay = 700;
  failRefresh = true;
  const beforeRetry = actions.length;
  await page.locator("#confirm-admin-action").click();
  assert(await page.locator("#confirm-admin-action").isDisabled());
  await page.keyboard.press("Enter");
  await page.keyboard.press("Escape");
  assert(await page.locator("#admin-confirm-dialog").isVisible());
  await page.locator("#admin-confirm-dialog").waitFor({ state: "hidden" });
  assert.equal(actions.length, beforeRetry + 1);
  assert.match(
    await page.locator("#directory-message").textContent(),
    /Đã xóa vĩnh viễn.*Chưa tải được/,
  );
  delay = 0;
  reset();
  await go("view=users");
  await click("delete-user");
  await confirmed();
  await go("view=users&state=trashed");
  await page.evaluate(() => (document.documentElement.style.fontSize = "200%"));
  await capture("purge-user-text-200-list");
  await click("purge-user");
  await capture("purge-user-text-200-dialog");
  await page.keyboard.press("Tab");
  assert.equal(
    await page.locator(":focus").getAttribute("id"),
    "confirm-admin-action",
  );
  const focusedButton = await page
    .locator("#confirm-admin-action")
    .boundingBox();
  assert(
    focusedButton &&
      focusedButton.y >= 0 &&
      focusedButton.y + focusedButton.height <= 844,
  );
  await capture("purge-user-text-200-action");
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 844, height: 390 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await go("view=users&state=trashed");
  await click("purge-user");
  await capture("purge-user-landscape-reduced-motion");
  await page.keyboard.press("Escape");
  user.can_purge = false;
  await go("view=users&state=trashed");
  assert.equal(
    await page.locator('[data-directory-action="purge-user"]').count(),
    0,
  );
  reset();
  user.can_delete = false;
  await go("view=users");
  assert.equal(
    await page.locator('[data-directory-action="delete-user"]').count(),
    0,
  );
  assert.deepEqual(errors, []);
  await writeFile(
    `${out}/results.json`,
    JSON.stringify({ measurements, errors }, null, 2),
  );
  console.log(
    JSON.stringify({ screenshots: measurements.length, errors, out }),
  );
} finally {
  await browser.close();
}
