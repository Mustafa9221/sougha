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

const FALLBACK_TOPICS = [
  'iPhone 16 Pro',
  'iPhone 17 Pro Max',
  'PS5',
  'Samsung Galaxy S25 Ultra',
];

function getByPath(obj, path) {
  if (!path) return obj;
  return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

async function fetchHotTopics() {
  const apiUrl = process.env.HOT_TOPICS_API_URL;

  if (!apiUrl) {
    console.warn(
      '[HotTopics] HOT_TOPICS_API_URL not set — using fallback topic list. ' +
        'Set this env var to plug in a real trending-topics API.'
    );
    return FALLBACK_TOPICS;
  }

  try {
    const res = await fetch(apiUrl, {
      headers: process.env.HOT_TOPICS_API_KEY
        ? { Authorization: `Bearer ${process.env.HOT_TOPICS_API_KEY}` }
        : undefined,
    });

    if (!res.ok) {
      throw new Error(`API responded with status ${res.status}`);
    }

    const json = await res.json();
    const rawList = getByPath(json, process.env.HOT_TOPICS_API_PATH);

    if (!Array.isArray(rawList)) {
      throw new Error('Resolved response is not an array — check HOT_TOPICS_API_PATH');
    }

    const field = process.env.HOT_TOPICS_FIELD;
    const topics = rawList
      .map((item) => (field ? item?.[field] : item))
      .filter((topic) => typeof topic === 'string' && topic.trim().length > 0)
      .map((topic) => topic.trim());

    if (topics.length === 0) {
      throw new Error('API returned zero usable topics');
    }

    console.log(`[HotTopics] Fetched ${topics.length} topics from API:`, topics);
    return topics;
  } catch (err) {
    console.error('[HotTopics] Failed to fetch hot topics, using fallback list:', err.message);
    return FALLBACK_TOPICS;
  }
}

module.exports = { fetchHotTopics, FALLBACK_TOPICS };
