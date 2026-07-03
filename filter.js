'use strict';

/**
 * Takes the raw combined results for one search topic (many listings
 * across Amazon/Jarir/Noon — different variants, colors, storage sizes,
 * etc.) and reduces it down to a single "best" result: the cheapest
 * in-stock item. If nothing is in stock, falls back to the cheapest
 * item overall so you still get a price reference.
 *
 * @param {Array} products - raw combined listings for one topic
 * @returns {Object|null} the single cheapest product, or null if empty
 */
function getCheapest(products, topic) {
  if (!Array.isArray(products) || products.length === 0) return null;

  let valid = products.filter(
    (p) => p && typeof p.price_qar === 'number' && p.price_qar > 0
  );

  if (topic) {
    const topicWords = topic.toLowerCase().split(/\s+/);
    const excludedWords = [
      'case', 'cover', 'protector', 'adapter', 'charger', 'cable', 
      'strap', 'band', 'controller', 'headset', 'stand', 'remote', 
      'camera', 'skin', 'faceplate', 'mount', 'cooling', 'fan', 'game'
    ];
    
    valid = valid.filter((p) => {
      let name = (p.name || '').toLowerCase();
      
      // Add common aliases to the name so it passes the word check
      if (name.includes('playstation 5')) name += ' ps5';
      if (name.includes('playstation5')) name += ' ps5';
      
      const hasAllWords = topicWords.every(word => {
        // 'galaxy' is often omitted in product titles (e.g., "Samsung S25 Ultra")
        if (word === 'galaxy') return true; 
        return name.includes(word);
      });

      const isAccessory = excludedWords.some(word => name.includes(word));
      
      return hasAllWords && !isAccessory;
    });
  }

  if (valid.length === 0) return null;

  const inStock = valid.filter((p) => p.in_stock !== false);
  const pool = inStock.length > 0 ? inStock : valid;

  return pool.reduce((cheapest, current) =>
    current.price_qar < cheapest.price_qar ? current : cheapest
  );
}

module.exports = { getCheapest };
