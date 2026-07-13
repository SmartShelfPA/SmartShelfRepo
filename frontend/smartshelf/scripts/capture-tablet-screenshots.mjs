/**
 * Capture Play Store tablet screenshots from the SmartShelf homepage mock.
 * Usage: node scripts/capture-tablet-screenshots.mjs
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '../../../store-assets/tablet-screenshots');
const mockHtml = path.join(outDir, 'homepage-mock.html');
const mockUrl = pathToFileURL(mockHtml).href;

const targets = [
  { name: '7-inch-tablet-home', width: 1200, height: 1920 },
  { name: '10-inch-tablet-home', width: 1600, height: 2560 },
];

async function capture(browser, target) {
  const context = await browser.newContext({
    viewport: { width: target.width, height: target.height },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    colorScheme: 'light',
  });
  const page = await context.newPage();
  await page.goto(mockUrl, { waitUntil: 'networkidle', timeout: 60_000 });
  await page.waitForTimeout(1500);

  const filePath = path.join(outDir, `${target.name}.png`);
  await page.screenshot({ path: filePath, fullPage: false });
  await context.close();
  return filePath;
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    for (const target of targets) {
      const filePath = await capture(browser, target);
      console.log(`Saved ${filePath}`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
