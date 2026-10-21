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
- 新 fixture 正常登录 → guide（无 choice）：真实按钮 `assessment-back` → 必须到 home；`0` assessment 写（start/respond/retest/ensure）。
- 另一个 fresh 上下文：guide 点 `assessment-home` → 必须到 home；同样 `0` 写。
- checks：`guide-visible-and-clean`、`back-button-exits-to-home`、`guide-back-zero-assessment-writes`、`home-button-exits-to-home`、`guide-home-zero-assessment-writes`。

### 2. `cycle-back`（已知 C6b 实际 FAIL，预期仍为 home）
- start → question 选 A → `assessment-settings` 引出自定义确认 → 点确认确实到 settings；
- 物理 `page.goBack()` 回测评 → 重新 GET、selection 清空；
- 选 A 提交一题（accepted 1，`aria-valuenow=1`）；
- 新题无 choice 时点 `assessment-back`，必须离开本页（预期 home）。
- 每步只读记录 `globalThis.getCurrentPages()` 的 `{route}` 数组（不可用则记 `available:false` + reason，**不伪造**）、URL/hash、DOM（screens/busy/error/selection/submitDisabled/progress）、planned request counts。
- `0` 额外 respond / retest / ensure；只走 UI 按钮与 `page.goBack()`，**不直接调 navigateBack、不替换 app 行为、不 patch router/history/popstate**。
- 若真实 public stack 出现其他合法前页：只记录在 detail，**不修改 `back-target-is-home` 的预期**（该 check 仍会 FAIL，交由 Root 判定）。

### 3. `report-today`
- 真实 10 次答题 → ASSESSED report（`A2`）→ `assessment-today` → 实际 today 路由；
- `ensure` 按既有契约：ASSESSED report 触发一次 `POST /api/v1/learning/plans:ensure`，**只记录次数，不声称业务 PASS**；
- 不模拟/伪造结果注入，transport 按旧 fixture 的正常 responses 生成。

### 4. `full-reload-recovery`
- 正常 start → 真实答 1 题（accepted 1，无未提交 choice）→ 真 `page.reload()`（**不是** `page.goto` 换 hash），不读写 storage/token/store、不造 pointer、不注入 guard；
- 恢复只走应用既有正常流程：能 refresh 就 refresh，出现 login 就**真实填账号密码**提交；
- 期望：server 对**同一 session** 再 GET（`placementGet +1`，sessionId 不变）、accepted 仍为 1、页面 choice 清空、`start` 不增加（不新开会话）；
- 记录完整 routes/publicstack/counts/source；失败保留、不据此预判产品 vs 测试。
- checks：`reload-reaches-assessment`、`reload-reGETs-same-session`、`reload-accepted-sequence-still-1`、`reload-clears-page-choice`、`reload-does-not-start-new-session`。

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

## 已知背景（不并入本诊断）

- C6b 的 cycle-back 已知实际 FAIL；更早的 C3 脚本在完整 relogin 恢复后还有两处 FAIL，**产品 vs 测试未定**。本诊断**不混入 relogin**，也不重测 retest 语义。
- 因此本目录不产出任何 PASS 结论；即使全绿也只代表这四条导航诊断通过，不代表产品整体。
- 静态修正前的 driver/fixture 原样保存在 `archive/pre-static-fix-20261021/`（含 SHA-256 manifest），**未删除任何失败证据**。
