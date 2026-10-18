// Maintainer-only image generation using the existing browser test runtime.
// PLAYWRIGHT_PACKAGE may point to an installed playwright/package.json.
import { createRequire } from "node:module";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { site } from "./seo.mjs";
const require = createRequire(
  process.env.PLAYWRIGHT_PACKAGE || import.meta.url,
);
const { chromium } = require("playwright");
const logo = await readFile(
  new URL("../public/favicon.svg", import.meta.url),
  "utf8",
);
const fontDirectory = new URL(
  "../node_modules/@fontsource-variable/space-grotesk/files/",
  import.meta.url,
);
const fonts = await Promise.all(
  ["latin", "vietnamese", "latin-ext"].map(async (subset) => {
    const data = await readFile(
      new URL(`space-grotesk-${subset}-wght-normal.woff2`, fontDirectory),
    );
    return `@font-face {font-family:Card; font-weight:300 700; src:url(data:font/woff2;base64,${data.toString("base64")}) format('woff2');}`;
  }),
);
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  });
  await page.setContent(`<!doctype html><html lang="vi"><meta charset="utf-8"><style>
${fonts.join("\n")}
*{box-sizing:border-box}body{margin:0;width:1200px;height:630px;padding:70px 80px;background:#fafafa;color:#202124;font-family:Card,'Segoe UI',sans-serif}
.brand{display:flex;align-items:center;gap:18px;font-size:38px;font-weight:600}.brand svg{width:58px;height:58px}
h1{font-size:76px;line-height:1.15;letter-spacing:-3px;margin:72px 0 24px;font-weight:600;max-width:960px}
p{font-size:32px;line-height:1.5;color:#61656e;margin:0}.rule{width:80px;height:6px;background:#245bdb;margin-top:52px}
</style><body><div class="brand">${logo}<span>${site.name}</span></div><h1>Rút gọn link miễn phí</h1><p>Chuyển thẳng đến địa chỉ đích.</p><div class="rule"></div></body></html>`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: fileURLToPath(new URL("../public/social-card.png", import.meta.url)),
  });
  await page.setViewportSize({ width: 48, height: 48 });
  await page.setContent(
    `<style>html,body{margin:0;width:48px;height:48px}svg{display:block;width:48px;height:48px}</style>${logo}`,
  );
  const png = await page.screenshot({ omitBackground: true });
  await writeFile(new URL("../public/favicon.png", import.meta.url), png);
  // ICO supports a PNG payload. Keep the fallback icon identical to the SVG.
  const ico = Buffer.alloc(22);
  ico.writeUInt16LE(1, 2);
  ico.writeUInt16LE(1, 4);
  ico[6] = ico[7] = 48;
  ico.writeUInt16LE(1, 10);
  ico.writeUInt16LE(32, 12);
  ico.writeUInt32LE(png.length, 14);
  ico.writeUInt32LE(22, 18);
  await writeFile(
    new URL("../public/favicon.ico", import.meta.url),
    Buffer.concat([ico, png]),
  );
} finally {
  await browser.close();
}
