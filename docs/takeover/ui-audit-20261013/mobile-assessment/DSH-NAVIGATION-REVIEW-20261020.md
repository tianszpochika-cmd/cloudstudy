# MB006 H5 离开保护 — 只读设计审查（2026-10-20）

状态：**只读审查，未实现、未验证、未改产品/测试/Git/服务/浏览器。** 不声称修复或整页 PASS。C4 作者正在改 `assessment.vue`（当前 hash `abff80cd…`，仅 CSS + safe prev-auth back，未审核）；本文件不依赖其新代码，C3 基线仍为 `86620ed0…`。

## 1. 已观测事实

- `[实测]` C3 lifecycle 证据 `dsh-20261020-lifecycle/runs/codex-review-c3-lifecycle-1/dirty-history-back/results.json`：已选 A 未提交时真实浏览器 `page.goBack()` → `route=#/pages/login/login`、`confirmation=false`、`draftKept=false`；`onBackPress` 未被触达。该目录的 `ROOT-RUN1-CLASSIFICATION.md` 把它分类为 **measured normal-H5 UX FAIL**（不是未测分支）。
- `[实测]` `assessment.vue`（C3 `86620ed0…`）已有页面内保护：`requestLeave/confirmLeave` + `onBackPress`（`selectedKey && question` 时 `requestLeave('back')` 并 `return true`），以及 `busy` 锁定；这些只覆盖页面按钮和 `uni.navigateBack` 路径。
- `[读取]` `uni.navigateBack` 才调用 `onBackPress`：`apps/mobile/node_modules/@dcloudio/uni-h5/dist/uni-h5.es.js:18854-18859`（`invokeHook(ON_BACK_PRESS, {from:'navigateBack'})` 后才 `getApp().$router.go(-delta)`）。浏览器 popstate 不经过该 API，故不触发。
- `[读取]` uni-h5 在 `initRouter(app)` 中 `createRouter(...)`、注册内部 `beforeEach`（tabBar 滚动）、`app.router = router`、`app.use(router)`：`uni-h5.es.js:14250-14255`；页面经 `<RouterView>` + `KeepAlive` 渲染：`:20112`。
- `[读取]` `getApp().$router` 被 uni 自身使用（`:6041`、`:18858`）；`getApp()` 的公开类型是 `AppInstance`（`@dcloudio/types/uni-app/app.d.ts:128,213`），**不含 `$router`**。
- `[读取]` `@dcloudio/uni-app` 公开导出仅有页面生命周期（含 `onBackPress`，`dist/uni-app.d.ts:49`），**没有** `onBeforeRouteLeave`/`useRouter`/`beforeEach`；`@dcloudio/uni-h5` 的 export 列表也没有路由 helper。
- `[读取]` `uni.addInterceptor` 是公开 API（`uni-h5.es.js:2470`），按 uni API 方法名拦截（`navigateTo/switchTab/redirectTo/reLaunch/navigateBack` 等），**看不到浏览器 popstate**。
- `[读取]` uni-h5 依赖 `vue-router@4.4.4`（`uni-h5/package.json`），但 `apps/mobile` 与仓库根均无 `node_modules/vue-router`，应用也未声明该依赖；直接 `import { onBeforeRouteLeave } from 'vue-router'` 当前解析不到。
- `[读取]` 应用源码目前没有 `$router`/`beforeEach`/`onBeforeRouteLeave`/`popstate` 使用（全 `apps/mobile/src` grep 为空）。

## 2. 结论：是否有“受支持的公开 hook”？

- `[推断]` Vue Router 实例**确实存在**且页面位于 `RouterView` 内，因此 `beforeEach`/`onBeforeRouteLeave` 语义上可作用于页面路由；取消导航时由 vue-router 处理 URL 回退。
- `[实测]` 但当前安装的 uni **公开类型/导出没有**页面级浏览器历史 guard；`getApp().$router` 是 uni 自身使用的运行时路径，**不是** `@dcloudio/types` 的公开契约；`onBeforeRouteLeave` 需要直接依赖 `vue-router`，当前不可解析。
- 因此：**没有“既公开、又有类型、又无新依赖”的现成 uni hook**。可选路径只有“运行时 router 实例 + vue-router 公共 guard（未类型化）”或“新增 `vue-router` 直接依赖”。这不是可以静默豁免的细节；不批准任一方案时，H5 浏览器返回丢草稿的 UX FAIL 仍然存在。

## 3. 候选方案

### A. 页面作用域的 `getApp().$router.beforeEach`（无新依赖，运行时路径）
- 在页面 setup（`#ifdef H5`）取 `const router = getApp().$router`（需显式窄化 cast），仅当 `active && selectedKey && question` 时对 `from.path === '/pages/assessment/assessment'` 的离开返回 `false`，复用现有 leave confirmation；不 monkeypatch `history/popstate`。
- 确认：一次性 `bypass` 后调用 `router.back()` 重放真实历史返回（而不是 `navigate('back')` 的 switchTab 兜底），guard 消费 bypass 后放行；取消/失败清 bypass，草稿保留。
- 清理：`onBeforeUnmount` 调用 `beforeEach` 返回的卸载函数；`identityRevision` 变化/owner 切换时 `leave()` 并使 guard 失效；不重复注册。
- 风险：`$router` 未在公开 d.ts，属半公开运行时表面；全局注册（页面谓词约束）；与 uni 内部 `beforeEach`、`history.listen` 的 `removeCurrentPages` 交互需实测；KeepAlive 下缓存页的 guard 必须移除；busy 时是否取消返回需定策（建议与 `onBackPress` 一致：busy 取消导航）。

### B. 页面内 `onBeforeRouteLeave`（语义最干净，但需依赖变更）
- 从 `vue-router@4.4.4` 导入 `onBeforeRouteLeave`，页面作用域、自动清理；需把 `vue-router` 加为 `apps/mobile` 直接依赖（版本与 uni-h5 对齐），并验证在 uni 的 `RouterView + KeepAlive` 下 injection 生效。
- 风险/成本：依赖变更超出当前只读 scope；H5 条件编译；仍需验证 URL 回退、bypass、owner 清理。
- 这是首选“架构干净”的长期方案，但不是本轮可无变更落地的方案。

### C. 不新增 guard（保持现状）
- 必须显式记录 GAP：真实浏览器返回可在无确认下离开并丢草稿；现有 C3 FAIL 保持。不能以“onBackPress 已存在”结案。

**不推荐**：全局 `popstate`/`history.pushState` monkeypatch、`beforeunload` 伪装应用内确认、改 uni 私有 bundle。它们违反 Root 约束且跨浏览器不可控。

## 4. Guard 生命周期（A/B 共用设计约束）

1. 注册：仅 H5；仅页面 setup 且 `active`；记录卸载函数；模块级/页面实例标志防重复。
2. 判定：`from.path` 为 assessment，且存在未提交选择/题目，且非 `bypass`；clean 或非本页导航直接放行。
3. 取消：返回 `false`，显示现有 `leaveDestination` 确认；不导航、不写、不清草稿；`prompting` 防重复弹窗。
4. 确认：设置一次性 `bypass`，用 `router.back()` 重放浏览器返回（按钮路径仍走现有 `navigate`）；放行后清 bypass；仅在实际离开后清草稿。
5. busy：与现有 `onBackPress` 对齐，取消导航并保持提交；不弹确认、不丢请求。
6. owner/late：guard 内检查 `session.identityRevision`/`active`；owner 变化立即失效并卸载；旧 owner 的 pending 不显示、不写。
7. 清理：`onBeforeUnmount` 卸载；owner 变化卸载；页面缓存 hide 不卸载（仍为当前页）；重新进入只注册一次。
8. 兼容：保留 `onBackPress`（native/程序化 `navigateBack`）；保留页面按钮与 `navigate()` 行为；不改变已批准的 settings/home 路径。

## 5. 必测清单（未来实现后；现在全部未跑）

1. dirty 选择 + 浏览器 back → 确认框、URL 仍 assessment、草稿保留、0 写。
2. 取消 → 留在原页、草稿保留、URL 不变、0 写；再次 back 仍弹一次（不卡死）。
3. 确认 → 恰一次真实历史返回、落到实际上一页、无二次弹窗、仅离开后清草稿。
4. 取消后 forward / 再 back → URL 与状态一致，无幽灵弹窗。
5. clean 页面 back → 不弹窗，正常离开（login/home 现状不回归）。
6. busy 提交中 back → 取消导航、无确认、请求不丢；release 后 back 正常弹。
7. 快速双击 back / 连续 popstate → 单次确认、单次导航。
8. 弹窗期间 logout/owner 切换 → guard 失效、无旧 owner 提示/写、新 owner 正常。
9. 卸载/重进 → guard 只注册一次、无重复提示。
10. settings/back 按钮与现有 `navigate` 确认流程不回归。
11. native/Android `onBackPress` 仍工作（H5 不适用，NOT_RUN）。
12. 直接 hash 进入/刷新 → guard 不残留；浏览器 forward 状态正确。

## 6. 范围与风险

- 仅 H5 浏览器历史；不改 native `onBackPress`、不改 API/store/guard、不改 C4 正在编辑的 `assessment.vue`。若实现，需与 C4 作者串行，避免同文件冲突。
- `getApp().$router` 为运行时路径，升级 uni-h5 可能变化；方案 A 必须标注“未类型化、需 Root 批准”，不能写成公开契约。
- 全局 `beforeEach` 注册即使带页面谓词，仍属应用级 hook；需证明与 uni 内部 `beforeEach`/`history.listen` 不冲突（取消导航时页面栈/URL 一致）。
- KeepAlive、快速 back/forward、bypass 泄漏、owner 竞态是主要风险点，必须用真实浏览器证据判定，不能以源码推断 PASS。
- 未批准 A/B 前，结论是 **concrete GAP**：H5 dirty 浏览器返回丢草稿；C3 measured FAIL 保持，不静默豁免。

## 7. 建议

1. 若允许新增直接依赖：选 **B**（`onBeforeRouteLeave`），语义/清理最好；先做 H5-only 小样验证 injection 与 URL 回退。
2. 若不允许依赖变更：把 **A** 作为“运行时半公开 API”候选交 Root 决策，先在测试分支验证 guard 生命周期与 uni 内部 history 交互；未验证前不进入产品。
3. 两者都不批：保留 **C/GAP**，在验收中显式记录浏览器返回丢草稿，不用 `onBackPress` 的存在掩盖。

本文件只含只读证据与设计选项，不含实现，也不构成修复声明。
