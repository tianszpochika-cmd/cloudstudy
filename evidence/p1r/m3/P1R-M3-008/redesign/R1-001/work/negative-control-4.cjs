const { chromium } = require("playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const page = await ctx.newPage();
    // 受控失败：断言一个不存在的 CTA 文案，采集器必须非零退出。
    await page.goto("http://127.0.0.1:18182/", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2000);
    const count = await page.locator('[data-learning-entry="__no-such-entry__"]').count();
    assert.equal(count, 1, "controlled failure: missing CTA must fail");
  } finally { await browser.close(); }
})().catch((e) => { console.error("CONTROLLED-FAIL-OK:" + e.message.slice(0, 200)); process.exit(1); });
