import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const origin = "http://127.0.0.1:18181";
const output = "docs/06-design/v2-980plus/admin-experience-2026-09-22";
await mkdir(`${output}/screenshots`, { recursive: true });
const permissions = [
  "dashboard.read",
  "content.read",
  "content.write",
  "content.publish",
  "content.rollback",
  "content.review.l1",
  "content.review.l2",
  "commerce.read",
  "support.read",
  "support.command",
  "audit.read",
  "release.read",
  "moderation.read",
  "moderation.command",
  "recovery.read",
  "recovery.request",
  "recovery.command",
].map((p) => `admin.${p}`);
let allowed = permissions,
  mode = "data",
  failPath = "",
  commandCount = 0;
const requests = [];
const metrics = [
  {
    metricId: "UI 样例 · 学习活动",
    metricVersion: "样例口径",
    state: "AVAILABLE",
    totalValue: 128,
    periodStart: "2026-09-22",
  },
  {
    metricId: "UI 样例 · 内容访问",
    metricVersion: "样例口径",
    state: "AVAILABLE",
    totalValue: 356,
    periodStart: "2026-09-22",
  },
];
const tickets = Array.from({ length: 14 }, (_, i) => ({
  ticketId: `UI-TICKET-${String(i + 1).padStart(3, "0")}`,
  categoryCode: i % 2 ? "LEARNING" : "ACCOUNT",
  priority: i % 3 ? "NORMAL" : "HIGH",
  state: i === 2 ? "RESOLVED" : "OPEN",
  slaState: "WITHIN_SLA",
  redactionVersion: "v1",
}));
const orders = Array.from({ length: 12 }, (_, i) => ({
  orderRef: `UI-ORDER-${String(i + 1).padStart(3, "0")}`,
  state: "PAID",
  amountMinor: 9900,
  currency: "CNY",
  redactionVersion: "v1",
  createdAt: "2026-09-22 09:00",
}));
const audit = Array.from({ length: 14 }, (_, i) => ({
  auditId: `UI-AUDIT-${i}`,
  actionCode: i % 2 ? "CONTENT_REVIEW" : "CONTENT_SAVE",
  resourceType: "CONTENT",
  resourceRef: `UI-CONTENT-${i}`,
  resultCode: "SUCCESS",
  redacted: true,
  occurredAt: "2026-09-22 09:00",
}));
const contents = Array.from({ length: 3 }, (_, i) => ({
  contentCode: `UI-CONTENT-${i}`,
  title: [
    "日常英语 · 建立学习习惯",
    "职场表达 · 一次轻松的自我介绍",
    "阅读练习 · 在城市中发现故事",
  ][i],
  latestStatus: ["DRAFT", "IN_REVIEW", "PUBLISHED"][i],
  stateVersion: 1,
  authorSubject: "ui-other-editor",
  versions: [
    { versionNumber: 1, contentVersionId: `UI-V${i}`, status: "DRAFT" },
  ],
  reviewStages: ["FIRST_PENDING", "FINAL_PENDING"],
}));
const lexemes = ["habit", "journey", "discover", "connect", "practice"].map(
  (word, i) => ({
    lexeme: {
      lexemeId: `UI-WORD-${i}`,
      headword: word,
      language: "en-US",
      packCode: "VOCAB-PHASE1",
      cefr: "A2",
      availability: i ? "PUBLISHED" : "DRAFT",
      stateVersion: 1,
      contentVersion: 1,
      fields: {
        headword: word,
        phoneticUS: "ˈhæbɪt",
        senses: [{ meaningCn: "UI 样例释义" }],
        cefr: "A2",
      },
      pronunciations: [],
      createdBy: "ui-other-editor",
    },
  }),
);
const item = (id) => ({
  item: {
    itemId: `UI-ITEM-${id}`,
    kind: "QUESTION",
    stem: `UI 样例 ${id} · Choose the correct word for the sentence.`,
    packCode: "VOCAB-PHASE1",
    availability: "DRAFT",
    stateVersion: 1,
    fields: { options: ["build", "builds"], answerIndex: 0 },
    createdBy: "ui-other-editor",
  },
});
const browser = await chromium.launch({ channel: "msedge", headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
await context.route("**/api/v1/**", async (route) => {
  const req = route.request(),
    url = new URL(req.url()),
    path = url.pathname.replace("/api/v1", "");
  requests.push({ path, method: req.method() });
  const reply = (data, status = 200) =>
    route.fulfill({
      status,
      contentType: "application/json",
      headers: {
        "access-control-allow-origin": origin,
        "access-control-allow-credentials": "true",
      },
      body: JSON.stringify({ data, requestId: "ui-fixture-request" }),
    });
  if (req.method() === "OPTIONS")
    return route.fulfill({
      status: 204,
      headers: {
        "access-control-allow-origin": origin,
        "access-control-allow-credentials": "true",
        "access-control-allow-headers": "*",
        "access-control-allow-methods": "*",
      },
    });
  if (path === "/auth/login" || path === "/auth/token/refresh")
    return reply({
      accessToken: "ui-fixture-memory-only",
      sessionId: "ui-session",
    });
  if (path.startsWith("/iam/"))
    return reply({
      principal: {
        subject: "ui-test-editor",
        roles: ["EDITOR"],
        permissions: allowed,
      },
      permissions: allowed,
    });
  if (path === "/auth/logout") return reply({});
  if (path === failPath)
    return reply({ message: "UI 测试：服务暂时不可用" }, 503);
  if (req.method() !== "GET") {
    commandCount++;
    if (path.endsWith("/prepare"))
      return reply({
        token: "ui-confirmation",
        decisionId: "ui-decision",
        resourceRef: req.postDataJSON().aggregateRef,
      });
    if (path === "/admin/recovery/recoveries")
      return reply({
        recoveryId: "UI-RECOVERY-1",
        status: "REQUESTED",
        requestedBy: "ui-test-editor",
      });
    return reply({
      status: "CONFIRMED",
      total: 2,
      accepted: 2,
      skipped: 0,
      failed: 0,
    });
  }
  if (mode === "empty")
    return reply(path.includes("sagas") ? [] : { items: [] });
  if (path === "/admin/ops/metrics") return reply({ items: metrics });
  if (path === "/admin/ops/tickets") return reply({ items: tickets });
  if (path === "/admin/ops/commerce/orders") return reply({ items: orders });
  if (path === "/admin/ops/audit") return reply({ items: audit });
  if (path === "/admin/content-commands") {
    if (url.searchParams.get("kind") === "LEXEME")
      return reply({ items: lexemes });
    if (url.searchParams.get("kind") === "ITEM")
      return reply({
        items: [item(url.searchParams.has("cursor") ? 2 : 1)],
        nextCursor: url.searchParams.has("cursor") ? null : "ui-next",
      });
    return reply({ items: contents });
  }
  if (path.includes("sagas/unfinished")) return reply(["UI-SAGA-1"]);
  if (path === "/admin/learners/search")
    return reply({
      items: [{ subjectId: "UI-LEARNER-1", tenantId: "platform" }],
    });
  if (path.includes("/profile"))
    return reply({
      profile: {
        version: 1,
        goal: { type: "WORKPLACE", dailyMinutes: 30, startingLevel: "A2" },
        preferences: {
          uiLocale: "zh-CN",
          contentLocale: "en-US",
          themeMode: "SYSTEM",
        },
      },
    });
  if (path.includes("/plans"))
    return reply({
      items: [
        {
          planId: "UI-PLAN-1",
          title: "UI 样例 · 每日学习计划",
          status: "ACTIVE",
        },
      ],
    });
  if (path.includes("/assessments"))
    return reply({
      items: [{ attemptId: "UI-ASSESSMENT-1", score: 85, state: "COMPLETED" }],
    });
  if (path.includes("/srs"))
    return reply({
      due: [
        {
          item_id: "UI-SRS-1",
          stage: "REVIEW",
          due_at: "2026-09-22",
          review_count: 3,
        },
      ],
    });
  if (path === "/phonetics/catalog")
    return reply({
      items: [
        {
          phonemeId: 1,
          symbol: "/iː/",
          group: "长元音",
          exampleWord: "see",
          description: "嘴唇微微展开，保持发音。",
        },
        {
          phonemeId: 2,
          symbol: "/ɪ/",
          group: "短元音",
          exampleWord: "sit",
          description: "短促轻松地发音。",
        },
      ],
    });
  if (path === "/phonetics/minimal-pairs")
    return reply({
      items: [{ pairId: 1, leftWord: "sheep", rightWord: "ship" }],
    });
  if (path === "/admin/moderation/reports")
    return reply({
      items: [
        {
          reportId: "UI-REPORT-1",
          status: "OPEN",
          reasonCode: "SPAM",
          reviewMode: "MANUAL",
          targetRef: "UI-POST-1",
          roomRef: "UI-ROOM-1",
          createdAt: "2026-09-22",
        },
      ],
    });
  return reply({ items: [] });
});
if (process.argv.includes("--commerce-only")) {
  const page = await context.newPage();
  await page.goto(origin + "/login");
  await page.locator("[name=identifier]").fill("fixture");
  await page.locator("[name=password]").fill("fixture");
  await page.locator(".login-submit").click();
  await page.waitForURL("**/dashboard");
  const results = [];
  failPath = "/admin/ops/tickets";
  await page.goto(origin + "/commerce");
  await page
    .getByText("工单暂时不可用，可刷新重试。", { exact: true })
    .waitFor();
  await page.getByText("UI-ORDER-001", { exact: true }).waitFor();
  results.push({ name: "Support failure does not block orders", pass: true });
  failPath = "";
  allowed = ["admin.commerce.read"];
  let before = requests.length;
  await page.reload();
  await page.getByText("UI-ORDER-001", { exact: true }).waitFor();
  assert.equal(
    requests
      .slice(before)
      .some((r) =>
        ["/admin/ops/tickets", "/admin/ops/metrics"].includes(r.path),
      ),
    false,
  );
  results.push({
    name: "Commerce-only account does not request unauthorized side panels",
    pass: true,
  });
  allowed = permissions;
  await page.reload();
  await page.getByText("UI-TICKET-001", { exact: true }).waitFor();
  assert.equal(
    await page.getByText("UI-TICKET-006", { exact: true }).count(),
    0,
  );
  assert.equal(
    await page
      .locator(".el-table__row")
      .filter({ hasText: "UI-TICKET-003" })
      .getByRole("button", { name: "提交解决", exact: true })
      .isDisabled(),
    true,
  );
  results.push({
    name: "Ticket summary is bounded and completed tickets cannot be resolved again",
    pass: true,
  });
  await page
    .getByRole("button", { name: "申请退款", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "预检退款", exact: true }).click();
  await page
    .getByRole("button", { name: "确认执行退款", exact: true })
    .waitFor();
  await page
    .getByPlaceholder("填写订单编号", { exact: true })
    .fill("UI-ORDER-002");
  assert.equal(
    await page
      .getByRole("button", { name: "确认执行退款", exact: true })
      .count(),
    0,
  );
  results.push({
    name: "Changing refund order invalidates confirmation",
    pass: true,
  });
  await page.reload();
  await page.getByText("UI-ORDER-001", { exact: true }).waitFor();
  await page.screenshot({
    path: output + "/screenshots/commerce-desktop.png",
    fullPage: true,
  });
  const layouts = [];
  for (const width of [320, 390, 820, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      ),
      false,
    );
    layouts.push({ width, pass: true });
  }
  await writeFile(
    output + "/commerce-validation.json",
    JSON.stringify(
      {
        scope: "UI only: synthetic browser fixtures",
        checks: results,
        layouts,
      },
      null,
      2,
    ),
  );
  console.log(
    "PASS commerce permission, failure isolation, bounded summary and refund guard 4/4; layouts 4/4",
  );
  await browser.close();
  process.exit(0);
}
if (process.argv.includes("--editors-only")) {
  const page = await context.newPage();
  await page.goto(origin + "/login");
  await page.locator("[name=identifier]").fill("ui-fixture-editor");
  await page.locator("[name=password]").fill("ui-fixture-only");
  await page.locator(".login-submit").click();
  await page.waitForURL("**/dashboard");
  const guardChecks = [];
  for (const [path, button, field] of [
    ["/lexemes", "新建单词", "如 habit"],
    ["/items", "新建条目", "题干/例句/标题"],
  ]) {
    await page.goto(origin + path);
    await page.getByRole("button", { name: button, exact: true }).click();
    await page
      .getByPlaceholder(field, { exact: true })
      .fill("UI unsaved draft");
    await page.getByRole("button", { name: "取消", exact: true }).click();
    await page.getByRole("button", { name: "继续编辑", exact: true }).click();
    assert.equal(
      await page.getByPlaceholder(field, { exact: true }).inputValue(),
      "UI unsaved draft",
    );
    await page.getByRole("button", { name: "取消", exact: true }).click();
    await page
      .getByRole("button", { name: "放弃修改并继续", exact: true })
      .click();
    await page
      .getByRole("dialog", { name: button, exact: true })
      .waitFor({ state: "hidden" });
    guardChecks.push({ path, pass: true });
  }
  const paths = [
    "dashboard",
    "content",
    "lexemes",
    "items",
    "phonetics",
    "learners",
    "support",
    "commerce",
    "governance",
    "audit",
    "release",
    "recovery",
    "forbidden",
  ];
  for (const path of paths) {
    await page.goto(origin + "/" + path);
    await page.waitForSelector("#admin-main");
    await page.waitForTimeout(250);
    await page.mouse.move(0, 0);
    await page.screenshot({
      path: `${output}/screenshots/${path}-desktop.png`,
      fullPage: true,
    });
  }
  await writeFile(
    `${output}/editor-validation.json`,
    JSON.stringify(
      { scope: "UI-only browser fixtures", checks: guardChecks },
      null,
      2,
    ),
  );
  console.log(
    "PASS editor unsaved guards 2/2; captured all 13 authenticated screens",
  );
  await browser.close();

  process.exit(0);
}
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const checks = [];
async function check(name, fn) {
  try {
    await fn();
    checks.push({ name, pass: true });
    console.log("PASS", name);
  } catch (e) {
    checks.push({ name, pass: false, error: e.message });
    console.log("FAIL", name, e.message);
    await page.screenshot({
      path: `${output}/screenshots/failure-${checks.length}.png`,
      fullPage: true,
    });
  }
}
async function go(path) {
  await page.goto(origin + path);
  await page.waitForSelector(path === "/login" ? ".login-card" : "#admin-main");
  await page.waitForTimeout(150);
}
async function shot(name) {
  await page.mouse.move(0, 0);
  await page.screenshot({
    path: `${output}/screenshots/${name}.png`,
    fullPage: true,
  });
}
await go("/login");
await shot("login-desktop");
await check("login validation focuses missing account", async () => {
  await page.locator(".login-submit").click();
  assert.equal(
    await page
      .locator("[name=identifier]")
      .evaluate((e) => e === document.activeElement),
    true,
  );
  assert.equal(await page.locator(".field-error").count(), 2);
});
await check("password visibility control", async () => {
  await page.locator("[name=password]").fill("ui-fixture-only");
  await page.getByRole("button", { name: "显示密码", exact: true }).click();
  assert.equal(
    await page.locator("[name=password]").getAttribute("type"),
    "text",
  );
  await page.getByRole("button", { name: "隐藏密码", exact: true }).click();
});
await check("login with fixture permissions", async () => {
  await page.locator("[name=identifier]").fill("ui-fixture-editor");
  await page.locator(".login-submit").click();
  await page.waitForURL("**/dashboard");
  await page.waitForSelector(".shortcut-card");
  assert.equal(await page.locator(".admin-aside .admin-nav-link").count(), 12);
});
await shot("dashboard-desktop");
await check("functional feature search with keyboard shortcut", async () => {
  await page.keyboard.press("Control+k");
  await page.getByPlaceholder("输入页面名称或关键词").fill("词汇");
  await page.getByPlaceholder("输入页面名称或关键词").press("Enter");
  await page.waitForURL("**/lexemes");
});
await check("lexeme editor opens and is readable", async () => {
  await page.getByRole("button", { name: "新建单词", exact: true }).click();
  await page.getByRole("dialog").waitFor();
  assert.ok(
    await page.getByPlaceholder("如 habit", { exact: true }).isVisible(),
  );
  await page.getByRole("button", { name: "取消", exact: true }).click();
});
await shot("lexemes-desktop");
await go("/items");
await check("item cursor pagination appends rows", async () => {
  await page.getByRole("button", { name: "加载更多", exact: true }).click();
  assert.equal(
    await page
      .locator(".el-table__body-wrapper tbody tr")
      .first()
      .locator("xpath=..")
      .locator("tr")
      .count(),
    2,
  );
});
await check("batch example is valid JSONL and executes once", async () => {
  await page.getByRole("button", { name: "批量导入", exact: true }).click();
  await page.getByRole("button", { name: "填入格式示例", exact: true }).click();
  const lines = (
    await page.getByRole("dialog").locator("textarea").inputValue()
  ).split("\n");
  assert.equal(lines.length, 2);
  for (const line of lines) assert.ok(JSON.parse(line).kind);
  const before = commandCount;
  await page.getByRole("button", { name: "提交导入", exact: true }).click();
  await page.getByText("总数 2 · 成功 2 · 跳过 0 · 失败 0").waitFor();
  assert.equal(commandCount, before + 1);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "关闭", exact: true })
    .click();
});
await go("/content");
await shot("content-desktop");
await check("content dirty inputs survive refresh", async () => {
  await page.getByRole("button", { name: "新建内容", exact: true }).click();
  await page.getByLabel("标题", { exact: true }).fill("UI 未保存标题");
  await page.getByRole("button", { name: "刷新", exact: true }).click();
  await page.getByLabel("标题", { exact: true }).waitFor();
  assert.equal(
    await page.getByLabel("标题", { exact: true }).inputValue(),
    "UI 未保存标题",
  );
});
await check("navigation protects unsaved content", async () => {
  await page.locator('.admin-aside .admin-nav-link[href="/dashboard"]').click();
  await page.getByRole("button", { name: "继续编辑", exact: true }).click();
  assert.ok(page.url().endsWith("/content"));
  await page.locator('.admin-aside .admin-nav-link[href="/dashboard"]').click();
  await page
    .getByRole("button", { name: "放弃修改并继续", exact: true })
    .click();
  await page.waitForURL("**/dashboard");
});
await go("/support");
await check("support loaded-list search and pagination", async () => {
  assert.equal(
    await page.locator(".el-table__body-wrapper tbody tr").count(),
    10,
  );
  await page.getByPlaceholder("筛选当前列表").fill("UI-TICKET-014");
  assert.equal(
    await page.locator(".el-table__body-wrapper tbody tr").count(),
    1,
  );
  await page.getByPlaceholder("筛选当前列表").fill("");
  await page.locator(".el-pager").getByText("2", { exact: true }).click();
  assert.equal(
    await page.locator(".el-table__body-wrapper tbody tr").count(),
    4,
  );
});
await shot("support-desktop");
await go("/commerce");
await check("refund challenge invalidates on changed order", async () => {
  await page.getByPlaceholder("填写订单编号").fill("UI-ORDER-001");
  await page.getByRole("button", { name: "预检退款", exact: true }).click();
  await page.locator(".b13-refund-challenge").waitFor();
  await page.getByPlaceholder("填写订单编号").fill("UI-ORDER-002");
  assert.equal(await page.locator(".b13-refund-challenge").count(), 0);
});
await shot("commerce-desktop");
await go("/learners");
await check("learner record detail replaces raw JSON", async () => {
  await page.getByRole("button", { name: "检索", exact: true }).click();
  await page.getByRole("button", { name: "记录详情", exact: true }).click();
  await page.locator(".record-fields").first().waitFor();
  assert.equal(await page.locator("pre.json").count(), 0);
});
await shot("learners-desktop");
await check(
  "API failure is recoverable and does not display false zero",
  async () => {
    failPath = "/admin/ops/metrics";
    await go("/dashboard");
    await page.getByText("暂时无法读取数据", { exact: true }).waitFor();
    assert.equal(
      await page.locator(".metric-card strong").first().innerText(),
      "—",
    );
    failPath = "";
    await page.getByRole("button", { name: "刷新", exact: true }).click();
    await page.getByText("UI 样例 · 学习活动", { exact: true }).waitFor();
  },
);
await check(
  "permission guard hides links and blocks direct route",
  async () => {
    allowed = ["admin.support.read"];
    await go("/audit");
    await page.waitForURL("**/forbidden**");
    assert.equal(await page.locator(".admin-aside .admin-nav-link").count(), 1);
    assert.ok(
      await page
        .getByRole("heading", { name: "暂时无法访问这个页面" })
        .isVisible(),
    );
    allowed = permissions;
  },
);
await go("/dashboard");
await check("mobile menu opens, navigates, closes", async () => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "打开导航", exact: true }).click();
  await page.locator('.admin-mobile-nav a[href="/items"]').click();
  await page.waitForURL("**/items");
  await page.locator(".admin-mobile-nav").waitFor({ state: "hidden" });
});
await check(
  "mobile table columns remain readable and actions can be scrolled into view",
  async () => {
    const table = page.locator(".el-table").first();
    const action = table.locator("thead .el-table-fixed-column--right");
    assert.equal(
      await action.evaluate((e) => getComputedStyle(e).position),
      "static",
    );
    const wrap = table.locator(".el-scrollbar__wrap");
    await wrap.evaluate((e) => {
      e.scrollLeft = e.scrollWidth;
    });
    await page.waitForTimeout(100);
    const bounds = await table.boundingBox();
    const cell = await action.boundingBox();
    assert.ok(
      cell.x >= bounds.x - 1 &&
        cell.x + cell.width <= bounds.x + bounds.width + 1,
    );
    await wrap.evaluate((e) => {
      e.scrollLeft = 0;
    });
  },
);
await shot("items-mobile");
await check("dark theme persists on reload", async () => {
  await page.getByRole("button", { name: "外观设置", exact: true }).click();
  await page.getByRole("menuitem", { name: "深色", exact: true }).click();
  await page.reload();
  await page.waitForSelector("#admin-main");
  assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
});
await shot("dashboard-dark-mobile");
await check("shared UI locale switches with fallback", async () => {
  await page.getByRole("button", { name: /界面语言/ }).click();
  await page.getByRole("menuitem", { name: "English", exact: true }).click();
  await page.getByRole("button", { name: "Appearance", exact: true }).waitFor();
  await page.getByRole("button", { name: /界面语言/ }).click();
  await page.getByRole("menuitem", { name: "中文", exact: true }).click();
});
const layout = [];
const paths = [
  "/dashboard",
  "/content",
  "/lexemes",
  "/items",
  "/phonetics",
  "/learners",
  "/support",
  "/commerce",
  "/governance",
  "/audit",
  "/release",
  "/recovery",
  "/forbidden",
];
for (const theme of ["light", "dark", "high-contrast"]) {
  await page.evaluate(async (theme) => {
    const { adminThemeController } =
      await import("/src/platform/v2-foundation.ts");
    adminThemeController.setTheme(theme);
  }, theme);
  for (const width of [320, 390, 820, 1440]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    for (const path of paths) {
      await go(path);
      const result = await page.evaluate(() => ({
        width: innerWidth,
        scroll: document.documentElement.scrollWidth,
        body: document.body.scrollWidth,
      }));
      layout.push({
        theme,
        width,
        path,
        pass: result.scroll <= width + 1 && result.body <= width + 1,
        ...result,
      });
    }
  }
}
await check(
  "all authenticated routes across 4 widths and 3 themes",
  async () => {
    assert.deepEqual(
      layout.filter((item) => !item.pass),
      [],
    );
  },
);
for (const modeValue of ["empty", "data"]) {
  mode = modeValue;
  await go("/support");
  if (modeValue === "empty") await shot("support-empty");
}
await check("reduced motion preference disables decoration", async () => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await page.waitForSelector("#admin-main");
  assert.equal(await page.locator("html").getAttribute("data-motion"), "off");
  await page.emulateMedia({ reducedMotion: "no-preference" });
});
await check("four quality levels are selectable", async () => {
  for (const level of ["Ultra", "High", "Medium", "Performance"]) {
    await page.evaluate(async (level) => {
      const { adminPerformance } = await import("/src/platform/motion.ts");
      adminPerformance.setLevel(level);
    }, level);
    assert.equal(
      await page.locator("html").getAttribute("data-quality"),
      level,
    );
  }
});
await check("offline banner appears", async () => {
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  /* browser navigator remains online for synthetic events; use actual offline emulation */ await context.setOffline(
    true,
  );
  await page
    .getByText("当前网络已断开，请检查连接后重试。", { exact: true })
    .waitFor();
  await context.setOffline(false);
});
await page.setViewportSize({ width: 1440, height: 1000 });
await page.evaluate(async () => {
  const { adminThemeController } =
    await import("/src/platform/v2-foundation.ts");
  adminThemeController.setTheme("dark");
});
await go("/dashboard");
await shot("dashboard-dark");
await check("no browser runtime errors", async () =>
  assert.deepEqual(errors, []),
);
const loginContext = await browser.newContext();
const loginPage = await loginContext.newPage();
const loginLayouts = [];
for (const theme of ["light", "dark", "high-contrast"])
  for (const width of [320, 390, 820, 1440]) {
    await loginPage.setViewportSize({ width, height: 844 });
    await loginPage.goto(origin + "/login");
    await loginPage.waitForSelector(".login-card");
    await loginPage.evaluate(async (theme) => {
      const { adminThemeController } =
        await import("/src/platform/v2-foundation.ts");
      adminThemeController.setTheme(theme);
    }, theme);
    const overflow = await loginPage.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    );
    loginLayouts.push({ theme, width, pass: !overflow });
    if (width === 390 && theme === "light")
      await loginPage.screenshot({
        path: `${output}/screenshots/login-mobile.png`,
        fullPage: true,
      });
  }
await check("login at 4 widths and 3 themes without fixtures", async () =>
  assert.deepEqual(
    loginLayouts.filter((x) => !x.pass),
    [],
  ),
);
await check(
  "real unavailable login preserves account and shows retryable feedback",
  async () => {
    await loginPage.locator("[name=identifier]").fill("ui-unavailable-check");
    await loginPage.locator("[name=password]").fill("ui-check-only");
    await loginPage.locator(".login-submit").click();
    await loginPage.locator("[role=alert]").waitFor();
    assert.equal(
      await loginPage.locator("[name=identifier]").inputValue(),
      "ui-unavailable-check",
    );
    assert.equal(await loginPage.locator("[name=password]").inputValue(), "");
  },
);
await loginContext.close();
// Real connectivity probe is separate from fixture-driven checks.
let gateway;
try {
  const response = await fetch("http://127.0.0.1:18070/actuator/health", {
    signal: AbortSignal.timeout(3000),
  });
  gateway = { reachable: true, status: response.status };
} catch {
  gateway = { reachable: false };
}
await writeFile(
  `${output}/ui-validation.json`,
  JSON.stringify(
    {
      date: new Date().toISOString(),
      scope:
        "UI ONLY: synthetic browser-intercepted API data; no real authentication or owner writes",
      checks,
      layout,
      loginLayouts,
      gateway,
      runtimeErrors: errors,
      requestCount: requests.length,
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({
    checks: checks.length,
    failed: checks.filter((x) => !x.pass).map((x) => x.name),
    layouts: layout.length,
    layoutFailures: layout.filter((x) => !x.pass).length,
    errors,
    gateway,
  }),
);
await browser.close();
if (checks.some((x) => !x.pass)) process.exitCode = 1;
