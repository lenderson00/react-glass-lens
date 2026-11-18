/**
 * Capture mobile layout screenshots and detect horizontal overflow.
 * Usage: DEMO_URL=http://localhost:5199 node scripts/mobile-screenshots.mjs after
 */
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium, devices } from 'playwright';

const label = process.argv[2] || 'after';
const baseUrl = process.env.DEMO_URL ?? 'http://localhost:5199/';
const outDir = join(process.cwd(), 'docs', 'mobile-screenshots', label);

const targets = [
  { name: 'docs', path: '#/docs' },
  { name: 'playground', path: '#/playground' },
  { name: 'home', path: '#/' },
];

const profiles = [
  { key: 'pixel7-portrait', ...devices['Pixel 7'] },
  { key: 'pixel7-landscape', ...devices['Pixel 7'], viewport: { width: 915, height: 412 } },
  { key: 'iphone14-portrait', ...devices['iPhone 14'] },
  { key: 'iphone14-landscape', ...devices['iPhone 14'], viewport: { width: 844, height: 390 } },
];

const overflow = [];

async function hasHorizontalScroll(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    const w = Math.max(doc.scrollWidth, body.scrollWidth);
    const vw = doc.clientWidth;
    return { w, vw, bad: w > vw + 1 };
  });
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader'],
  });

  for (const profile of profiles) {
    const { key: _key, viewport: customVp, ...device } = profile;
    const context = await browser.newContext({
      ...device,
      viewport: customVp ?? device.viewport,
    });
    const page = await context.newPage();
    await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 60000 });

    for (const t of targets) {
      await page.goto(`${baseUrl}${t.path}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(t.name === 'playground' ? 1200 : 600);
      if (t.name === 'docs') {
        await page.evaluate(() => window.scrollTo(0, 0));
      }
      const scroll = await hasHorizontalScroll(page);
      if (scroll.bad) {
        overflow.push({ profile: profile.key, page: t.name, ...scroll });
      }
      const file = join(outDir, `${profile.key}-${t.name}.png`);
      await page.screenshot({ path: file, fullPage: t.name !== 'playground' });
    }
    await context.close();
  }

  await browser.close();
  console.log(`Screenshots -> ${outDir}`);
  if (overflow.length) {
    console.error('OVERFLOW', JSON.stringify(overflow, null, 2));
    process.exit(1);
  }
  console.log('No horizontal overflow detected.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});