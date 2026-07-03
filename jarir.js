'use strict';

async function scrapeJarir(browser, searchQuery) {
  const page = await browser.newPage();

  try {
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) {
        req.abort();
      } else {
        req.continue();
      }
    });

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    console.log('[Jarir] Navigating...');
    await page.goto(
      `https://www.jarir.com/qa-en/catalogsearch/result/?q=${encodeURIComponent(searchQuery)}`,
      { waitUntil: 'networkidle2', timeout: 20000 }
    );

    // Accept cookies if banner appears
    const cookieClicked = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button'))
        .find(el => el.innerText?.trim().includes('Accept all'));
      if (btn) { btn.click(); return true; }
      return false;
    });
    if (cookieClicked) {
      console.log('[Jarir] Accepted cookies');
      await new Promise(r => setTimeout(r, 1000));
    }

    // Select Qatar English if country selector appears
    const countryClicked = await page.evaluate(() => {
      const el = Array.from(document.querySelectorAll('button, a, div, span'))
        .find(el => el.innerText?.includes('Qatar') && el.innerText?.includes('English'));
      if (el) { el.click(); return true; }
      return false;
    });
    if (countryClicked) {
      console.log('[Jarir] Selected Qatar English');
      await new Promise(r => setTimeout(r, 1000));
    }

    // Wait for product tiles
    console.log('[Jarir] Waiting for products...');
    const found = await page.waitForSelector('.product-tile', { timeout: 10000 })
      .then(() => true)
      .catch(() => false);

    if (!found) {
      console.warn('[Jarir] No product tiles found — page may not have loaded correctly');
      return [];
    }

    // Small settle wait after tiles appear
    await new Promise(r => setTimeout(r, 1000));

    const results = await page.evaluate(() => {
      const items = document.querySelectorAll('.product-tile');
      const products = [];

      items.forEach((item, index) => {
        if (index >= 20) return;

        const name = item.querySelector('.product-title__title')?.innerText?.trim() || null;
        const priceText = item.querySelector('.product-tile__price')?.innerText?.trim() || null;
        const url = item.querySelector('.product-tile__link')?.href || null;
        const outOfStock = !!item.querySelector('.out-of-stock');

        const priceMatch = priceText ? priceText.match(/[\d,]+(\.\d+)?/) : null;
        const price = priceMatch ? parseFloat(priceMatch[0].replace(/,/g, '')) : null;

        if (name && price) {
          products.push({
            store: 'Jarir',
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

    console.log(`[Jarir] Found ${results.length} products`);
    return results;

  } catch (err) {
    console.error(`[Jarir] Error:`, err.message);
    return [];
  } finally {
    await page.close().catch(() => {});
  }
}

module.exports = { scrapeJarir };