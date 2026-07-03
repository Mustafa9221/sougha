'use strict';

async function scrapeNoon(browser, searchQuery) {
  const page = await browser.newPage();

  try {
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (['image', 'font', 'media'].includes(req.resourceType())) {
        req.abort();
      } else {
        req.continue();
      }
    });

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    console.log('[Noon] Navigating...');
    await page.goto(
      `https://www.noon.com/qatar-en/search/?q=${encodeURIComponent(searchQuery)}`,
      { waitUntil: 'networkidle2', timeout: 20000 }
    );

    console.log('[Noon] Waiting for products...');
    const found = await page.waitForSelector('a[id^="productBox"], a[href*="/p/"]', { timeout: 10000 })
      .then(() => true)
      .catch(() => false);

    if (!found) {
      console.warn('[Noon] No product cards found — page may not have loaded correctly');
      return [];
    }

    await new Promise(r => setTimeout(r, 500));

    const results = await page.evaluate(() => {
      const items = document.querySelectorAll('a[id^="productBox"], a[href*="/p/"]');
      const products = [];

      items.forEach((item, index) => {
        if (index >= 20) return;

        const name =
          item.querySelector('[class*="name" i]')?.innerText?.trim() ||
          item.querySelector('[class*="Name" i]')?.innerText?.trim() ||
          item.querySelector('[class*="title" i]')?.innerText?.trim() ||
          null;

        const priceEl =
          item.querySelector('strong') ||
          item.querySelector('[class*="price" i]') ||
          item.querySelector('[class*="Price" i]') ||
          item.querySelector('[class*="amount" i]');

        const priceText = priceEl?.innerText?.trim() || null;

        const qarMatch = item.innerText?.match(/[\d,]+(?:\.\d+)?(?=\s*(QAR|ر\.ق))/);
        const priceFromText = qarMatch ? parseFloat(qarMatch[0].replace(/,/g, '')) : null;

        const priceMatch = priceText ? priceText.match(/[\d,]+(\.\d+)?/) : null;
        const priceFromEl = priceMatch ? parseFloat(priceMatch[0].replace(/,/g, '')) : null;

        const price = priceFromEl || priceFromText || null;

        const url = item.href || null;

        const outOfStock =
          item.innerText?.toLowerCase().includes('out of stock') ||
          !!item.querySelector('[class*="outOfStock" i]') ||
          !!item.querySelector('[class*="out-of-stock" i]');

        if (name && price && price > 0) {
          products.push({
            store: 'Noon',
            name,
            price_qar: price,
            in_stock: !outOfStock,
            url,
            scraped_at: new Date().toISOString(),
          });
        }
      });

      return products;
    });

    console.log(`[Noon] Found ${results.length} products`);
    return results;

  } catch (err) {
    console.error(`[Noon] Error:`, err.message);
    return [];
  } finally {
    await page.close().catch(() => {});
  }
}

module.exports = { scrapeNoon };