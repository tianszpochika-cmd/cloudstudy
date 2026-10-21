# MB006 C6b checkpoint — C6 静态审 4 项修正（候选，未验收）

日期 2026-10-21。仅 `apps/mobile/src/pages/assessment/assessment.vue` + 本目录证据。未改测试/其他产品/Git/服务/浏览器；不宣称 PASS。

## 1. 修正（对应 Root 4 点）

1. **permit 归属**：`takeNavigationPermit` 现在要求 `permit.operation === operation` 且 `permit.revision === session.identityRevision`；不匹配立即 `clearNavigationPermit(permit.operation)`，新 owner/新 operation（含 void 导航后的 begin/load/submit）不会继承旧 permit。
2. **back 目标显式化**：`NavigationPermit` 增加 `target`。`navigate()` 在执行前解析真实内部目标：`back` 且存在非 auth 前页且 runtime 有 `navigateBack` → 该前页规范化路径；否则 `/pages/home/home`；settings/home/today 用固定路径。guard 用 `normalizeInternalPath(to.path) === permit.target` 精确匹配，`back` 不再放行任意路由。
3. **navigateBack 绑定**：删除 `const back = runtime.navigateBack; back(...)`，改回方法调用 `runtime.navigateBack({ delta: 1 })`（`allowingBack` 的 try/finally 保留），`this` 绑定不变。
4. **超时/void 诚实化**：permit 过期改为 4000ms（与既有导航超时一致）。到期时仅当 permit 仍属当前 operation/revision 且 `active`，才清 permit 并置既有 `errorKey='navigationUnconfirmed'`；旧 timer 按 operation 匹配，不会清新 permit。guard 消费、`invalidate()`/hide、拒绝/失败、超时各自清理。`beforeunload` 的 permit 豁免也要求当前 operation+revision，不再只看 owner。

## 2. 保留不变

C5b route guard 的 cancel/confirm 语义、C5c beforeunload 的 dirty/busy 文档卸载提示、C4 CSS/copy、native `onBackPress`、`runtime.navigateBack` 调用点、4.4.4 直依赖与 lock/package 均保持。无 history/popstate/私有 `$router`/全局 guard。

## 3. 冻结

- 编辑前归档在 `dsh-20261021-c6/baseline/`：C5c page `719cc0ce…b6fe81c1`、C6 首版 page `51b896bc…a107f16f`（`assessment.vue.c6.raw` 未覆盖）、i18n/package/lock 原字节 + 四哈希。
- C6b：`assessment.vue.c6b.raw` raw=LF=`ac8fb8d2831f4d5f1f20091e09abef7cc6a1314021545ecbbb84a31d11f157fd`（40572 bytes）；四哈希见 `c6b-source-hashes.json`：page 同左、i18n `6ac6800e…`、package `484382c7…`、lock `d57a87ca…`（package/lock/i18n 未变）。

## 4. 执行与 NOT_RUN

- `pnpm --filter @englishflow/mobile typecheck`：exit **0**。
- 浏览器/Native/小程序/partial-runtime（`navigateBack` 缺失、void 立即完成、switchTab 不经 router guard 等分支）：**NOT_RUN**；本任务禁止浏览器/探针。
- 构建：NOT_RUN；C5 阶段 `build:h5` 仍为预存在 estree-walker/EPERM 环境阻塞（历史日志，未复跑）。

## 5. 风险（未由本文件解决）

- 4s 内若某 runtime 的 void 导航既不触发 guard 也不触发 hide，仍会在到期时报 `navigationUnconfirmed`（诚实报错，但属误报窗口，需 Root 实测定夺）。
- `back` 目标从前页快照解析；若 uni 栈在 arm 与 guard 之间变化，guard 精确匹配可能不消耗 permit（回退为阻断而非误放行）。
- 未声明 native/iOS/Safari 或任何未跑分支通过；页面 source 仍为候选，Root 复核后再冻结测试。
