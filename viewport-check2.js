const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const viewports = [1280, 1200, 768, 480, 375];
  const outDir = path.join(__dirname, 'screenshots/review-2026');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  for (const width of viewports) {
    const page = await browser.newPage();
    await page.setViewportSize({ width, height: 800 });
    await page.goto('http://localhost:4242', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1000);

    // Try multiple strategies to close modal
    const closed = await page.evaluate(() => {
      // Look for CANCEL button inside any modal/dialog
      const btns = Array.from(document.querySelectorAll('button'));
      const cancel = btns.find(b => b.textContent.trim().toUpperCase() === 'CANCEL');
      if (cancel) { cancel.click(); return 'cancel'; }
      // Try X button
      const x = btns.find(b => b.textContent.trim() === '×' || b.textContent.trim() === '✕' || b.textContent.trim() === 'x' || b.getAttribute('aria-label') === 'Close');
      if (x) { x.click(); return 'x-btn'; }
      return 'none';
    });
    console.log(`${width}px: modal close strategy = ${closed}`);
    await page.waitForTimeout(600);

    // Full viewport screenshot
    await page.screenshot({
      path: path.join(outDir, `${width}px-full.png`),
      clip: { x: 0, y: 0, width, height: 800 }
    });

    // Header crop (top 160px to capture tabs and toolbar)
    await page.screenshot({
      path: path.join(outDir, `${width}px-header.png`),
      clip: { x: 0, y: 0, width, height: 160 }
    });

    console.log(`Saved: ${width}px`);
    await page.close();
  }

  await browser.close();
  console.log('Done.');
})();
