# MB007 QA — PREPARED（NOT_RUN）

- **状态**：`NOT_RUN`。作者会话没有启动浏览器、没有执行 `author.cjs`、没有产生截图或 `results.json`，也不声称 UI 已验收。
- **日期**：2026-10-21
- **目录**：`docs/takeover/ui-audit-20261013/mobile-home/dsh-20261021-qa/`
- **只改本目录三文件**：`fixture.cjs`、`author.cjs`、`PREPARED.md`。未改产品、未写其他目录、未 Git、未安装、未启动服务或浏览器。
- **固定服务**：`http://127.0.0.1:18183`（已有服务，脚本不自启、不改端口）。
- **候选边界**：`home.vue` / i18n / 极窄 home store 由另一作者负责；本目录不修改、不注入其 store/业务方法。候选是否已落盘、具体 DOM 类名/结构以 Root 审时实际文件为准。

## 与 before 的关系

本 fixture 是基于 `dsh-20261021-before/fixture.cjs` 的测试专用改造，保留同一真实链路：

1. 打开真实登录页 `/#/pages/login/login?theme=…&uiLocale=…&returnTo=%2Fpages%2Fhome%2Fhome`；主题/语言走产品既有 `public-auth-handoff` 合法偏好入口。
2. 用真实 `#mobile-login-identifier` / `#mobile-login-password` / `.login-submit` 登录；真实会话恢复、授权守卫、`/iam/principal/me`、`/learner/*`、`/content/*`、`/learning/*` 均由 fixture 受控 HTTP 响应驱动。
3. 只拦截本地 `/api/v1/*`（18183、18070、18087 的 `127.0.0.1`/`localhost`），其他 origin abort，静态资源 continue。
4. 不读请求 headers/body/token/cookie；请求记录只有 `method`、`path`、`status`、`held`。
5. 未知路径/方法一律 **501** + `report.unknown`，没有泛 200 兜底。
6. 不注入 store/token/storage/router/history/组件/业务方法；合成账号与内容只存在于 fixture 响应中。
7. 不生成正式报告、正式计划、法律正文或默认签署；IAM summary、目标、计划均为明确合成事实。

## 合成事实与权限

- IAM：`adultGate=PASSED`、`learningAccess=ELIGIBLE`、`consent.accepted=true`、必要 purpose 满足。
- 权限至少包含真实服务当前入口所需的 **`learner.home.read`** 与原 **`learning.plan.read`**，另有 `learner.target.read`、`learner.profile.read`、`learner.preference.read`、`content.catalog.read`。
- 目标：`FOUNDATION` / 15 分钟 / `ACTIVE`（已保存）。计划：`plan_mb007_qa_synthetic_1`，`planVersion=3`，3 items（2 DUE + 1 DEFERRED）。
- 5 个任务：`AVAILABLE`（有 contentCode）、`IN_PROGRESS`（有 contentCode）、`COMPLETED`、`UNAVAILABLE`、`LOCKED`。
- 课程：2 个 `PUBLISHED` + 1 个 `UNPUBLISHED`；未发布标题独立可识别，作者检查是否只显示可用。
- `home403` 是合成 HTTP 403（`PERMISSION_DENIED`）。作者把“403 UI 分流”作为 PASS/FAIL，把“permission-error 正式 envelope / 契约语义”单列为 **contract GAP**，不冒充已验证契约，也不把合成 403 说成真实后台行为。

## fixture 公开 options

`fresh({ mode, owner, locale, theme, width, height, caseId, waitReady, waitForHomeUrl })`

支持的 `mode`：

| mode | 传输行为 |
| --- | --- |
| `ready` | home/catalog 200；5 任务 + 2 已发布 + 1 未发布 |
| `emptyNO_PLAN` | home 200、tasks=[]；plan `emptyReason=NO_PLAN` |
| `COMPLETED` | home 200、tasks=[]；plan `emptyReason=COMPLETED` |
| `NO_DUE_REVIEW` | home 200、tasks=[]；plan `emptyReason=NO_DUE_REVIEW` |
| `NO_CONTENT` | home 200、tasks=[]、catalog items=[]；plan `emptyReason=NO_CONTENT` |
| `stale` | home 200 `stale=true`、tasks=[]、plan 未建立；不造 0%/任务/计划 |
| `loadinghold` | 首次 home 200 被 hold，真实 pending |
| `home503` | 首次 home 真实 503，后续 200 |
| `retry503Hold` | 首次 503；重试后的第二次 home 200 被 hold |
| `catalogUNAVAILABLE` | catalog 真实 503；home `contentStatus=UNAVAILABLE` |
| `home403` | 首次 home 真实 403 |
| `home401` | 首次 home 真实 401；`/auth/token/refresh` 真实 401 |

控制面（不碰 session/store/token）：

- `holdNext(path, label)`：下一次匹配 GET 在收到后保持 pending。
- `releaseHold(label)`：用**旧请求收到时快照的 body** 真实 `route.fulfill(200)`；分别记录 `received` / `fulfilled` / `aborted`，不会为了“late 证明”主动 abort。
- `armResponse(path, {status,code})`：一次性的真实 HTTP 错误/状态；路径可用 `*` 前缀。
- `switchOwner('B')`：只改变 fixture 后续响应与登录 subject；切号仍通过真实登录表单。
- `holdSummary()` / `waitForHold(label)`：Root 后续交互控制可直接复用。

`waitReady` 只等真实 transport（home/catalog 状态与 GET），不等候选 DOM；作者用语义 DOM 等待。`waitForHomeUrl:false` 用于 401/403 可能立刻离开 home 的 auth case。

## author 用法

每 case 独立运行，main-only；`require` 不 launch、不校验 env。

```powershell
$env:MB007_CONFIRM_BROWSER = '1'
$env:EXPECTED_HOME_SHA = (Get-FileHash -Algorithm SHA256 apps\mobile\src\pages\home\home.vue).Hash.ToLower()
$env:EXPECTED_I18N_SHA = (Get-FileHash -Algorithm SHA256 packages\i18n\src\mobile-experience.ts).Hash.ToLower()
$env:EXPECTED_STORE_SHA = (Get-FileHash -Algorithm SHA256 apps\mobile\src\stores\learner-content.ts).Hash.ToLower()
# 若候选把极窄 store 放在别的文件：
# $env:QA_STORE_FILE = 'apps/mobile/src/stores/<candidate-store>.ts'
$env:MB007_QA_RUN_ID = 'qa-ready-20261021-root-1'

node docs/takeover/ui-audit-20261013/mobile-home/dsh-20261021-qa/author.cjs --case ready
```

其余 case 同理：`--case search`、`--case retry`、`--case empty`、`--case auth`、`--case late`。每次必须换新的 `MB007_QA_RUN_ID`（或省略自动时间戳）；目录存在即拒绝，不覆盖、不删除旧证据。输出绝对路径由脚本打印，结果在其 `results.json`。

严格 raw hash：三个 `EXPECTED_*` 直接对文件原始字节做 SHA-256，无默认、无自动接受；其他 source/deps 记录 before/after 并要求稳定，不用它们冒充 Root 冻结值。

## 各 case 检查

### ready

- 真实登录后进入 home；canonical `#/` / `#/pages/home/home`；真实 home GET 200 + catalog GET 200。
- 单 H1（今日学习 / Today's learning）；真实 5 任务标题；AVAILABLE 可用“开始学习”；IN_PROGRESS 可用“继续课程/继续学习/Continue course/Continue learning”（记录真实文本）。
- COMPLETED / UNAVAILABLE / LOCKED 不可触发（disabled 或点击后无 URL/请求变化）。
- 只显示 2 个 PUBLISHED，未发布不出现。
- body 16/24（至少 3 个正文文本节点）、辅助字号 >=14、按钮命中区 >=44、至少一个 >=48。
- 记录 unknown API、pageErrors、console errors、domain writes、hash 稳定、closed。

### search

- 真实 `<input>`；空搜索/大小写（`AIRPORT`）/中文（`机场`）/无匹配。
- 真实原生 input 后 0ms 与 160ms 分别记录；pointer 点击“清除搜索”恢复；clear 按钮 Space、Enter 分别恢复并看真实结果。
- 200% 文字后长文本仍完整、无水平溢出（只对当前渲染子树做测试态 font-size/line-height 加倍，记录方法）。
- 点击真实课程标题进入 learn：同时检查 URL、learn DOM 文本、真实 `/content/learner/:code` GET；不以 URL 单独证明。
- learn 页 console warnings 原样保留，不用白名单盖掉未知目标页 warning。

### retry

- 首次 home 真实 HTTP 503；轻错误 + 重试按钮。
- 点击重试（真实 pointer）后第二次 home 200 被 hold；hold 期间按钮禁用/消失，重复强制点击零新增 home GET。
- `releaseHold` 真实 HTTP 200 恢复；记录 503 console 为 expected HTTP console 与关联 page warning，同时原样保留全部 console/pageerror，不做广泛白名单。
- 0 domain writes。

### empty

依次跑 `NO_PLAN` / `NO_CONTENT` / `NO_DUE_REVIEW` / `COMPLETED` / `stale`，另加 `catalogUNAVAILABLE`：

- 不出现伪造 0%、任务 action、计划 id。
- NO_PLAN：真实 onboarding 出口。
- NO_CONTENT / NO_DUE_REVIEW：“看可用内容”/“新学或结束”后真实书架标题在视口内可见。
- COMPLETED：“结束学习”不产生 self 导航死循环。
- stale：不造 0%/任务/计划，只记录实际渲染。
- catalogUNAVAILABLE：catalog 真实 503，不显示已发布课程；记录原始错误 UI/console。

### auth

- `home403`：真实 403 -> forbidden 页面；旧 home 数据隐藏；存在次出口（返回登录/返回）。
- `home401` + refresh 401：回到真实登录；旧数据隐藏；0 domain writes；refresh 请求状态 401。
- `home403` 的权限契约单列 **GAP**：不声称正式 permission-error 契约已满足。
- 两个子流程都需要真实 API 401/403，不直接 `session.clear()` 或改 login state。

### late（best-effort，允许 GAP，不编造）

1. A 登录 ready，记录 A 任务/课程。
2. `holdNext('/api/v1/learner/home','late-A')`；真实点击 A 课程进 learn，再真实浏览器返回 home，触发被 hold 的 A home GET。
3. 对 `/content/learner/*` 与 `/auth/token/refresh` 分别真实 401，经真实 UI 回登录。
4. `switchOwner('B')` 后用真实登录表单登录 B；等 B home ready。
5. `releaseHold('late-A')`：只有 `fulfilled=true` 才检查 A 旧包是否污染 B；`aborted` 明确记 GAP/NOT_RUN，**不把 abort 当 late 证据**。
6. 若步骤选择器/时序不可靠，输出已得证据 + `GAP`，不写假 PASS。

## 静态检查（作者仅允许这些，不运行浏览器）

```powershell
node --check docs/takeover/ui-audit-20261013/mobile-home/dsh-20261021-qa/fixture.cjs
node --check docs/takeover/ui-audit-20261013/mobile-home/dsh-20261021-qa/author.cjs
node -e "require('./docs/takeover/ui-audit-20261013/mobile-home/dsh-20261021-qa/fixture.cjs'); require('./docs/takeover/ui-audit-20261013/mobile-home/dsh-20261021-qa/author.cjs'); console.log('import-only ok')"
```

`import-only` 不是运行证据。作者本轮已执行两条 `node --check` 与 `import-only`，输出 `import-only ok`；未启动浏览器、未访问 18183。

## 选择器与候选适配

候选锁定文案：H1 今日学习/Today's learning、课程内容/Courses、搜索课程/Search courses、清除搜索/Clear search、修改目标/Change goal、进入测评/Take assessment、错题本/Mistakes、重试/Retry、主 task 开始学习/Start learning 或继续课程/Continue course（记录真实文本，语义兼容 Continue learning）。

`author.cjs` **不依赖** `v2-home-body` / `task-button` 旧类，使用：

- 可见 `h1` / `[role=heading][aria-level=1]`；
- `button` / `uni-button` / `[role=button]` 的可见文本与 `aria-label`；
- 真实 `input` / `[role=searchbox]`；
- 标题文本定位最近按钮/容器；
- 页面正文与真实 GET 事实。

若候选实际 DOM 与上述语义不一致（例如 H1 未带 heading role、clear 只是无文本图标、course 不是可点击按钮），先读候选窄改本目录选择器；**不能为过脚本改产品**。无法确定处会以 FAIL/GAP 记录，PREPARED 不预设 PASS。

## 退出码

- `0`：本 case 所有 checks 为 PASS。
- `1`：任一 check FAIL（仍写 results、截图与原始 console/pageerror）。
- `2`：setup 拒绝 / GAP / NOT_RUN（不冒充 PASS；已写出的证据保留）。

`closed`、source/deps hash 稳定、unknown API、auth/domain 写分离、console/pageerror 原文都会写入 `results.json`。`REFRESH 401` 与 `403` 的预期 console 只做显式分类，不做广泛白名单。

## 明确不声称

- 不声称候选 UI 已完成或本 PREPARED 已执行。
- 不声称合成 IAM/计划/课程是真实后台或 native 行为。
- 不声称 403 permission-error 契约已满足。
- 不声称 late 一定能复现；`aborted` / 步骤失败一律 GAP/NOT_RUN。
- 不声称任何 before/QA 缺陷已经被修复。
