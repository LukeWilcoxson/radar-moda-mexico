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

## Public launch checklist — free/low-cost

1. Push project to a GitHub repo.
2. Deploy to Vercel free tier.
3. Add `radarmodamexico.com` in Vercel domains.
4. Point DNS from registrar to Vercel.
5. Connect the newsletter form to Kit before collecting emails.
6. Replace Coco Loco placeholder links with live website/Instagram.
7. Keep Ads buttons hidden/disabled until official Meta page IDs are mapped.

## Current caveats

- Instagram snapshots are static screenshots, not official Instagram API data.
- Brand images/names belong to the respective brands; footer includes an editorial disclaimer.
- Newsletter form is visual-only until connected to Kit.
- Coco Loco is included as an emerging brand with a local preview image and placeholder links.
