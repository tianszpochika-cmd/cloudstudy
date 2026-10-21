# MB006 C7b checkpoint — C7 静态退修（候选，未验收）

日期 2026-10-21。仅 `apps/mobile/src/pages/assessment/assessment.vue` + 本目录证据。未改测试/共享/Git/服务；浏览器仍 **NOT_RUN**，不宣称修复或签收。

## 1. 三项更正

1. **移除错误判据**：`isMobileLearningPath` 实际只排除 PUBLIC/AUTH_ONLY，assessment/home/today 与未知 path 都返回 true，不能充当“可达前页”。已删除该 import 与判据。H5 页内 back 现在**始终** `switchTab('/pages/home/home')`（与独立 home 按钮一致）；不读 uni 栈猜 history、不重放 delta。Native 仅当存在前页、前页不等于本页、且不是 auth 落地页时 `navigateBack`（`runtime.navigateBack` 仍为方法调用绑定）。
2. **afterEach 只在公开事实确认失效**：回调 `(to, from, failure)`，仅当
   - `to.path === '/pages/assessment/assessment'` 且 `failure === undefined` 或 `isNavigationFailure(failure, NavigationFailureType.duplicated)`（用户 forward 回到本页），或
   - 成功离开本页（`failure === undefined && to.path !== 本页`）
   时，才 `settleRouteLeave(false)`、清 `leaveDestination`、`focus('assessment-submit')`；`aborted/cancelled` 等其他离页拒绝**不清**第一确认框。保持 `active`+prompt 归属判断；`onBeforeUnmount(remove)` 注销，无全局常驻 guard 与 history/popstate patch。
3. **探针描述更正**：不再建议 `getApp().$router` 或内部 operation/revision 日志；只保留 public `getCurrentPages().map(p => p.route)` 与 DOM/`location.hash`。

## 2. 改动行为摘要

- H5：页内 back（无论是否有选择、前页是什么）→ 学习首页；permit `target` 与实际分支同源（home），exact target + operation/revision 校验不变。
- Native：可用前页 → `navigateBack`；本页/auth 前页/无前页 → home。
- forward 自动取消旧 prompt 并保留草稿；下一次真实 back 重新确认；确认无操作不视为 PASS。
- busy/owner/exact permit/beforeunload 安全边界与 C4 CSS/copy 未改。

## 3. 分析未变（不实施）

relogin recovery 2 FAIL + pageerror `Object` 仍为 **ANALYSIS_ONLY**：`page.goto` 同源 hash 不保证 full-document reload，再次 login 会翻 owner revision/清 store（详见 `C7-CHECKPOINT.md` §4）。不改测试/产品，不声称修复。

## 4. 冻结与执行

- 旧 C7 原字节保留：`dsh-20261021-c7/assessment.vue.c7.raw` = `92e7e11090c046985e5e1a4cb83a8e5249e479f022efd69aea42774125b3937b`（未覆盖）；C6b `ac8fb8d2…f157fd` 亦保留。
- C7b page raw=LF=`37bad477e4239061972941c42b24468db5994b8afb89feb61f720fbe168c07e5`（42425 bytes）。
- 四哈希 `c7b-source-hashes.json`：page 同左、i18n `6ac6800e…`、package `484382c7…`、lock `d57a87ca…`（后三未变）。
- `pnpm --filter @englishflow/mobile typecheck`：exit **0**。
- 浏览器/Native/小程序/partial-runtime/构建：**NOT_RUN**（本次未执行；不引用旧构建阻塞作为当前事实）。

## 5. 风险

- H5 页内 back 不再回到真实上一页（含学习页），这是本次 Root 指定的固定 UX；native 分支未实测。
- afterEach 的 `leftPage` 成功离开分支在页面已隐藏后才触发，通常 prompt 已 settle；若出现异常时序，仅清旧框，不写产品数据。
- 未声明 iOS/Safari 或任何未跑分支通过。
