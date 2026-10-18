import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { site } from "./seo.mjs";
const require = createRequire(
  process.env.PLAYWRIGHT_PACKAGE || import.meta.url,
);
const { chromium } = require("playwright");
const origin = process.env.UI_ORIGIN || "http://localhost:8794";
assert(
  ["localhost", "127.0.0.1", "[::1]"].includes(new URL(origin).hostname),
  "SEO verification must run locally",
);
const out = process.env.UI_OUTPUT || ".local/seo/after";
await mkdir(out, { recursive: true });
const paths = ["/", "/about/", "/privacy/", "/terms/", "/report/"];
const http = [],
  screenshots = [],
  errors = [];
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  // Keep public UI screenshots deterministic, without accessing real accounts.
  await page.route("https://challenges.cloudflare.com/**", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: 'window.turnstile={render:()=>"seo-local-fixture",reset:()=>{}};',
    }),
  );
  await page.route("**/api/me", (route) =>
    route.fulfill({
      json: { user: null, admin: false, csrf: "seo-local-fixture" },
    }),
  );
  await page.route("**/api/config", (route) =>
    route.fulfill({
      json: {
        siteKey: "seo-local-fixture",
        loginEnabled: true,
        createEnabled: true,
        guestEnabled: true,
        analyticsEnabled: true,
        guestLimit: 3,
        userLimit: 20,
        activeLimit: 100,
      },
    }),
  );
  const inspect = () => ({
    title: document.title,
    description: document.querySelector('meta[name="description"]')?.content,
    canonical: document
      .querySelector('link[rel="canonical"]')
      ?.getAttribute("href"),
    h1: [...document.querySelectorAll("h1")].map((e) => e.textContent),
    schema: [
      ...document.querySelectorAll('script[type="application/ld+json"]'),
    ].map((e) => JSON.parse(e.textContent)),
    overflow: document.documentElement.scrollWidth > innerWidth,
  });
  for (const path of paths) {
    const response = await fetch(origin + path, { redirect: "manual" });
    const html = await response.text();
    assert.equal(response.status, 200, path);
    assert.ok(!response.headers.get("x-robots-tag")?.includes("noindex"));
    assert.match(html, /<h1[ >]/);
    assert.ok(html.includes(`href="${site.origin}${path}"`));
    assert.match(html, /application\/ld\+json/);
    const initial = JSON.parse(
      html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1],
    );
    for (const width of [1440, 768, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(origin + path);
      await page.evaluate(() => document.fonts.ready);
      const rendered = await page.evaluate(inspect);
      assert.equal(rendered.canonical, site.origin + path);
      assert.equal(rendered.h1.length, 1);
      assert.deepEqual(
        rendered.schema,
        [initial],
        "Initial and rendered JSON-LD must agree",
      );
      assert.equal(rendered.overflow, false, `${path} at ${width}`);
      await page.screenshot({
        path: `${out}/${path.replaceAll("/", "") || "home"}-${width}.png`,
        fullPage: true,
      });
      screenshots.push({ path, width, ...rendered });
    }
    // All internal content/navigation links point to real pages or valid fragments.
    const links = await page
      .locator("a[href]")
      .evaluateAll((els) =>
        els
          .filter((e) => !e.closest("dialog"))
          .map((e) => e.getAttribute("href")),
      );
    for (const href of new Set(links)) {
      if (!href.startsWith("/") && !href.startsWith("#")) continue;
      const link = new URL(href, origin + path);
      if (link.pathname.startsWith("/auth/")) continue;
      const target = await fetch(link.href, { redirect: "error" });
      assert.equal(target.status, 200, href);
      if (link.hash)
        assert.ok(
          (await target.text()).includes(`id="${link.hash.slice(1)}"`),
          href,
        );
    }
    http.push({
      path,
      status: response.status,
      canonical: site.origin + path,
      schema: initial["@graph"].map((x) => x["@type"]),
    });
  }
  for (const path of ["/dashboard/", "/admin/"]) {
    const r = await fetch(origin + path);
    assert.equal(r.status, 200);
    assert.match(r.headers.get("x-robots-tag"), /noindex/);
    assert.match(await r.text(), /name="robots" content="noindex,nofollow"/);
    http.push({
      path,
      status: r.status,
      robots: r.headers.get("x-robots-tag"),
    });
  }
  for (const [path, status] of [
    ["/api/links", 401],
    ["/api/admin/links", 403],
    ["/seo-audit-missing-20261018", 404],
  ]) {
    const r = await fetch(origin + path);
    assert.equal(r.status, status, path);
    assert.match(r.headers.get("x-robots-tag"), /noindex/);
    http.push({ path, status, robots: r.headers.get("x-robots-tag") });
  }
  for (const [path, location] of [
    ["/about", "/about/"],
    ["/about.html", "/about/"],
    ["/index.html", "/"],
  ]) {
    const r = await fetch(origin + path, { redirect: "manual" });
    assert.ok([301, 302, 307, 308].includes(r.status));
    assert.equal(r.headers.get("location"), location);
    http.push({ path, status: r.status, location });
  }
  const sitemap = await (await fetch(origin + "/sitemap.xml")).text();
  assert.deepEqual(
    [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]).sort(),
    paths.map((path) => site.origin + path).sort(),
  );
  const robots = await (await fetch(origin + "/robots.txt")).text();
  assert.ok(robots.includes(`Sitemap: ${site.origin}/sitemap.xml`));
  const image = await fetch(origin + site.image);
  assert.equal(image.status, 200);
  assert.match(image.headers.get("content-type"), /image\/png/);
  for (const icon of ["/favicon.svg", "/favicon.png", "/favicon.ico"]) {
    const response = await fetch(origin + icon);
    assert.equal(response.status, 200, icon);
    assert.match(response.headers.get("content-type"), /image\//, icon);
    assert.ok((await response.arrayBuffer()).byteLength > 0, icon);
  }
  // Table-of-contents links stay usable with a keyboard and land on visible headings.
  await page.goto(origin + "/about/");
  const expiryLink = page.locator('.contents-nav a[href="#thoi-han"]');
  await expiryLink.focus();
  await page.keyboard.press("Enter");
  assert.equal(new URL(page.url()).hash, "#thoi-han");
  assert.ok(await page.locator("#thoi-han").isVisible());
  const home = await (await fetch(origin + "/")).text();
  const asset = home.match(/src="(\/assets\/[^" ]+\.js)"/)[1];
  assert.match(
    (await fetch(origin + asset)).headers.get("cache-control"),
    /immutable/,
  );
  // Meaningful public text is present without executing any client JavaScript.
  const noJs = await browser.newContext({ javaScriptEnabled: false });
  const plain = await noJs.newPage();
  for (const path of paths) {
    await plain.goto(origin + path);
    assert.equal(await plain.locator("h1").count(), 1);
    assert.ok((await plain.locator("main").innerText()).length > 100);
  }
  await noJs.close();
  assert.deepEqual(errors, []);
  await writeFile(
    `${out}/results.json`,
    JSON.stringify(
      { http, screenshots, errors, noJavaScriptPages: paths },
      null,
      2,
    ),
  );
  console.log(
    `SEO verified: ${http.length} HTTP checks, ${paths.length} pages without JavaScript, ${screenshots.length} screenshots, no console/runtime errors.`,
  );
} finally {
  await browser.close();
}
