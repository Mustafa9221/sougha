# Price Tracker

Daily job: fetch today's "hot topics" (product names) → search each one across
Amazon AE, Jarir, and Noon → keep only the cheapest in-stock listing per
topic → save results. Runs automatically every 24 hours for free via
GitHub Actions.

## How it fits together

```
hotTopics.js  → gets today's list of products to check (e.g. ["iPhone 17 Pro Max", "PS5"])
scraper.js    → runScraper(query) opens one browser, runs amazon.js/jarir.js/noon.js
                for that query, returns ALL listings found (every variant, every store)
filter.js     → getCheapest(listings) reduces those to a single cheapest in-stock item
storage.js    → saves the day's results to data/latest.json and appends to data/history.json
index.js      → orchestrator: loops hotTopics → scraper → filter → storage
```

`amazon.js`, `jarir.js`, `noon.js` are your existing scrapers — untouched.

## 1. Local setup

```bash
npm install
node index.js          # runs the full daily job once
node test.js            # quick manual test of a single query (unchanged)
```

Results land in:
- `data/latest.json` — this run's results
- `data/history.json` — every run ever, appended, so you can track price trends

## 2. Plugging in a real "hot topics" API

Right now `hotTopics.js` uses a small hardcoded fallback list
(`iPhone 16 Pro`, `iPhone 17 Pro Max`, `PS5`, `Samsung Galaxy S25 Ultra`) so
the pipeline runs out of the box. To point it at a real trending-topics API,
set these env vars (locally in a `.env`-style export, or as GitHub secrets
for the scheduled job):

| Env var | Required | Meaning |
|---|---|---|
| `HOT_TOPICS_API_URL` | yes | The endpoint to call |
| `HOT_TOPICS_API_KEY` | no | Sent as `Authorization: Bearer <key>` if set |
| `HOT_TOPICS_API_PATH` | no | Dot-path to the array inside the JSON response, e.g. `data.items` |
| `HOT_TOPICS_FIELD` | no | Field name holding the search term per item, e.g. `title` (omit if items are plain strings) |

If the call fails for any reason, it falls back to the hardcoded list so a
bad API day doesn't kill the whole run.

## 3. Deployment — GitHub Actions (free, no VPS needed)

The workflow is already set up at `.github/workflows/scrape.yml`. It:

- Runs every day at **06:00 UTC** (edit the `cron` line to change the time)
- Can also be triggered manually from the **Actions** tab (`workflow_dispatch`)
- Installs deps, runs `node index.js`
- Commits `data/latest.json` and `data/history.json` back into the repo,
  so results persist between runs (GitHub Actions runners are wiped after
  every run — nothing survives unless you commit it or push it somewhere)

### Setup steps

1. Push this project to a GitHub repo (public repos get unlimited free
   Actions minutes; private repos get 2,000 free minutes/month, which is
   plenty for a once-a-day job).
2. If you're using a real hot-topics API, go to
   **Settings → Secrets and variables → Actions** and add:
   - `HOT_TOPICS_API_URL`
   - `HOT_TOPICS_API_KEY` (if needed)
   - `HOT_TOPICS_API_PATH` (if needed)
   - `HOT_TOPICS_FIELD` (if needed)
3. That's it — it'll run automatically every 24h. You can also click
   **Actions → Daily Price Tracker → Run workflow** to trigger it by hand.

### Why GitHub Actions instead of a VPS

You said you don't want to pay for hosting. GitHub Actions' scheduled
workflows are free (within the minutes above), require no server to
maintain, and puppeteer's bundled Chromium runs fine on the standard
`ubuntu-latest` runner — so there's no infrastructure to manage or pay for.

## 4. Notes / things worth knowing

- **Rate limiting risk**: running Amazon/Jarir/Noon puppeteer scrapes daily
  from GitHub's shared IP ranges may get flagged more than from a
  residential/VPS IP. If you start seeing a lot of "bot detection
  triggered" or empty results in the logs, that's usually why.
- **Topics run sequentially**, not in parallel, to avoid spinning up too
  many Chromium pages at once on a free runner and getting killed for
  memory/timeout.
- Each topic's result records `listings_found` (how many raw listings were
  seen across all 3 stores) alongside the single `cheapest` one that got
  saved, so you can sanity-check that a topic isn't secretly returning 0
  in the background.
