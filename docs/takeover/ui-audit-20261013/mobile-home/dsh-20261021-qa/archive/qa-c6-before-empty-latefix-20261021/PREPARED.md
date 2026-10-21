# MB007 QA — PREPARED（NOT_RUN）

- **状态**：`NOT_RUN`。作者会话没有启动浏览器、没有执行 `author.cjs`、没有产生截图或 `results.json`，不声称 UI 已验收。
- **日期**：2026-10-21
- **目录**：`docs/takeover/ui-audit-20261013/mobile-home/dsh-20261021-qa/`
- **旧稿保留**：首稿与后续修稿原样保存在 `archive/qa-first-draft-20261021/`、`archive/qa-revised-before-tabfix-20261021/`、`archive/qa-c3-before-reviewqueue-planlate-20261021/`，未删除、未覆盖任何旧证据。
- **只改本目录**：`fixture.cjs`、`author.cjs`、`PREPARED.md` 及上述 archive。未改产品、未 Git、未安装、未启动服务/浏览器。
- **固定服务**：`http://127.0.0.1:18183`（已有服务，脚本不自启、不改端口）。
- **候选**：`home.vue` / i18n / 极窄 store 由另一作者负责；本目录不修改，不注入 store/token/storage/router/history/业务方法。

## 候选事实（本轮窄读，非全库扫描）

`home.vue` 当前使用：

- H1 `.home-title`（`role=heading aria-level=1`），文案 今日学习 / Today's learning。
- 任务行 `.home-task`；标题 `.home-task__title`；首行主按钮 `.home-task__primary`；次级行 `.home-task__secondary`；负态 `.home-task__state`。
- 课程行 `.home-course`；标题 `.home-course__title`；搜索 `input[type=search].home-search__input`；设置 `.home-settings`。
- 次级 IN_PROGRESS 文案实际为 **继续 / Continue**（不是 Continue course）。
- 空态动作：NO_PLAN 开始设置/Start setup；NO_CONTENT / NO_DUE_REVIEW / COMPLETED 统一 **查看课程 / View courses**；无 published 课程时 `action` 为空，不渲染无效 CTA。
- forbidden 页当前 H1 为 `#mobile-forbidden-title`：generic **暂时无法访问这项内容 / This content is not available.** 或 unknown **暂时无法确认访问状态 / We cannot confirm access**；不再显示 403 数字或旧英文 Forbidden / “没有访问权限”。403 case 等真实 forbidden URL + 已签 H1/中性说明，不靠 URL 单独 PASS。
- 首稿用旧 empty 文案、Continue course、403 数字、旧课程点击触发 401，均已修正。

`author.cjs` 使用上述真实类；若候选下一轮 DOM 变动，先窄读候选再改本目录选择器，不能为过脚本改产品。

## fixture 边界

真实登录页 + 真实 guard；本地 `/api/v1/*` 受控 transport；未知 501；不读 headers/body/token/cookie；不造正式报告/计划/法律正文/默认签署。IAM 仅合成 summary，不做真实后台/native 声称。

权限至少含 **`learner.home.read`** 与 **`learning.plan.read`**，另有 target/profile/preference/catalog read。`home403` 的 403 UI 分流可 PASS/FAIL；permission-error 正式 envelope 单列 **contract GAP**。

### options

`fresh({ mode, owner, locale, theme, colorScheme, width, height, caseId, waitReady, waitForHomeUrl, payloadSequence })`

- `theme`: `light` / `dark` / `system` / `high-contrast`；`colorScheme` 显式 `light|dark`。主题/语言只走既有 login handoff + GET `/learner/preferences`（`system -> SYSTEM`，`high-contrast -> highContrast=true`），不改 store/localStorage。实际 DOM theme 由 matrix 另行核验。
- `payloadSequence`: 每个 home 200 的 task 标题带 `G<n>` 前缀、completedMinutes 递增；用于证明迟到包与新包不同，不拿相同 payload 冒充覆盖保护。
- 新增真实 settings GET 合成 shape：`/notifications/preferences`、`/support/tickets`（沿用 nav fixture 形状），用于 settings 401 流程，不泛 200。
- 新增 `/learning/review-queue` 受控只读空队列：`items:[]`、`emptyStatus:'EMPTY'`、`emptyCopy`、`history:[]`、`projectionVersion`；不生成复习计划/任务，不泛 200。learn 实际 GET 因此不再 501。
- `caseKey` 写入全部 transport 记录；未知 API 在交互 settled 后统计，顶层 `unknownCount` 与 `no-unknown-api` FAIL 共用同一来源。

### modes

`ready`、`emptyNO_PLAN`、`COMPLETED`、`NO_DUE_REVIEW`、`NO_CONTENT`、`stale`、`loadinghold`、`home503`、`retry503Hold`、`catalogUNAVAILABLE`、`home403`、`home401`、`planLate`。

### 控制面（公开，仅输运 data）

`holdNext(path,label)` / `releaseHold(label)` / `waitForHold` / `holdSummary` / `armResponse(path,{status,code})` / `switchOwner('B')` / `payloadTitle(seq)`。

- hold 收到时快照旧 body；release 用真实 `route.fulfill(200)`，分别记录 received / fulfilled / aborted；不主动 abort 旧包。
- `releaseHold` 返回 `payload`，author 同时记录 `page.on('response')` 与 `requestfinished` 的浏览器侧到达；`route.fulfill` resolve 不等于浏览器已收到，缺浏览器响应记 GAP 不冒充 PASS。

## author 用法

main-only；`require` 不 launch、不校验 env。每 case 新目录，存在即拒绝。

```powershell
$env:MB007_CONFIRM_BROWSER = '1'
$env:EXPECTED_HOME_SHA = (Get-FileHash -Algorithm SHA256 apps\mobile\src\pages\home\home.vue).Hash.ToLower()
$env:EXPECTED_I18N_SHA = (Get-FileHash -Algorithm SHA256 packages\i18n\src\mobile-experience.ts).Hash.ToLower()
$env:EXPECTED_STORE_SHA = (Get-FileHash -Algorithm SHA256 apps\mobile\src\stores\learner-content.ts).Hash.ToLower()
$env:EXPECTED_RUNTIME_SHA = (Get-FileHash -Algorithm SHA256 apps\mobile\src\platform\uni-runtime.ts).Hash.ToLower()
# 若极窄 store 换了路径，显式指定；否则默认 learner-content.ts
# $env:QA_STORE_FILE = 'apps/mobile/src/stores/<candidate-store>.ts'
$env:MB007_QA_RUN_ID = 'qa-ready-20261021-root-1'

node docs/takeover/ui-audit-20261013/mobile-home/dsh-20261021-qa/author.cjs --case ready
```

Cases：`ready`、`search`、`navigation`、`retry`、`empty`、`auth`、`late`、`late-same`、`plan-late`。

严格 raw hash：home / i18n / store / runtime 四项必须显式且与文件原始字节一致；其他 API/session/navigation/handoff/package/lock 记录 before/after 并要求稳定。runtime 新 diff 不自动接受，必须由 Root 给 `EXPECTED_RUNTIME_SHA`。

## 各 case 检查

### ready

- 真实 home GET 200 + catalog GET 200；单 H1；5 任务实际行。
- AVAILABLE 主按钮开始学习；IN_PROGRESS 次级 **继续/Continue**（记录真实文本）。COMPLETED/UNAVAILABLE/LOCKED 行必须有标题 + `.home-task__state` 状态，且无可用 button 或 disabled；点击后 URL/请求不变。
- 只显示 2 published；未发布不出现。
- body 16/24、辅助 >=14、按钮 >=44；`ready-primary-48` 只检查 `.home-task__primary` 本体 >=48，不由任何 input/search clear 的 48 高度代为通过。
- unknown / pageErrors / 未分类 console errors / domain writes / hash / closed。

### search

- 真实 input；空、大小写 `AIRPORT`、中文 `机场`、无匹配；0ms 与 160ms 结果分别记录；pointer clear；clear 的 Space/Enter 都看真实结果。
- 200% 文字下长课程文本完整。`search-text200-no-horizontal-overflow` 只把 `documentElement.scrollWidth > clientWidth + 1` 判为横向溢出；外壳正常 `scrollHeight > clientHeight` 的纵向长页不算 FAIL。另独立检查实际 `.home-course__*` / `.home-task__*` / button 的 CSS `overflowX/Y` 隐藏或裁切，不全局忽略 overflow、不降低裁切要求。
- 点击课程标题后检查 learn URL + 真实 `/content/learner/:code` GET + 可见标题；不以 URL 单独证明。learn warnings 原样保留。

### navigation（新增具名 case）

- 真实 pointer 点击 `.home-task__primary`（主任务）→ learn；必须观察到真实 content GET 且 learn DOM 可见课程标题/内容，不能只 match URL。
- 从 learn 返回 home 必须用真实“学习 / Learn” tab（或已获准 header 返回）并等 home DOM + 新 home GET；不使用 `page.goBack()` 代替。返回后点击**第二门** `.home-course`（course2，非已缓存的 course1）→ learn；必须出现不同 contentCode `mb007-course-hotel` 的新 GET + course2 新标题/内容，不以 URL 或缓存 DOM 单独 PASS。

### retry

- 首次 home 真实 503；轻错误 + 重试。
- 重试后的第二次 home 200 被 hold；hold 中按钮 disabled/消失，重复强制点击零新增 home GET。
- release 真实 200 恢复；503 console 只按本 case 实际 503 API path 分类，其余 console error 全保留并 FAIL；0 domain writes。

### empty

- `NO_PLAN`：开始设置 → 真实 onboarding。
- `NO_CONTENT`：catalog items=[]，**不渲染查看课程 CTA**；断言无 CTA、无 `.home-course`、无任务/0%/计划。
- `NO_DUE_REVIEW` / `COMPLETED`：查看课程 → 真实书架标题在视口内；COMPLETED 另查无 self 导航死循环，不能只接受 URL 不变。
- `stale`：无任务/0%/计划。
- `catalogUNAVAILABLE`：catalog 真实 503，不显示 published。
- 所有日志原样。

### auth

- `home403`：等真实 `/pages/forbidden/forbidden`，读 `#mobile-forbidden-title` 当前 generic/unknown 两文案之一，描述中性且无 403/forbidden；次出口按当前 管理账号/帮助与反馈/退出登录；旧数据隐藏；0 domain writes；permission contract GAP。
- `home401` + refresh 401：真实登录分流；旧数据隐藏；refresh 请求 401；0 domain writes。
- 401/403 console 只按本 case 实际 API path + status 分类，不做全 `Failed to load resource` 豁免。

### late（跨 owner，best-effort）

1. A ready；hold A home；真实课程离开 learn 后，用真实“学习 / Learn” tab（或已获准 header 返回）回 home，等 home DOM 后拿 held A GET；不假设 `page.goBack()` 必回 home（另测 browser back 只能单独具名记录，不能替代 tab 主路径）。
2. `notifications/preferences` 真实 401 + refresh 401；真实点击 `.home-settings` 进入 settings，由真实 401 分流到登录。
3. `switchOwner('B')` 后真实登录 B；若 returnTo=settings，用真实 tab/返回入口回 home（不篡改 token/returnTo）；无法回 home 则 GAP/NOT_RUN。
4. release A 旧 HTTP 200；记录 fulfilled、浏览器 response/requestfinished；只有浏览器收到才检查 B DOM 未被 A 覆盖。abort/无浏览器响应不冒充 late 证据。

### late-same（新增同 owner）

1. `payloadSequence=true`，初始 `G1`。
2. hold 后离开 learn，用真实“学习 / Learn” tab 回 home（不假设 browser back），拿到 held `G2`（真实 pending）。
3. settings 离开/返回，拿到 `G3`；确认 GUI 明确显示 `G3`，且 `G2` 与 `G3` payload 不同。
4. release `G2` 为真实 200；记录浏览器 response 与 fulfilled；确认 `G3` 不回退、`G2` 不覆盖。
5. 若旧包 abort 或浏览器未收到，GAP/NOT_RUN，不 PASS。

### plan-late（新增，同 owner）

1. `planLate` 传输：首次 `/learning/today` 真实 503；重试的第二次 200 旧解释并被 hold；返回 home 后的第三次 200 新解释，items 为空，不伪造复习任务。
2. 真实点击 home 的 plan-read 重试按钮；hold 旧 today GET。
3. 不点 disabled header settings。用真实 `uni-tabbar` 唯一“课程 / Courses”项离开 home 到 learn（校验 URL + learn DOM），再通过 `goHomeViaUi` 点真实“学习 / Learn”tab 回 home；等第三次 today 200 与新解释可见。若 Courses tab 不唯一/不可用，明确 `plan-late-courses-tab-unavailable` GAP/NOT_RUN，不伪造 PASS。
4. release 旧 HTTP 200；记录 fulfilled、浏览器 response/requestfinished；确认新解释仍在、旧解释不覆盖；0 domain writes。
5. 该 case 直接覆盖 `retryPlan` 晚到覆盖风险；产品 C4 未完成前会真实 FAIL/GAP，不改成 PASS。

## 日志分类

`results.json` 保留全部 consoleWarnings / consoleErrors / pageErrors 原文。main 里按本 case **实际请求 path + status** 生成允许集合（retry/plan-late 503；auth/late 401/403）；不在集合内的 console error 一律 FAIL。learn 的 `/learning/review-queue` 用合法空队列，不再进入 501；未知仍保留并 FAIL。warnings 不静默丢弃，按 case scope 原样记录；pageErrors 非空 FAIL。

## 静态检查

```powershell
node --check docs/takeover/ui-audit-20261013/mobile-home/dsh-20261021-qa/fixture.cjs
node --check docs/takeover/ui-audit-20261013/mobile-home/dsh-20261021-qa/author.cjs
node -e "require('./docs/takeover/ui-audit-20261013/mobile-home/dsh-20261021-qa/fixture.cjs'); require('./docs/takeover/ui-audit-20261013/mobile-home/dsh-20261021-qa/author.cjs'); console.log('import-only ok')"
```

作者本轮执行两条 `node --check` 与 import-only，输出 `import-only ok`；未启动浏览器、未访问 18183。静态检查不代浏览器 PASS。

## 退出码

- `0`：本 case 全部 checks PASS。
- `1`：任一 FAIL（仍写 results/截图/原始日志）。
- `2`：setup 拒绝 / GAP / NOT_RUN（不冒充 PASS，已写证据保留）。

## 明确不声称

- 不声称候选 UI 完成或本 PREPARED 已执行。
- 不声称 403 permission-error 契约已满足。
- 不声称 late 必然复现；abort、无浏览器响应、无法真实回 home 一律 GAP/NOT_RUN。
- 不声称合成 IAM/计划/课程是真实后台/native 行为，也不声称任何 before/QA 缺陷已修复。
