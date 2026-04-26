const { chromium } = require('@playwright/test');

const VIEWPORTS = [
  { width: 1440, label: '1440px' },
  { width: 1280, label: '1280px' },
  { width: 1200, label: '1200px' },
  { width: 1024, label: '1024px' },
  { width: 768,  label: '768px'  },
  { width: 480,  label: '480px'  },
  { width: 375,  label: '375px'  },
];

const OUT_DIR = '/Users/alig/Ali-work/experiment/ali-productivity-dashboard/ali-productivity-dashboard/screenshots';
const URL = 'http://localhost:4242';

(async () => {
  const browser = await chromium.launch({ headless: true });

  for (const vp of VIEWPORTS) {
    const page = await browser.newPage();
    await page.setViewportSize({ width: vp.width, height: 800 });

    await page.goto(URL, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1500);

    // Close settings modal if present — try multiple selectors
    const cancelSelectors = [
      'button:has-text("Cancel")',
      'button:has-text("Close")',
      'button[aria-label="Close"]',
      '.modal-footer button:last-child',
      '#settingsModal .modal-footer button',
    ];
    for (const sel of cancelSelectors) {
      try {
        const btn = page.locator(sel).first();
        if (await btn.isVisible({ timeout: 500 })) {
          await btn.click();
          await page.waitForTimeout(400);
          break;
        }
      } catch (_) {}
    }

    // Full-page screenshot (shows complete header in context)
    await page.screenshot({
      path: `${OUT_DIR}/header-${vp.label}-full.png`,
      fullPage: false,
    });

    // Cropped screenshot: just the header region (top 160px)
    await page.screenshot({
      path: `${OUT_DIR}/header-${vp.label}-crop.png`,
      clip: { x: 0, y: 0, width: vp.width, height: 160 },
    });

    // Collect header metrics for analysis
    const metrics = await page.evaluate(() => {
      const header = document.querySelector('header');
      const left = document.querySelector('.header-left');
      const tabToggle = document.querySelector('#mainTabToggle');
      const viewToggle = document.querySelector('#taskViewToggle');
      const buttons = document.querySelector('.buttons');
      const titleDiv = document.querySelector('.header-left > div:first-of-type');

      const rect = (el) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right), height: Math.round(r.height), width: Math.round(r.width) };
      };

      const style = (el) => el ? window.getComputedStyle(el).display : 'N/A';

      return {
        header: rect(header),
        headerLeft: rect(left),
        mainTabToggle: rect(tabToggle),
        mainTabToggleDisplay: style(tabToggle),
        taskViewToggle: rect(viewToggle),
        taskViewToggleDisplay: style(viewToggle),
        buttons: rect(buttons),
        titleDiv: rect(titleDiv),
      };
    });

    console.log(`\n=== ${vp.label} ===`);
    console.log(JSON.stringify(metrics, null, 2));

    await page.close();
  }

  await browser.close();
  console.log('\nDone.');
})();
