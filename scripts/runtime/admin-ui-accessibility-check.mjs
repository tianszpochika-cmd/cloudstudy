import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";
import assert from "node:assert/strict";

const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const results = [];
try {
  await page.goto("http://127.0.0.1:18181/login");
  await page.waitForSelector(".login-card");
  for (const theme of ["light", "dark", "high-contrast"]) {
    await page.evaluate(async (theme) => {
      const { adminThemeController } =
        await import("/src/platform/v2-foundation.ts");
      adminThemeController.setTheme(theme);
    }, theme);
    const contrast = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      const luminance = (name) => {
        const raw = style
          .getPropertyValue(`--admin-${name}`)
          .trim()
          .replace("#", "");
        const hex =
          raw.length === 3 ? [...raw].map((c) => c + c).join("") : raw;
        const channels = [0, 2, 4]
          .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
          .map((v) =>
            v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4,
          );
        return (
          channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
        );
      };
      return [
        ["ink", "surface"],
        ["muted", "surface"],
        ["muted", "canvas"],
        ["accent", "surface"],
        ["on-brand", "brand"],
      ].map(([foreground, background]) => {
        const a = luminance(foreground),
          b = luminance(background);
        const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        return {
          foreground,
          background,
          ratio: Number(ratio.toFixed(2)),
          pass: ratio >= 4.5,
        };
      });
    });
    results.push({ theme, contrast });
  }
  await page.evaluate(async () => {
    const { adminThemeController } =
      await import("/src/platform/v2-foundation.ts");
    adminThemeController.setTheme("system");
  });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.waitForFunction(
    () => document.documentElement.dataset.theme === "dark",
  );
  await page.emulateMedia({ colorScheme: "light" });
  await page.waitForFunction(
    () => document.documentElement.dataset.theme === "light",
  );
  await page.locator("[name=identifier]").focus();
  await page.keyboard.press("Tab");
  assert.equal(
    await page
      .locator("[name=password]")
      .evaluate((e) => e === document.activeElement),
    true,
  );
  await page.keyboard.press("Tab");
  assert.equal(
    await page
      .getByRole("button", { name: "显示密码", exact: true })
      .evaluate((e) => e === document.activeElement),
    true,
  );
  await page.keyboard.press("Enter");
  assert.equal(
    await page.locator("[name=password]").getAttribute("type"),
    "text",
  );
  const failed = results.flatMap((r) =>
    r.contrast.filter((c) => !c.pass).map((c) => ({ theme: r.theme, ...c })),
  );
  await writeFile(
    "docs/06-design/v2-980plus/admin-experience-2026-09-22/accessibility-validation.json",
    JSON.stringify(
      {
        date: new Date().toISOString(),
        scope:
          "Core text token contrast, system theme and login keyboard controls only; not a complete accessibility audit",
        results,
        systemTheme: true,
        loginKeyboard: true,
        failed,
      },
      null,
      2,
    ),
  );
  assert.deepEqual(failed, []);
  console.log(
    "PASS 15 core contrast pairs, system theme light/dark, login keyboard controls",
  );
} finally {
  await browser.close();
}
