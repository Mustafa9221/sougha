'use strict';

/**
 * Fetches "today's hot topics" (product search terms) from an external API,
 * so you don't have to hardcode/update the list of products yourself.
 *
 * Configure via env var HOT_TOPICS_API_URL, pointing at any API that
 * returns JSON. You can shape the response to your source using
 * HOT_TOPICS_API_PATH (dot-path to the array within the JSON, optional)
 * and HOT_TOPICS_FIELD (field name per item that holds the search term,
 * optional — if items are plain strings this isn't needed).
 *
 * Example .env:
 *   HOT_TOPICS_API_URL=https://api.example.com/v1/trending?category=tech
 *   HOT_TOPICS_API_PATH=data.items
 *   HOT_TOPICS_FIELD=title
 *
 * If no API is configured (or the call fails), falls back to
 * FALLBACK_TOPICS below so the pipeline still runs.
 */

function getDynamicTopics() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed (0 = Jan, 8 = Sep)

  // iPhones usually release in September.
  // Before September, the latest is from the previous year.
  // Example: In mid-2024 (before Sept), the latest is iPhone 15 (2024 - 2009).
  const iphoneVersion = month < 8 ? (year - 2009) : (year - 2008);
  
  // Samsung S series usually release in Jan/Feb. 
  // The version matches the year (e.g. S24 in 2024).
  const samsungVersion = year - 2000;

  return [
    `iPhone ${iphoneVersion} Pro`,
    `iPhone ${iphoneVersion} Pro Max`,
    `Samsung Galaxy S${samsungVersion} Ultra`,
    'PS5'
  ];
}

const FALLBACK_TOPICS = getDynamicTopics();

const puppeteer = require('puppeteer');

function getByPath(obj, path) {
  if (!path) return obj;
  return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

async function scrapeAmazonBestSellers() {
  console.log('[HotTopics] Scraping Amazon Best Sellers for current trends...');
  
  const launchOptions = {
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  };

  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  let browser;
  try {
    browser = await puppeteer.launch(launchOptions);
  } catch (err) {
    try {
      launchOptions.channel = 'chrome';
      browser = await puppeteer.launch(launchOptions);
    } catch (err2) {
      launchOptions.channel = 'msedge';
      browser = await puppeteer.launch(launchOptions);
    }
  }

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Amazon AE Mobile Phones Best Sellers
    await page.goto('https://www.amazon.ae/gp/bestsellers/electronics/11608080031', { waitUntil: 'networkidle2', timeout: 20000 });

    const results = await page.evaluate(() => {
      // The class for the title in Amazon's best seller list
      const items = document.querySelectorAll('.p13n-sc-uncoverable-faceout a > div, .p13n-sc-truncate-desktop-type2');
      const topics = [];
      
      items.forEach((item) => {
        if (topics.length >= 4) return;
        const text = item.innerText;
        if (text && text.trim().length > 0) {
          // Take the first 4 words to form a nice short search topic 
          // (e.g., "Apple iPhone 15 Pro Max (256 GB)" -> "Apple iPhone 15 Pro")
          const clean = text.trim().split(/[\s\-()]+/).slice(0, 4).join(' ').trim();
          
          // Ignore general generic words or short items
          if (clean && clean.length > 5 && !topics.includes(clean)) {
            topics.push(clean);
          }
        }
      });
      return topics;
    });

    if (results && results.length > 0) {
      console.log(`[HotTopics] Successfully scraped live trends from Amazon:`, results);
      return results;
    }
  } catch (err) {
    console.error('[HotTopics] Failed to scrape live trends:', err.message);
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
  
  return null;
}

async function fetchHotTopics() {
  const apiUrl = process.env.HOT_TOPICS_API_URL;

  if (apiUrl) {
    try {
      const res = await fetch(apiUrl, {
        headers: process.env.HOT_TOPICS_API_KEY ? { Authorization: `Bearer ${process.env.HOT_TOPICS_API_KEY}` } : undefined,
      });

      if (res.ok) {
        const json = await res.json();
        const rawList = getByPath(json, process.env.HOT_TOPICS_API_PATH);
        const field = process.env.HOT_TOPICS_FIELD;
        const topics = rawList.map((item) => (field ? item?.[field] : item)).filter((t) => typeof t === 'string' && t.trim().length > 0).map((t) => t.trim());
        
        if (topics.length > 0) {
          console.log(`[HotTopics] Fetched ${topics.length} topics from API:`, topics);
          return topics;
        }
      }
    } catch (err) {
      console.error('[HotTopics] API failed:', err.message);
    }
  }

  // If no API, scrape the best sellers page dynamically for real-time trending devices
  const scrapedTopics = await scrapeAmazonBestSellers();
  if (scrapedTopics && scrapedTopics.length > 0) {
    return scrapedTopics;
  }

  // Final fallback if everything fails
  console.log('[HotTopics] Using date-based generated fallback topics.');
  return getDynamicTopics();
}

module.exports = { fetchHotTopics, FALLBACK_TOPICS: getDynamicTopics() };
