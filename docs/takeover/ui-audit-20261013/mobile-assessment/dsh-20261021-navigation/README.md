# dsh-20261021-navigation — 最小真实 H5 导航诊断（只准备，未执行）

**状态：NOT_RUN。** 本目录由 DSH 作者会话准备，**没有启动浏览器、没有跑任何 case、没有 PASS 结论**。Root 稍后审查并执行。

范围仅限移动端 H5 评估页的**导航行为诊断**：`guide` 退出、`settings → 物理返回 → 再答题 → back` 循环、`ASSESSED report → today`。不验证产品业务正确性，不改产品代码、不改既有测试、不碰 Git/服务/其他 worker 目录。

## 文件

| 文件 | 作用 |
| --- | --- |
| `scripts/nav-diagnose.cjs` | 唯一 driver，`--case` 单跑一个 case，约 300 行以内 |
| `scripts/fixture.nav.cjs` | 本地精简 fixture（由 `dsh-20261020-risk/fixture.cjs` 复制的**局部**版本；旧文件未改动） |
| `PREPARED-CHECKPOINT.md` | 准备快照：文件 hash、静态检查、NOT_RUN 声明 |
| `runs/<run-id>/` | 执行时生成：`results.json` + 每步截图（准备阶段不存在） |

## 前置条件（Root 执行时）

1. Root 管理的 dev server 已在固定端口 `http://127.0.0.1:18183` 运行（固定端口，不自增）。
2. Playwright Chromium 可用（与既有测试相同的本机依赖）。
3. `apps/mobile` 当前页仍是 Root 批准的那一份：**page hash 只由环境变量传入**，driver 内**不存 page hash、无默认值、无自动接纳**。
4. 其余 9 个受控文件固定为当前 C6b 值（i18n、API、store、session、navigation、uni-runtime、uni.scss、package.json、pnpm-lock.yaml）；任何漂移在启动浏览器**之前**以 exit 2 拒绝。

## 运行

```powershell
# 一次只跑一个 case；先确认固定端口服务已启动
$env:MB006_CONFIRM_BROWSER = '1'
$env:NAV_EXPECTED_PAGE_SHA = '<Root 批准的 64 位小写 hex>'
$env:NAV_RUN_ID = 'nav-guide-exits-1'      # 可选，单段安全名
$env:NAV_EXECUTOR = 'root-review'          # 可选，仅记录

node docs/takeover/ui-audit-20261013/mobile-assessment/dsh-20261021-navigation/scripts/nav-diagnose.cjs --case guide-exits
node ...\nav-diagnose.cjs --case cycle-back
node ...\nav-diagnose.cjs --case report-today
```

退出码：`0` = 全部 check PASS 且前后 hash 稳定；`1` = 真实 FAIL（check 失败、pageerror、非计划 console error、未知 API、hash 漂移、case 抛错、close 失败）；`2` = setup 拒绝（env/守卫/hash/服务/浏览器启动，或 **run 目录已存在**）。setup 拒绝**不写 run 产物、绝不覆盖旧 results/PNG**。

## 四个 case

### 1. `guide-exits`
- 新 fixture 正常登录 → guide（无 choice）：真实按钮 `assessment-back` → home；另一个 fresh 点 `assessment-home` → home；两例 `0` assessment 写（start/respond/retest/ensure）。
- **home 验收（同一 helper，guide-back/guide-home/cycle-back 共用）**：去 query 后精确匹配 `#/`（H5 首 entry canonical alias）**或** `#/pages/home/home`，**并同时**满足 `.v2-home-body` 可见、`.v2-home-greet-title` 存在且非空、`document.body.innerText` 非空、`#assessment-page` 不可见，且该 id 已发出 `GET /api/v1/learner/home`；满足后才采集 counts/stack 与截图。**只凭 URL 不算通过，异步空白不当作完成。**
- checks：`guide-visible-and-clean`、`back-button-exits-to-home`、`back-home-ready`、`back-home-reads-completed`、`guide-back-zero-assessment-writes`、`home-button-exits-to-home`、`home-home-ready`、`home-home-reads-completed`、`guide-home-zero-assessment-writes`。

### 2. `cycle-back`（C6b 真 FAIL；C8 旧 FAIL 仅为 URL 断言不兼容）
- start → question 选 A → `assessment-settings` 引出自定义确认 → 点确认确实到 settings；
- 物理 `page.goBack()` 回测评 → 重新 GET、selection 清空；
- 选 A 提交一题（accepted 1，`aria-valuenow=1`）；
- 新题无 choice 时点 `assessment-back`，必须离开本页并落到 **home（同上 helper 验收）**。
- 每步只读记录 `globalThis.getCurrentPages()` 的 `{route}`（不可用记 `available:false`+reason）、URL/hash、DOM、counts。
- `0` 额外 respond / retest / ensure；只走 UI 按钮与 `page.goBack()`；**不直接调 navigateBack、不替换 app 行为、不 patch router/history**。
- 若真实 stack 出现其他合法前页：只记录 detail，**不修改预期**。

### 3. `report-today`
- 真实 10 次答题 → ASSESSED report（`A2`）→ `assessment-today` → today；
- **today 验收**：`#/pages/today/today` + `.v2-today-body` 可见 + `.v2-today-title` 存在非空 + DOM 非空 + `#assessment-page` 不可见 + 已发出 `GET /api/v1/learner/home`；**不再仅凭 URL 判 PASS**。
- `ensure` 按既有契约记录（ASSESSED → 一次 `plans:ensure`），不声称业务 PASS；不模拟/伪造结果注入。

### 4. `full-reload-recovery`
- 正常 start → 真实答 1 题（accepted 1，无未提交 choice）→ 真 `page.reload()`（**不是** `page.goto` 换 hash），不读写 storage/token/store、不造 pointer、不注入 guard；
- 恢复只走应用既有正常流程：能 refresh 就 refresh，出现 login 就**真实填账号密码**提交；
- 期望：server 对**同一 session** 再 GET（`placementGet +1`，sessionId 不变）、accepted 仍为 1、页面 choice 清空、`start` 不增加（不新开会话）；
- 记录完整 routes/publicstack/counts/source；失败保留、不据此预判产品 vs 测试。
- checks：`reload-reaches-assessment`、`reload-reGETs-same-session`、`reload-accepted-sequence-still-1`、`reload-clears-page-choice`、`reload-does-not-start-new-session`。

### 5. `settings-baseline`
- 正常登录 **returnTo 固定 settings**（`fresh({destination:'settings'})`，fixture 只允许 assessment 默认 / settings 两个初始目的，禁止自由 returnTo），**全程不挂载 assessment 页**；
- 等真实 `.v2-settings-title` 可见 + DOM 非空 + `learner/preferences`、`notifications/preferences`、`support/tickets` 三类读取已发生；
- 记录 warnings/errors/unknown、source/deps、close、截图；**warnings 原样保留**，本 case 仅用于确定 settings 文本里 AppIcon 的来源，**不称 settings UI 通过**，也不为通过而删警告或改产品。
- checks：`settings-title-visible`、`settings-reads-completed`、`assessment-never-mounted`（外加通用 error/unknown/hash/close 判据）。

## 传输契约（精确匹配，禁止广义 200 兜底）

fixture 只承认下列**精确 pathname**（query 不参与匹配），未知路径一律 `501` + `report.unexpected` → FAIL：

| Method | Path | 形状 |
| --- | --- | --- |
| POST | `/api/v1/auth/login`、`/auth/token/refresh`、`/auth/logout` | 合成 token/204 |
| GET | `/api/v1/iam/principal/me`、`/iam/permissions` | principal + permissions + consentState |
| GET | `/api/v1/learner/profile`、`/learner/targets`、`/learner/preferences` | 合成档案/目标/偏好 |
| GET | `/api/v1/learner/home` | tasks/empty stream（home 与 today 共用读取） |
| GET | `/api/v1/content/learner/catalog` | `{ items: [] }` |
| POST | `/api/v1/assessment/placement/sessions` | 新 session projection |
| GET | `/api/v1/assessment/placement/sessions/{id}` | 当前 projection（读回） |
| POST | `.../sessions/{id}/responses` | 递增 sequence |
| POST | `.../sessions/{id}/retest` | 仅 COMPLETED 后允许 |
| POST | `/api/v1/learning/plans:ensure` | planVersion 1 |
| GET | `/api/v1/learning/today` | 空 plan queue |
| GET | `/api/v1/notifications/preferences` | settings 读取 |
| GET | `/api/v1/support/tickets` | settings closure board |

若 `today` 需要新的 read shape：本 driver 不会放开兜底，会在 `report.unexpected` 中明确列出 method/path 并 FAIL；新增 shape 必须另行评审后在此表中显式登记。

## 记录与判据

- `results.json`：case、run、env 传入的 page hash（并注明 `pageHashDefaulted:false`）、`sourceHashesBefore/After`、`dependenciesBefore/After`、`closed`、每步 `steps[]`（url/hash/stack/screens/selection/counts/截图名）、`report`（requests 仅 method/path；targetReads；unexpected；pageErrors；consoleErrors；**consoleWarnings 单独保留**）、checks、result。
- **依赖基线时点**：`dependenciesBefore` 与 `sourceHashesBefore` 在 **browser launch 之前**同次采集；结束后只读 `After` 并严格逐项比对，避免“都读在 case 之后”的假稳定。
- **run 目录独占**：launch 之前若同名目录已存在 → exit 2；创建用非递归 `mkdir`（父目录 `runs/` 单独确保），失败同样 exit 2，绝不覆盖既有 results/PNG。
- **close 受断言**：`closed:true` 才可能出现 PASS；close 失败会新增/保留 `browser-closed-cleanly` FAIL，不放宽。
- FAIL：任一 check 失败、pageerror、非计划 console error、未知 API 501、前后 hash 不稳定、case 抛错、close 失败。缺页/导航未达属测量失败（FAIL）；env/守卫/hash/服务/浏览器启动/目录冲突属 setup（exit 2）。**无新增宽松路径**。
- 不读 storage/token/headers/body；不注入 guard/store；route 仅来自只读 `getCurrentPages()` 与真实 URL。

## 只读 navigation 诊断（console.debug/log/info）

C8 产品在 `assessment.vue` 的 `onBeforeRouteLeave` 内（`import.meta.env.DEV`）发出**唯一**开发诊断：

```
console.info('[assessment-nav-guard]', JSON.stringify({ toPath, toMetaRoute, toMetaIsEntry, active, busy, permitDestination, permitTarget, permitAliases, permitOperationCurrent }))
```

fixture 只接受**文本以 `[assessment-nav-guard]` 精确开头**的 debug/log/info，随后对该 tag 之后的字符串 `JSON.parse`，并按白名单拣字段：

- `toPath`/`toMetaRoute`/`permitTarget`：path 形状字符串（允许无前导 `/`，如 `pages/home/home`；长度 ≤160）；`toMetaRoute`/`permitTarget` 允许 `null`。
- `active`/`busy`/`toMetaIsEntry`/`permitOperationCurrent`：必须是 boolean。
- `permitDestination`：`null` 或 `back|home|settings|today`。
- `permitAliases`：字符串数组，**最多 2 个**，每个 path 形状 ≤160。
- **出现任何未知字段、类型不符、enum 越界、>2 alias、非 JSON、超长（>600）** → 整条拒绝，只累加 `navigationDiagnosticsRejected` 计数（不存内容）。
- **绝不记录** `message.args`、整个对象、owner/token/headers；不保存原始消息文本，只保存白名单后的 `fields`。
- 记录形如 `{ id, caseId, route, at, tag, fields: {...}, fieldCount }`；`route` 取事件发生时 `page.url()`。
- 纯采集：`console.warn/error` 既有记录与判据、未知 API 501 判据**完全不变**，不扩大 error 豁免。
- 旧 `[MB006]` 泛化 token 解析已移除（它捕获不到产品实际 tag）。

## 已知背景（不并入本诊断）

- C6b 的 cycle-back 已知实际 FAIL；更早的 C3 脚本在完整 relogin 恢复后还有两处 FAIL，**产品 vs 测试未定**。本诊断**不混入 relogin**，也不重测 retest 语义。
- 因此本目录不产出任何 PASS 结论；即使全绿也只代表这四条导航诊断通过，不代表产品整体。
- 静态修正前的 driver/fixture 原样保存在 `archive/pre-static-fix-20261021/`（含 SHA-256 manifest），**未删除任何失败证据**。
- 加只读诊断前的 driver/fixture/README/checkpoint 原样保存在 `archive/pre-diagnostics-20261021/`。
- `runs/` 下已存在 Root/Codex 于 2026-10-21 08:25–08:28 执行产生的 5 个 run 目录；本目录未改动它们。
