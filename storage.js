'use strict';

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const LATEST_FILE = path.join(DATA_DIR, 'latest.json');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

/**
 * Saves the results of a run.
 * - Overwrites data/latest.json with this run's results (what you'd
 *   fetch/display "right now").
 * - Appends a timestamped snapshot to data/history.json so you can
 *   track price changes over time.
 *
 * @param {Object[]} results - array of { topic, cheapest, checkedAt }
 */
function saveResults(results) {
  ensureDataDir();

  const runRecord = {
    run_at: new Date().toISOString(),
    results,
  };

  fs.writeFileSync(LATEST_FILE, JSON.stringify(runRecord, null, 2));

  let history = [];
  if (fs.existsSync(HISTORY_FILE)) {
    try {
      history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
      if (!Array.isArray(history)) history = [];
    } catch {
      history = [];
    }
  }

  history.push(runRecord);
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));

  console.log(`[Storage] Saved ${results.length} results to ${LATEST_FILE}`);
  console.log(`[Storage] Appended run to ${HISTORY_FILE} (${history.length} runs total)`);
}

module.exports = { saveResults, DATA_DIR, LATEST_FILE, HISTORY_FILE };
