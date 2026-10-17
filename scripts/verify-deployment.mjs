import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { appendFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

export async function verifyDeployment({
  commit,
  origin = "https://oh.io.vn",
  directory = "dist",
  fetchResponse = fetch,
}) {
  assert.match(commit, /^[a-f0-9]{40}$/, "Expected a full Git commit SHA");
  const get = async (path) => {
    const response = await fetchResponse(new URL(path, origin), {
      headers: { "Cache-Control": "no-cache" },
      signal: AbortSignal.timeout(15000),
      redirect: "error",
    });
    assert.equal(response.status, 200, `${path} must return HTTP 200`);
    return response;
  };
  const marker = await (await get(`/deployment.json?commit=${commit}`)).json();
  assert.equal(
    marker.commit,
    commit,
    "Production is not serving the expected commit",
  );
  const policy = (await readFile(resolve(directory, "_headers"), "utf8"))
    .match(/^\s+Content-Security-Policy:\s*(.+)$/m)?.[1]
    .trim();
  assert.ok(policy, "The release must include its CSP");
  const localHtml = await readFile(resolve(directory, "index.html"), "utf8");
  const assets = [
    ...new Set(
      [
        ...localHtml.matchAll(
          /(?:src|href)="(\/assets\/[^\"]+|\/favicon\.svg)"/g,
        ),
      ].map((match) => match[1]),
    ),
  ];
  assert.ok(assets.length >= 2, "The homepage must reference built assets");
  for (const path of [
    "/",
    "/about/",
    "/privacy/",
    "/terms/",
    "/report/",
    "/dashboard/",
    "/admin/",
  ]) {
    const response = await get(path);
    assert.equal(
      response.headers.get("content-security-policy"),
      policy,
      `Unexpected CSP on ${path}`,
    );
    if (path === "/") {
      const html = await response.text();
      for (const asset of assets)
        assert.ok(html.includes(asset), `Homepage is missing ${asset}`);
    }
  }
  const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
  for (const asset of assets) {
    const bytes = Buffer.from(await (await get(asset)).arrayBuffer());
    assert.equal(
      sha256(bytes),
      sha256(await readFile(resolve(directory, asset.slice(1)))),
      `Deployed bytes do not match ${asset}`,
    );
  }
  const config = await (await get("/api/config")).json();
  assert.equal(typeof config.createEnabled, "boolean");
  assert.equal(typeof config.guestEnabled, "boolean");
  return { commit, pages: 7, assets: assets.length, api: "/api/config" };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const commit = process.argv[2];
  let result;
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      result = await verifyDeployment({ commit });
      break;
    } catch (error) {
      if (attempt === 6) throw error;
      console.warn(`Production check ${attempt}/6: ${error.message}`);
      await delay(5000);
    }
  }
  const summary = `Verified https://oh.io.vn at commit ${result.commit}: ${result.pages} pages, ${result.assets} assets, CSP and public API passed.`;
  console.log(summary);
  if (process.env.GITHUB_STEP_SUMMARY)
    await appendFile(process.env.GITHUB_STEP_SUMMARY, summary + "\n");
}
