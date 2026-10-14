# MB-002 — Mobile 注册页逐页重设计与复验

> **2026-10-15最新补修**：当前9258正式注册源已获[作者34矩阵及契约/手势报告](20261015-contract-followup/report.md)、[44项独立风险复签](20261015-9258-independent-final/review.md)与[root收口](20261015-9258-independent-final/root-review.md)，typecheck/H5 build通过；PUSHED_SCOPED，提交`4b3a40f17e555c7232391907763bc5edc1c3aa7d`已推origin/dev-redesign且随后远程SHA与HEAD一致。新账号/密码长度提示、不截断、错误自然高度及primary键盘修复已在真实H5运行，旧FAIL与缓存裸key FAIL保留。下文既有设计/收据为历史具名范围，不覆盖本次差量。

日期：2026-10-14（北京时间）。正式入口：`http://127.0.0.1:18183/#/pages/register/register`。

作者结论：`PASS_UI_SCOPED_NOT_BUSINESS_ACCEPTANCE`。最终 [results.json](20261014-run1/results.json) 有 34 个矩阵记录、具名交互检查和源文件 SHA-256。独立签收由主 Agent 在 [independent-review.md](independent-review.md) 记录；本报告不代替最终提交、推送收据或实时部署验证。

11:10续做后的[最终独立视觉复审](20261014-final-review/review.md)签`UI_SCOPE_PASS`：冻结源32矩阵、38图目检与320英文200%两行纠错自然高度、真实pointer click均通过。此前具名动态独审保持；根Agent查看390默认与320英文200%清理截图后接受本页UI范围，待单页推送收据。

本页单独提交`4968bc766d0102199737491bd06f36d673dc755d`已推送origin/dev-redesign，随后ls-remote返回同一SHA。根收口检查另发现文件EOF多一个空行，随后仅移除该空行，剔除文件末尾换行后前后文本完全相同，范围diff-check通过；源码当前原始SHA-256为`e2115e12d993ceba294afe60933a6e5d8ad0d8916b210daa4e6052ff3cf8782f`。所有原UI证据仍保留已验源`46171faa…`哈希，不覆盖历史或为EOF格式清理重复全矩阵。没有改Vue逻辑、样式、文案或控件。

## 现状、设计与改动

[修改前截图](20261014-run1/before-390.png) 与 [修改前观察](20261014-run1/before-observations.json) 从具名本地备份复制保留：重复注册 hero、装饰品牌、卡内标题与说明将主动作推到约 831px；实际原生输入缺少 id/name/标签，autocomplete 为 off；空提交停在按钮，没有聚焦缺项。

本页沿用 [正式设计方向](../DESIGN-DIRECTION.md)、[已批准认证概念](../learner-login-redesign/concept.png)、[正式 Web 注册 390px](../learner-register/register-390-light.png) 和已验 Mobile 登录页。采用平台内 uni-app 控件与已有 Token，不引入新框架、品牌色、存储或接口。

- 移除重复 hero、装饰卡与艺术字，保留一个创建账号主标题、成人说明和短描述。开放表单上限 420px，正常标题 28px、描述/标签 14px、输入/主按钮 16px；密码规则以 13px 紧贴密码，登录出口位于主按钮之后。390px 中文主按钮 top 实测 **564.45px**。
- 字段明确包在 `.register-fields` uni-view grid 容器，三字段间及确认密码到主按钮的实际间距均为 24px，避免 uni-form 内部 span 包装破坏 gap。
- 双密码显示均使用既有 eye 图标 19px 和真实 44×44px 控件；顶部使用既有四角品牌 25px。亮、暗、高对比与系统主题消费已验共享色板，不修改 Token 文件。
- 逐字段必填、密码至少 12 位与确认不一致错误，聚焦首个错误。空确认使用「请再输入一次密码」，与 mismatch 区分；修正后移除错误 ARIA。服务端失败独立中性反馈，编辑不自动隐藏未处理的失败。
- H5 条件编译桥接真正原生 input 的 id/name、username/new-password autocomplete、可访问标签、required、password minlength、错误关联。用受控 watch `flush: post` + `nextTick` 覆盖输入、主题外语义、焦点、显隐、忙碌和语言变化；其余平台保留 uni-input 模型及焦点能力。眼睛关联真正密码输入。
- 提交锁定三输入、双眼睛、主按钮及登录出口；busy 时字段同步和 label 焦点操作也受保护。等待已有 `session.register` 及 `continueAfterLogin`，catch 将异常映射为中性文案，finally 恢复交互，没有新增页面 Promise.race。
- 使用既有 `safeMobileRouteReturnTo` 处理 uni 页面查询的二次编码；去登录时携带安全 returnTo。IAM 注册、权限快照、成人 Gate 和系统安全存储继续由既有业务模块负责。

注册共享中英文文案由主 Agent 修改 `packages/i18n/src/mobile-experience.ts`；作者只消费这些 key，没有改共享文案、图标、Token 或其它页面。

## 修复中的真实失败与回归

本轮首先发现预 bundle 仍含旧共享文案，页面显示 `mobile.auth.register.title` 等原始 key。核对原自有 PID7400 的完整项目命令后，仅重启本人的 Mobile H5 服务并启用 `--force`，固定 18183；未停止其它服务。重新打开隔离上下文后文案正常。

32 组正常布局通过后，严格交互发现 uni-h5 的输入模型更新节流 100ms：`short` 改为合规密码后立即点击提交，页面仍按旧值聚焦密码。见 [第一次失败结果](20261014-run1/results-before-focus-check.json)。本地 uni-h5 `useValueSync` 与表单 field 的即时 state 实现支持此定位。

当前通过跨端组件事件同步即时值：具名 form 的 `detail.value`，blur/confirm 的当前字段值；缺少 detail/value 时保留已有 refs，非字符串不覆盖，busy 时拒绝同步。没有读取 DOM.value 或用固定等待掩盖问题。

即时 blur 同步还暴露第二个问题：纠错文字消失使按钮在 pointerdown/up 间移位，点击没有提交。见 [第二次失败结果](20261014-run1/results-before-focus-settle.json)。发生校验后保留该字段上一条错误全文的自然布局高度，以 `visibility: hidden` 和 `aria-hidden` 隐藏已修正文案，并移除 alert role/输入错误关联；初始不创建错误占位或等待框。多行错误的自然高度也保留。

[最终结果](20261014-run1/results.json) 保留严格「short → 合规值立即点击」、「合规密码 → 空立即点击」及「合规确认 → 空立即点击」断言，证实首错焦点、当前语义和零错误请求。中间已通过结果另保留为 [results-before-rapid-clear.json](20261014-run1/results-before-rapid-clear.json)，不把早期矩阵通过当整页完成。

## 验证与视觉对应

隔离 Playwright Chromium；当前 Browser 插件不可用，使用现有 Playwright，HTTPS 保持严格默认验证。所有 `/api/v1/**` 请求完全拦截，使用合成账号与失败/成人 REQUIRED fixture；不读取敏感存储、Cookie、请求 body/header 或 token，不输出这些内容。

| 验收维度 | 当前证据 |
| --- | --- |
| 布局与设计对应 | 320/390/768/1280px × 中英 × 四主题，共 32 组通过；单标题、无装饰卡/idle 状态、420px 上限、三输入真实 16px、间距 24px、无横溢出。作者共同目检正式 Web 与 [390 亮色](20261014-run1/register-390-zh-CN-light.png)、[高对比](20261014-run1/register-390-zh-CN-high-contrast.png)、[英文放大](20261014-run1/register-390-en-US-text-200.png)，开放布局、层级、图标、紫色语义与动作顺序一致；Mobile 成人及共享字段文案按平台资源保留。 |
| 色彩与控件 | 标题/说明/密码规则/主按钮文字的矩阵最小对比分别为 14.17/5.50/5.50/8.00；所有按钮命中区两维至少 44px。系统主题实时偏好切换通过。 |
| 输入语义与错误 | 空提交、短密码、空确认、mismatch、即时修正/清空、失焦、语言适配器切换、label 点击、双显隐、busy 与恢复后原生 name/autocomplete/标签/invalid/describedby 持续正确。见 [必填](20261014-run1/register-required.png)、[不一致](20261014-run1/register-mismatch.png)。语言切换是公共适配器 fixture，不宣称页面有可见语言选择器。 |
| 键盘与等待 | Tab 可见焦点；账号 Enter 到密码、密码 Enter 到确认，双眼睛 Enter/Space、确认 Enter 提交；busy 所有出口禁用，重复提交一次请求，恢复后可重试。见 [焦点](20261014-run1/register-keyboard-focus.png)、[busy](20261014-run1/register-busy.png)。 |
| 失败与返回 | 409 使用中性注册失败文案，429/503 正确映射；拒绝后编辑保留服务错误并可再次提交。单/双编码合法深链去登录后保留，外部 URL 回退 home。见 [中性反馈](20261014-run1/register-conflict-neutral.png)。 |
| 成人边界 | 全 API 拦截的合成注册响应使用无效 dummy 凭据、合成权限主体和 REQUIRED Gate，只验证进入既有 onboarding 而非学习页。见 [fixture 导航](20261014-run1/register-synthetic-adult-gate-route.png)。这是 UI 路由证据，不是 IAM 成功或成人资格验收。 |
| 放大与滚动 | 中英文 200% 字号两组通过（矩阵共 34 条），原生输入变 32px、无横溢出、下方出口可到达；[320×460 英文短视口](20261014-run1/register-320-short-viewport.png) 可纵向滚动。 |

页面异常为 **0**；console 仅 fixture 的一次 409、429、503 和两次 401 资源错误。`typecheck` 与最终 `build:h5` 均通过；H5 构建保留既有配置加载、Sass @import、session 动态 chunk 与插件计时警告。`iam-auth-transport`、`public-auth-handoff`、`adult-gate-policy-version`、`adult-consent-copy` 共 **10/10** 通过。

共享注册文案修改后的 MB-001 完整回归由主 Agent 执行，具名本地结果 `.git/codex-local-backups/mobile-login-after-register-copy-20261014/results.json` 为 UI scope PASS。其后发现的登录快速清空问题由另一独占任务补修，不能用该早期回归记录覆盖后续差量；本页不修改登录源或证据。

## 交接与限制

最终注册页 SHA-256：`46171faacf15f103dd3063568cd0f903d10825ca283bd7dc674571c0073d76bd`。最终 results 的八项源文件/共享依赖/脚本哈希与当前文件一致。作者白名单仅 `apps/mobile/src/pages/register/register.vue`、`apps/mobile/tests/ui-register.e2e.cjs` 和本页证据目录；未操作 Git、索引或 CHANGELOG。脚本默认输出到 `.git/codex-local-backups/mobile-register-<timestamp>`；本轮显式输出到本页 `20261014-run1`。

自有预览服务保留给复审：session **31852** / PID **9820**，固定 `127.0.0.1:18183`，项目 `uni -p h5 --strictPort --force`。原 session20908/PID7400 已因本页文案缓存被本人核对后替换。

未验真实 IAM 成功、真实成人确认后的学习闭环、原生 App/小程序、物理软键盘、系统读屏及其它页面。await 导航与 catch 的实现边界经源码审查；没有注入专门导航异常的浏览器 fixture。文本放大截图证明网页滚动，不代表物理输入法或读屏通过。本页 UI scope PASS 不能迁移 R1 业务完成状态；最终独立复审、逐页提交和推送由主 Agent 收口。
