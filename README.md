# Bushy Athletic FC · UCFL Stats Dashboard

Standalone dashboard for Bushy Athletic FC player and team stats.

Data is loaded from bundled JSON snapshots. The site never calls the Clubforce API in the browser. **2026/27 League (Division 2A)** is selected by default, with **2025/26 League (Division 3A)** available in the season selector.

## Features

- League results, player stats, and league table for the selected competition
- Upcoming fixtures across every competition Bushy are found in, with the competition named on each card
- Leaderboards for goals, appearances, minutes, yellow cards, and red cards
- Player names disambiguated when two players share a short name (for example DUNNE Mick and DUNNE Mark)
- Combined **2026/27 All Competitions** stats alongside league- and cup-only views
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

## Refreshing data

Do not fetch Clubforce on page load. Refresh snapshots locally or via GitHub Actions, then deploy the JSON.

Current season (results, fixtures, table, extra competitions, insights):

```bash
node scripts/fetch-current-season.mjs
```

Completed seasons (historic):

```bash
node scripts/fetch-completed-seasons.mjs
```

Or:

```bash
node scripts/refresh-data.mjs          # current season only
node scripts/refresh-data.mjs --all    # current + completed
```

GitHub Actions workflow `.github/workflows/refresh-data.yml` runs on Irish local time: **weekdays at 1pm and 11pm**, and **hourly from 1pm through 11pm at weekends**. It can also be started manually. It commits updated files under `data/` so Cloudflare Pages can redeploy.

To enable it after pushing the project:

1. In GitHub, open **Settings → Actions → General**.
2. Under **Workflow permissions**, select **Read and write permissions** and save.
3. Open **Actions → Refresh dashboard data → Run workflow**.
4. Choose `current` for a normal update, or `all` to refresh current and completed seasons.
5. Confirm the workflow creates a `Refresh Bushy Athletic stats from Clubforce` commit.
6. If Cloudflare Pages is connected to the repository, that commit automatically triggers a deployment.

Scheduled workflows run from the repository's default branch. GitHub may start scheduled jobs a few minutes after the configured time. If the default branch is protected against direct pushes, allow GitHub Actions to push or change the workflow to open a pull request.

Extra analysis fields (penalties, own goals, captain appearances, full lineups and match events) are written to `data/insights/` and are **not** loaded by the website.

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
| `teamId` | Clubforce team id for this Bushy side (avoids mixing other squads) |
| `organizationId` | UCFL org ID in the Comet system |
| `apiKey` | Public Clubforce/Comet API key |
| `cacheTtlMinutes` | How long session cache remains valid |
| `completedSeasonNames` | Exact competition names stored as previous seasons |
| `currentSeasonCompetitionName` | Exact active league name to refresh |
| `seasons` | Season dropdown options (league campaigns) |
| `defaultSeasonId` | Which season is selected on page load |

To refresh the API key from Clubforce:

```bash
node scripts/fetch-config.mjs
```

## Notes

- **Player stats:** Goals, appearances, minutes, and cards come from the official `/player/{personId}/stats` endpoint per competition (same source as the Clubforce app). Match events are still used for results, fixtures, and discovering squad members.
- **Assists:** The official stats API includes an assists field, but UCFL competitions currently return zero assists. The dashboard includes a dedicated "Coming soon" section rather than showing empty values.
- **Cups:** Upcoming fixtures come from the team's Clubforce schedule, which includes competitions outside UCFL (for example the LFA Junior Cup). Those competitions are added to the season dropdown when Bushy have a current-season fixture or result in them.
- **API key:** The same key is already public in the Clubforce frontend bundle. It is included here so refresh scripts can run without a backend proxy.

## Project structure

```
ucfl-dashboard/
├── index.html
├── css/styles.css
├── data/
│   ├── current-season.json
│   ├── completed-seasons.json
│   └── insights/          # extra stats, not used by the site
├── js/
│   ├── app.js
│   ├── api.js
│   ├── aggregate.js
│   ├── display-names.js
│   ├── config.js
│   └── types.js
├── scripts/
│   ├── serve.mjs
│   ├── fetch-config.mjs
│   ├── fetch-completed-seasons.mjs
│   ├── fetch-current-season.mjs
│   ├── refresh-data.mjs
│   └── insights.mjs
└── README.md
```
