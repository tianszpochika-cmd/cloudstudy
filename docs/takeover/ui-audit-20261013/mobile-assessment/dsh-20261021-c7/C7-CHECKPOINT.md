# MB006 C7 checkpoint — 真实 C6b 浏览器 FAIL 的两项修复 + 一项分析（候选，未验收）

> **状态更正（C7b，2026-10-21）**：§2 的 `isMobileLearningPath` 判据、§3 的 afterEach 无条件清理、§6 的私有探针建议**均已作废**。`isMobileLearningPath` 实际只排除 PUBLIC/AUTH_ONLY，assessment/home/today 与未知 path 都返回 true，不能作为“可达前页”判据；H5 页内 back 现**始终** `switchTab` 学习首页，native 仅在可用前页（排除本页与 auth 前页）时 `navigateBack`；afterEach 只在公开事实表明回到本页（success/duplicated）或实际离开时失效旧 prompt。C7 原字节 `92e7e110…25b3937b` 保留；详见 `C7B-CHECKPOINT.md`。浏览器仍 NOT_RUN。

日期 2026-10-21。仅改 `apps/mobile/src/pages/assessment/assessment.vue` 与本目录证据。未改 i18n/API/store/session/runtime/deps/Git/测试/服务；不宣称 UI 签收。

## 1. 已实测 FAIL（保留，不抹除）

- risk `codex-20261021-c6b-leave-1`：22/26。`L1-back-without-selection-exits-to-home` FAIL（期望 `#/pages/home/home`，实际仍 assessment）；relogin recovery 2 FAIL；pageerror `Object`。
- backguard `codex-20261021-c6b-repeat-confirm-1`：19/21。二次/三次 back 的 native beforeunload dismiss 后 forward 回 assessment，旧 custom prompt 仍在；点确认只收框、原题零写。

## 2. 修复 1：clean 页面返回可靠落 home

根因（依据实测序列 + 已装 uni-h5/vue-router 公共实现）：真实 browser back 从 settings 回 assessment 后，`getCurrentPages()` 仍可能给出本页/陈旧 `settings`；旧 `navigate()` 据此 arm 了 `target=/pages/settings/settings` 的 permit 并 `navigateBack`，而实际 router 去的是本页/其他入口，guard 因 `busy` 且 target 不匹配而 abort，页面停留 assessment。

改动（**已被 C7b 取代**）：C7 曾把可用性收紧为「非 auth 且 `isMobileLearningPath(previous)`」，该判据错误——`isMobileLearningPath` 只排除 PUBLIC/AUTH_ONLY，本页/tab/未知 path 都可能为 true。C7b 已改为：H5 页内 back 一律 `switchTab('/pages/home/home')`；native 仅在存在前页、前页不是本页且不是 auth 落地页时 `navigateBack`。permit 的 `target` 与实际分支仍同源计算。
- 公共依据：uni 官方 `getCurrentPages()` 与既有 `switchTab/navigateBack`；不再引用 `isMobileLearningPath`。
- 行为变化：H5 页内 back 与独立 home 按钮同落学习首页（本次风险测试期望）；native 的可达前页语义保留。

## 3. 修复 2：forward/其他导航取消旧 pending guard

改动（**已被 C7b 取代**）：C7 的 afterEach 曾在任意导航完成/失败时清理 pending prompt，仍可能在第二个被拒绝的离页导航（aborted）时误清第一确认框。C7b 只保留：公开事实表明用户已回到本页（success 或 `NavigationFailureType.duplicated`）或实际已离开页面时才失效旧 prompt；aborted/cancelled 不清。
- 依据：vue-router 4.4.4 公共 `useRouter`/`afterEach` 回调 `(to, from, failure)`、`isNavigationFailure`、`NavigationFailureType`（`router.afterEach(cb)` 返回注销函数）。

## 4. 未修复项分析（relogin recovery + pageerror Object）

- 脚本 `page.goto(<same-origin>#/pages/login/...)` 只改 hash，不保证 full-document reload；fixture 的会话/owner revision 仍在，随后再次 login 会清 store/翻 revision，出现 `after-goto root=false`、pending→guide、`waitForFunction` 超时；`pageerror "Object"` 更像该异步链路抛出的非 Error 对象，而非本页新错。
- 建议（不改测试/产品）：恢复路径用 `page.reload()` 或新 context + 正确 returnTo 做 full-document；若仍失败，再按既有 `start` 恢复 GAP 立项，不能靠造 pointer/扩 API 绕过。
- 现状：**ANALYSIS_ONLY**，未改代码、未声称修复。

## 5. 冻结与执行

- 编辑前归档：`dsh-20261021-c7/baseline/assessment.vue.c6b.raw` = `ac8fb8d2…f157fd`（C6b 原字节，未覆盖）。
- C7 page raw=LF=`92e7e11090c046985e5e1a4cb83a8e5249e479f022efd69aea42774125b3937b`（41513 bytes）；四哈希 `c7-source-hashes.json`：page 同左、i18n `6ac6800e…`、package `484382c7…`、lock `d57a87ca…`（后三者未变）。
- `pnpm --filter @englishflow/mobile typecheck`：exit **0**。
- Browser/Native/小程序/partial-runtime/构建：**NOT_RUN**（本次未执行浏览器、构建或 native；不引用 C6b 之前的旧构建阻塞作为当前事实，Root 的 C6b build 0 仅证明旧版本）。

## 6. 风险与最小探针（若 Root 复测仍失败）

- settings→back 现在落 home 属有意固定行为（C7b）；不再用 uni 栈或私有 router 推断可达前页。
- 若仍停在 assessment：Root 只用**只读 public** `getCurrentPages().map(p=>({route:p.route}))` 与当前 DOM/`location.hash` 即可定位；**不使用** `getApp().$router` 或内部 operation/revision 日志。
- afterEach 为页面实例注册、unmount 注销；仅按公开 success/duplicated/leave 事实清理，被拒绝的其他离页导航不清第一确认框。
