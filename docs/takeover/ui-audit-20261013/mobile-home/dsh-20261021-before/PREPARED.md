# MB007 Before 采集 — PREPARED（NOT_RUN）

- **状态**：`NOT_RUN`。作者会话没有启动浏览器、没有执行本目录脚本、没有产生截图或 `results.json`，也不声称 UI 已验收。
- **日期**：2026-10-21
- **范围**：MB007 原始正式移动首页的真实 H5 before 证据（截图 / DOM / console / API / hash）。
- **目录**：`docs/takeover/ui-audit-20261013/mobile-home/dsh-20261021-before/`
- **只改本目录三文件**：`fixture.cjs`、`before.cjs`、`PREPARED.md`。未改产品、未写其他目录、未 Git、未安装、未启动服务或浏览器。
- **固定服务**：`http://127.0.0.1:18183`（已有服务，脚本不自启、不改端口）。

## 冻结事实

| 文件 | 期望 raw SHA-256 |
| --- | --- |
| `apps/mobile/src/pages/home/home.vue` | `20451deb04fa38876cd7286eb30efd05997eec38f3ece449b6066fb2687cbae8` |
| `packages/i18n/src/mobile-experience.ts` | `6ac6800e179de0ba15ab3607918b2f8427d364e19306eaf8f2a146f016247380` |

`before.cjs` 直接对文件原始字节做 SHA-256，不从 Git、不做换行/编码归一化；两项必须由 Root 通过环境变量显式给出且与文件一致，否则退出码 2，且在启动浏览器前拒绝。

另外记录 before/after 的 page / i18n / API / store / session / navigation / deps（`apps/mobile/package.json`、`pnpm-lock.yaml`）hash；运行前后必须一致。前两项之外的 hash 只做漂移证据，不冒充 Root 冻结值。

## 真实链路与 fixture 边界

参照 `mobile-assessment/dsh-20261021-navigation/scripts/fixture.nav.cjs`（原文件未改）：

1. 打开真实登录页 `/#/pages/login/login?theme=…&uiLocale=…&returnTo=%2Fpages%2Fhome%2Fhome`。
   - `theme` / `uiLocale` 走产品已有的 `public-auth-handoff` 合法偏好入口，不注入 storage、token、store、component、router 或 history。
2. 用真实 `#mobile-login-identifier` / `#mobile-login-password` / `.login-submit` 完成登录；授权守卫、会话恢复、`/iam/principal/me`、`/learner/preferences` 都是真实页面流程。
3. 只拦截本地 `/api/v1/*`（18183、18070、18087 的 `127.0.0.1`/`localhost`），其他 origin 直接 abort，页面静态资源继续。
4. 不读请求 headers、body、token、cookie；报告只记 `method` + `path`。合成 login 只在 fixture 内返回一个明确标注 `not-a-credential` 的假 access token，不写入日志或结果。
5. 未匹配的 API 路径或方法一律 **501** 并记入 `report.unknown`；不存在泛 200 兜底。
6. `fixture.cjs` 被 `require` 时只定义模块，不启动浏览器；`before.cjs` 只有 `require.main === module` 才执行 `main()`。

### 合成事实（只用于 before 页身份）

- IAM：`adultGate=PASSED`、`learningAccess=ELIGIBLE`、`consent.accepted=true`、必要 purpose 全部满足、permissions 含 `learning.plan.read`。
- 学习目标：`FOUNDATION` / 15 分钟 / `ACTIVE`（已保存）。
- 计划：`plan_mb007_synthetic_1`，`planVersion=3`，3 个 item（2 DUE + 1 DEFERRED），因此首页无“未定级”引导。
- 任务 3 个：
  - `AVAILABLE` 且有 `contentCode`（按钮“查看课程”，可用）
  - `COMPLETED`（按钮“已完成”，禁用）
  - `UNAVAILABLE`（按钮“暂不可用”，禁用，带不可用原因）
- 课程 3 个：2 个 `PUBLISHED` + 1 个 `UNPUBLISHED`。未发布标题故意独立可识别，用于记录“书架是否只显示可用”；同时保留 KPI 使用 `store.home.content.length`（含未发布）这一 before 事实，不替产品修饰。

## 四个采集组合

每个组合都输出 **fullpage + viewport** 两张 PNG，并记录 DOM 摘录、computed 字号/行高/overflow、按钮命中区、console warnings/errors/pageerrors 原文、API 写请求/未知请求计数。

| # | 文件名前缀 | viewport | locale | theme | 文字 |
| --- | --- | --- | --- | --- | --- |
| 01 | `01-390x844-light-zh` | 390×844 | `zh-CN` | `light` | 100% |
| 02 | `02-390x844-dark-en` | 390×844 | `en-US` | `dark` | 100% |
| 03 | `03-1280x900-light-zh` | 1280×900 | `zh-CN` | `light` | 100% |
| 04 | `04-320x568-light-zh-text200` | 320×568 | `zh-CN` | `light` | 200% |

`200%` 只是测试态：在当前渲染的 `.yx-page` 子树上按 computed font-size / line-height 加倍并标 `!important`，`results.json` 明确记录方法与 factor。它不写 store、token、组件、路由或 storage。

每组合产物：

- `<前缀>-full.png`
- `<前缀>-viewport.png`
- 同一 `results.json` 中的 `scenarios[]`：`url`、`routeKey`、`canonicalHome`、`lang` / `dataTheme` / `dataUiLocale`、`mainTextExcerpt`、`mainDomExcerpt`（≤12000 字符并标 `truncated`）、`typography[]`、`buttons[]`、`smallTargets`、`overflow[]`、`contentPublishObservation`、`identity`、`api.writes/unknown`、`consoleWarnings/Errors`、`pageErrors`、`counts`、`screenshots`。

页身份只依赖真实可见的合成课程标题、任务标题与按钮文案（现有类名如 `.v2-home-body`、`.content-title`、`.task-row`、`.task-button`），不做产品未承诺的假断言。

## Root 执行命令（PowerShell）

```powershell
$env:MB007_CONFIRM_BROWSER = '1'
$env:EXPECTED_HOME_SHA = '20451deb04fa38876cd7286eb30efd05997eec38f3ece449b6066fb2687cbae8'
$env:EXPECTED_I18N_SHA = '6ac6800e179de0ba15ab3607918b2f8427d364e19306eaf8f2a146f016247380'
$env:MB007_RUN_ID = 'mb007-before-20261021-root-1'   # 可选；也可用 RUN_ID
node docs/takeover/ui-audit-20261013/mobile-home/dsh-20261021-before/before.cjs
```

- 输出目录：`docs/takeover/ui-audit-20261013/mobile-home/dsh-20261021-before/runs/<RUN_ID>/`（脚本打印绝对路径）。
- 目录必须不存在；存在则拒绝（不覆盖、不删除旧图/旧结果）。
- 未给 `MB007_RUN_ID`/`RUN_ID` 时默认 `mb007-before-<UTC 时间戳>`。

### 作者侧允许的静态检查（不启动浏览器）

```powershell
node --check docs/takeover/ui-audit-20261013/mobile-home/dsh-20261021-before/fixture.cjs
node --check docs/takeover/ui-audit-20261013/mobile-home/dsh-20261021-before/before.cjs
node -e "require('./docs/takeover/ui-audit-20261013/mobile-home/dsh-20261021-before/fixture.cjs'); require('./docs/takeover/ui-audit-20261013/mobile-home/dsh-20261021-before/before.cjs'); console.log('import-only ok')"
```

`import-only` 只验证 require 不自动 launch / 不读环境；它不是运行证据。

作者本轮已执行上述两条 `node --check` 与 `import-only`，输出 `import-only ok`；未启动浏览器、未访问 18183。

## 退出码

- `0`：四组截图与 `results.json` 已写，`closed=true`，hash 前后一致，无未知 API。**这不等于 UI PASS。**
- `1`：采集不完整（场景异常、未知 API、hash 漂移、关闭失败）。
- `2`：启动前拒绝（环境变量、两个 raw hash 不匹配、18183 无响应、运行目录已存在、浏览器启动失败）。已知 DSH `spawn EPERM` 不重试，按 setup 拒绝处理。

## 明确不声称

- 不声称任何 before 缺陷是 PASS、已修复或 UI 完成。
- 不声称深浅色/中英文/200% 文字在 before 版本已经正确；只记录实际渲染与差异。
- 不声称 `results.json` 是业务验收；它只是 before 证据。
- 不声称本 PREPARED 已执行。Root 审后执行，最终以新 `runs/<RUN_ID>/results.json` 为准。
