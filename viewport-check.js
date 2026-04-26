const { chromium } = require('@playwright/test');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const viewports = [1280, 1200, 768, 480, 375];
  const outDir = path.join(__dirname, 'screenshots/review-2026');
  const fs = require('fs');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  for (const width of viewports) {
    const page = await browser.newPage();
    await page.setViewportSize({ width, height: 800 });
    await page.goto('http://localhost:4242', { waitUntil: 'networkidle', timeout: 15000 });

    // Close any settings modal that appears (Cancel button or X)
    try {
      const cancelBtn = page.locator('button:has-text("Cancel"), button[aria-label="Close"], .modal-close, #closeSettings, button:has-text("✕"), button:has-text("×")').first();
      await cancelBtn.waitFor({ timeout: 3000 });
      await cancelBtn.click();
      await page.waitForTimeout(400);
    } catch (e) {
      // No modal appeared, that's fine
    }

    // Full-page screenshot
    await page.screenshot({
      path: path.join(outDir, `${width}px-full.png`),
      fullPage: false,
      clip: { x: 0, y: 0, width, height: 800 }
    });

    // Header-only crop (top 200px)
    await page.screenshot({
      path: path.join(outDir, `${width}px-header.png`),
      clip: { x: 0, y: 0, width, height: 200 }
    });

    console.log(`Done: ${width}px`);
    await page.close();
  }

  await browser.close();
  console.log('All screenshots saved to screenshots/review-2026/');
})();
