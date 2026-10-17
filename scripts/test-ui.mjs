import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const require = createRequire(
  process.env.PLAYWRIGHT_PACKAGE || import.meta.url,
);
const { chromium } = require("playwright");
const out = process.env.UI_OUTPUT || ".local/ui-ux/after";
const origin = process.env.UI_ORIGIN || "http://localhost:8791";
assert(
  ["localhost", "127.0.0.1", "[::1]"].includes(new URL(origin).hostname),
  "UI tests may only target a local server",
);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (e) => pageErrors.push(e.message));
  let member = false,
    empty = false,
    networkError = false;
  let configDelay = 0,
    accountDelay = 0,
    statsDelay = 0;
  let listDelay = 0,
    listFailure = false,
    actionDelay = 0,
    actionFailure = false,
    overviewFailure = false,
    overviewDelay = 0,
    searchWithUser = false;
  let blocks = [],
    lastAction = null;
  let statsRows = Array.from({ length: 14 }, (_, i) => ({
    day: `2026-10-${String(i + 1).padStart(2, "0")}`,
    source: i % 2 ? "Google" : "Không xác định",
    device: i % 3 ? "Máy tính" : "Điện thoại",
    clicks: 20 + ((i * 17) % 64),
  }));
  let statsEnabled = true,
    statsGaps = [];
  const now = Date.now();
  const rows = [
    {
      slug: "tai-lieu",
      label: "Tài liệu dự án",
      target: "https://github.com/oh-io-vn/oh.io.vn",
      status: "active",
      created_at: now,
      expires_at: now + 31536000000,
      fixed_expires_at: null,
    },
    {
      slug: "bai-viet",
      label: "Bài viết mới nhất",
      target: "https://example.com/bai-viet/huong-dan-chia-se",
      status: "active",
      created_at: now,
      expires_at: now + 31536000000,
      fixed_expires_at: null,
    },
    {
      slug: "su-kien",
      label: "Đăng ký sự kiện",
      target: "https://example.com/su-kien",
      status: "expired",
      created_at: now - 31536000000,
      expires_at: now - 86400000,
      fixed_expires_at: null,
    },
    {
      slug: "a".repeat(64),
      label:
        "Đường dẫn kiểm thử với tên rất dài để kiểm tra khả năng xuống dòng trên màn hình nhỏ và trong các hộp thoại",
      target: "https://example.com/" + "tai-lieu-khong-ngat/".repeat(14),
      status: "active",
      created_at: now,
      expires_at: now + 31536000000,
      fixed_expires_at: null,
    },
  ];
  let links = structuredClone(rows);
  let lastCreate = null,
    lastEdit = null,
    deleteCount = 0,
    actionCount = 0;
  await page.route("https://challenges.cloudflare.com/**", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: 'let opts;window.turnstile={render:(n,o)=>(opts=o,"local-ui-fixture"),reset:()=>{},execute:()=>opts.callback("local-ui-fixture-token")};',
    }),
  );
  await page.route("**/api/**", async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      path = url.pathname;
    const failure = () =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Dịch vụ đang bận. Hãy thử lại." }),
      });
    const json = (data) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(data),
      });
    if (networkError)
      return route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Dịch vụ đang bận. Vui lòng thử lại." }),
      });
    if (path === "/api/me") {
      if (accountDelay)
        await new Promise((resolve) => setTimeout(resolve, accountDelay));
      return json({
        user: member
          ? {
              name: "Người kiểm thử",
              email: "preview@example.invalid",
              blocked: false,
            }
          : null,
        admin: member,
        csrf: "synthetic-ui-csrf",
      });
    }
    if (path === "/api/config") {
      if (configDelay)
        await new Promise((resolve) => setTimeout(resolve, configDelay));
      return json({
        createEnabled: true,
        guestEnabled: true,
        siteKey: "local-ui-fixture",
      });
    }
    if (path === "/api/links" && request.method() === "POST") {
      lastCreate = request.postDataJSON();
      return json({
        url: "https://oh.io.vn/link-moi",
        slug: "link-moi",
        expires_at: now + 7776000000,
        months: member ? 12 : 3,
      });
    }
    if (path === "/api/links") {
      if (listDelay)
        await new Promise((resolve) => setTimeout(resolve, listDelay));
      if (listFailure) return failure();
      const q = url.searchParams.get("q")?.toLowerCase() || "";
      return json({
        links: empty
          ? []
          : links.filter((l) =>
              (l.label + l.slug + l.target).toLowerCase().includes(q),
            ),
        next: null,
        expiryHeld: false,
      });
    }
    if (path.endsWith("/edit")) {
      lastEdit = request.postDataJSON();
      const slug = path.split("/")[3];
      Object.assign(
        links.find((l) => l.slug === slug),
        lastEdit,
      );
      return json({ ok: true });
    }
    if (request.method() === "DELETE") {
      deleteCount++;
      links = links.filter((l) => l.slug !== path.split("/")[3]);
      return json({ ok: true });
    }
    if (path.endsWith("/stats")) {
      if (statsDelay)
        await new Promise((resolve) => setTimeout(resolve, statsDelay));
      return json({
        since: "2026-09-18",
        enabled: statsEnabled,
        gaps: statsGaps,
        rows: statsRows,
      });
    }
    if (path === "/api/admin/overview") {
      if (overviewDelay)
        await new Promise((resolve) => setTimeout(resolve, overviewDelay));
      if (overviewFailure) return failure();
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
          monitoring: JSON.stringify({
            at: now,
            requests: 1250,
            reads: 18900,
            writes: 240,
            databaseBytes: 245000,
            level: 0,
          }),
        },
        links: [{ status: "active", count: 3 }],
        audit: [],
      });
    }
    if (path === "/api/admin/blocklist") return json(blocks);
    if (path === "/api/admin/action") {
      actionCount++;
      lastAction = request.postDataJSON();
      if (actionDelay)
        await new Promise((resolve) => setTimeout(resolve, actionDelay));
      if (actionFailure) return failure();
      if (lastAction.action === "add_block")
        blocks.push({ kind: lastAction.kind, value: lastAction.subject });
      if (lastAction.action === "remove_block")
        blocks = blocks.filter((b) => b.value !== lastAction.subject);
      return json({ ok: true });
    }
    if (path === "/api/admin/search")
      return json({
        users: searchWithUser
          ? [
              {
                id: "ui-user",
                name: "Tài khoản kiểm thử",
                email: "test@example.invalid",
                blocked: false,
              },
            ]
          : [],
        links: [],
      });
    if (path === "/api/logout") {
      member = false;
      return json({ ok: true });
    }
    return route.fulfill({
      status: 404,
      contentType: "application/json",
      body: '{"error":"No UI fixture"}',
    });
  });
  const goto = async (path) => {
    await page.goto(
      origin + (path === "/admin/" ? "/admin/?view=operations" : path),
    );
    await page.evaluate(() => document.fonts.ready);
    if (path === "/" && !networkError)
      await page.waitForSelector("#shorten-form button[type=submit]:enabled");
    if (path === "/dashboard/")
      await page.waitForFunction(
        () =>
          !document
            .querySelector("#link-list")
            ?.textContent.includes("Đang tải"),
      );
    if (path === "/admin/" && member)
      await page.waitForSelector("#admin-content:not([hidden])");
  };
  const measure = async (name) => {
    const m = await page.evaluate(() => {
      const d = document.documentElement;
      const dialogs = [...document.querySelectorAll("dialog[open]")].map(
        (el) => ({
          id: el.id,
          width: el.clientWidth,
          scroll: el.scrollWidth,
          height: el.clientHeight,
          scrollHeight: el.scrollHeight,
        }),
      );
      const iconFailures = [...document.querySelectorAll(".ui-icon")]
        .filter((icon) => icon.getClientRects().length)
        .flatMap((icon) => {
          const failures = [];
          const box = icon.getBoundingClientRect();
          // Rotation expands the axis-aligned bounding box of a spinner. Use
          // its rendered CSS size for scale, and bounds only for containment.
          const style = getComputedStyle(icon);
          const width = parseFloat(style.width);
          const height = parseFloat(style.height);
          const name = icon.getAttribute("data-icon");
          if (
            icon.getAttribute("aria-hidden") !== "true" ||
            icon.getAttribute("focusable") !== "false"
          )
            failures.push(`${name}: decorative SVG is exposed to focus/AT`);
          const control = icon.closest("a, button");
          if (control) {
            const bounds = control.getBoundingClientRect();
            const fontSize = parseFloat(getComputedStyle(control).fontSize);
            if (!control.textContent.trim())
              failures.push(`${name}: missing visible label`);
            if (bounds.width < 44 || bounds.height < 44)
              failures.push(`${name}: target smaller than 44px`);
            if (width > fontSize * 1.5 || Math.abs(width - height) > 1)
              failures.push(`${name}: icon oversized or distorted`);
            if (
              box.left < bounds.left ||
              box.right > bounds.right ||
              box.top < bounds.top ||
              box.bottom > bounds.bottom
            )
              failures.push(`${name}: icon outside control bounds`);
          }
          return failures;
        });
      return {
        width: d.clientWidth,
        scroll: d.scrollWidth,
        dialogs,
        iconFailures,
      };
    });
    assert(
      m.scroll <= m.width,
      `${name}: document overflow ${JSON.stringify(m)}`,
    );
    for (const d of m.dialogs)
      assert(
        d.scroll <= d.width,
        `${name}: dialog overflow ${JSON.stringify(d)}`,
      );
    assert.deepEqual(
      m.iconFailures,
      [],
      `${name}: ${m.iconFailures.join(", ")}`,
    );
    return { name, ...m };
  };
  async function checkFilteredRename() {
    member = true;
    empty = false;
    networkError = false;
    listFailure = false;
    links = structuredClone([rows[0]]);
    await page.setViewportSize({ width: 390, height: 900 });
    await goto("/dashboard/");
    await page.locator("#search").fill("tai-lieu");
    await page.locator("#search-button").click();
    await page.waitForFunction(
      () => document.querySelectorAll(".link-card").length === 1,
    );
    await page.locator('[data-action="edit"]').click();
    await page.locator("#edit-code").fill("filtered-code");
    await page.locator('[name="confirm_rename"]').check();
    await page.locator('#edit-form button[type="submit"]').click();
    await page.waitForSelector("#edit-dialog:not([open])", { state: "hidden" });
    await page
      .getByRole("heading", { name: "Không tìm thấy link", exact: true })
      .waitFor();
    assert.equal(await page.locator(":focus").getAttribute("id"), "search");
    assert.match(
      await page.locator("#dashboard-notice").textContent(),
      /filtered-code/,
    );
    await page.locator("#clear-search").click();
    await page
      .locator('[data-action="edit"][data-slug="filtered-code"]')
      .waitFor();
    await page.screenshot({
      animations: "disabled",
      path: `${out}/rename-filter-recovery.png`,
      fullPage: true,
    });
  }
  const measurements = [];
  // A slow configuration response keeps a single pending hint, then restores
  // guest guidance. Reduced motion stops every placeholder animation.
  configDelay = 1500;
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(origin + "/");
  await page.locator("#home-loading").waitFor();
  assert.equal(await page.locator("#guest-hint").isVisible(), false);
  assert.equal(
    await page.locator('#shorten-form button[type="submit"]').isEnabled(),
    false,
  );
  assert.equal(
    await page
      .locator(".skeleton")
      .first()
      .evaluate((el) => getComputedStyle(el).animationName),
    "none",
  );
  await page.waitForSelector('#shorten-form button[type="submit"]:enabled');
  assert.equal(await page.locator("#home-loading").count(), 0);
  assert.equal(await page.locator("#guest-hint").isVisible(), true);
  configDelay = 0;
  await page.emulateMedia({ reducedMotion: "no-preference" });
  // Before auth/data resolves: every route remains usable and no SVG expands.
  member = true;
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of [
      "/",
      "/dashboard/",
      "/admin/",
      "/about/",
      "/privacy/",
      "/terms/",
      "/report/",
    ]) {
      accountDelay = 1500;
      await page.goto(
        origin + (path === "/admin/" ? "/admin/?view=operations" : path),
      );
      await page.evaluate(() => document.fonts.ready);
      await page.locator("#account .loading-placeholder").waitFor();
      assert.equal(await page.locator("#login-link").isVisible(), false);
      assert.equal(
        await page
          .locator(
            ".loading-placeholder input, .loading-placeholder button, .loading-placeholder a",
          )
          .count(),
        0,
      );
      const oversized = await page
        .locator("svg:visible")
        .evaluateAll(
          (nodes) =>
            nodes.filter((el) => el.getBoundingClientRect().width > 32).length,
        );
      assert.equal(oversized, 0, "Initial SVGs must have bounded sizes");
      measurements.push(await measure(`loading-${path}-${width}`));
      await page.screenshot({
        animations: "disabled",
        path: `${out}/loading-${path.split("/")[1] || "home"}-${width}.png`,
        fullPage: true,
      });
      await page.locator("#logout").waitFor();
      await page.waitForFunction(
        () => !document.querySelector(".loading-placeholder"),
      );
    }
  }
  accountDelay = 0;
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await goto("/");
    await page.locator("#custom-options summary").click();
    const alignment = await page.locator(".slug-input").evaluate((el) => {
      const prefix = el.querySelector("span").getBoundingClientRect(),
        input = el.querySelector("input").getBoundingClientRect();
      return Math.abs(
        (prefix.top + prefix.bottom) / 2 - (input.top + input.bottom) / 2,
      );
    });
    assert(alignment <= 1, "Slug prefix and value must share the same center");
    await page.screenshot({
      animations: "disabled",
      path: `${out}/slug-aligned-${width}.png`,
      fullPage: true,
    });
    await goto("/dashboard/");
    await page.locator('[data-action="edit"]').first().click();
    await page.locator("#edit-code").fill("renamed-code");
    assert(await page.locator("#rename-warning").isVisible());
    await page.locator('#edit-form button[type="submit"]').click();
    assert(
      await page.locator("#edit-dialog").isVisible(),
      "Rename cannot submit without acknowledging the broken old address",
    );
    await page.locator('[name="confirm_rename"]').check();
    measurements.push(await measure(`rename-${width}`));
    await page.screenshot({
      animations: "disabled",
      path: `${out}/rename-${width}.png`,
    });
    await page.locator('#edit-form button[type="submit"]').click();
    await page.waitForSelector("#edit-dialog:not([open])", { state: "hidden" });
    await page
      .locator('[data-action="edit"][data-slug="renamed-code"]')
      .waitFor();
    assert.equal(
      await page.locator(":focus").getAttribute("data-slug"),
      "renamed-code",
    );
    assert.match(
      await page.locator("#dashboard-notice").textContent(),
      /Địa chỉ cũ đã ngừng hoạt động/,
    );
    links = structuredClone(rows);
    await goto("/dashboard/");
    statsDelay = 1500;
    await page.locator('[data-action="stats"]').first().click();
    await page.locator("#stats-content .loading-placeholder").waitFor();
    assert.equal(await page.locator("#export-excel").isEnabled(), false);
    measurements.push(await measure(`stats-loading-${width}`));
    await page.screenshot({
      animations: "disabled",
      path: `${out}/stats-loading-${width}.png`,
    });
    await page.keyboard.press("Escape");
    assert.equal(
      await page.locator("#stats-dialog").isVisible(),
      false,
      "Loading must not trap the user in a dialog",
    );
    await page.waitForFunction(
      () => !document.querySelector("#stats-content").hasAttribute("aria-busy"),
    );
    assert.equal(
      await page.locator("#stats-dialog").isVisible(),
      false,
      "A late response must not reopen the dialog",
    );
    statsDelay = 0;
    await goto("/admin/");
    if (width > 900) {
      const bottoms = await page
        .locator("#admin-content > .admin-grid > .panel")
        .evaluateAll((nodes) =>
          nodes.map((n) => n.getBoundingClientRect().bottom),
        );
      assert(
        Math.abs(bottoms[0] - bottoms[1]) <= 1,
        "Admin panels align at their bottom edges",
      );
    }
    const space = await page
      .locator("#expiry-hold-help")
      .evaluate(
        (el) =>
          el.getBoundingClientRect().top -
          el.previousElementSibling.getBoundingClientRect().bottom,
      );
    assert(space >= 12, "Helper text needs clearance below divider");
    searchWithUser = true;
    await page.locator("#admin-query").fill("test@example.invalid");
    await page.locator("#admin-search button").click();
    await page.locator("[data-admin-action=block_user]").waitFor();
    const gap = await page
      .locator("#admin-results")
      .evaluate(
        (el) =>
          el.getBoundingClientRect().top -
          document
            .querySelector("#admin-search-message")
            .getBoundingClientRect().bottom,
      );
    assert(gap >= 16, "Search notice and results must not touch");
    for (const selector of [
      "#logout",
      "[data-admin-action=block_user]",
      "[data-admin-action=block_user_links]",
      "#block-form button",
    ]) {
      assert.equal(
        await page
          .locator(selector)
          .evaluate((el) => getComputedStyle(el).color),
        "rgb(165, 50, 50)",
      );
    }
    measurements.push(await measure(`admin-spacing-${width}`));
    await page.screenshot({
      animations: "disabled",
      path: `${out}/admin-spacing-${width}.png`,
      fullPage: true,
    });
  }
  searchWithUser = false;
  member = false;

  const paths = [
    "/",
    "/dashboard/",
    "/admin/",
    "/about/",
    "/privacy/",
    "/terms/",
    "/report/",
  ];
  for (const mode of ["guest", "member"]) {
    member = mode === "member";
    for (const width of [320, 390, 768, 1280, 1440]) {
      await page.setViewportSize({ width, height: width < 700 ? 844 : 1000 });
      for (const path of paths) {
        await goto(path);
        const name = `${mode}-${path === "/" ? "home" : path.split("/")[1]}-${width}`;
        measurements.push(await measure(name));
        assert.equal(await page.locator("h1").count(), 1);
        if (
          ["/", "/dashboard/", "/about/"].includes(path) &&
          (member || path !== "/dashboard/")
        ) {
          assert.equal(
            await page
              .locator(
                path === "/about/"
                  ? 'footer a[aria-current="page"]'
                  : '.nav-link[aria-current="page"]',
              )
              .getAttribute("href"),
            path,
          );
        }
        if (path === "/admin/" && member)
          assert.equal(
            await page
              .locator('.user-menu [aria-current="page"]')
              .getAttribute("href"),
            "/admin/",
          );
        if ([390, 768, 1440].includes(width))
          await page.screenshot({
            animations: "disabled",
            path: `${out}/${name}.png`,
            fullPage: true,
          });
      }
    }
  }
  // Small-screen landscape and enlarged text layouts.
  for (const width of [320, 390, 844]) {
    await page.setViewportSize({ width, height: 390 });
    for (const path of paths) {
      await goto(path);
      measurements.push(await measure(`landscape-${path}-${width}`));
    }
  }
  // Keyboard access and navigation on the real rendered page.
  member = false;
  await page.setViewportSize({ width: 1440, height: 1000 });
  await goto("/");
  await page.keyboard.press("Tab");
  assert.equal(await page.locator(":focus").getAttribute("class"), "skip-link");
  await page.keyboard.press("Enter");
  assert.equal(await page.locator(":focus").getAttribute("id"), "main-content");
  assert.equal(
    await page.locator('.nav-link[aria-current="page"]').getAttribute("href"),
    "/",
  );
  assert(await page.locator('label[for="target"]').isVisible());
  // Guest creation and copying use controlled fixture API responses only.
  await page.locator("#target").fill("https://example.com/guest-test");
  await page.locator('#shorten-form button[type="submit"]').click();
  await page.waitForSelector("#result:not([hidden])");
  assert.equal(lastCreate.target, "https://example.com/guest-test");
  assert.equal(lastCreate.turnstile, "local-ui-fixture-token");
  // A click on an SVG path must reach the same action as the text label.
  await page.locator("#copy-result .ui-icon").click();
  await page.locator('#copy-result [data-icon="check"]').waitFor();
  assert.equal(
    await page.locator('#copy-result [data-icon="check"]').count(),
    1,
  );
  assert.equal(
    await page.evaluate(() => navigator.clipboard.readText()),
    "https://oh.io.vn/link-moi",
  );
  await page.screenshot({
    animations: "disabled",
    path: `${out}/guest-result-desktop.png`,
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  measurements.push(await measure("guest-result-mobile"));
  await page.screenshot({
    animations: "disabled",
    path: `${out}/guest-result-mobile.png`,
    fullPage: true,
  });
  // Member customization, search, edits, stats, Excel, deletion/cancel.
  member = true;
  await goto("/");
  await page.locator("#custom-options summary").click();
  await page.locator("#target").fill("https://example.com/member-test");
  await page.locator('[name="slug"]').fill("tuy-chinh");
  await page.locator('[name="label"]').fill("Tên ghi nhớ");
  measurements.push(await measure("custom-options-mobile"));
  await page.screenshot({
    animations: "disabled",
    path: `${out}/member-custom-mobile.png`,
    fullPage: true,
  });
  await page.locator('#shorten-form button[type="submit"]').click();
  await page.waitForSelector("#result:not([hidden])");
  assert.equal(lastCreate.slug, "tuy-chinh");
  assert.equal(lastCreate.label, "Tên ghi nhớ");
  await goto("/dashboard/");
  await page.locator("#search").fill("no-match");
  await page.locator("#search-button").click();
  await page
    .getByRole("heading", { name: "Không tìm thấy link", exact: true })
    .waitFor();
  await page.screenshot({
    animations: "disabled",
    path: `${out}/search-empty-mobile.png`,
    fullPage: true,
  });
  await page.locator("#search").fill("");
  await page.locator("#search-button").click();
  await page.waitForSelector(".link-card");
  await page.locator('[data-action="edit"] .ui-icon').first().click();
  await page.locator('#edit-form [name="label"]').fill("Tài liệu đã chỉnh sửa");
  await page.setViewportSize({ width: 320, height: 390 });
  measurements.push(await measure("edit-short-mobile"));
  await page.screenshot({
    animations: "disabled",
    path: `${out}/edit-short-mobile.png`,
    fullPage: false,
  });
  await page.locator('#edit-form button[type="submit"]').click();
  await page.waitForSelector("#edit-dialog:not([open])", { state: "attached" });
  assert.equal(lastEdit.label, "Tài liệu đã chỉnh sửa");
  await page.locator('[data-action="stats"]').first().click();
  await page.waitForSelector("#stats-dialog[open]");
  await page.waitForSelector("#stats-content:not([aria-busy])");
  measurements.push(await measure("stats-short-mobile"));
  await page.screenshot({
    animations: "disabled",
    path: `${out}/stats-short-mobile.png`,
    fullPage: false,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    animations: "disabled",
    path: `${out}/stats-desktop.png`,
    fullPage: false,
  });
  const dl = page.waitForEvent("download");
  await page.locator("#export-excel").click();
  const download = await dl;
  await download.saveAs(`${out}/${download.suggestedFilename()}`);
  assert(download.suggestedFilename().endsWith(".xlsx"));
  await page.keyboard.press("Escape");
  // Sparse statistics must preserve calendar spacing and never stretch one bar.
  const regularStatsRows = statsRows;
  statsRows = [
    { day: "2026-10-17", source: "Zalo", device: "Điện thoại", clicks: 1 },
    { day: "2026-10-17", source: "Khác", device: "Máy tính", clicks: 1 },
  ];
  for (const [width, height] of [
    [1440, 690],
    [768, 900],
    [390, 844],
    [320, 390],
  ]) {
    await page.setViewportSize({ width, height });
    const trigger = page.locator('[data-action="stats"]').first();
    await trigger.click();
    await page.waitForSelector("#stats-dialog[open]");
    await page.waitForSelector("#stats-content:not([aria-busy])");
    assert.equal(await page.locator(".chart-bar").count(), 30);
    assert.equal(
      await page.locator(".chart-axis time").first().textContent(),
      "18/09/2026",
    );
    assert.equal(
      await page.locator(".chart-axis time").last().textContent(),
      "17/10/2026",
    );
    const chartGeometry = await page.locator(".chart").evaluate((el) => {
      const bars = [...el.children].map((bar) => bar.getBoundingClientRect());
      return {
        width: el.clientWidth,
        positive: bars.filter((bar) => bar.height > 0).map((bar) => bar.width),
      };
    });
    assert.equal(chartGeometry.positive.length, 1);
    assert(
      chartGeometry.positive[0] <= chartGeometry.width / 20,
      "One day must not fill the plot",
    );
    measurements.push(await measure(`single-day-stats-${width}`));
    await page.screenshot({
      animations: "disabled",
      path: `${out}/stats-single-day-${width}.png`,
    });
    const header = page.locator("#stats-dialog .dialog-top");
    const body = page.locator("#stats-dialog .dialog-body");
    const before = await header.boundingBox();
    await page.getByText("Xem số liệu từng ngày", { exact: true }).click();
    assert.equal(
      await page.locator("#stats-content details[open] .stat-row").count(),
      30,
    );
    await body.evaluate((el) => (el.scrollTop = 180));
    const after = await header.boundingBox();
    assert.deepEqual(
      after,
      before,
      "Dialog heading must stay in its own fixed row",
    );
    const boundaries = await body.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      const top = el.previousElementSibling.getBoundingClientRect();
      const hit = document.elementFromPoint(
        top.left + top.width / 2,
        top.top + top.height / 2,
      );
      return {
        separated: rect.top >= top.bottom,
        headerHit: el.previousElementSibling.contains(hit),
        scrolled: el.scrollTop,
        outerScroll: el.parentElement.scrollTop,
        width: el.clientWidth,
        scrollWidth: el.scrollWidth,
      };
    });
    assert(
      boundaries.separated && boundaries.headerHit && boundaries.scrolled > 0,
    );
    assert.equal(boundaries.outerScroll, 0);
    assert(boundaries.scrollWidth <= boundaries.width);
    await page.screenshot({
      animations: "disabled",
      path: `${out}/stats-scrolled-${width}.png`,
    });
    // Keyboard focus can reach the export action and returns to the opener.
    await page.locator("#stats-dialog [data-close]").focus();
    for (
      let i = 0;
      i < 5 &&
      (await page.locator(":focus").getAttribute("id")) !== "export-excel";
      i++
    )
      await page.keyboard.press("Tab");
    assert.equal(
      await page.locator(":focus").getAttribute("id"),
      "export-excel",
    );
    const exportBox = await page.locator("#export-excel").boundingBox();
    const bodyBox = await body.boundingBox();
    assert(
      exportBox.y >= bodyBox.y &&
        exportBox.y + exportBox.height <= bodyBox.y + bodyBox.height + 1,
    );
    await page.keyboard.press("Escape");
    assert.equal(
      await page.locator(":focus").getAttribute("data-action"),
      "stats",
    );
    await trigger.click();
    await page.waitForSelector("#stats-dialog[open]");
    await page.waitForSelector("#stats-content:not([aria-busy])");
    assert.equal(
      await body.evaluate((el) => el.scrollTop),
      0,
      "Reopening statistics starts at the top",
    );
    await page.keyboard.press("Escape");
  }
  statsRows = [];
  statsEnabled = false;
  statsGaps = [
    {
      started_at: now - 86400000,
      ended_at: null,
      reason: "Tạm dừng ghi thống kê",
    },
  ];
  await page.locator('[data-action="stats"]').first().click();
  await page.waitForSelector("#stats-dialog[open]");
  await page.waitForSelector("#stats-content:not([aria-busy])");
  assert.equal(await page.locator(".chart").count(), 0);
  assert(
    (await page.locator("#stats-content").textContent()).includes(
      "Chưa có lượt truy cập.",
    ),
  );
  assert(
    (await page.locator("#stats-content .notice").textContent()).includes(
      "Thống kê có thời gian bị thiếu.",
    ),
  );
  await page.keyboard.press("Escape");
  statsRows = regularStatsRows;
  statsEnabled = true;
  statsGaps = [];
  await page.locator('[data-action="delete"]').first().click();
  await page.locator("#delete-dialog [data-close]").click();
  assert.equal(deleteCount, 0);
  await page.locator('[data-action="delete"]').first().click();
  await page.locator("#confirm-delete").click();
  await page.waitForSelector("#delete-dialog:not([open])", {
    state: "attached",
  });
  assert.equal(deleteCount, 1);
  empty = true;
  await goto("/dashboard/");
  await page
    .getByRole("link", { name: "Tạo link đầu tiên", exact: true })
    .waitFor();
  await page.screenshot({
    animations: "disabled",
    path: `${out}/member-empty-desktop.png`,
    fullPage: true,
  });
  empty = false;
  // Admin forms retain API behavior, using fixtures only.
  await goto("/admin/");
  for (const width of [1440, 1024, 768]) {
    await page.setViewportSize({ width, height: 900 });
    const tops = await page
      .locator(".limits input")
      .evaluateAll((inputs) =>
        inputs.map((el) => el.getBoundingClientRect().top),
      );
    assert(
      Math.abs(tops[0] - tops[1]) < 1 && Math.abs(tops[2] - tops[3]) < 1,
      "Paired inputs align even when a label wraps",
    );
  }
  const blockSelect = page.locator("#block-form select");
  await blockSelect.focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  assert.equal(await blockSelect.inputValue(), "url");
  await blockSelect.click();
  await page.screenshot({
    animations: "disabled",
    path: `${out}/admin-picker-open.png`,
  });
  await page.getByRole("option", { name: "Tên miền và tên miền con" }).click();
  assert.equal(await blockSelect.inputValue(), "host");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator('#policy-form button[type="submit"]').click();
  await page.waitForFunction(
    () =>
      document.querySelector("#policy-message")?.textContent ===
      "Đã lưu cấu hình dịch vụ.",
  );
  assert.equal(actionCount, 1);
  await page.locator('#block-form [name="value"]').fill("example.invalid");
  await page.locator('#block-form button[type="submit"]').click();
  await page.waitForSelector("#admin-confirm-dialog[open]");
  assert.equal(actionCount, 1);
  await page.locator("#confirm-admin-action").click();
  await page.waitForSelector("#admin-confirm-dialog:not([open])", {
    state: "attached",
  });
  assert.equal(actionCount, 2);
  await page.locator('#admin-search [name="query"]').fill("missing-link");
  await page.locator("#admin-search button").click();
  await page.waitForFunction(
    () =>
      document.querySelector("#admin-search-message")?.textContent ===
      "Tìm thấy 0 tài khoản và 0 link.",
  );
  // Donation, focus restoration, reduced motion, error response, 200% text scale.
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: width === 320 ? 390 : 844 });
    await goto("/");
    await page.locator("footer [data-donate]").click();
    measurements.push(await measure(`donate-${width}`));
    await page.screenshot({
      animations: "disabled",
      path: `${out}/donate-${width}.png`,
      fullPage: false,
    });
    await page.keyboard.press("Escape");
    assert.equal(await page.locator(":focus").getAttribute("data-donate"), "");
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(
    await page
      .locator(".primary")
      .first()
      .evaluate((el) => getComputedStyle(el).transitionDuration),
    "0s",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await goto("/about/");
  await page.evaluate(() => (document.documentElement.style.fontSize = "200%"));
  measurements.push(await measure("text-zoom-200-percent"));
  await page.screenshot({
    animations: "disabled",
    path: `${out}/text-zoom-mobile.png`,
    fullPage: true,
  });
  for (const mode of ["guest", "member"]) {
    member = mode === "member";
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      for (const path of paths) {
        await goto(path);
        await page.evaluate(
          () => (document.documentElement.style.fontSize = "200%"),
        );
        measurements.push(await measure(`text-200-${mode}-${path}-${width}`));
        if (member) {
          const overlap = await page.evaluate(() => {
            const a = document.querySelector(".brand").getBoundingClientRect(),
              b = document.querySelector(".user-menu").getBoundingClientRect();
            return (
              a.left < b.right &&
              a.right > b.left &&
              a.top < b.bottom &&
              a.bottom > b.top
            );
          });
          assert.equal(
            overlap,
            false,
            "Enlarged account navigation overlaps brand",
          );
        }
      }
    }
  }
  networkError = true;
  await goto("/");
  await page.waitForFunction(
    () => !!document.querySelector("#global-notice")?.textContent,
  );
  measurements.push(await measure("network-error-mobile"));
  await page.screenshot({
    animations: "disabled",
    path: `${out}/network-error-mobile.png`,
    fullPage: true,
  });
  // Focused regressions for validation, pending requests and destructive actions.
  networkError = false;
  member = true;
  await goto("/");
  await page.locator("#target").fill("https://example.com/validation");
  await page.locator("#custom-options summary").click();
  await page.locator("#slug").fill("ab");
  await page.locator("#custom-options summary").click();
  const createBeforeInvalid = lastCreate;
  await page.locator("#shorten-form button[type=submit]").click();
  assert.equal(await page.locator("#custom-options").getAttribute("open"), "");
  assert.equal(await page.locator(":focus").getAttribute("id"), "slug");
  assert.equal(
    await page.locator("#slug").getAttribute("aria-invalid"),
    "true",
  );
  assert.equal(
    lastCreate,
    createBeforeInvalid,
    "Invalid slug must not reach the API",
  );
  await page.screenshot({
    animations: "disabled",
    path: `${out}/invalid-slug-mobile.png`,
    fullPage: true,
  });
  await page.locator("#slug").fill("ma-hop-le");
  assert.equal(
    await page.locator("#slug").evaluate((el) => el.validity.patternMismatch),
    false,
  );
  await page.locator("#shorten-form button[type=submit]").click();
  await page.waitForSelector("#result:not([hidden])");
  assert.equal(lastCreate.slug, "ma-hop-le");
  assert.equal(await page.locator(":focus").getAttribute("id"), "result");
  await page.locator("#copy-result").click();
  await page.locator("#copy-result").click();
  assert.equal(
    await page.locator("#copy-result").getAttribute("aria-label"),
    "Đã sao chép",
  );
  await page.waitForFunction(
    () => document.querySelector("#copy-result").textContent === "Sao chép",
  );
  assert.equal(
    await page.locator("#copy-result").getAttribute("aria-label"),
    null,
  );
  assert.equal(
    await page.locator('#copy-result [data-icon="copy"]').count(),
    1,
  );

  // Search remains keyboard-operable while the initial list is pending.
  listDelay = 650;
  await page.goto(origin + "/dashboard/");
  await page.locator("#link-list[aria-busy=true]").waitFor();
  await page.locator("#search").fill("bai-viet");
  await page.locator("#search").press("Enter");
  await page.waitForFunction(() =>
    document.querySelector("#list-status").textContent.includes("1 link"),
  );
  assert.equal(new URL(page.url()).searchParams.get("q"), "bai-viet");
  assert.equal(await page.locator(".link-card").count(), 1);
  assert.equal(
    await page.locator("#link-list").getAttribute("aria-busy"),
    null,
  );
  listDelay = 0;
  await page.locator("#clear-search").click();
  await page.waitForFunction(
    () => !document.querySelector("#link-list").hasAttribute("aria-busy"),
  );
  assert.equal(new URL(page.url()).searchParams.has("q"), false);
  assert.equal(await page.locator(":focus").getAttribute("id"), "search");
  await page.reload();
  await page.waitForSelector(".link-card");

  // A failed search labels the previous results; retry recovers without losing input.
  listFailure = true;
  await page.locator("#search").fill("bai-viet");
  await page.locator("#search").press("Enter");
  await page.waitForFunction(() =>
    document
      .querySelector("#list-status")
      .textContent.includes("kết quả trước đó"),
  );
  await page.screenshot({
    animations: "disabled",
    path: `${out}/search-error-mobile.png`,
    fullPage: true,
  });
  listFailure = false;
  await page.locator("#search-button").click();
  await page.waitForFunction(() =>
    document.querySelector("#list-status").textContent.includes("1 link"),
  );
  await page.locator("[data-action=edit]").click();
  assert.match(
    await page.locator("#edit-slug").textContent(),
    /oh\.io\.vn\/bai-viet/,
  );
  await page.locator("#edit-form [name=label]").fill("Tên vừa lưu");
  await page.locator("#edit-form button[type=submit]").click();
  await page.waitForFunction(() =>
    document
      .querySelector("#dashboard-notice")
      .textContent.includes("Đã lưu thay đổi"),
  );
  assert.equal(
    await page.locator(":focus").getAttribute("data-action"),
    "edit",
  );
  await page.locator("[data-action=delete]").click();
  assert.match(await page.locator("#delete-context").textContent(), /bai-viet/);
  await page.screenshot({
    animations: "disabled",
    path: `${out}/delete-context-mobile.png`,
    fullPage: false,
  });
  await page.keyboard.press("Escape");
  assert.equal(
    await page.locator(":focus").getAttribute("data-action"),
    "delete",
  );

  // Admin settings are not editable before their current values are known.
  overviewDelay = 650;
  await page.goto(origin + "/admin/?view=operations");
  await page.waitForFunction(() =>
    document.querySelector("#admin-message").textContent.includes("Đang tải"),
  );
  assert.equal(await page.locator("#admin-content").isVisible(), false);
  await page.waitForSelector("#admin-content:not([hidden])");
  assert.equal(await page.locator("[name=guest_limit]").inputValue(), "3");
  overviewDelay = 0;
  overviewFailure = true;
  await page.reload();
  await page.waitForSelector("#retry-service:not([hidden])");
  assert.equal(await page.locator("#admin-content").isVisible(), false);
  await page.screenshot({
    animations: "disabled",
    path: `${out}/admin-load-error-mobile.png`,
    fullPage: true,
  });
  overviewFailure = false;

  await page.locator("#retry-service").click();
  await page.waitForSelector("#admin-content:not([hidden])");

  // No admin write occurs until explicit confirmation; busy dialogs resist dismissal.
  searchWithUser = true;
  await page.locator("#admin-query").fill("test@example.invalid");
  await page.locator("#admin-search button").click();
  await page.locator("[data-admin-action=block_user]").waitFor();
  const actionsBefore = actionCount;
  await page.locator("[data-admin-action=block_user]").click();
  await page.waitForSelector("#admin-confirm-dialog[open]");
  assert.equal(actionCount, actionsBefore);
  assert.match(
    await page.locator("#admin-confirm-subject").textContent(),
    /test@example.invalid/,
  );
  await page.keyboard.press("Escape");
  assert.equal(actionCount, actionsBefore);
  assert.equal(
    await page.locator(":focus").getAttribute("data-admin-action"),
    "block_user",
  );
  await page.locator("[data-admin-action=block_user]").click();
  await page.screenshot({
    animations: "disabled",
    path: `${out}/admin-confirm-mobile.png`,
    fullPage: false,
  });
  measurements.push(await measure("admin-confirm-mobile"));
  actionFailure = true;
  await page.locator("#confirm-admin-action").click();
  await page.waitForFunction(() =>
    document
      .querySelector("#admin-confirm-message")
      .textContent.includes("Dịch vụ đang bận"),
  );
  assert.equal(
    await page.locator("#admin-confirm-dialog").getAttribute("open"),
    "",
  );
  actionFailure = false;
  actionDelay = 650;
  await page.locator("#confirm-admin-action").click();
  await page.waitForSelector("#confirm-admin-action[aria-busy=true]");
  const pendingIcon = page.locator(
    '#confirm-admin-action [data-icon="loading"]',
  );
  assert.equal(await pendingIcon.count(), 1);
  assert.equal(
    await pendingIcon.evaluate((el) => getComputedStyle(el).animationName),
    "none",
    "Reduced motion must disable the loading icon animation",
  );
  await page.keyboard.press("Escape");
  assert.equal(
    await page.locator("#admin-confirm-dialog").getAttribute("open"),
    "",
  );
  await page.waitForSelector("#admin-confirm-dialog:not([open])", {
    state: "attached",
  });
  actionDelay = 0;
  assert.equal(lastAction.action, "block_user");
  assert.equal(lastAction.blocked, true);
  assert.equal(
    await page.locator("[data-admin-action=block_user]").textContent(),
    "Mở khóa tài khoản",
  );
  assert.match(
    await page.locator("#admin-results-message").textContent(),
    /Đã khóa/,
  );
  await page.locator("[data-admin-action=block_user]").click();
  await page.locator("#confirm-admin-action").click();
  await page.waitForSelector("#admin-confirm-dialog:not([open])", {
    state: "attached",
  });
  assert.equal(lastAction.blocked, false);

  // A successful write followed by a failed refresh is reported accurately.
  overviewFailure = true;
  await page.locator("#policy-form button[type=submit]").click();
  await page.waitForFunction(() =>
    document
      .querySelector("#policy-message")
      .textContent.includes("Chưa tải được dữ liệu mới"),
  );
  assert.match(
    await page.locator("#policy-message").textContent(),
    /Đã lưu cấu hình/,
  );
  overviewFailure = false;

  // Internal navigation is exercised through actual links as well as direct routes.
  await page.locator('footer a[href="/about/"]').click();
  await page.waitForURL(origin + "/about/");
  await page.locator('footer a[href="/report/"]').click();
  await page.waitForURL(origin + "/report/");
  await page.locator("#copy-report-email").click();
  assert.equal(
    await page.evaluate(() => navigator.clipboard.readText()),
    "hi@oh.io.vn",
  );
  await page.locator(".brand").click();
  await page.waitForURL(origin + "/");

  // Match the existing palette against WCAG AA normal-text contrast requirements.
  const contrast = (a, b) => {
    const luminance = (hex) => {
      let value = hex.replace(/^#/, "");
      if (value.length === 3)
        value = [...value].map((character) => character.repeat(2)).join("");
      const channels = value
        .match(/\w\w/g)
        .map((c) => parseInt(c, 16) / 255)
        .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    };
    const x = luminance(a),
      y = luminance(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  };
  const palette = await page.evaluate(() => {
    const styles = getComputedStyle(document.documentElement);
    return Object.fromEntries(
      [
        "text",
        "canvas",
        "muted",
        "surface",
        "blue",
        "danger",
        "danger-soft",
      ].map((name) => [name, styles.getPropertyValue(`--${name}`).trim()]),
    );
  });
  for (const [ink, paper] of [
    [palette.text, palette.canvas],
    [palette.muted, palette.surface],
    [palette.blue, palette.surface],
    [palette.surface, palette.blue],
    [palette.danger, palette["danger-soft"]],
  ])
    assert(
      contrast(ink, paper) >= 4.5,
      `Insufficient contrast: ${ink}/${paper}`,
    );
  assert.equal(
    consoleErrors.filter(
      (error) => !error.includes("the server responded with a status of 503"),
    ).length,
    0,
    JSON.stringify(consoleErrors),
  );
  // Unmocked local Worker smoke test and final screenshots.
  await checkFilteredRename();
  const real = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const realStatuses = [];
  for (const path of paths) {
    const response = await real.goto(origin + path);
    realStatuses.push({ path, status: response.status() });
    assert.equal(response.status(), 200);
  }
  await real.goto(origin + "/");
  await real.evaluate(() => document.fonts.ready);
  await real.screenshot({
    path: `${out}/local-worker-home-desktop.png`,
    fullPage: true,
  });
  await real.setViewportSize({ width: 390, height: 844 });
  await real.screenshot({
    path: `${out}/local-worker-home-mobile.png`,
    fullPage: true,
  });
  await real.close();
  assert.equal(pageErrors.length, 0, JSON.stringify(pageErrors));
  await writeFile(
    `${out}/results.json`,
    JSON.stringify(
      {
        measurements,
        realStatuses,
        pageErrors,
        consoleErrors,
        checks: [
          "70 page/viewport combinations",
          "visible headings and labels",
          "keyboard skip link and active navigation",
          "guest and member creation with verification fixture",
          "clipboard",
          "search and empty states",
          "edit/save and acknowledged slug rename with restored focus",
          "renamed result outside current search restores focus and remains discoverable",
          "21 pending page/viewport states, bounded SVG and non-interactive skeletons",
          "slug baseline, admin panel alignment, divider clearance and risk colors",
          "stats skeleton, disabled export and cancellation before response",
          "stats and Excel download",
          "delete cancellation and confirmation",
          "admin policy and blocklist",
          "donation Escape and focus restoration",
          "reduced motion",
          "200% text scaling",
          "network error feedback",
          "invalid collapsed custom code opens with inline error and focus",
          "repeated copy restores visual and accessible labels",
          "search during initial load, URL query and clearing",
          "failed search retains and labels previous results",
          "edit focus restoration and delete record context",
          "admin controls hidden until loaded, failure and retry",
          "admin confirmation cancellation, failure, retry and busy state",
          "successful save followed by refresh failure",
          "actual internal link navigation and report email clipboard",
          "computed CSS token contrast pairs",
          "single-day chart, 30 calendar days, zero state and missing-data warning",
          "independent dialog header/body scrolling, export keyboard access and reopen reset",
          "wrapped admin labels keep paired inputs aligned",
          "styled block type picker keyboard and pointer selection",
        ],
        environment:
          "Chrome headless, built app on local Wrangler, API and Turnstile fixtures for account states. No production mutations.",
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      measurements: measurements.length,
      pageErrors,
      consoleErrors,
      output: out,
    }),
  );
} finally {
  await browser.close();
}
