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

async function dismissModal(page) {
  // Try clicking the X button in the modal header
  try {
    const x = page.locator('.modal-header button, button.modal-close, .modal button[title="Close"], .modal-header .close-btn').first();
    if (await x.isVisible({ timeout: 300 })) { await x.click(); await page.waitForTimeout(300); return; }
  } catch(_) {}
  // Try Cancel button
  try {
    const cancel = page.locator('button:has-text("Cancel"), button:has-text("CANCEL")').first();
    if (await cancel.isVisible({ timeout: 300 })) { await cancel.click(); await page.waitForTimeout(300); return; }
  } catch(_) {}
  // Try the × (times) button
  try {
    const x2 = page.locator('button:has-text("×"), button:has-text("✕"), button:has-text("x")').first();
    if (await x2.isVisible({ timeout: 300 })) { await x2.click(); await page.waitForTimeout(300); return; }
  } catch(_) {}
  // Press Escape
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();

  // Pre-set IndexedDB to mark "configured" so settings modal won't show,
  // by injecting a script via addInitScript before first navigation
  await context.addInitScript(() => {
    // Override indexedDB open to pre-populate config so modal is skipped
    // We'll handle it by dismissal instead - just flag window
    window.__suppressModal = true;
  });

  for (const vp of VIEWPORTS) {
    const page = await context.newPage();
    await page.setViewportSize({ width: vp.width, height: 800 });

    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(e => console.log('nav err:', e.message));
    
    // Wait for the app to render
    await page.waitForTimeout(2000);

    // Dismiss modal if visible — check for the × button inside modal-header
    const modalVisible = await page.locator('.modal').isVisible().catch(() => false);
    if (modalVisible) {
      console.log(`  [${vp.label}] Modal detected, dismissing...`);
      // Click the × button (text is "×" or similar)
      const dismissed = await page.evaluate(() => {
        // Find any button inside a modal that looks like a close button
        const btns = Array.from(document.querySelectorAll('.modal button, [role="dialog"] button'));
        // Try × or x text
        const closeBtn = btns.find(b => {
          const t = b.textContent.trim();
          return t === '×' || t === '✕' || t === 'x' || t === 'X' || b.title === 'Close';
        });
        if (closeBtn) { closeBtn.click(); return 'close-btn'; }
        // Try Cancel
        const cancelBtn = btns.find(b => b.textContent.trim().toLowerCase() === 'cancel');
        if (cancelBtn) { cancelBtn.click(); return 'cancel'; }
        return null;
      });
      console.log(`  [${vp.label}] Dismissed via: ${dismissed}`);
      await page.waitForTimeout(500);
    }

    // Double-check modal is gone
    const stillVisible = await page.locator('.modal').isVisible().catch(() => false);
    if (stillVisible) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
    }

    // Screenshot: full viewport (800px height)
    await page.screenshot({
      path: `${OUT_DIR}/v2-header-${vp.label}-full.png`,
      fullPage: false,
    });

    // Screenshot: header crop (top 180px to be safe)
    const cropH = Math.min(180, 800);
    await page.screenshot({
      path: `${OUT_DIR}/v2-header-${vp.label}-crop.png`,
      clip: { x: 0, y: 0, width: vp.width, height: cropH },
    });

    // Collect layout metrics
    const metrics = await page.evaluate(() => {
      const rect = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        return { 
          top: Math.round(r.top), bottom: Math.round(r.bottom), 
          left: Math.round(r.left), right: Math.round(r.right), 
          height: Math.round(r.height), width: Math.round(r.width),
          display: style.display,
          visible: style.display !== 'none' && r.width > 0
        };
      };

      // Check if taskViewToggle is on the same row as mainTabToggle
      const tabs = document.querySelector('#mainTabToggle');
      const toggle = document.querySelector('#taskViewToggle');
      let sameRow = null;
      if (tabs && toggle) {
        const tr = tabs.getBoundingClientRect();
        const vr = toggle.getBoundingClientRect();
        // "Same row" = tops within 10px of each other
        sameRow = Math.abs(tr.top - vr.top) <= 10;
      }

      // Check for any overflow/clipping
      const header = document.querySelector('header');
      const headerRight = header ? header.getBoundingClientRect().right : null;
      const buttonsRight = document.querySelector('.buttons') ? document.querySelector('.buttons').getBoundingClientRect().right : null;
      const overflow = headerRight && buttonsRight ? buttonsRight > headerRight + 2 : null;

      return {
        header: rect('header'),
        headerLeft: rect('.header-left'),
        mainTabToggle: rect('#mainTabToggle'),
        taskViewToggle: rect('#taskViewToggle'),
        buttons: rect('.buttons'),
        titleDiv: rect('.header-left > div:first-of-type'),
        taskViewToggle_sameRowAsTabs: sameRow,
        buttons_overflow: overflow,
        viewportWidth: window.innerWidth,
      };
    });

    console.log(`\n=== ${vp.label} ===`);
    console.log(JSON.stringify(metrics, null, 2));

    await page.close();
  }

  await browser.close();
  console.log('\n=== Done. ===');
})();
