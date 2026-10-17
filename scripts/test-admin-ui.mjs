import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const require = createRequire(
  process.env.PLAYWRIGHT_PACKAGE || import.meta.url,
);
const { chromium } = require("playwright");
const origin = process.env.UI_ORIGIN || "http://localhost:8794";
assert(["localhost", "127.0.0.1", "[::1]"].includes(new URL(origin).hostname));
const out = process.env.UI_OUTPUT || ".local/admin-directory";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage();
  const errors = [],
    consoleErrors = [],
    measurements = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (e) => {
    if (e.type() === "error") consoleErrors.push(e.text());
  });
  const now = Date.now();
  const users = [
    {
      id: "one",
      name: "Người dùng kiểm thử",
      email: "test@example.invalid",
      blocked: 0,
      created_at: now,
      link_count: 2,
    },
    {
      id: "two",
      name: "Tài khoản đang khóa",
      email: "blocked@example.invalid",
      blocked: 1,
      created_at: now,
      link_count: 1,
    },
    {
      id: "empty",
      name: "Chưa có link",
      email: "empty@example.invalid",
      blocked: 0,
      created_at: now,
      link_count: 0,
    },
  ];
  const base = {
    label: "Tài liệu dự án",
    target: "https://example.com/tai-lieu",
    status: "active",
    effective_status: "active",
    created_at: now,
    last_access_at: now,
    expires_at: now + 86400000,
    idle_expires_at: now + 86400000,
    fixed_expires_at: null,
    effective_expires_at: now + 86400000,
    owner_id: "one",
    owner_email: users[0].email,
    owner_name: users[0].name,
  };
  const initial = [
    { ...base, slug: "tai-lieu" },
    {
      ...base,
      slug: "khach",
      label: "Link của khách",
      owner_id: null,
      owner_email: null,
      owner_name: null,
    },
    {
      ...base,
      slug: "da-khoa",
      label: "Link đã bị khóa",
      status: "blocked",
      effective_status: "blocked",
      owner_id: "two",
      owner_email: users[1].email,
      owner_name: users[1].name,
    },
    {
      ...base,
      slug: "ten-dai",
      label:
        "Nội dung có tên dài để kiểm tra cách xuống dòng và khoảng cách trong danh sách quản trị",
      target: "https://example.com/" + "duong-dan-dai/".repeat(20),
    },
  ];
  let links = structuredClone(initial),
    member = true,
    listDelay = 0,
    detailDelay = 0,
    statsDelay = 0,
    failure = false,
    editFailure = false,
    lastEdit;
  await page.route("**/api/**", async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      path = url.pathname;
    const json = (body, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    if (path === "/api/me")
      return json({
        user: member ? { name: "Admin", email: "admin@example.invalid" } : null,
        admin: member,
        csrf: "fixture-only",
      });
    if (path.endsWith("/edit")) {
      if (editFailure) return json({ error: "Địa chỉ đã bị chặn." }, 400);
      lastEdit = { path, body: request.postDataJSON() };
      Object.assign(
        links.find((l) => l.slug === path.split("/")[4]),
        lastEdit.body,
      );
      return json({ ok: true });
    }
    if (path.endsWith("/stats")) {
      if (statsDelay)
        await new Promise((resolve) => setTimeout(resolve, statsDelay));
      const slug = path.split("/")[4];
      return json({
        since: new Date(now - 29 * 86400000).toISOString().slice(0, 10),
        enabled: true,
        tracked: slug !== "khach",
        gaps: [],
        rows:
          slug === "khach"
            ? []
            : [
                {
                  day: new Date(now).toISOString().slice(0, 10),
                  source: "Google",
                  device: "Máy tính",
                  clicks: 4,
                },
              ],
      });
    }
    if (path.startsWith("/api/admin/links/")) {
      if (detailDelay)
        await new Promise((resolve) => setTimeout(resolve, detailDelay));
      return json({
        link: links.find((l) => l.slug === path.split("/")[4]),
        expiryHeld: false,
      });
    }
    if (["/api/admin/links", "/api/admin/users"].includes(path)) {
      if (listDelay)
        await new Promise((resolve) => setTimeout(resolve, listDelay));
      if (failure) return json({ error: "Chưa kết nối được dịch vụ." }, 503);
      const q = (url.searchParams.get("q") || "").toLowerCase(),
        owner = url.searchParams.get("owner"),
        offset = Number(url.searchParams.get("cursor")) || 0;
      if (path.endsWith("/users")) {
        const state = url.searchParams.get("state");
        const rows = users.filter(
          (u) =>
            (u.name + u.email).toLowerCase().includes(q) &&
            (state === "all" || u.blocked === (state === "blocked" ? 1 : 0)),
        );
        return json({
          users: rows,
          total: rows.length,
          totalUsers: users.length,
          next: null,
        });
      }
      const state = url.searchParams.get("status");
      const rows = links.filter(
        (l) =>
          (!owner || l.owner_id === owner) &&
          (l.slug + l.label + l.target + l.owner_email)
            .toLowerCase()
            .includes(q) &&
          (state === "all" || l.effective_status === state),
      );
      return json({
        links: rows.slice(offset, offset + 25),
        total: rows.length,
        totalUsers: users.length,
        owner: users.find((u) => u.id === owner) || null,
        expiryHeld: false,
        next: rows.length > offset + 25 ? String(offset + 25) : null,
      });
    }
    return json({ error: "No fixture" }, 404);
  });
  const ready = async () => {
    await page.waitForSelector('#directory-results:not([aria-busy="true"])');
    await page.evaluate(() => document.fonts.ready);
  };
  const goto = async (query = "") => {
    await page.goto(origin + "/admin/" + query);
    await ready();
  };
  const capture = async (name) => {
    const measure = await page.evaluate(() => {
      const roots = [
        document.documentElement,
        ...document.querySelectorAll("dialog[open]"),
      ];
      return roots.map((el) => ({
        width: el.clientWidth,
        scroll: el.scrollWidth,
      }));
    });
    assert(
      measure.every((m) => m.scroll <= m.width),
      `${name}: overflow`,
    );
    assert.equal(await page.locator("img").count(), 0, "No injected markup");
    measurements.push({ name, measure });
    await page.screenshot({
      path: `${out}/${name}.png`,
      fullPage: true,
      animations: "disabled",
    });
  };
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: width < 700 ? 844 : 1000 });
    await goto();
    assert.equal(
      await page.locator('.admin-nav [aria-current="page"]').textContent(),
      "Link",
    );
    assert.match(
      await page.locator("#directory-summary").textContent(),
      /4 link.*3 tài khoản/,
    );
    assert.equal(await page.locator(".directory-row").count(), 4);
    assert.equal(
      await page
        .locator('[data-directory-action="edit"][data-slug="da-khoa"]')
        .count(),
      0,
    );
    await capture(`links-${width}`);
    if (width >= 768) {
      const tops = await page
        .locator(".directory-row")
        .first()
        .locator(".actions button")
        .evaluateAll((nodes) =>
          nodes.map((el) => el.getBoundingClientRect().top),
        );
      assert(
        Math.max(...tops) - Math.min(...tops) <= 1,
        "Admin actions should fit one row on tablet and desktop",
      );
    }
    await page
      .locator('[data-directory-action="detail"][data-slug="tai-lieu"]')
      .click();
    await page.locator("#link-detail-content dl").waitFor();
    assert.match(
      await page.locator("#link-detail-content").textContent(),
      /test@example.invalid/,
    );
    await capture(`detail-${width}`);
    await page.locator("#detail-edit").click();
    await page.locator("#edit-code").fill("ma-moi");
    await page.locator('[name="confirm_rename"]').check();
    await capture(`edit-${width}`);
    await page.keyboard.press("Escape");
    await page
      .locator('[data-directory-action="stats"][data-slug="tai-lieu"]')
      .click();
    await page.locator("#stats-content .stats-total").waitFor();
    assert.match(
      await page.locator("#stats-content").textContent(),
      /4.*lượt được ghi nhận/s,
    );
    await capture(`stats-${width}`);
    await page.keyboard.press("Escape");
    await page.locator('[data-admin-view="users"]').click();
    await ready();
    assert.match(
      await page.locator("#directory-summary").textContent(),
      /3 tài khoản/,
    );
    await capture(`users-${width}`);
    await page.locator('.user-row a[href*="owner=one"]').click();
    await ready();
    assert.equal(await page.locator(".directory-row").count(), 2);
    assert.match(
      await page.locator("#directory-owner").textContent(),
      /test@example.invalid/,
    );
    await capture(`owner-${width}`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await goto("?view=users");
  await page.locator('.user-row a[href*="owner=empty"]').click();
  await ready();
  assert.match(
    await page.locator("#directory-results").textContent(),
    /Không có link/,
  );
  await capture("empty-account");
  await goto();
  await page
    .locator('[data-directory-action="edit"][data-slug="tai-lieu"]')
    .click();
  await page.locator("#edit-code").fill("ma-moi");
  await page.locator('#edit-form button[type="submit"]').click();
  assert.equal(lastEdit, undefined);
  await page.locator('[name="confirm_rename"]').check();
  editFailure = true;
  await page.locator('#edit-form button[type="submit"]').click();
  await page
    .locator("#edit-message")
    .filter({ hasText: "Địa chỉ đã bị chặn" })
    .waitFor();
  assert(await page.locator("#edit-dialog").isVisible());
  editFailure = false;
  await page.locator('#edit-form [name="label"]').fill("Admin đã sửa");
  await page.locator('#edit-form button[type="submit"]').click();
  await page.waitForSelector("#edit-dialog", { state: "hidden" });
  await ready();
  assert.equal(lastEdit.path, "/api/admin/links/tai-lieu/edit");
  assert.equal(lastEdit.body.slug, "ma-moi");
  assert.equal(
    await page.locator(":focus").getAttribute("data-slug"),
    "ma-moi",
  );
  await page
    .locator('[data-directory-action="stats"][data-slug="khach"]')
    .click();
  await page
    .locator("#stats-content")
    .filter({ hasText: "Link khách không được ghi thống kê" })
    .waitFor();
  await page.keyboard.press("Escape");
  // Real pagination boundaries and round-trip navigation, using local fixtures only.
  links = Array.from({ length: 27 }, (_, i) => ({
    ...base,
    slug: `page-${String(i).padStart(2, "0")}`,
  }));
  await goto();
  assert.equal(await page.locator(".directory-row").count(), 25);
  await page.locator("#directory-next").click();
  await ready();
  assert.equal(await page.locator(".directory-row").count(), 2);
  assert(page.url().includes("cursor=25"));
  await page.locator("#directory-prev").click();
  await ready();
  assert.equal(await page.locator(".directory-row").count(), 25);
  // Failure keeps the previous page; retry ends the skeleton. Latest search wins.
  failure = true;
  await page.locator("#directory-refresh").click();
  await ready();
  assert.equal(await page.locator(".directory-row").count(), 25);
  assert.match(
    await page.locator("#directory-message").textContent(),
    /kết quả trước/,
  );
  failure = false;
  await page.locator("#directory-query").fill("no-match");
  await page.locator('#directory-filter button[type="submit"]').click();
  await ready();
  assert.equal(await page.locator(".directory-row").count(), 0);
  listDelay = 700;
  await page.locator("#directory-query").fill("page-01");
  await page.locator('#directory-filter button[type="submit"]').click();
  await page.locator("#directory-results .loading-placeholder").waitFor();
  await capture("loading-links");
  listDelay = 0;
  await page.locator("#directory-query").fill("page-02");
  await page.locator('#directory-filter button[type="submit"]').click();
  await ready();
  await page.waitForTimeout(800);
  assert.equal(await page.locator(".directory-row").count(), 1);
  assert.match(await page.locator(".directory-row").textContent(), /page-02/);
  statsDelay = 700;
  await page.locator('[data-directory-action="stats"]').click();
  await page.locator("#stats-content .loading-placeholder").waitFor();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(800);
  assert.equal(await page.locator("#stats-dialog").isVisible(), false);
  detailDelay = 700;
  await page.locator('[data-directory-action="detail"]').click();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(800);
  assert.equal(await page.locator("#link-detail-dialog").isVisible(), false);
  links = [
    {
      ...base,
      slug: "safe-text",
      label: "<img src=x onerror=alert(1)>",
      owner_email: "<script>unsafe</script>",
    },
  ];
  await goto();
  assert.equal(
    await page.locator(".directory-row img, .directory-row script").count(),
    0,
  );
  await page.evaluate(() => (document.documentElement.style.fontSize = "200%"));
  await capture("text-200-percent");
  member = false;
  await page.goto(origin + "/admin/");
  await page
    .locator("#admin-message")
    .filter({ hasText: "tài khoản quản trị" })
    .waitFor();
  assert.equal(await page.locator("#admin-directory").isVisible(), false);
  assert.deepEqual(errors, []);
  assert(
    consoleErrors.every((e) =>
      /Failed to load resource: the server responded with a status of (400|503)/.test(
        e,
      ),
    ),
    consoleErrors.join("\n"),
  );
  await writeFile(
    `${out}/results.json`,
    JSON.stringify({ measurements, errors, consoleErrors }, null, 2),
  );
  console.log(
    JSON.stringify({
      screenshots: measurements.length,
      errors,
      expectedFailureResponses: consoleErrors.length,
      out,
    }),
  );
} finally {
  await browser.close();
}
