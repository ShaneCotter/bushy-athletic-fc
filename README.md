# Bushy Athletic FC · UCFL Stats Dashboard

Standalone dashboard for Bushy Athletic FC player and team stats across all UCFL competitions they appear in.

Data is loaded from bundled JSON files (`data/completed-seasons.json`). The **2025/26** season is live today; **2026/27** is listed as coming soon until that season starts.

## Features

- **2025/26** season stats, results and fixtures data from stored JSON
- **2026/27** shown in the season selector as coming soon (enable in `config.js` when ready)
- Leaderboards for goals, appearances, minutes, yellow cards, and red cards
- Player stats sourced from the official `/player/{id}/stats` API (goals, minutes, appearances, cards match Clubforce)
- Assists section reserved as "Coming soon" until the source API publishes assist data
- Session cache (30 minutes) so refreshes stay fast

## Quick start

From this folder:

```bash
python3 -m http.server 8080
```

Then open [http://localhost:8080](http://localhost:8080).

If you have Node available:

```bash
node scripts/serve.mjs
```

## Deploy by itself

This folder is self-contained. Upload the entire `ucfl-dashboard` directory to any static host, for example:

- Netlify drag-and-drop
- GitHub Pages
- Cloudflare Pages
- Any nginx/apache static file host

Requirements:

1. Serve over HTTP/HTTPS (ES modules need a web server; opening `index.html` directly from disk will not work)
2. No build step required

Optional: set a custom port when using the included Node server:

```bash
PORT=3000 node scripts/serve.mjs
```

## Configuration

Edit `js/config.js`:

| Setting | Purpose |
|--------|---------|
| `teamMatch` | Partial name used to find your team in API data |
| `organizationId` | UCFL org ID in the Comet system |
| `apiKey` | Public Clubforce/Comet API key |
| `cacheTtlMinutes` | How long session cache remains valid |
| `completedSeasonNames` | Exact competition names stored as previous seasons |
| `seasons` | Season dropdown options (`comingSoon: true` for future seasons) |
| `defaultSeasonId` | Which season is selected on page load |

To refresh the API key from Clubforce:

```bash
node scripts/fetch-config.mjs
```

To refresh stored data for completed seasons (run when a season ends or results are updated):

```bash
node scripts/fetch-completed-seasons.mjs
```

This writes `data/completed-seasons.json`, which the site loads on page open.

## Notes

- **Player stats:** Goals, appearances, minutes, and cards come from the official `/player/{personId}/stats` endpoint per competition (same source as the Clubforce app). Match events are still used for results, fixtures, and discovering squad members.
- **Assists:** The official stats API includes an assists field, but UCFL competitions currently return zero assists. The dashboard includes a dedicated "Coming soon" section rather than showing empty values.
- **API key:** The same key is already public in the Clubforce frontend bundle. It is included here so the site can run as a static deployment without a backend proxy.

## Project structure

```
ucfl-dashboard/
├── index.html
├── css/styles.css
├── data/
│   └── completed-seasons.json
├── js/
│   ├── app.js          # UI and page lifecycle
│   ├── api.js          # Live API fetching (current season)
│   ├── aggregate.js    # Stats aggregation
│   ├── config.js       # Team/competition settings
│   └── types.js        # Shared JSDoc types
├── scripts/
│   ├── serve.mjs
│   ├── fetch-config.mjs
│   └── fetch-completed-seasons.mjs
└── README.md
```
