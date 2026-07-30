import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const brandsPath = path.join(root, 'data/brands.json');
const cachePath = path.join(root, 'data/cache/brand-assets.json');

const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';

function adsLibraryUrl(brand) {
  if (!brand.officialMetaPageId) return null;
  const params = new URLSearchParams({
    active_status: 'active',
    ad_type: 'all',
    country: brand.country || 'MX',
    media_type: 'all',
    search_type: 'page',
    view_all_page_id: String(brand.officialMetaPageId)
  });
  return `https://www.facebook.com/ads/library/?${params.toString()}`;
}

function absoluteUrl(candidate, baseUrl) {
  if (!candidate) return null;
  try {
    return new URL(candidate, baseUrl).toString();
  } catch {
    return null;
  }
}

function decodeHtml(value = '') {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function findMeta(html, propertyNames) {
  for (const property of propertyNames) {
    const patterns = [
      new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["'][^>]*>`, 'i'),
      new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${property}["'][^>]*>`, 'i')
    ];
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match?.[1]) return decodeHtml(match[1].trim());
    }
  }
  return null;
}

function findLikelyImage(html, baseUrl) {
  const imgMatches = [...html.matchAll(/<img[^>]+(?:src|data-src|data-original)=["']([^"']+)["'][^>]*>/gi)];
  const candidates = imgMatches
    .map((m) => decodeHtml(m[1]))
    .filter((src) => !src.startsWith('data:'))
    .filter((src) => !/logo|icon|sprite|placeholder|loading/i.test(src))
    .map((src) => absoluteUrl(src, baseUrl))
    .filter(Boolean);
  return candidates[0] || null;
}

function suspiciousImageUrl(url = '') {
  return /kamustoto|taruhan|casino|chlorine|trisodium|phosphate|cleaning|chemical|logo-black|logo_pineda/i.test(url);
}

async function fetchWebsiteVisual(brand) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    if (!brand.website || brand.website === '#') {
      return { imageUrl: null, source: 'local-or-missing-website', status: 'website-skipped', finalUrl: brand.website };
    }
    const res = await fetch(brand.website, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent': userAgent,
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
      }
    });
    const finalUrl = res.url || brand.website;
    if (!res.ok) {
      return { imageUrl: null, source: 'website', status: `website-http-${res.status}`, finalUrl };
    }
    const html = await res.text();
    const metaImage = findMeta(html, ['og:image', 'twitter:image', 'twitter:image:src']);
    const rawImageUrl = absoluteUrl(metaImage, finalUrl) || findLikelyImage(html, finalUrl);
    const imageUrl = suspiciousImageUrl(rawImageUrl) ? null : rawImageUrl;
    return {
      imageUrl,
      source: imageUrl ? (metaImage ? 'og:image' : 'first-site-image') : 'website',
      status: imageUrl ? 'website-image-found' : (rawImageUrl ? 'suspicious-image-blocked' : 'website-image-missing'),
      finalUrl
    };
  } catch (error) {
    return {
      imageUrl: null,
      source: 'website',
      status: `website-fetch-failed`,
      error: error.name === 'AbortError' ? 'Request timed out' : error.message
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function refresh() {
  const brands = JSON.parse(await fs.readFile(brandsPath, 'utf8'));
  const previous = JSON.parse(await fs.readFile(cachePath, 'utf8').catch(() => '{}'));
  const refreshedAt = new Date().toISOString();
  const cache = {};
  const summary = { total: brands.length, websiteImages: 0, websiteFailed: 0, instagram: 0, adProvider: 0 };

  for (const brand of brands) {
    process.stdout.write(`Refreshing ${brand.name}... `);
    const website = await fetchWebsiteVisual(brand);
    if (website.imageUrl) summary.websiteImages += 1;
    else summary.websiteFailed += 1;

    cache[brand.id] = {
      ...(previous[brand.id] || {}),
      websiteImage: website.imageUrl || previous[brand.id]?.websiteImage || null,
      websiteImageSource: website.source,
      websiteStatus: website.status,
      websiteFinalUrl: website.finalUrl || brand.website,
      websiteError: website.error || null,
      instagramImage: null,
      instagramPostUrl: null,
      instagramStatus: 'not-configured-in-mvp',
      adImages: [],
      adsStatus: brand.officialMetaPageId ? 'official-page-link-ready' : 'official-page-id-needed',
      adsLibraryUrl: adsLibraryUrl(brand),
      adsNote: brand.officialMetaPageId ? 'Official Meta page only' : 'Official Meta page ID not mapped yet — disabled to avoid keyword-search junk.',
      lastRefreshed: refreshedAt
    };
    console.log(website.status);
  }

  await fs.writeFile(cachePath, JSON.stringify(cache, null, 2) + '\n');
  console.log('\nRefresh summary');
  console.log(JSON.stringify(summary, null, 2));
  console.log(`Cache written: ${cachePath}`);
}

refresh().catch((error) => {
  console.error(error);
  process.exit(1);
});
