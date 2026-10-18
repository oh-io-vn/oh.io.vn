import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const require = createRequire(
  process.env.PLAYWRIGHT_PACKAGE || import.meta.url,
);
const { chromium } = require("playwright");
const origin = process.env.UI_ORIGIN || "http://127.0.0.1:8797";
assert(["localhost", "127.0.0.1", "[::1]"].includes(new URL(origin).hostname));
const out = ".local/security/browser";
await mkdir(out, { recursive: true });
const payload =
  '<img src=x onerror="window.__xss=1">\'"<svg onload="window.__xss=1">';
const now = Date.now();
const user = {
  id: "fixture-owner",
  email: "fixture@example.invalid",
  name: payload,
  blocked: 0,
  created_at: now,
  link_count: 1,
};
const link = {
  slug: "fixture-link",
  target: "https://example.com/?q=%3Csvg%3E",
  label: payload,
  status: "active",
  effective_status: "active",
  owner_id: user.id,
  owner_email: user.email,
  owner_name: user.name,
  created_at: now,
  last_access_at: now,
  months: 12,
  fixed_expires_at: null,
  idle_expires_at: now + 86400000,
  expires_at: now + 86400000,
  effective_expires_at: now + 86400000,
};
const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = [];
try {
  // Test escaping even without relying on CSP as the last line of defense.
  const context = await browser.newContext({
    bypassCSP: true,
    serviceWorkers: "block",
  });
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    if (!url.pathname.startsWith("/api/")) return route.continue();
    const json = (data) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(data),
      });
    if (url.pathname === "/api/me")
      return json({ user, admin: true, csrf: "local-fixture-only" });
    if (url.pathname === "/api/links")
      return json({ links: [link], next: null, expiryHeld: false });
    if (url.pathname === "/api/admin/links")
      return json({
        links: [link],
        next: null,
        expiryHeld: false,
        total: 1,
        totalUsers: 1,
        owner: user,
      });
    if (url.pathname === "/api/admin/users")
      return json({ users: [user], next: null, total: 1, totalUsers: 1 });
    if (url.pathname === "/api/admin/blocklist")
      return json([{ kind: "url", value: "https://example.com/#" + payload }]);
    if (url.pathname === "/api/admin/overview")
      return json({
        policy: {
          create_enabled: 1,
          guest_enabled: 1,
          analytics_enabled: 1,
          expiry_hold: 0,
          guest_limit: 3,
          user_limit: 20,
          active_limit: 100,
          global_limit: 200,
          heartbeat: now,
          last_backup_at: now,
          monitoring: null,
        },
        links: [{ status: "active", count: 1 }],
        audit: [{ action: "add_block", subject: payload, created_at: now }],
      });
    if (url.pathname === "/api/admin/search")
      return json({ users: [user], links: [link] });
    throw new Error(
      "Unexpected API request in local browser test: " + url.pathname,
    );
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const [name, path, ready] of [
      ["dashboard", "/dashboard/", "#link-list .link-card"],
      [
        "admin-links",
        "/admin/?view=links",
        "#directory-results .directory-row",
      ],
      ["admin-users", "/admin/?view=users", "#directory-results .user-row"],
      [
        "admin-operations",
        "/admin/?view=operations",
        "#admin-content:not([hidden])",
      ],
    ]) {
      await page.goto(origin + path);
      await page.waitForSelector(ready);
      await page.evaluate(() => document.fonts.ready);
      if (name === "admin-operations") {
        await page
          .locator('#admin-search input[name="query"]')
          .fill("fixture@example.invalid");
        await page.locator('#admin-search button[type="submit"]').click();
        await page.waitForSelector("#admin-results .panel");
        await page
          .locator('#block-form select[name="kind"]')
          .selectOption("url");
        await page
          .locator('#block-form input[name="value"]')
          .fill("https://example.com/page#section");
        await page.locator('#block-form button[type="submit"]').click();
        await page.waitForSelector("dialog[open]");
        assert.ok(
          (await page.locator("dialog[open]").innerText()).includes(
            "phần sau dấu #",
          ),
        );
      }
      const state = await page.evaluate(
        (text) => ({
          executed: Boolean(window.__xss),
          unsafeElements: document.querySelectorAll(
            '[onerror],[onload],img[src="x"]',
          ).length,
          literalVisible: document.body.textContent.includes(text),
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
        }),
        payload,
      );
      assert.deepEqual(
        state,
        {
          executed: false,
          unsafeElements: 0,
          literalVisible: true,
          overflow: false,
        },
        `${name} at ${width}px`,
      );
      await page.screenshot({
        path: `${out}/${name}-${width}.png`,
        fullPage: true,
      });
      results.push({ name, width, ...state });
    }
  }
  assert.deepEqual(errors, []);
  await writeFile(
    `${out}/results.json`,
    JSON.stringify({ results, errors }, null, 2),
  );
  console.log(JSON.stringify({ scenarios: results.length, errors, out }));
} finally {
  await browser.close();
}
