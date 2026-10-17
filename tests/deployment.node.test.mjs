import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { verifyDeployment } from "../scripts/verify-deployment.mjs";

const commit = "a".repeat(40);
const policy = "default-src 'self'; script-src 'self'; object-src 'none'";
const html =
  '<script src="/assets/main-test.js"></script><link href="/assets/main-test.css" rel="stylesheet">';

async function fixture(t, override = () => undefined) {
  const directory = await mkdtemp(join(tmpdir(), "oh-deployment-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(join(directory, "assets"));
  await Promise.all([
    writeFile(join(directory, "index.html"), html),
    writeFile(
      join(directory, "_headers"),
      `/*\n  Content-Security-Policy: ${policy}\n`,
    ),
    writeFile(
      join(directory, "assets/main-test.js"),
      "console.log('release');",
    ),
    writeFile(
      join(directory, "assets/main-test.css"),
      "body { color: black; }",
    ),
  ]);
  const visited = [];
  const fetchResponse = async (url, options) => {
    assert.equal(url.origin, "https://deployment.test");
    assert.equal(options.redirect, "error");
    assert.equal(options.headers["Cache-Control"], "no-cache");
    visited.push(url.pathname);
    const custom = override(url.pathname);
    if (custom) return custom;
    if (url.pathname === "/deployment.json") return Response.json({ commit });
    if (url.pathname === "/api/config")
      return Response.json({ createEnabled: true, guestEnabled: true });
    if (url.pathname === "/assets/main-test.js")
      return new Response("console.log('release');");
    if (url.pathname === "/assets/main-test.css")
      return new Response("body { color: black; }");
    return new Response(html, {
      headers: { "Content-Security-Policy": policy },
    });
  };
  return {
    options: {
      commit,
      origin: "https://deployment.test",
      directory,
      fetchResponse,
    },
    visited,
  };
}

test("deployment verification checks the commit, all pages, assets, CSP and API", async (t) => {
  const { options, visited } = await fixture(t);
  assert.deepEqual(await verifyDeployment(options), {
    commit,
    pages: 7,
    assets: 2,
    api: "/api/config",
  });
  assert.equal(visited.length, 11);
});

test("deployment verification rejects an old release before checking pages", async (t) => {
  const { options, visited } = await fixture(
    t,
    (path) =>
      path === "/deployment.json" && Response.json({ commit: "b".repeat(40) }),
  );
  await assert.rejects(verifyDeployment(options), /expected commit/);
  assert.deepEqual(visited, ["/deployment.json"]);
});

test("deployment verification rejects stale or corrupted asset bytes", async (t) => {
  const { options } = await fixture(
    t,
    (path) => path === "/assets/main-test.js" && new Response("old release"),
  );
  await assert.rejects(
    verifyDeployment(options),
    /Deployed bytes do not match/,
  );
});

test("deployment verification rejects missing CSP on a secondary page", async (t) => {
  const { options } = await fixture(
    t,
    (path) => path === "/privacy/" && new Response(html),
  );
  await assert.rejects(verifyDeployment(options), /Unexpected CSP/);
});

test("deployment verification fails when the public API is unavailable", async (t) => {
  const { options } = await fixture(
    t,
    (path) =>
      path === "/api/config" && new Response("unavailable", { status: 503 }),
  );
  await assert.rejects(verifyDeployment(options), /must return HTTP 200/);
});
