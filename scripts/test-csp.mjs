import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const require = createRequire(
  process.env.PLAYWRIGHT_PACKAGE || import.meta.url,
);
const { chromium } = require("playwright");
const headers = await readFile(
  new URL("../public/_headers", import.meta.url),
  "utf8",
);
const policy = headers
  .match(/^\s+Content-Security-Policy:\s*(.+)$/m)?.[1]
  .trim();
assert.ok(policy, "The static response must have a CSP");

// Use browser-enforced CSP with synthetic responses only. No analytics or
// application requests leave this isolated context, including blocked probes.
const origin = "http://127.0.0.1:18791";
const allowedScripts = [
  "https://static.cloudflareinsights.com/beacon.min.js",
  "https://static.cloudflareinsights.com/beacon.min.js/v-test-version",
];
const forbiddenScripts = [
  "https://static.cloudflareinsights.com/unrelated.js",
  "https://untrusted.example.invalid/script.js",
];
const requests = [];
const beacons = [];
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const context = await browser.newContext({ serviceWorkers: "block" });
  await context.addInitScript(() => {
    window.cspViolations = [];
    document.addEventListener("securitypolicyviolation", (event) => {
      window.cspViolations.push({
        directive: event.effectiveDirective,
        blockedURI: event.blockedURI,
      });
    });
  });
  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = request.url();
    requests.push(url);
    if (url === origin + "/") {
      return route.fulfill({
        contentType: "text/html",
        headers: { "Content-Security-Policy": policy },
        body: `<!doctype html><html><head><title>CSP regression</title></head><body>
          <script src="/app.js"></script>
          ${allowedScripts.map((src) => `<script type="module" src="${src}"></script>`).join("")}
          <script src="https://challenges.cloudflare.com/turnstile/v0/api.js"></script>
          ${forbiddenScripts.map((src) => `<script src="${src}"></script>`).join("")}
          <script>window.inlineRan = true;</script>
          </body></html>`,
      });
    }
    if (url === origin + "/app.js") {
      return route.fulfill({
        contentType: "text/javascript",
        body: `window.appLoaded = true;
          try { eval('window.evalRan = true'); } catch { window.evalBlocked = true; }
          fetch('https://untrusted.example.invalid/collect').catch(() => {});`,
      });
    }
    if (allowedScripts.includes(url)) {
      return route.fulfill({
        contentType: "text/javascript",
        headers: { "Access-Control-Allow-Origin": "*" },
        body: `window.analyticsLoads = (window.analyticsLoads || 0) + 1;
          navigator.sendBeacon('/cdn-cgi/rum', 'synthetic-csp-test');`,
      });
    }
    if (url === origin + "/cdn-cgi/rum") {
      beacons.push({ method: request.method(), body: request.postData() });
      return route.fulfill({ status: 204 });
    }
    if (url === "https://challenges.cloudflare.com/turnstile/v0/api.js") {
      return route.fulfill({
        contentType: "text/javascript",
        body: "window.turnstileLoaded = true;",
      });
    }
    return route.fulfill({
      contentType: "text/javascript",
      body: "window.forbiddenLoaded = true;",
    });
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(origin, { waitUntil: "networkidle" });
  const state = await page.evaluate(() => ({
    appLoaded: window.appLoaded,
    analyticsLoads: window.analyticsLoads || 0,
    turnstileLoaded: window.turnstileLoaded,
    inlineRan: Boolean(window.inlineRan),
    evalRan: Boolean(window.evalRan),
    evalBlocked: window.evalBlocked,
    forbiddenLoaded: Boolean(window.forbiddenLoaded),
    violations: window.cspViolations,
  }));
  assert.equal(
    state.analyticsLoads,
    2,
    "Both unversioned and versioned beacons must execute",
  );
  assert.equal(
    state.appLoaded,
    true,
    "First-party application scripts must execute",
  );
  assert.equal(state.turnstileLoaded, true, "Turnstile must remain allowed");
  assert.equal(
    beacons.length,
    2,
    "Both beacons must reach the same-origin collector",
  );
  assert.ok(
    beacons.every(
      ({ method, body }) => method === "POST" && body === "synthetic-csp-test",
    ),
  );
  assert.equal(state.inlineRan, false, "Inline scripts must remain blocked");
  assert.equal(state.evalRan, false, "String evaluation must remain blocked");
  assert.equal(state.evalBlocked, true);
  assert.equal(state.forbiddenLoaded, false);
  assert.ok(
    forbiddenScripts.every((url) => !requests.includes(url)),
    "Unrelated scripts must be blocked before network access",
  );
  assert.ok(!requests.includes("https://untrusted.example.invalid/collect"));
  for (const blockedURI of [
    ...forbiddenScripts,
    "inline",
    "eval",
    "https://untrusted.example.invalid/collect",
  ]) {
    assert.ok(
      state.violations.some((violation) => violation.blockedURI === blockedURI),
      `Missing CSP enforcement for ${blockedURI}`,
    );
  }
  assert.equal(
    state.violations.length,
    5,
    "Only the five deliberately disallowed probes should violate CSP",
  );
  assert.deepEqual(errors, []);
  console.log(
    "CSP passed: both beacon URLs execute and send same-origin POSTs; application/Turnstile remain allowed; inline, eval, unrelated scripts and foreign connections remain blocked.",
  );
} finally {
  await browser.close();
}
