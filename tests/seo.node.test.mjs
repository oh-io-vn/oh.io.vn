import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import {
  renderMetadata,
  renderSitemap,
  structuredData,
  site,
} from "../scripts/seo.mjs";

execFileSync(process.execPath, ["scripts/generate-pages.mjs"]);
const publicPages = ["index", "about", "privacy", "terms", "report"];
const privatePages = ["admin", "dashboard"];
const documents = Object.fromEntries(
  await Promise.all(
    [...publicPages, ...privatePages].map(async (name) => [
      name,
      await readFile(`src/web/${name}.html`, "utf8"),
    ]),
  ),
);

test("public initial HTML has unique metadata, canonical identity and descriptive content", () => {
  const titles = new Set(),
    descriptions = new Set();
  for (const name of publicPages) {
    const html = documents[name];
    const url = site.origin + (name === "index" ? "/" : `/${name}/`);
    assert.match(html, /<html lang="vi">/);
    assert.equal((html.match(/<h1[ >]/g) || []).length, 1, name);
    assert.equal((html.match(/rel="canonical"/g) || []).length, 1);
    assert.ok(html.includes(`rel="canonical" href="${url}"`));
    assert.ok(html.includes(`property="og:url" content="${url}"`));
    assert.doesNotMatch(html, /content="noindex/);
    titles.add(html.match(/<title>(.*?)<\/title>/s)[1]);
    descriptions.add(html.match(/name="description" content="([^"]+)"/)[1]);
    for (const key of [
      "og:description",
      "og:site_name",
      "og:image",
      "og:image:alt",
      "twitter:card",
      "twitter:image",
    ])
      assert.ok(html.includes(`="${key}"`), `${name}: ${key}`);
    const data = JSON.parse(
      html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1],
    );
    assert.equal(data["@context"], "https://schema.org");
    assert.equal(data["@graph"][0].url, url);
    assert.doesNotMatch(
      JSON.stringify(data),
      /aggregateRating|Review|dateModified|Person/,
    );
  }
  assert.equal(titles.size, publicPages.length);
  assert.equal(descriptions.size, publicPages.length);
  const app = structuredData("index", {
    title: "Rút gọn link miễn phí",
    description: "Công cụ rút gọn link miễn phí.",
    indexable: true,
  })["@graph"].find((item) => item["@type"] === "WebApplication");
  assert.equal(app.isAccessibleForFree, true);
  assert.deepEqual(app.offers, { "@type": "Offer", price: 0 });
});

test("private pages have noindex, no public sharing metadata and no structured data", () => {
  for (const name of privatePages) {
    assert.match(documents[name], /name="robots" content="noindex,nofollow"/);
    assert.doesNotMatch(
      documents[name],
      /application\/ld\+json|rel="canonical"|property="og:/,
    );
  }
  assert.equal(structuredData("admin", { private: true }), null);
});

test("sitemap contains exactly the five public canonical URLs and no fabricated dates", async () => {
  const xml = await readFile("public/sitemap.xml", "utf8");
  const urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
  assert.deepEqual(
    urls.sort(),
    publicPages
      .map((name) => site.origin + (name === "index" ? "/" : `/${name}/`))
      .sort(),
  );
  assert.doesNotMatch(
    xml,
    /lastmod|\/api\/|\/auth\/|\/admin\/|\/dashboard\/|\.html/,
  );
  for (const url of urls) assert.equal(new URL(url).search, "");
  assert.match(
    renderSitemap({
      index: { indexable: true },
      future: { indexable: true },
      admin: { private: true, indexable: true },
    }),
    /https:\/\/oh.io.vn\/future\//,
  );
  assert.doesNotMatch(renderSitemap({ future: {} }), /<loc>/);
});

test("metadata escapes content without allowing attributes or JSON-LD to inject HTML", () => {
  const text = '</script><img src=x onerror="alert(1)"> & test';
  const html = renderMetadata("index", {
    title: text,
    description: text,
    indexable: true,
  });
  assert.doesNotMatch(html, /<img|<\/script><img/);
  assert.equal((html.match(/<script /g) || []).length, 1);
  const json = JSON.parse(
    html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1],
  );
  assert.equal(json["@graph"][0].description, text);
});

test("share image has the advertised size and assets cache without caching authenticated responses", async () => {
  const png = await readFile("public/social-card.png");
  assert.equal(png.subarray(1, 4).toString(), "PNG");
  assert.equal(png.readUInt32BE(16), 1200);
  assert.equal(png.readUInt32BE(20), 630);
  const favicon = await readFile("public/favicon.ico");
  assert.equal(favicon.readUInt16LE(2), 1);
  assert.equal(favicon[6], 48);
  assert.equal(favicon[7], 48);
  const headers = await readFile("public/_headers", "utf8");
  assert.match(
    headers,
    /\/assets\/\*\r?\n  Cache-Control: public, max-age=31536000, immutable/,
  );
  assert.doesNotMatch(headers, /^\/\*\r?\n  Cache-Control: public/m);
  const robots = await readFile("public/robots.txt", "utf8");
  for (const path of ["api", "auth", "admin", "dashboard"])
    assert.ok(robots.includes(`Disallow: /${path}/`));
  assert.ok(robots.includes(`Sitemap: ${site.origin}/sitemap.xml`));
});
