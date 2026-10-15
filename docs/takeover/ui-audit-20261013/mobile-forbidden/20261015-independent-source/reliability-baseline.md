# MB005 独立只读可靠性预审

日期：2026-10-15。阶段：`BASELINE_REVIEW / CANDIDATE_FREEZE_PENDING`。

本轮只读必要源与 B8 成人响应契约，不修改正式源、共享安全规则、Git 或服务，也不运行浏览器或新测试。原始页仍为 `ea32cc53…fe4e61`；session 实读为 `d944c9e8…f8931`。完整 raw hash 见 `baseline-manifest.json`。以下结论是源码事实及风险建议，不是候选差量签收或浏览器 PASS。

## 1. 固定出口选择

| 目标 | 源码事实 | 页面实现建议 |
|---|---|---|
| `/pages/settings/settings` | `pages.json:214-218` 普通页面；不在 `235-270` tabBar | 使用当前 runtime 的 `navigateTo`，不需要 switchTab |
| `/pages/support/support` | `pages.json:228-232` 普通页面；不在 tabBar | 同上；保留认证边界，不扩大客服写权限 |
| `/pages/login/login` | `pages.json:151` 普通页面，navigation `14` 为公开页 | 退出后优先使用现有 `reLaunch`；若缺失，按实际 runtime 选 `redirectTo` 或保守 fallback，并单列历史栈是否清除的限制 |
| `/pages/profile/profile`（若仍保留） | `pages.json:266` 为 tabBar；`uni-runtime.ts:178-190` 明确区分 tab | 必须复用 switchTab 分流，不能直接 navigateTo |

`UniRuntime` 的 `reLaunch` / `redirectTo` 是可选项，`navigateTo` / `switchTab` 返回 `void | Promise<unknown>`（`uni-runtime.ts:76-79`）。H5 fallback 的 `h5Navigate` 只同步写 hash（`138-143`），所以 `await runtime.navigateTo(...)` 只在返回 Promise 的 runtime 上等待其结果；它不自动证明 hash guard、目标页加载及权限复查已经完成。正式浏览器仍需检查最终路由、页面身份及错误状态。

`navigation.ts:15-22,48-50` 将 settings/support/profile 归为 auth-only；`94-105` 的成人/撤回限制只拦学习与 onboarding。`195-209` 和 `229-249` 仍要求这些账号出口具备真实认证，但不要求 learning-ready。不要为了出口重设计而放宽共享规则，也不要把 nav 放行当作目标页所有读写都获准。

## 2. owner 与 refresh 边界

事实：`getMobileApiIdentity()` 仅检查 verifiedSubject 并返回 subject/revision（`session.ts:90-95`），不检查 authenticated。刷新期间可以仍有 subject，但 `isAuthenticated` 严格依赖 status 为 authenticated（`69-70`）。`restore()` 会先等待当前 refresh verdict（`118-123`）。

建议：账号/帮助动作先等待现有 `restore()`，再重新取得 identity 并检查 `isAuthenticated`；不能仅因 identity 非空就从 refreshing 状态继续。页面持有自己的 visible/generation/action-id；每次异步读完再核实同一 owner 与当前 action，onHide/unmount 和外部账号切换应使旧动作失效。

固定 settings/support 目标没有 owner query，所以本页晚导航的主要风险是打断新账号流程；它仍不能据此省略 owner/generation guard。目标页自己的权限复查继续生效，不在本页伪造角色或复用陈旧授权。

## 3. logout 的双向陷阱

精确事实：

1. `session.logout()` 在第一个 await 之前执行 authEpoch++、invalidateLearningIdentity，再设 revoking（`278-283`）。
2. invalidate 会立即清 verifiedSubject、增加 identityRevision、更新请求身份并清学习缓存（`341-348`）。
3. 正常成功或失败后 `clear()` 又增加 authEpoch、再次失效 identity/revision，清 token 并设 unauthenticated（`368-384`）。
4. 旧 logout 响应若遇到新 epoch，不会 clear 新会话；但成功分支仍会返回 true（`283`）。新登录会调用 clear 并在自身 epoch 下绑定新 owner（`164-183`）。

因此需要同时避免：

- **误取消正常退出**：捕获退出前的 owner tuple，await 后要求仍是同一 identity，会把本来就应清掉的 owner 当成竞态。
- **旧退出跳走新账号**：仅看 logout 返回 true 后直接 reLaunch 登录，可在 A 的旧响应到达时打断已经登录的 B；共享 store 的 epoch 保护不会替页面取消这个导航。

具体建议：调用前明确标记“本页主动退出”，容许该调用自身同步发生的空 identity 变化。await 后，只有本页仍可见、operation generation 仍有效、当前身份为空、status 确为 unauthenticated，才提交安全登录出口。出现新 owner，或新登录/刷新使 status 进入 restoring/refreshing/authenticated，应丢弃旧结果。不要把“所有 revision 变化都忽略”用于退出：外部身份变化仍需取消旧动作。

generation 与自身退出的边界必须由作者明确处理：同步 watch 不能在 `logout()` 的正常 invalidate 前缀中把自己的操作直接作废；同时新登录开始应使旧 action 失效。page-local busy 能防连续点击，但不能替代这些外部轮次检查。

返回 false 的退出路径会 fail closed 并清本地会话，`lastError` 由 store 记录（`284`）。本页应区分导航失败、本地已退出与服务端撤销未确认，不能凭 false 假装仍认证，也不能凭 true 宣称新 owner 应被退出。

## 4. 原因来源与未知状态

- B8 `status` 是兼容状态；`learningAccess` 才是服务端受保护能力 Gate，缺失/不确定应限制（`b8-auth-iam.openapi.json:4107-4122`）。
- 客户端将未知值归为 UNKNOWN，不将其归为 REJECTED（`gateway-auth.ts:97-108`）。
- 当前 owner 的资格读取失败，会将 adultGate/adultLearningAccess 置 UNKNOWN 并抛错；保持会话身份不等于授予学习资格（`session.ts:354-365`）。
- `clear()` 可保留撤回 marker（`368-384`）。该 marker 独自存在、身份为空时，不足以宣称当前已核验账号的服务端同意事实。原因展示至少区分“当前可核验账号事实”和“会话/读取尚不能确认”。

候选不得从 `returnTo`、query 的 reason、缺少 permission 或一次 503 推导“未成年被拒绝”。明确 REJECTED、撤回学习能力、通用无权、未知/暂不可读取应各有诚实说明；都不能开放学习或自动重签。未知状态仍可保留有认证的账号/帮助出口，不应强制将有效账号变成无限登录循环。

## 5. 未关闭 GAP / 冻结后检查

1. 作者尚未交冻结 page+i18n raw hash，当前不审在改差量，不签候选。
2. 冻结后只核页面 source diff：出口 API、busy/failed、键盘单次激活、onHide/owner/generation、正常退出不会被自身 invalidate 中断、晚 A 不导航走 B。
3. 真实 runtime 的 navigateTo/reLaunch Promise、void fallback、interceptor 拒绝与目标页实际就绪仍需具名浏览器证据。源码 await 不升级为 PASS。
4. 需要独立运行证据的边界：同 owner refresh pending 的账号出口、logout 200/401/503、logout 晚响应跨 B 登录、导航拒绝/hide 后回调、未知/暂不可用原因；本轮不重复测试组。
5. 新 candidate 不能直接继承旧 preaudit 的截图、上一页 MB004 或模块 29 PASS。只读结论已发 Root 与作者，等待冻结后按新 hash 复核。
