# MB-001 — Mobile 登录页逐页重设计与复验

> **2026-10-15标题窄补修**：实际恢复/退出转回登录时捕获setNavigationBarTitle page not found，已独立定位为login onShow过早调用，正式源仅移到onReady。当前0c5 raw获中英8标题及3恢复边界独审、typecheck/H5 build通过，未改原排版/认证/键盘；[收口与证据](20261015-title-lifecycle/root-review.md)。推送收据由Root另录，原具名PASS/FAIL保留。

> **2026-10-14当前键盘差量**：原da5空主按钮Enter跳过账号首错已真实复现并保留FAIL；当前1d347967局部keyup提交获[17项独立复签](20261014-1d34-independent-keyboard/review.md)与[root收口](20261014-1d34-independent-keyboard/root-review.md)，typecheck通过，PUSHED_SCOPED，提交`70ad42f41c844708400ca18ec1a87c95976649f1`已推origin/dev-redesign且远程SHA一致。无布局变更，本次不重签原26矩阵或真实IAM/native范围。

日期：2026-10-14（北京时间）。正式入口：`http://127.0.0.1:18183/#/pages/login/login`。

作者结论：`PASS_UI_SCOPED_NOT_BUSINESS_ACCEPTANCE`；独立复审结论见 [independent-review.md](independent-review.md)。当前签收范围为 Mobile H5 登录页的排版、响应式、主题、表单语义及受控认证失败交互。提交、推送与远程收据由主 Agent 记录如下，不宣称实时部署。

主Agent推送收据：源码、证据与本页记录提交 `c6208c0a00a4e6ea80b4479f8e20ab6bea4aa389` 已推送 `origin/dev-redesign`，随即 `ls-remote` 返回同一SHA。本收据不表示服务部署或真实后台业务重签。

## 证据版本与范围

- [2026-10-13 原始 results.json](results.json) 保留 `FAIL`：24 个主题/宽度/语言组合通过后，空提交的实际原生输入 `aria-invalid` 为 `null`，整页尚未验收。旧截图和失败记录未覆盖。
- [2026-10-14 run1/results.json](20261014-run1/results.json) 为本轮最终结果，含当前源文件 SHA-256、26 个矩阵记录、交互断言、请求路径及双阶段等待结果。本轮早期结果另外保存在 `results-initial-pass.json` 与 `results-strict-before-two-stage.json`。
- 设计依据为 [正式页面简约重设计方向](../DESIGN-DIRECTION.md)、[已批准登录概念](../learner-login-redesign/concept.png) 和 [正式 Web 390px 登录截图](../learner-login-redesign/login-390-light.png)。概念中的浏览器外框不属于正式页面；uni-app 控件按平台实现。
- 追溯现有 R1-004 / R1-015、BC-004、IC-053 登录与安全返回边界。本页 UI 签收不能补齐真实 IAM、同意/资格查询或业务链证据，也不改变历史 R1 签收状态。

## 修复与实现

1. 将登录主任务整理为开放单列：品牌、成人说明、标题、简短说明、账号、密码、找回密码、登录、注册出口。移除装饰卡、艺术字、重复状态框和未发生操作时的等待反馈。
2. 真实密码眼睛命中区为 44×44px，图标为 19px；正常字号标题 28px，说明/标签 14px，原生输入和主按钮 16px。字段保留清晰可见的焦点态，提交等待禁用所有相关控件，阻止重复请求。
3. 将 grid/gap 设在明确的 `.login-fields` uni-view 容器。uni-form 的内部 span 包装曾使表单上的 gap 无效；修复后账号与密码、密码区与主按钮的实际几何间距均为 24px，断言检查真实坐标。
4. 保留 uni-input 的 model、focus 和 password 属性，在 H5 条件编译内将 name、autocomplete、标签、required、错误关联及 ARIA 补到真正的 `.uni-input-input`，而非只贴在 uni 包装节点。H5 眼睛 `aria-controls` 指向实际密码输入。
5. 修复动态语义同步的生命周期缺口：旧页面 `onUpdated` 在嵌套 uni-view/form slot 更新时没有触发，输入节点身份未变、稳定后仍缺少错误属性。见 [原生属性时序](20261014-run1/before-aria-timeline.json)、[生命周期记录](20261014-run1/before-lifecycle.json) 与 [失败截图](20261014-run1/before-required-390.png)。当前使用受控 `watch` 的 `flush: post` 和 `nextTick`，覆盖输入、错误、忙碌、焦点、密码切换及翻译标签；没有用固定延时掩盖断言。
6. 高对比主题将 V2 色板桥接到现有共享 `--yx-*` 语义变量，使用既有品牌色和反色，取消重阴影；未新增品牌色。登录顶部消费与 Web 相同的四角品牌图标。
7. 移除页面对 `session.login` 额外设置的 10 秒 race，沿用 API 客户端每次请求的受控超时。IAM 登录与权限读取是两段顺序请求，旧 race 会在总耗时超过 10 秒时提前解锁并报错，而原请求仍继续；公共入口恢复会话的独立短超时保持原有范围。未改 session store、接口或认证状态规则。

共享文案与图标由主 Agent 在 `packages/i18n/src/mobile-experience.ts`、`apps/mobile/src/theme/v2-icons.ts` 补齐，本页仅消费。账号密码、成人 Gate、安全存储、IAM 路由和导航业务边界保持既有实现。

## 视觉对应检查

| 验收项 | 当前正式 H5 结果与证据 |
| --- | --- |
| 开放单列与宽度 | 无装饰外卡；表单最大 420px，320px 视口内容宽 272px，纵向组织主任务。见 [320 亮色](20261014-run1/login-320-zh-CN-light.png)、[390 亮色](20261014-run1/login-390-zh-CN-light.png)、[768 亮色](20261014-run1/login-768-zh-CN-light.png)。 |
| 字体与层级 | 正常无衬线 28/14/16px 层级，输入实际计算字号 16px；中文与英文 200% 放大后可换行、滚动。见 [中文 200%](20261014-run1/login-390-zh-CN-text-200.png)、[英文 200%](20261014-run1/login-390-en-US-text-200.png)。 |
| 品牌与图标 | 顶部四角品牌 25px，与已落地 Web 一致；密码图标 19px，真实 44×44px 命中区。 |
| 色彩与主题 | 继续使用共享紫色与语义色。亮、暗、跟随系统、高对比均实测；[暗色](20261014-run1/login-390-zh-CN-dark.png)、[高对比](20261014-run1/login-390-zh-CN-high-contrast.png) 文字清晰，错误还有文字表达。矩阵最小标题/说明/主按钮文字对比分别为 14.17/5.50/8.00。 |
| 动作顺序与间距 | 找回密码位于密码下方，注册出口位于主按钮之后，字段与主动作真实间距 24px。没有默认等待框；等待与错误只在相应操作发生后出现。 |

作者将当前 390px 亮色、高对比及英文放大截图与已批准概念、正式 Web 截图共同目检；独立审者另检查 1280px 与字段几何。本页采用同一设计体系的移动适配，保留成人说明和共享 Mobile 文案。

## 验证结果

自动化使用隔离 Playwright Chromium 上下文。当前 Browser 插件不可用，故使用项目现有 Playwright；HTTPS 保持严格默认校验。所有 `/api/v1/**` 请求完全拦截，未使用真实账号，不读取敏感存储、Cookie、请求 body、认证 header 或 token。

- 320/390/768px × 中文/英文 × 亮/暗/高对比/跟随系统共 24 组通过，另含中英文 200% 字号两组；无横向溢出，系统主题偏好实时切换有效，所有交互命中区至少 44px。
- 空提交正确关联字段错误并聚焦第一个缺项；输入和失焦只清除已修正的字段错误。翻译适配器切换后实际原生标签同步，眼睛切换后输入值和语义保留。见 [必填错误](20261014-run1/login-required-error.png)、[键盘焦点](20261014-run1/login-keyboard-focus.png)。语言切换测试使用公共适配器 fixture，不宣称登录页有可见语言切换器。
- Tab、账号 Enter 到密码、眼睛 Enter/Space、密码 Enter 提交均通过；忙碌期输入、按钮和导航出口禁用，重复触发仅一次 IAM 请求，恢复后语义正确；服务失败反馈不会在编辑时凭空消失。见 [忙碌](20261014-run1/login-busy.png)、[拒绝反馈](20261014-run1/login-server-rejection.png)。
- 单段 6 秒负向请求保持忙碌至 401；双阶段 fixture 分别等待 5100ms，两段均低于客户端 8000ms 单请求超时。第一段仅返回无效 dummy 串且不记录其内容，权限阶段返回 503，未产生 authenticated session。在 **10058ms** 检查点仍 busy 且无 alert，**10267ms** 后才解锁并显示「登录没有完成，请稍后重试。」。见 [最终结果](20261014-run1/results.json)、[双阶段失败截图](20261014-run1/login-two-stage-neutral-error.png)。这证明前端等待状态与中性失败反馈，不证明真实认证成功。
- 320×460px 短视口可纵向滚动至下方出口，见 [短视口英文](20261014-run1/login-320-english-short-viewport.png)。不以此替代物理软键盘覆盖测试。
- `pageErrors` 为 0；浏览器 console 中仅预期 fixture 的两次 401、一次 503 资源错误。
- `pnpm --filter @englishflow/mobile typecheck` 通过；`pnpm --filter @englishflow/mobile build:h5` 通过。构建保留既有配置加载、Sass @import、动态 session chunk 与插件计时警告，无新增阻断错误。此前同页阶段的 IAM transport/public-auth-handoff 既有测试 5/5 通过；本轮不把这些测试当成真实后台认证证据。

最终 UI 脚本为 `apps/mobile/tests/ui-login.e2e.cjs`。默认输出至 `.git/codex-local-backups/mobile-login-<timestamp>`，避免覆盖历史记录；本轮显式设置 `UI_AUDIT_OUTPUT=docs/takeover/ui-audit-20261013/mobile-login/20261014-run1`。源码、Token、共享依赖与脚本的 SHA-256 全部存于最终结果并核对当前文件一致。

## 交接边界

当前页面源码 SHA-256：`1f16e4a3588e4a26ac02f126692621a7846918cf55734263eac2bd8567a1891f`。作者修改白名单为 `apps/mobile/src/pages/login/login.vue`、`apps/mobile/src/theme/v2-tokens.scss`、`apps/mobile/tests/ui-login.e2e.cjs` 和本页证据目录；完成最终复验后未继续修改源文件。

作者自有 Mobile H5 服务仍保留给复审：执行 session `20908`，监听 PID `7400`，固定 `127.0.0.1:18183`，进程命令为本项目 uni H5 开发服务并带 strictPort。未停止其它共享服务。

未验证真实 IAM 成功/成人 Gate 后完整业务返回、原生 iOS/Android/小程序、物理软键盘、系统读屏及所有其它 Mobile 页面。高对比 Token 桥接属于共享适配，其余页面需按逐页队列复验；本页通过不迁移其它页面或 R1 业务完成状态。后续由主 Agent 核对最终差量、完成本页提交与远程收据后再进入 MB-002。
