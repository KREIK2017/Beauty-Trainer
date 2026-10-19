import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const browser = await chromium.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: true,
});

const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
await page.goto(
  pathToFileURL(resolve("design/design-system-preview.html")).href,
);
await page.screenshot({
  path: "design/design-system-preview-desktop.png",
  fullPage: true,
});

await page.setViewportSize({ width: 390, height: 844 });
await page.reload();
await page.screenshot({
  path: "design/design-system-preview-mobile-viewport.png",
});
await page.screenshot({
  path: "design/design-system-preview-mobile.png",
  fullPage: true,
});

await browser.close();
