'use strict';

const puppeteer = require('puppeteer');
const { scrapeAmazon } = require('./amazon');
const { scrapeJarir } = require('./jarir');
const { scrapeNoon } = require('./noon');

/**
 * Runs all store scrapers (Amazon, Jarir, Noon) for a single search query
 * and returns the combined, raw list of products found across stores.
 *
 * NOTE: this returns EVERYTHING found (all variants/listings from all
 * stores). Picking the single cheapest match is handled separately by
 * filter.js — runScraper's job is just "go get the data".
 *
 * @param {string} searchQuery - e.g. "iPhone 16 Pro"
 * @returns {Promise<Array>} combined array of product objects
 */
async function runScraper(searchQuery) {
  console.log(`\n[Scraper] Starting run for: "${searchQuery}"`);

  const launchOptions = {
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  };

  // If puppeteer's own bundled Chromium download is unavailable/blocked
  // (common with AV software on Windows), point at an existing Chrome
  // install instead via PUPPETEER_EXECUTABLE_PATH.
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  let browser;
  try {
    browser = await puppeteer.launch(launchOptions);
  } catch (err) {
    console.warn('[Scraper] Puppeteer cache missing or broken. Falling back to system Chrome...');
    try {
      launchOptions.channel = 'chrome';
      browser = await puppeteer.launch(launchOptions);
    } catch (err2) {
      console.warn('[Scraper] System Chrome missing. Falling back to system Edge...');
      launchOptions.channel = 'msedge';
      browser = await puppeteer.launch(launchOptions);
    }
  }

  try {
    // Run all three stores in parallel. Each store file already catches
    // its own errors and returns [] on failure, so one store dying
    // doesn't take down the others.
    const [amazonResults, jarirResults, noonResults] = await Promise.all([
      scrapeAmazon(browser, searchQuery).catch((err) => {
        console.error('[Scraper] Amazon threw unexpectedly:', err.message);
        return [];
      }),
      scrapeJarir(browser, searchQuery).catch((err) => {
        console.error('[Scraper] Jarir threw unexpectedly:', err.message);
        return [];
      }),
      scrapeNoon(browser, searchQuery).catch((err) => {
        console.error('[Scraper] Noon threw unexpectedly:', err.message);
        return [];
      }),
    ]);

    const combined = [...amazonResults, ...jarirResults, ...noonResults];
    console.log(
      `[Scraper] "${searchQuery}" done — Amazon: ${amazonResults.length}, Jarir: ${jarirResults.length}, Noon: ${noonResults.length} (total: ${combined.length})`
    );

    return combined;
  } finally {
    await browser.close().catch(() => {});
  }
}

module.exports = { runScraper };