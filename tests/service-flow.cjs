// Run: NODE_PATH=/path/to/node_modules node tests/service-flow.cjs [base URL]
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_PATH ? { executablePath: process.env.BROWSER_PATH } : {}) });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const base = process.argv[2] || 'http://127.0.0.1:8765';
  const network = [];
  page.on('request', request => { if (request.method() !== 'GET') network.push(request.url()); });
  try {
    await page.goto(`${base}/services/spreadsheet-cleanup/?rows=20&columns=6`, { waitUntil: 'networkidle' });
    assert.equal(await page.locator('#rows').inputValue(), '20');
    assert.equal(await page.locator('#columns').inputValue(), '6');
    await page.locator('#file-size').selectOption('within');
    assert.match(await page.locator('#fit-status').textContent(), /Within the \$15/);
    await page.locator('input[name="rule"]').first().check();
    await page.locator('#scope-check').check();
    await page.locator('#notes').fill('Keep 0012; <script>alert("test")</script>');
    await page.getByRole('button', { name: 'Create request brief' }).click();
    assert.equal(await page.locator('#brief-section').isVisible(), true);
    const brief = await page.locator('#brief').inputValue();
    assert.match(brief, /USD \$15/);
    assert.match(brief, /VP-\d{8}-[A-F0-9]{8}/);
    assert.match(brief, /not an accepted order or payment/);
    assert.match(await page.locator('#brief-status').textContent(), /Nothing has been sent/);
    const email = new URL(await page.locator('#email-brief').getAttribute('href'));
    assert.equal(email.pathname, 'info@vitapilotai.com');
    assert.equal(email.searchParams.get('body'), brief);
    const downloadWait = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download brief' }).click();
    const download = await downloadWait;
    assert.match(download.suggestedFilename(), /VP-.*-request\.txt/);
    assert.equal(await fs.readFile(await download.path(), 'utf8'), brief);
    await page.locator('#rows').fill('26');
    assert.equal(await page.locator('#brief-section').isHidden(), true);
    assert.equal(await page.locator('#brief').inputValue(), '');
    await page.getByRole('button', { name: 'Create request brief' }).click();
    assert.match(await page.locator('#brief').inputValue(), /Quote request — no price agreed/);
    await page.locator('input[name="rule"]').last().check();
    await page.getByRole('button', { name: 'Create request brief' }).click();
    assert.match(await page.locator('#fit-status').textContent(), /cannot be combined/);
    assert.equal(await page.locator('#brief-section').isHidden(), true);
    await page.locator('input[name="rule"]').last().uncheck();
    await page.locator('#rows').fill('25');
    await page.locator('#columns').fill('11');
    await page.getByRole('button', { name: 'Create request brief' }).click();
    assert.match(await page.locator('#brief').inputValue(), /Quote request/);
    await page.locator('#columns').fill('10');
    await page.locator('#file-size').selectOption('unknown');
    await page.getByRole('button', { name: 'Create request brief' }).click();
    assert.match(await page.locator('#brief').inputValue(), /Quote request/);
    assert.deepEqual(network, [], 'The form must not POST or upload anything');

    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${base}/services/spreadsheet-cleanup/`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `overflow at ${width}`);
    }
    const screenshotDir = process.env.SCREENSHOT_DIR;
    if (screenshotDir) {
      await fs.mkdir(screenshotDir, { recursive: true });
      await page.screenshot({ path: path.join(screenshotDir, 'service-desktop.png'), fullPage: true });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({ path: path.join(screenshotDir, 'service-mobile.png'), fullPage: true });
    }

    await page.goto(`${base}/demos/csv-flight-check/`);
    await page.locator('#sample-button').click();
    const serviceURL = new URL(await page.locator('#service-link').getAttribute('href'), page.url());
    assert.equal(serviceURL.searchParams.get('rows'), '7');
    assert.equal(serviceURL.searchParams.get('columns'), '5');
    assert.deepEqual([...serviceURL.searchParams.keys()].sort(), ['columns', 'rows']);
    await page.locator('#service-link').click();
    assert.equal(await page.locator('#rows').inputValue(), '7');

    const links = await page.locator('a[href]').evaluateAll(nodes => nodes.map(node => node.href));
    for (const link of new Set(links)) {
      const url = new URL(link);
      if (url.origin !== new URL(base).origin) continue;
      const response = await context.request.get(link);
      assert.equal(response.ok(), true, `broken link: ${link}`);
    }
    assert.deepEqual(errors, []);
    console.log('PASS: package boundaries, quote routing, consent/rules, stale brief invalidation, email encoding, download contents, no uploads, mobile/tablet/desktop layout, CSV handoff, and internal links.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
