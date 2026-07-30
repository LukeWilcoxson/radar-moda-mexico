import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const root = process.cwd();
const brandsPath = path.join(root, 'data/brands.json');
const cachePath = path.join(root, 'data/cache/brand-assets.json');
const outputDir = path.join(root, 'public/instagram-grid-snapshots');
const historyManifestPath = path.join(root, 'data/history-manifest.json');
const historyRoot = path.join(root, 'public/history');
const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function publicPathFor(fileName) {
  return `/instagram-grid-snapshots/${fileName}`;
}

async function dismissOverlays(page) {
  const labels = [
    'Allow all cookies',
    'Allow essential and optional cookies',
    'Decline optional cookies',
    'Only allow essential cookies',
    'Not Now',
    'Not now',
    'Close'
  ];

  for (const label of labels) {
    try {
      const locator = page.getByRole('button', { name: label }).first();
      if (await locator.isVisible({ timeout: 1200 })) {
        await locator.click({ timeout: 2500 });
        await page.waitForTimeout(900);
      }
    } catch {
      // Overlay not present. Continue.
    }
  }
}

async function screenshotGridOnly(page, outputPath) {
  // Wait for actual post thumbnails, not just the profile logo/header.
  await page.waitForFunction(() => {
    return [...document.querySelectorAll('main img')].filter((node) => {
      const rect = node.getBoundingClientRect();
      return rect.width > 180 && rect.height > 180 && node.naturalWidth > 100 && rect.y > 250;
    }).length >= 3;
  }, { timeout: 18000 }).catch(() => null);

  const images = await page.locator('main img').evaluateAll((nodes) =>
    nodes
      .map((node) => {
        const rect = node.getBoundingClientRect();
        return {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          loaded: node.naturalWidth > 100 && node.naturalHeight > 100
        };
      })
      // Post-grid thumbnails are the large square-ish images below the profile header/stories.
      .filter((rect) => rect.loaded && rect.width > 180 && rect.height > 180 && rect.y > 250)
  ).catch(() => []);

  if (images.length >= 3) {
    const top = Math.max(0, Math.min(...images.map((rect) => rect.y)) - 6);
    const left = Math.max(0, Math.min(...images.map((rect) => rect.x)) - 6);
    const right = Math.max(...images.map((rect) => rect.x + rect.width)) + 6;
    const viewport = page.viewportSize() || { width: 1280, height: 1500 };
    await page.screenshot({
      path: outputPath,
      clip: {
        x: left,
        y: top,
        width: Math.min(viewport.width - left, right - left),
        height: Math.min(viewport.height - top, 1050)
      }
    });
    return 'grid-cropped-from-post-images';
  }

  await page.screenshot({ path: outputPath, fullPage: false });
  return 'full-page-fallback-no-loaded-grid';
}

async function snapshotBrand(page, brand) {
  const fileName = `${brand.id}.png`;
  const outputPath = path.join(outputDir, fileName);

  if (!brand.instagram || brand.instagram === '#') {
    return {
      instagramGridSnapshot: null,
      instagramSnapshotStatus: 'snapshot-skipped-no-instagram',
      instagramSnapshotMode: null,
      instagramSnapshotCapturedAt: new Date().toISOString(),
      instagramSnapshotError: null
    };
  }

  try {
    await page.goto(brand.instagram, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(3500);
    await dismissOverlays(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(1200);

    const imageCount = await page.locator('main img, article img, img').count().catch(() => 0);
    const bodyText = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '');
    const unavailable = /Sorry, this page isn't available|Page not found/i.test(bodyText);
    const loginWall = imageCount < 5 && /Log in|Sign up|Create an account/i.test(bodyText);
    const captureMode = await screenshotGridOnly(page, outputPath);

    return {
      instagramGridSnapshot: publicPathFor(fileName),
      instagramSnapshotStatus: unavailable ? 'snapshot-captured-page-unavailable' : (loginWall ? 'snapshot-captured-login-wall-or-limited-view' : 'snapshot-captured-grid-visible'),
      instagramSnapshotMode: captureMode,
      instagramSnapshotCapturedAt: new Date().toISOString(),
      instagramSnapshotError: null
    };
  } catch (error) {
    return {
      instagramGridSnapshot: null,
      instagramSnapshotStatus: 'snapshot-failed',
      instagramSnapshotMode: null,
      instagramSnapshotCapturedAt: new Date().toISOString(),
      instagramSnapshotError: error.message
    };
  }
}

async function main() {
  await fs.mkdir(outputDir, { recursive: true });
  await fs.mkdir(historyRoot, { recursive: true });
  const brands = JSON.parse(await fs.readFile(brandsPath, 'utf8'));
  const cache = JSON.parse(await fs.readFile(cachePath, 'utf8').catch(() => '{}'));
  const historyManifest = JSON.parse(await fs.readFile(historyManifestPath, 'utf8').catch(() => '{}'));
  const week = new Date().toISOString().slice(0, 10);
  const label = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date());
  const weekDir = path.join(historyRoot, week);
  await fs.mkdir(weekDir, { recursive: true });
  const executablePath = (await exists(chromePath)) ? chromePath : undefined;

  const browser = await chromium.launch({
    headless: true,
    executablePath,
    args: ['--disable-blink-features=AutomationControlled']
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 1500 },
    deviceScaleFactor: 1,
    locale: 'en-US',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36'
  });

  const page = await context.newPage();
  const summary = { total: brands.length, captured: 0, failed: 0, limited: 0 };

  for (const brand of brands) {
    process.stdout.write(`Snapshotting ${brand.name}... `);
    const result = await snapshotBrand(page, brand);
    cache[brand.id] = { ...(cache[brand.id] || {}), ...result };

    if (result.instagramGridSnapshot) {
      summary.captured += 1;
      const sourcePath = path.join(outputDir, `${brand.id}.png`);
      const historyImagePath = path.join(weekDir, `${brand.id}.png`);
      if (await exists(sourcePath)) {
        await fs.copyFile(sourcePath, historyImagePath);
        const item = { date: week, label, image: `/history/${week}/${brand.id}.png` };
        const existing = historyManifest[brand.id] || [];
        historyManifest[brand.id] = [...existing.filter((entry) => entry.date !== week), item].slice(-12);
      }
    } else if (brand.websiteImage || cache[brand.id]?.websiteImage) {
      summary.captured += 1;
    } else {
      summary.failed += 1;
    }
    if (result.instagramSnapshotStatus.includes('limited')) summary.limited += 1;

    console.log(result.instagramSnapshotStatus);
  }

  await browser.close();
  // Preserve local/coming-soon brands in history using their website/local preview image.
  for (const brand of brands) {
    if (!historyManifest[brand.id]?.length && cache[brand.id]?.websiteImage?.startsWith('/')) {
      historyManifest[brand.id] = [{ date: week, label, image: cache[brand.id].websiteImage }];
    }
  }
  await fs.writeFile(cachePath, JSON.stringify(cache, null, 2) + '\n');
  await fs.writeFile(historyManifestPath, JSON.stringify(historyManifest, null, 2) + '\n');
  console.log('\nInstagram snapshot summary');
  console.log(JSON.stringify(summary, null, 2));
  console.log(`Snapshots saved in: ${outputDir}`);
  console.log(`Cache updated: ${cachePath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
