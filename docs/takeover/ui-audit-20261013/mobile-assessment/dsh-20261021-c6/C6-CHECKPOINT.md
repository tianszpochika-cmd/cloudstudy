# MB006 C6 checkpoint — clean page-UI navigation permit（候选，未验收）

日期 2026-10-20/21。仅改 `apps/mobile/src/pages/assessment/assessment.vue`。不宣称 PASS；C5c 证据与旧 dirty 保留。

## 1. 被修的实际回归

`risk/runs/codex-20261021-c5c-leave-1`：accepted 1、choice 已清后点 header back，页面停在 assessment 且出现 pageerror。源码根因：`navigate()` 先置 `pending='navigate'`（busy=true），H5 `onBeforeRouteLeave` 在 busy 处返回 false；而一次性 `routeLeaveBypass` 只在 `confirmLeave()` 的 dirty 路径设置，clean 的 settings/home/back/today 自阻。

## 2. 改动（精确）

- 删除长驻布尔 `routeLeaveBypass`；改为页内一次性 permit：`{ operation, revision, destination }`（`NavigationPermit`），存储于 `navigationPermit`。
- `navigate()` 在 `active/busy/current` 检查通过、`pending='navigate'` 之前 `armNavigationPermit({operation: request, revision, destination})`；**不在 finally 清除**（void/已 resolve 的 `navigate()` 不能证明 router guard 已跑）。catch/拒绝时 `clearNavigationPermit(request)`。
- permit 消耗点仅两处：H5 guard 的 `takeNavigationPermit(to)`（校验同一 `session.identityRevision` 且目标匹配 settings/home/today，`back` 匹配任何内部目标）；`invalidate()`/owner 变化/隐藏（经 `invalidate`）/2s 超时/失败清除。
- 清除按 `operation` 归属校验：旧 async 结果/旧 timer 不会清掉新 owner/新 operation 的 permit；owner 变化先 `settleRouteLeave(false)` 再 `invalidate()`（旧草稿/旧确认不跨 owner）。
- 浏览器 back 在无 permit 时仍走 C5b：busy → false（无确认、不丢请求）；dirty → 单次确认+focus；clean → 放行。`beforeunload` 仍仅在 dirty 或 submit/retest 在途时触发，permit 在途时不重复警告。
- C4 CSS/copy、native `onBackPress`、`runtime.navigateBack({delta:1})` 绑定、4.4.4 直依赖与 C5b route guard 语义均未改。

## 3. 冻结/执行

- 编辑前已归档到 `dsh-20261021-c6/baseline/`：C5c page raw `719cc0ce…b6fe81c1`（未覆盖）、i18n/package/lock 原字节与四个哈希（`c5c-four-hashes.json`）。
- C6 `assessment.vue` raw=LF=`51b896bcb7388df8522a76725e5e9a9ed8ca355aaf01fb2a6266ce8fa107f16f`（39374 bytes）；i18n/api/store/session/navigation 哈希不变；package `484382c7…`、lock `d57a87ca…` 不变（vue-router 4.4.4）；`c6-source-hashes.json`。
- `pnpm --filter @englishflow/mobile typecheck`：exit **0**。
- 浏览器/原生/构建：**NOT_RUN**（本任务禁止；C5 阶段 `build:h5` 仍为预存在 estree-walker/EPERM 环境阻塞）。

## 4. 风险与待 Root 实测

- 若某运行时 `switchTab/navigateTo/navigateBack` 在 router guard 运行前就同步失败且不抛错，permit 会在 2s 后过期而非立即清；窗口内若恰好发生真实 browser back 可能被误放行（概率窗口 2s，且 operation/owner/target 均需匹配）。
- `back` 的 permit 目标为任意内部路由（先前页未知），理论上可被同窗口的 browser back 消耗；Root 需实测重复/竞争。
- 待测：clean header back/home/settings/today 实际落点与 0 pageerror；dirty 确认不二次弹窗；busy 仍阻断；owner/隐藏/超时后无陈旧 permit；native `navigateBack` 不自阻；beforeunload 仅 dirty/busy 文档卸载时原生提示。未声明 native/iOS/Safari 或未跑分支通过。
