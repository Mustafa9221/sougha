'use strict';

const AED_TO_QAR = 1.02; // Both currencies pegged to USD, rate is stable

async function scrapeAmazon(browser, searchQuery) {
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

    console.log('[Amazon] Navigating...');
    await page.goto(
      `https://www.amazon.ae/s?k=${encodeURIComponent(searchQuery)}`,
      { waitUntil: 'networkidle2', timeout: 20000 }
    );

    // Detect CAPTCHA or bot block before proceeding
    const blocked = await page.evaluate(() => {
      const title = document.title.toLowerCase();
      const body = document.body?.innerText?.toLowerCase() || '';
      return (
        title.includes('robot') ||
        title.includes('captcha') ||
        body.includes('enter the characters you see below') ||
        body.includes('sorry, we just need to make sure')
      );
    });

    if (blocked) {
      console.warn('[Amazon] Bot detection triggered — returning empty');
      return [];
    }

    console.log('[Amazon] Waiting for products...');
    const found = await page.waitForSelector('[data-component-type="s-search-result"]', { timeout: 10000 })
      .then(() => true)
      .catch(() => false);

    if (!found) {
      console.warn('[Amazon] No product results found — page may not have loaded correctly');
      return [];
    }

    await new Promise(r => setTimeout(r, 500));

    const results = await page.evaluate((AED_TO_QAR) => {
      const items = document.querySelectorAll('[data-component-type="s-search-result"]');
      const products = [];

      items.forEach((item, index) => {
        if (index >= 20) return;

        const asin = item.getAttribute('data-asin');
        if (!asin || asin.trim() === '') return;

        const name =
          item.querySelector('h2 a span')?.innerText?.trim() ||
          item.querySelector('h2 span')?.innerText?.trim() ||
          null;

        const priceOffscreen = item.querySelector('.a-price .a-offscreen')?.innerText?.trim() || null;
        const priceWhole = item.querySelector('.a-price-whole')?.innerText?.trim() || null;
        const priceFraction = item.querySelector('.a-price-fraction')?.innerText?.trim() || '00';

        let priceAED = null;

        if (priceOffscreen) {
          const match = priceOffscreen.match(/[\d,]+(\.\d+)?/);
          priceAED = match ? parseFloat(match[0].replace(/,/g, '')) : null;
        } else if (priceWhole) {
          const clean = (priceWhole + '.' + priceFraction).replace(/[^0-9.]/g, '');
          priceAED = parseFloat(clean) || null;
        }

        const price_qar = priceAED
          ? parseFloat((priceAED * AED_TO_QAR).toFixed(2))
          : null;

        const rawUrl = item.querySelector('h2 a')?.href || null;
        const url = rawUrl ? rawUrl.split('/ref=')[0] : null;

        const outOfStock =
          item.innerText?.toLowerCase().includes('currently unavailable') ||
          item.innerText?.toLowerCase().includes('out of stock');

        if (name && price_qar && price_qar > 0) {
          products.push({
            store: 'Amazon AE',
            name,
            price_qar,
            price_aed: priceAED,
            in_stock: !outOfStock,
            url,
            scraped_at: new Date().toISOString(),
          });
        }
      });

      return products;
    }, AED_TO_QAR);

    console.log(`[Amazon] Found ${results.length} products`);
    return results;

  } catch (err) {
    console.error(`[Amazon] Error:`, err.message);
    return [];
  } finally {
    await page.close().catch(() => {});
  }
}

module.exports = { scrapeAmazon };