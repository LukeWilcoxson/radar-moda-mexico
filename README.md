# Radar Moda México

Public-facing MVP for `radarmodamexico.com`.

A weekly visual index of Mexican fashion, international luxury in Mexico, and emerging streetwear brands. Built from the original internal Coco Loco inspiration dashboard.

## Local test

```bash
cd "/Users/lukewilcoxson/Documents/Claude/Projects/Coco Loco/premium-fashion-inspo-dashboard"
npm run dev
```

Open:

```text
http://127.0.0.1:5173/
```

## Refresh data

```bash
npm run refresh
npm run snapshot:ig
npm run build
```

`snapshot:ig` saves:

- Current cropped grid screenshots: `public/instagram-grid-snapshots/`
- Weekly history snapshots: `public/history/YYYY-MM-DD/`
- Slider manifest: `data/history-manifest.json`

The frontend keeps a per-brand history slider. It currently has one week of history; after weekly runs, the slider becomes useful.

## Shopify signup endpoint

The public form posts to:

```text
/api/subscribe
```

This is a Vercel serverless function at `api/subscribe.js`. It creates a Shopify customer with marketing consent and tags:

```text
radar-minisite, radar-moda-mexico
```

Required Vercel environment variables:

```text
SHOPIFY_ADMIN_API_ACCESS_TOKEN=shpat_...
SHOPIFY_SHOP_DOMAIN=cocoloco.mx
SHOPIFY_API_VERSION=2026-07
```

The token must come from a Shopify Custom App with `write_customers`. Add `read_customers` later if we want to update existing customers instead of treating duplicate signups as success.

## Public launch checklist — free/low-cost

1. Push project to a GitHub repo.
2. Deploy to Vercel free tier.
3. Add `radarmodamexico.com` in Vercel domains.
4. Point DNS from registrar to Vercel.
5. Set Shopify env vars in Vercel.
6. Replace or refine CTA copy as Coco Loco positioning evolves.
7. Keep Ads buttons hidden/disabled until official Meta page IDs are mapped.

## Current caveats

- Instagram snapshots are static screenshots, not official Instagram API data.
- Brand images/names belong to the respective brands; footer includes an editorial disclaimer.
- Signup creates Shopify customers only after Vercel env vars are configured.
- Existing Shopify customer duplicate emails return success to the visitor, but are not updated unless we add read/update customer logic.
