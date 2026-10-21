# MB006 C5 author checkpoint — H5 dirty browser-back guard（C5b 修正候选，未验收）

日期 2026-10-20（CST）。候选实现，**未宣称 PASS / 未签整页**。范围：`apps/mobile/src/pages/assessment/assessment.vue`、`apps/mobile/package.json`、`pnpm-lock.yaml`（仅依赖暴露）；未改 API/store/session/global guards/private `$router`/popstate/history，未改 Git/服务/浏览器。C4 的 CSS 与导航逻辑保留。

## 1. 证据冻结（第一版 C5 原样保留）

- 第一版 C5（Root 静态审前）快照：`c5-baseline/assessment.vue.c5.raw` = `1e4e729c322b2d54c25812e91968cb5dc8ace803dc410019571a548943354204`（35589 bytes），`package.json.c5.raw` = `484382c7…c0078`，`pnpm-lock.yaml.c5.raw` = `d57a87ca…06624`。三个文件与 `c5-source-hashes.json` 均未覆盖。
- C5b（本修正）快照：`assessment.vue.c5b.raw` raw=LF=`24281df07efb4a8553cfb605eab8d22eb3e16f83076805b141818021948c529a`（36084 bytes）；package/lock 与 C5 相同（`484382c7…` / `d57a87ca…`）。见 `c5b-source-hashes.json`。
- C4 证据与基线仍在：`c5-baseline/assessment.vue.c4.raw` = `abff80cd…`，C4 package/lock 原字节同样保留。

## 2. 依赖（精确、最小）

- `apps/mobile/package.json` dependencies 增加 `"vue-router": "4.4.4"`（1 行）。
- `pnpm-lock.yaml` 仅 `apps/mobile` importer 增加 3 行：`specifier: 4.4.4` → `version: 4.4.4(vue@3.5.41(typescript@5.9.3))`，与 `@dcloudio/uni-h5` 既有解析完全一致（`pnpm-lock.yaml` 中 `@dcloudio/uni-h5` 依赖即 4.4.4）。
- 离线用既有 store 完成链接（`pnpm install --offline --frozen-lockfile --filter @englishflow/mobile --ignore-scripts --store-dir <既有全局 store>`，exit 0），`apps/mobile/node_modules/vue-router` 指向既有 `vue-router@4.4.4_vue@3.5.41_typescript@5.9.3_`；无版本升级、无其他 importer 改动。

## 3. H5 guard（`onBeforeRouteLeave`，仅 H5 条件编译）

判定顺序：`active && isAuthenticated` → 一次性 `routeLeaveBypass`（页面 UI 已确认的导航，即使 `pending === 'navigate'` 也可用）→ **`busy` 直接 `false`**（与 `onBackPress` 一致，读/进页/提交/导航中不弹窗）→ 无选择/无题放行 → 已有确认/已有 pending 时再 `false`（单弹窗）→ 设置 `leaveDestination='back'`、聚焦既有 `assessment-leave-title`，并返回未决 `Promise<boolean>`。

- 取消：`cancelLeave()` 先 `settleRouteLeave(false)`，再关确认并聚焦提交；Vue Router 4.4.4 对 abort 的 pop 导航调用 `history.go(-delta)` 回滚地址栏（源码 `vue-router.mjs` 3519-3556），页面不自行改 history。
- 确认：`confirmLeave()` 若存在 guard promise，只 `settleRouteLeave(true)`，让原始 pop 导航按实际目标完成；不猜测/不重放 delta。
- 页面按钮：先确认，再 `routeLeaveBypass = true` 调用既有 `navigate()`，`finally` 清除；同一决定不会二次弹窗；C4 的 `navigate('back')`（login 前页→home、真实前页→navigateBack）不变。
- owner 变化：`identityRevision` watcher **先 `settleRouteLeave(false)`** 再 `invalidate()`；旧 owner 的 pending 导航不得放行，旧草稿/旧确认清除。新 owner 的 auth 重定向是新的导航，guard 因已无草稿而放行（无需旧的 true 兜底）。
- 卸载：`leave()` 内 `settleRouteLeave(false)`；`onBackPress`（native/程序化 navigateBack）完全保留。

## 4. 重复 back 的显式推理（未解决项，交 Root 实测）

1. 第一次 popstate → guard 返回未决 Promise，确认框显示。
2. 第二次 popstate → guard 见 `leaveDestination`/`routeLeavePrompt`，返回 `false`；router abort 该次导航并 `history.go(-delta)` 回滚 URL。
3. 新的 pop/回滚会更新 `pendingLocation`；先前的 pending 导航在其 guard promise 结算后会被 `checkCanceledNavigation` 判为 `NAVIGATION_CANCELLED`（源码 3217-3224、3357-3367）。
4. 因此旧的 Promise 可能在其导航已被取消后仍然存在，直到用户取消/确认或 `onHide`/卸载/owner 变化将其 settle。**确认时可能只关闭确认框而不发生导航**；没有 history/popstate 补丁，也不静默重放 delta。该限制保留给 Root 的真实浏览器 repeat 测试，不声明已解决。

## 5. 执行

- `pnpm --filter @englishflow/mobile typecheck`：exit **0**（C5b 修正后）。
- `pnpm --filter @englishflow/mobile build:h5`：exit **1**，与 C3 已知环境问题同源——`estree-walker` 在 `unimport/dist/chunks/detect-acorn.cjs` 的 exports 解析失败（另有历史 `spawn EPERM`），**不是本页/vue-router 代码错误**；日志 `c5-baseline/build-h5.c5.log`。模板/条件编译未获构建级验证。
- 真实浏览器、URL 回滚、重复 back、focus、owner 切换：**NOT_RUN**（本任务禁止启动浏览器/探针）。
- native/小程序：H5 条件块被剥离；`onBackPress` 未改，未实测。

## 6. 待 Root 实测（不预签）

dirty 选择 + 浏览器 back → 单弹窗+焦点；取消 → 停留/草稿保留/URL 回 assessment；确认 → 落到实际历史目标且无二次弹窗；busy（尤其无选择时）back → 不导航不弹窗；页面按钮确认 → 不二次弹窗；owner 切换 → 旧 pending 取消、无旧 owner 提示；快速重复 back → 记录实际行为与上述限制。
