# MB-005 受限页只读预审

日期：2026-10-15。状态：`PREAUDIT_ONLY / 正式页未修改、未签收`。

## 范围与来源

本轮只读正式 `apps/mobile/src/pages/forbidden/forbidden.vue`，核对 navigation、页面 Header、现有 i18n 和 R1 门禁要求；仅本目录新增证据与计划。原页保存在 `originals/forbidden.vue`。页 raw SHA-256：`ea32cc53d929fc4b7f475ed82e2d9427813881cd4b16c928f0685bf502fe4e61`，其他输入见 `before-manifest.json` / `after-manifest.json`。

已先核对 CURRENT-PROGRESS、CURRENT-HANDOFF、dev-plan-R1。MB-005 的当前范围是 UI-PAGE-AUDIT 第 153 行的“限制说明、退出与可用出口”；不升级 R1 历史签收或 MB004 当前状态。

约束来源：

- `redesign/tasks/R1-007.md:9-16`：成人/必要同意未过时阻断学习，保留仍开放的账号、设置、隐私与客服；不扩客服/导出/删除写能力。
- `redesign/tasks/R1-009.md:9-16`：按 purpose 回收能力，保留账号和无关事实，不自行改变保留政策。
- `redesign/tasks/R1-013.md:9-16`、`business-chains.md:392`：拒绝后保留说明、支持与退出，不鼓励改资料绕门。
- `business-chains.md:408-415`：会话过期与已登录但缺权限/撤回必须分开；后者保留有效会话并说明具体受限能力，不能无限要求重新登录。

这些是本页适用子范围，非重新签署 R1-006/007/009/013。实现阶段沿用既有 ARCH-IAM-002 / ARCH-API-001 和 B8 成人/同意契约；不新增身份权威字段或法律正文。

## 源码事实

| 事实 | 精确位置 | 用户影响 |
|---|---|---|
| 页面仅根据 `adultGate === 'REJECTED'` 分支，没有读撤回标记、权限原因或状态读取失败 | `forbidden.vue:16-22` | 撤回和普通无权被混为“如果你认为这是误判” |
| 两个账号/帮助出口只对成人 REJECTED 显示 | `forbidden.vue:47-48` | 其他已登录受限用户正文建议联系帮助，却没有正文帮助入口 |
| navigation 将 profile/settings/support/devices 列为 auth-only，非 learning | `auth/navigation.ts:15-22,48-50` | 这些出口在导航层不要求学习资格；不能据此推定各页所有业务写入已开放 |
| 成人拒绝和撤回只拦 learning/onboarding | `auth/navigation.ts:94-105` | 受限页可以保留获准账号服务，不能扩大到学习入口 |
| `CONSENT_REQUIRED` 的撤回用户进入 forbidden；普通情况去 onboarding | `auth/navigation.ts:339-356` | 页面没有得到可展示的完整拒绝原因上下文，不能从 returnTo 推断角色、版权或授权事实 |
| Header 自带 kicker/H1/说明，卡片再放 eyebrow/标题/说明 | `MobilePageHeader.vue:18-22`；`forbidden.vue:36-45` | 首屏层级重复，真正原因在第二段标题下 |
| 解释、卡片标题、账号和帮助按钮为中文硬编码；只有退出按钮使用 authT | `forbidden.vue:19-21,41-49` | English 页面出现中英混排 |
| Header 说明来自 mobile-experience 的另一套通用文案；auth.forbidden 又有独立文案 | `packages/i18n/src/mobile-experience.ts:28,38`；`platform/v2-foundation.ts:28,37` | 文案入口分散，标题与业务原因未统一 |
| 返回按钮调用历史返回，没有上一页则去 home | `MobilePageHeader.vue:14`；`platform/experience.ts:57-59` | 对拒绝/撤回用户有回到受限学习页再被拦的风险；本轮未实际验证该循环 |
| logout 不持有本页 pending 状态、不检查返回布尔值、不捕获导航失败 | `forbidden.vue:26-31` | 请求期间仍可重复动作；UI 无法区分本地退出与服务端撤销未确认 |
| 卡片阴影、三块满宽按钮、重复 class/内联 rpx 间距来自旧换皮；按钮 nowrap/active scale | `forbidden.vue:38,46-49,57-77` | 需要整页重新安排信息与动作，200%/长英文潜在换行与位移风险仍待实际复验 |

## 隔离浏览器 before

独审代理已确认自有 `127.0.0.1:18183`（PID 35148）可安全复用。未启停服务；独立 Playwright browser/context，不接触其他代理 context。Browser 插件及 browser 技能未列出，按 frontend-testing-debugging 技能使用已有 Playwright Chromium。

目标路径：受限页 → 合成 IAM actor 状态 → 当前说明/出口 → 一条受控 logout pending/完成。

五个 context，390×844、reduced-motion：成人拒绝/撤回/通用权限受限三个中文亮色；成人拒绝英文亮色；撤回英文暗色。截图与 JSON 同名，另有 `adult-rejected-zh-CN-light-logout-pending.png`。

所有 `/api/v1/**` 拦截；只以合成 login 和 principal 建立临时 actor，撤回标记也是该隔离 actor 的 fixture。通用权限 fixture 只代表“已登录但无学习权限”，不声称知道真实 PDP 的具体拒绝原因。没有真实 IAM、撤回、账号、权限、客服或持久化验收；不读取 Cookie、storage、请求 body/header 或真实凭据。

结果：

- 5/5 渲染非空，无 Vite overlay，0 pageerror、0 console error，390px 下无横向溢出。
- 明确设置现有 i18n/theme adapter 后确认真实 `en-US` / `dark`；英文 Header 和退出按钮已翻译，卡片标题/解释/两个账号出口仍中文。
- 撤回与通用权限 fixture 的说明和正文出口完全相同；成人拒绝有账号/帮助出口，其他两个已登录 actor 没有。
- logout 真点击后阻塞拦截请求：页面没有 aria-busy，5 个按钮均未 disabled/aria-disabled，标签不变；释放 204 后到登录路由。这不是服务端撤销成功证据。
- 主退出控件可获得键盘焦点。未跑键盘激活重放、出口业务页、真实读屏、200%、平板/原生端、系统/高对比主题或颜色对比认证。

第一轮只提供 URL 参数，没有真正切换此旧页的语言/主题。该次截图/JSON 原样留在 `query-only-attempt/`；它是测试设置问题，不作为产品语言/主题失败。最终证据明确记录 adapter 的 actualLocale/actualTheme。

## 交接

建议整体布局与状态设计见 `implementation-plan.md`。Root 完成 MB004 单页推送后再认领 MB005 正式源。当前目录不构成 UI 签收或发布证据；此前页面和 R1 结果不迁移到新设计。
