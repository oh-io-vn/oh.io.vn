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
      if (b.action === "delete_user") {
        Object.assign(user, {
          deleted_at: now,
          restore_until: deadline,
          can_restore: true,
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
        filter === "trashed"
          ? entry.deleted_at != null
          : entry.deleted_at == null;
      return json({
        [isUsers ? "users" : "links"]: show ? [entry] : [],
        total: show ? 1 : 0,
        totalUsers: user.deleted_at == null ? 1 : 0,
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
      fullPage: true,
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
  for (const width of [1440, 768, 390, 320]) {
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
