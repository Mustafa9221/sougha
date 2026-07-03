'use strict';

const { fetchHotTopics } = require('./hotTopics');
const { runScraper } = require('./scraper');
const { getCheapest } = require('./filter');
const { saveResults } = require('./storage');

async function main() {
  console.log(`\n===== Price Tracker run started: ${new Date().toISOString()} =====`);

  const topics = await fetchHotTopics();
  const results = [];

  // Run topics sequentially (not in parallel) — each topic already opens
  // several browser pages across 3 stores, and running multiple topics'
  // worth of Chromium pages at once is a good way to get rate-limited or
  // run out of memory on a free-tier runner.
  for (const topic of topics) {
    try {
      const rawListings = await runScraper(topic);
      const cheapest = getCheapest(rawListings, topic);

      if (!cheapest) {
        console.warn(`[Index] No valid listings found for "${topic}"`);
        results.push({
          topic,
          cheapest: null,
          listings_found: rawListings.length,
          checked_at: new Date().toISOString(),
        });
        continue;
      }

      console.log(
        `[Index] Cheapest for "${topic}": ${cheapest.store} — ${cheapest.price_qar} QAR — ${cheapest.name}`
      );

      results.push({
        topic,
        cheapest,
        listings_found: rawListings.length,
        checked_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error(`[Index] Failed processing "${topic}":`, err.message);
      results.push({
        topic,
        cheapest: null,
        error: err.message,
        checked_at: new Date().toISOString(),
      });
    }
  }

  saveResults(results);

  console.log(`===== Price Tracker run finished: ${new Date().toISOString()} =====\n`);
}

main().catch((err) => {
  console.error('[Index] Fatal error:', err);
  process.exit(1);
});
