const { chromium } = require("playwright"),
  assert = require("assert/strict"),
  fs = require("fs");
process.chdir(require("path").resolve(__dirname, "../../../.."));
const origin = process.env.OFFICIAL_SITE_URL || "http://127.0.0.1:18182",
  dir =
    "docs/06-design/v2-980plus/official-site-experience-proposal-2026-09-21/implementation";
fs.mkdirSync(dir, { recursive: true });
const report = {
  result: "FAIL",
  at: new Date().toISOString(),
  scope:
    "Real official-site UI on 18182; no learner/backend business acceptance",
  checks: [],
  layouts: [],
  errors: [],
};
async function check(name, fn) {
  await fn();
  report.checks.push(name);
  console.log("PASS", name);
}
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext(),
      p = await context.newPage();
    p.on("pageerror", (e) => report.errors.push(e.message));
    p.on("console", (m) => {
      if (m.type() === "error" || m.text().includes("Hydration"))
        report.errors.push(m.text());
    });
    async function go(path) {
      await p.goto(origin + path, { waitUntil: "networkidle" });
    }
    await check("desktop homepage and modal word practice", async () => {
      await p.setViewportSize({ width: 1440, height: 1000 });
      await go("/");
      assert.match(await p.title(), /语学星/);
      await p.screenshot({ path: dir + "/home-desktop-light.png" });
      await p.getByRole("button", { name: "翻开这张词卡" }).click();
      const d = p.locator("dialog[open]");
      await d.getByRole("button", { name: "翻开释义" }).click();
      await d.getByRole("button", { name: "想起来了", exact: true }).click();
      await d.getByRole("button", { name: "放进句子里" }).click();
      await d.getByRole("button", { name: "latte to go" }).click();
      assert.ok(
        await d
          .getByRole("status")
          .filter({ hasText: "一杯打包带走" })
          .isVisible(),
      );
      await p.keyboard.press("Escape");
      assert.equal(await p.locator("dialog[open]").count(), 0);
      assert.ok(
        await p
          .getByRole("button", { name: "翻开这张词卡" })
          .evaluate((e) => e === document.activeElement),
      );
    });
    await check("course search, clear and route navigation", async () => {
      await go("/courses");
      const search = p.getByRole("searchbox");
      await search.fill("听力");
      await p.waitForURL(/q=/);
      assert.equal(await p.locator(".catalog-grid .course-card").count(), 1);
      assert.ok(await search.evaluate((e) => e === document.activeElement));
      await p.getByRole("button", { name: "清空搜索" }).click();
      await p.waitForURL((u) => !u.searchParams.has("q"));
      assert.equal(await p.locator(".catalog-grid .course-card").count(), 6);
      await p.locator(".catalog-grid .course-card").first().click();
      await p.waitForURL("**/courses/daily-words");
      assert.match(await p.locator("h1").innerText(), /日常词汇/);
      await p.goBack({ waitUntil: "networkidle" });
      assert.equal(new URL(p.url()).pathname, "/courses");
    });
    await check("help search and FAQ expansion", async () => {
      await go("/help");
      await p.getByRole("searchbox").fill("付费");
      assert.equal(await p.locator(".faq-list details").count(), 1);
      await p.locator(".faq-list summary").click();
      assert.ok(await p.locator(".faq-list details").evaluate((e) => e.open));
      await p.getByRole("searchbox").fill("does-not-exist");
      assert.ok(await p.locator(".help-empty").isVisible());
      await p.locator(".help-empty button").click();
      assert.equal(await p.locator(".faq-list details").count(), 8);
    });
    await check(
      "world room, 2D/3D, role wall and two sentence rounds",
      async () => {
        await go("/world");
        await p.getByRole("button", { name: "晨光书房", exact: true }).click();
        assert.ok(await p.locator(".room-morning").isVisible());
        await p.getByRole("button", { name: "2D", exact: true }).click();
        assert.equal(
          await p.locator(".world-widget").getAttribute("data-view"),
          "2d",
        );
        await p.getByRole("button", { name: "3D", exact: true }).click();
        await p.getByRole("button", { name: "向右转动空间" }).click();
        assert.match(
          await p.locator(".room-perspective").getAttribute("style"),
          /11deg/,
        );
        await p.getByRole("tab", { name: "角色墙" }).click();
        await p.locator(".character-card").nth(1).click();
        await p.getByRole("button", { name: "薄荷绿", exact: true }).click();
        await p.screenshot({
          path: dir + "/world-wall-desktop.png",
          fullPage: true,
        });
        await p.getByRole("button", { name: "看看我的空间" }).click();
        assert.ok(
          await p.locator(".room-avatar .avatar-1.outfit-1").isVisible(),
        );
        await p.getByRole("tab", { name: "拼句小火车" }).click();
        await p
          .locator("[data-word]")
          .filter({ hasText: /^English$/ })
          .click();
        await p.locator("[data-remove-word]").click();
        for (const word of ["I", "learn", "English", "every", "day."])
          await p
            .locator("[data-word]")
            .filter({
              hasText: new RegExp("^" + word.replace(".", "\\.") + "$"),
            })
            .click();
        await p.getByRole("button", { name: "再试一句" }).click();
        for (const word of ["A", "coffee,", "please."])
          await p
            .locator("[data-word]")
            .filter({
              hasText: new RegExp("^" + word.replace(".", "\\.") + "$"),
            })
            .click();
        await p.getByRole("button", { name: "回到我的空间" }).click();
        assert.equal(
          await p.locator(".world-widget").getAttribute("data-tab"),
          "room",
        );
      },
    );
    await check(
      "theme persistence, high contrast and four quality levels",
      async () => {
        await p.getByRole("button", { name: "切换为深色模式" }).click();
        await p.reload({ waitUntil: "networkidle" });
        assert.equal(
          await p.locator("html").getAttribute("data-theme"),
          "dark",
        );
        await p.locator(".footer-settings").click();
        const d = p.locator("dialog[open]");
        await d.locator("select").nth(0).selectOption("high-contrast");
        assert.equal(
          await p.locator("html").getAttribute("data-theme"),
          "high-contrast",
        );
        for (const level of ["Ultra", "High", "Medium", "Performance"]) {
          await d.locator("select").nth(2).selectOption(level);
          await p.waitForTimeout(50);
          if (level === "Performance")
            assert.equal(
              await p.locator(".world-widget").getAttribute("data-view"),
              "2d",
            );
        }
        await d.locator("select").nth(2).selectOption("High");
        await d.locator("select").nth(0).selectOption("light");
        await p.keyboard.press("Escape");
      },
    );
    await check("mobile navigation, start handoff and dialog", async () => {
      await p.setViewportSize({ width: 390, height: 844 });
      await go("/");
      await p.getByRole("button", { name: "打开导航菜单" }).click();
      assert.match(
        await p.locator("dialog[open] .menu-login").getAttribute("href"),
        /18183\/#\/pages\/login\/login/,
      );
      await p
        .locator("dialog[open]")
        .getByRole("link", { name: "学习世界" })
        .click();
      await p.waitForURL("**/world");
      assert.equal(await p.locator("dialog[open]").count(), 0);
      await go("/start");
      assert.match(
        await p.locator("[data-learning-entry]").getAttribute("href"),
        /18183\/#\/pages\/register\/register/,
      );
      await p.getByRole("button", { name: "查看方式" }).click();
      assert.ok(await p.locator("dialog[open] .copy-field").isVisible());
      await p.keyboard.press("Escape");
      await p.setViewportSize({ width: 1440, height: 1000 });
      await p.waitForTimeout(80);
      assert.match(
        await p.locator("[data-learning-entry]").getAttribute("href"),
        /18180\/register/,
      );
    });
    await check(
      "system reduced motion disables animation and depth",
      async () => {
        await p.emulateMedia({ reducedMotion: "reduce" });
        await go("/world");
        assert.equal(
          await p.locator("html").getAttribute("data-motion"),
          "off",
        );
        assert.equal(
          await p.locator(".world-widget").getAttribute("data-view"),
          "2d",
        );
        assert.ok(
          await p.getByRole("button", { name: "3D", exact: true }).isDisabled(),
        );
        await p.emulateMedia({ reducedMotion: "no-preference" });
      },
    );
    const routes = [
      "/",
      "/world",
      "/courses",
      "/courses/daily-words",
      "/courses/clear-grammar",
      "/courses/listening",
      "/courses/reading",
      "/courses/speaking",
      "/courses/writing",
      "/method",
      "/start",
      "/help",
      "/about",
      "/announcements",
      "/privacy",
      "/terms",
      "/minors",
      "/status",
      "/compliance",
    ];
    for (const width of [320, 390, 768, 1440])
      for (const theme of ["light", "dark"]) {
        await p.setViewportSize({ width, height: 900 });
        for (const route of routes) {
          await go(route + "?theme=" + theme);
          const layout = await p.evaluate(() => ({
            scroll: document.documentElement.scrollWidth,
            width: innerWidth,
            h1: document.querySelectorAll("h1").length,
            canonical: document
              .querySelector("link[rel=canonical]")
              ?.getAttribute("href"),
            missing: /official\.c[0-9a-f]+/.test(document.body.innerText),
          }));
          assert.ok(
            layout.scroll <= width + 1,
            route + " overflow " + width + " " + JSON.stringify(layout),
          );
          assert.equal(layout.h1, 1, route + " h1");
          assert.equal(layout.missing, false, route + " missing translation");
          assert.equal(layout.canonical, origin + route);
          report.layouts.push({ route, width, theme });
        }
        console.log("PASS layout", width, theme);
      }
    await p.setViewportSize({ width: 390, height: 844 });
    await go("/?theme=dark");
    await p.screenshot({ path: dir + "/home-mobile-dark.png", fullPage: true });
    await go("/world?theme=dark");
    await p.getByRole("tab", { name: "拼句小火车" }).click();
    await p.waitForTimeout(350); // Capture the settled panel, after its entrance animation.
    await p.screenshot({
      path: dir + "/world-mobile-game.png",
      fullPage: true,
    });
    await go("/?theme=light");
    await p.screenshot({
      path: dir + "/home-mobile-light.png",
      fullPage: true,
    });
    await check(
      "public projection reports its actual source and retry stays usable",
      async () => {
        await go("/courses");
        const response = await p.request.get(origin + "/api/public-projection");
        const body = await response.json();
        report.publicProjection = {
          source: body.source,
          state: body.state,
          errorCode: body.errorCode,
        };
        if (body.source === "empty-fallback") {
          assert.equal(body.state, "error");
          await p
            .locator(".published-courses")
            .getByRole("button", { name: "重新加载" })
            .click();
          assert.ok(
            await p.locator(".published-courses .public-status").isVisible(),
          );
        }
      },
    );
    await check(
      "legacy redirect, 404 and SSR preferences do not leak across visitors",
      async () => {
        await go("/pricing");
        assert.equal(new URL(p.url()).pathname, "/start");
        await go("/download");
        assert.equal(new URL(p.url()).pathname, "/start");
        const bad = await p.request.get(origin + "/does-not-exist");
        assert.equal(bad.status(), 404);
        const a = await p.request.get(origin + "/about", {
            headers: { cookie: "yx.public.theme=dark; yx.public.locale=zh-CN" },
          }),
          b = await p.request.get(origin + "/about", {
            headers: {
              cookie: "yx.public.theme=light; yx.public.locale=zh-CN",
            },
          });
        assert.match(await a.text(), /data-theme[^<]*dark/);
        assert.match(await b.text(), /data-theme[^<]*light/);
      },
    );
    await check(
      "system theme changes and default motion ignore a retired pause preference",
      async () => {
        const c = await browser.newContext({
            colorScheme: "dark",
            viewport: { width: 390, height: 844 },
          }),
          q = await c.newPage();
        await c.addInitScript(() => {
          localStorage.setItem("yx.official.performance", "High");
          localStorage.setItem("yx.official.performance:motion", "off");
        });
        q.on("pageerror", (e) => report.errors.push(e.message));
        q.on("console", (m) => {
          if (m.type() === "error" || m.text().includes("Hydration"))
            report.errors.push(m.text());
        });
        await q.goto(origin + "/", { waitUntil: "networkidle" });
        assert.equal(
          await q.locator("html").getAttribute("data-theme"),
          "dark",
        );
        await q.emulateMedia({ colorScheme: "light" });
        await q.waitForTimeout(80);
        assert.equal(
          await q.locator("html").getAttribute("data-theme"),
          "light",
        );
        assert.equal(await q.locator(".motion-toggle").count(), 0);
        await q.reload({ waitUntil: "networkidle" });
        assert.equal(await q.locator("html").getAttribute("data-motion"), "on");
        await c.close();
      },
    );
    await check(
      "touch viewport permits vertical scrolling and horizontal room rotation",
      async () => {
        const c = await browser.newContext({
            viewport: { width: 390, height: 844 },
            isMobile: true,
            hasTouch: true,
          }),
          q = await c.newPage();
        await q.goto(origin + "/world", { waitUntil: "networkidle" });
        const session = await c.newCDPSession(q);
        await q.locator(".room-perspective").scrollIntoViewIfNeeded();
        const box = await q.locator(".room-perspective").boundingBox(),
          x = box.x + box.width / 2,
          y = box.y + box.height / 2;
        const before = await q.evaluate(() => scrollY);
        await session.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [{ x, y }],
        });
        for (let i = 1; i <= 6; i++)
          await session.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ x, y: y - i * 22 }],
          });
        await session.send("Input.dispatchTouchEvent", {
          type: "touchEnd",
          touchPoints: [],
        });
        await q.waitForTimeout(250);
        assert.ok((await q.evaluate(() => scrollY)) > before + 20);
        await q.locator(".room-perspective").scrollIntoViewIfNeeded();
        const b = await q.locator(".room-perspective").boundingBox(),
          tx = b.x + b.width / 2,
          ty = b.y + b.height / 2;
        await session.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [{ x: tx, y: ty }],
        });
        for (let i = 1; i <= 4; i++)
          await session.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ x: tx + i * 18, y: ty }],
          });
        await session.send("Input.dispatchTouchEvent", {
          type: "touchEnd",
          touchPoints: [],
        });
        assert.ok(
          !/--room-angle: 0deg/.test(
            await q.locator(".room-perspective").getAttribute("style"),
          ),
        );
        await c.close();
      },
    );
    assert.deepEqual(report.errors, []);
    report.result = "PASS";
    console.log(
      JSON.stringify({
        checks: report.checks.length,
        layouts: report.layouts.length,
        errors: report.errors,
      }),
    );
  } finally {
    fs.writeFileSync(
      dir + "/browser-checks.json",
      JSON.stringify(report, null, 2),
    );
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
