# V2 UI 逐页审查索引 — 2026-10-13

> 分支：`dev-redesign`。本轮拉取后的源码观察基线：`4990dd29`；R1 原有签收基线：`7a6ac0a2`。时间口径：Asia/Shanghai。
> 用户已明确改为全部正式页面简约重设计。LW-001/LW-002/LW-003分别推送`182e106b`/`60858fbc`/`5cd40e35`且远程SHA一致；MB-001在审，其余PENDING。额度已用90%暂停，下一周期先续MB-001，见[暂停交接](ui-audit-20261013/PAUSE-HANDOFF.md)。旧70c2623f仅为前轮缺陷修复。

## 1. 进度与证据边界

- [CURRENT-PROGRESS](../06-design/v2-980plus/redesign/CURRENT-PROGRESS.md)仍是当前进度入口；本表只记录第二版正式 UI 的逐页审查与推送收据。
- 已核对 [LUNA-SIGNOFF](LUNA-SIGNOFF.md)：R1 IT-1…IT-7、R1-001…115 与全链在 `7a6ac0a2` 获签收。早于该账的 REJECT、BLOCKED、`lunaStamp=false` 原件保留，不回写。这份 R1 业务签收不自动完成 `4990dd29` 后续 UI 差量审查。
- [FEATURE-AVAILABILITY](FEATURE-AVAILABILITY-20261013.md)仍写 admin 修复未部署及旧镜像；[CONTENT-OPS](CONTENT-OPS-20261013.md)页首写未部署，而文末追加 `3e77e636` 合并/部署记录；[SUPPORT-GOVERNANCE](SUPPORT-GOVERNANCE-20261013.md)页首写未部署，而后文追加 `e61829ff`、`9d7e87a3` 部署记录。这些有时态差异的历史记录不能单独证明实时运行版本。
- 每次浏览器验收须记录实际 URL、时间、页面/资源版本可核验信息及环境。当前索引没有执行实时部署核验，不宣称本机或线上部署状态。
- **当前页 review scope ≠ 业务 PASS。** 当前源码、渲染、交互和视觉局部验收分别记录；构建、类型检查、HTTP 200、页面数量或历史 R1 签收不能替代当页真实业务/API/owner 数据证据。局部 UI 完成不改历史业务签收。
- 本轮产品阶段仍为 Phase 1。关闭能力、成人门、鉴权和配置边界按当前契约与事实解释，不为消除禁用控件擅自开放功能。

## 2. 范围与排队口径

| 正式端 | 路由事实源 | 唯一页面源组件数 | 当前处理方式 |
|---|---|---:|---|
| learner-web | [apps/learner-web/src/router/index.ts](../../apps/learner-web/src/router/index.ts) | 30 | 首页登录在审；33 个带页面的路由记录及其别名、设置分区、重定向逐项追溯 |
| mobile | [apps/mobile/src/pages.json](../../apps/mobile/src/pages.json) | 33 | H5 路由为 `#/pages/…`；原生 App/小程序验收单列，不能用 H5 替代 |
| admin-web | [apps/admin-web/src/router/index.ts](../../apps/admin-web/src/router/index.ts) | 15 | 登录开始，依次审查权限、表格、详情、编辑/审核和弹窗 |
| official-site | `apps/official-site/pages/` Nuxt 文件路由 | 16 | 按当前实际源文件逐页审查；历史“11 页”不代表当前完整队列 |
| 合计 | 正式路由页面源组件 | 94 | 是源码范围数，**不是完成数、完成率或业务卡数** |

一个页面的别名、设置分区、对话框和状态不是新增业务能力，但必须有具名复验记录。共享样式改动后，重验受影响的已审页；同源文件的另一入口不自动完成。未路由的学习端 WelcomePage、AdultGatePage、B3ListeningPage/B3ReadingPage/B3SpeakingPage、B11SyncPage 等历史文件不混入正式页面数量。静态原型只作视觉对照。

## 3. 每页必查与交付规则

当前完整设计方向见[DESIGN-DIRECTION](ui-audit-20261013/DESIGN-DIRECTION.md)。每页必须重新评估布局、提示文字、按钮位置、字体/艺术字、配色/图标与交互舒适度，不能仅修bug即放行。

每页报告至少记录以下维度；不适用项明确写 N/A 与理由，未执行项写 NOT_RUN 与具体边界：

1. **身份与可达性**：真实路由、页面标题、主内容、刷新/返回/深链、鉴权跳转；没有白屏、框架覆盖层或相关 console/pageerror。
2. **布局与排版**：首屏层次、对齐、间距、字体/行高、图文比例、长文本/内容缺项；无重叠、裁切、布局漂移或无意横向滚动。
3. **响应式与滚动**：至少 1280×900、390×844；受平板/断点影响的页补 768 宽，窄屏风险补 320 宽；检查全页、固定导航、底部动作、safe-area、长表格/长文和软键盘遮挡。
4. **控件与键盘**：触摸目标至少 44×44px 或有等效命中区；Tab 顺序、Enter/Space、可见焦点、Esc、对话框焦点约束/恢复，关闭、返回和双击边界。
5. **表单与语义**：可访问名称/label、字段与错误关联、首错定位、自动填充、密码显示、输入类型、重试、切步骤清理、未保存内容和 pending 防重复/误切。
6. **状态与反馈**：Loading、Empty、Error、成功、禁用原因、取消、重试、失效、权限拒绝；401/403 不伪装为空，状态不只靠颜色，反馈与已保存事实一致。
7. **主题、国际化与性能**：亮/暗/跟随系统/高对比、中文默认与 UI locale fallback、长文案/格式化、内容语言分离、四级画质和减少动效；记录当页覆盖范围。
8. **交互与证据**：修复前复现 → 最小修复 → 同一交互复验；保存前后/响应式/状态截图、实测步骤与观察；API/数据事实和 fixture/source-only 证据分开。
9. **回归与独立复核**：运行改动所需的构建/类型/单测及关联页回归；复杂或风险修改由独立审查方复核 diff 与实际效果，不用源码猜测代替浏览器结论。
10. **逐页提交推送**：一页收口即同步本表、当前进度入口的对应记录、当页报告和 CHANGELOG；保存页面范围、测试/截图、未测边界、提交 SHA 与远程推送收据。只提交本页相关差量，保护其他未提交工作。共享修改说明影响页。没有推送收据不写已推送。

状态约定：PENDING → IN_REVIEW → UI_VERIFIED → PUSHED_SCOPED；阻塞时记 BLOCKED 并写明确原因。UI_VERIFIED 只表示该页报告具名范围内通过，PUSHED_SCOPED 表示其源码/报告/记录已完成远程推送；两者都不升级为业务全链 PASS。初始记录只使用 PENDING 和 LW-001 的 IN_REVIEW。

## 4. 额度与恢复规则

- 使用真实账户限额工具读取五小时滚动窗口的 `usedPercent` 与 `resetsAt`，不开新页面前、页面收口后及长工作阶段复核。
- 当五小时窗口 **usedPercent ≥ 90%（剩余 ≤ 10%）**，停止开启新页；保存当前页已完成检查、未完成步骤、证据位置和工作区差量，按安全边界结束当前操作，不因额度把页面标成完成。
- 依据工具返回的真实 `resetsAt` 设置当前线程续跑定时器，并在该时间后复查实际限额再继续；不把“从现在等五小时”或猜测周期当重置时间。无法读取限额或重置时间时如实记不可用，不编造重置，不绕过限制。
- 续跑先核对本索引、上页收据、源码差量、固定端口与进程所有权，继续未完成页；不得重做已完成页或擅停共享服务。自动恢复只在用户约定范围内推进。
- 定时器、限额实读结果与暂停/恢复记录由主 Agent 维护；本索引建立本身没有创建自动化或改变任务状态。

## 5. 学习端 Web

所有 source 链接相对仓库，便于跨机器复用。先完成 LW-001，再以认证 → 引导 → 测评 → 学习闭环 → 账号/帮助 → 关闭能力的顺序逐页推进。

| 审查编号 | 真实路由 | 页面源文件 | 本页需展开的场景 | 当前状态 | 证据 / 提交 / 远程收据 |
|---|---|---|---|---|---|
| LW-001 | `/login` | [apps/learner-web/src/pages/LoginPage.vue](../../apps/learner-web/src/pages/LoginPage.vue) | 登录：空提交、密码显示、错误、等待、链接与键盘 | PUSHED_SCOPED | [重设计记录](ui-audit-20261013/learner-login-redesign/review.md)，182e106b远程SHA一致；70c2623f旧范围保留 |
| LW-002 | `/register` | [apps/learner-web/src/pages/RegisterPage.vue](../../apps/learner-web/src/pages/RegisterPage.vue) | 注册：密码规则、确认密码、错误定位 | PUSHED_SCOPED | [重设计记录](ui-audit-20261013/learner-register/review.md)，60858fbc远程SHA一致 |
| LW-003 | `/reset-password` | [apps/learner-web/src/pages/PasswordResetPage.vue](../../apps/learner-web/src/pages/PasswordResetPage.vue) | 请求/确认两步、切步清错、等待与完成 | PUSHED_SCOPED | [本页报告](ui-audit-20261013/learner-reset/report.md)，5cd40e35远程SHA一致，64组/根Agent复验 |
| LW-004 | `/onboarding` | [apps/learner-web/src/pages/OnboardingPage.vue](../../apps/learner-web/src/pages/OnboardingPage.vue) | 成人门、三项同意、目标/时长、保存后定级四幕 | PENDING | — |
| LW-005 | `/forbidden` | [apps/learner-web/src/pages/ForbiddenPage.vue](../../apps/learner-web/src/pages/ForbiddenPage.vue) | 限制说明、可用出口与退出 | PENDING | — |
| LW-006 | `/assessment` | [apps/learner-web/src/pages/AssessmentPage.vue](../../apps/learner-web/src/pages/AssessmentPage.vue) | 开场、选项、保存回执、反馈、报告与重测 | PENDING | — |
| LW-007 | `/home` | [apps/learner-web/src/pages/HomePage.vue](../../apps/learner-web/src/pages/HomePage.vue) | 计划横幅、今日入口、首次引导、空/错态 | PENDING | — |
| LW-008 | `/today` | [apps/learner-web/src/pages/TodayPage.vue](../../apps/learner-web/src/pages/TodayPage.vue) | 任务、空态分流、重复动作与反馈 | PENDING | — |
| LW-009 | `/courses` | [apps/learner-web/src/pages/CoursesPage.vue](../../apps/learner-web/src/pages/CoursesPage.vue) | 目录、搜索无结果、读取失败、续学入口 | PENDING | — |
| LW-010 | `/learn` | [apps/learner-web/src/pages/LearningLoopPage.vue](../../apps/learner-web/src/pages/LearningLoopPage.vue) | 学习队列、进度、检查点与恢复 | PENDING | — |
| LW-011 | `/learn/session` | [apps/learner-web/src/pages/LearnPage.vue](../../apps/learner-web/src/pages/LearnPage.vue) | 课程内容、章节、检查点、停止/失效出口 | PENDING | — |
| LW-012 | `/practice` | [apps/learner-web/src/pages/B2PracticePage.vue](../../apps/learner-web/src/pages/B2PracticePage.vue) | 作答、反馈、下一题、提交禁用解释 | PENDING | — |
| LW-013 | `/vocabulary` | [apps/learner-web/src/pages/VocabularyPage.vue](../../apps/learner-web/src/pages/VocabularyPage.vue) | 词汇、媒体可播事实、收藏、复习与三态 | PENDING | — |
| LW-014 | `/grammar` | [apps/learner-web/src/pages/B3GrammarPage.vue](../../apps/learner-web/src/pages/B3GrammarPage.vue) | 选择、图/文本降级、练习与异步切换 | PENDING | — |
| LW-015 | `/reading` | [apps/learner-web/src/pages/B11ReadingPage.vue](../../apps/learner-web/src/pages/B11ReadingPage.vue) | 阅读目录、正文、词句、提交与离线提示 | PENDING | — |
| LW-016 | `/reader` | [apps/learner-web/src/pages/B11ReadingPage.vue](../../apps/learner-web/src/pages/B11ReadingPage.vue) | 沉浸阅读入口与上下文、长文滚动 | PENDING | — |
| LW-017 | `/mistakes` | [apps/learner-web/src/pages/MistakesPage.vue](../../apps/learner-web/src/pages/MistakesPage.vue) | 错题空态、补救、回执与恢复 | PENDING | — |
| LW-018 | `/mastery` | [apps/learner-web/src/pages/MasteryPage.vue](../../apps/learner-web/src/pages/MasteryPage.vue) | 有证据/不足数据、状态与排版 | PENDING | — |
| LW-019 | `/plan-map` | [apps/learner-web/src/pages/PlanMapPage.vue](../../apps/learner-web/src/pages/PlanMapPage.vue) | 计划地图、状态文字、窄屏与键盘 | PENDING | — |
| LW-020 | `/b2/report` | [apps/learner-web/src/pages/B2ReportPage.vue](../../apps/learner-web/src/pages/B2ReportPage.vue) | 定级/周期报告、空态、建议、分享/撤销 | PENDING | — |
| LW-021 | `/reports/weakness` | [apps/learner-web/src/pages/B2ReportPage.vue](../../apps/learner-web/src/pages/B2ReportPage.vue) | 弱点报告入口与同页不同上下文 | PENDING | — |
| LW-022 | `/share/reports/:ref` | [apps/learner-web/src/pages/ReportSharePage.vue](../../apps/learner-web/src/pages/ReportSharePage.vue) | 公开只读、有效/失效/撤销/错误与返回 | PENDING | — |
| LW-023 | `/world` | [apps/learner-web/src/pages/B4WorldPage.vue](../../apps/learner-web/src/pages/B4WorldPage.vue) | 成长事实、空态、关闭能力与图文比例 | PENDING | — |
| LW-024 | `/messages` | [apps/learner-web/src/pages/MessagesPage.vue](../../apps/learner-web/src/pages/MessagesPage.vue) | 消息列表、详情、已读、空/错态 | PENDING | — |
| LW-025 | `/commerce` | [apps/learner-web/src/pages/B5CommercePage.vue](../../apps/learner-web/src/pages/B5CommercePage.vue) | 权益、兑换、关闭支付、输入与反馈 | PENDING | — |
| LW-026 | `/settings/:section` | [apps/learner-web/src/pages/SettingsPage.vue](../../apps/learner-web/src/pages/SettingsPage.vue) | 四个已具名分区及未知 section 边界，见分区表 | PENDING | — |
| LW-027 | `/platform` | [apps/learner-web/src/pages/B6PlatformPage.vue](../../apps/learner-web/src/pages/B6PlatformPage.vue) | 主题、语言、画质、动效与持久化 | PENDING | — |
| LW-028 | `/support` | [apps/learner-web/src/pages/SupportPage.vue](../../apps/learner-web/src/pages/SupportPage.vue) | 帮助、工单、可用/受限写入口、失败说明 | PENDING | — |
| LW-029 | `/listening` | [apps/learner-web/src/pages/B11ListeningPage.vue](../../apps/learner-web/src/pages/B11ListeningPage.vue) | 当前关闭能力说明、返回、无假播放器 | PENDING | — |
| LW-030 | `/speaking` | [apps/learner-web/src/pages/B11SpeakingPage.vue](../../apps/learner-web/src/pages/B11SpeakingPage.vue) | 当前关闭能力说明、返回与权限状态 | PENDING | — |
| LW-031 | `/writing` | [apps/learner-web/src/pages/B3WritingPage.vue](../../apps/learner-web/src/pages/B3WritingPage.vue) | 当前关闭能力说明与返回 | PENDING | — |
| LW-032 | `/writing/practice` | [apps/learner-web/src/pages/B3WritingPage.vue](../../apps/learner-web/src/pages/B3WritingPage.vue) | 写作练习兼容入口的关闭说明与返回 | PENDING | — |
| LW-033 | `/:pathMatch(.*)*` | [apps/learner-web/src/pages/EmptyPage.vue](../../apps/learner-web/src/pages/EmptyPage.vue) | 未知页面、登录/未登录壳、恢复入口 | PENDING | — |

### 5.1 别名入口

这些是实际 alias；需检查深链进入时内容、权限、标题、返回与关闭能力说明。与主入口同源，不重复计算页面组件数。

| 审查编号 | 真实 alias | 对应主路由 | 页面源文件 | 当前状态 | 证据 / 提交 / 远程收据 |
|---|---|---|---|---|---|
| LW-A01 | `/courses/listening` | `/listening` | [apps/learner-web/src/pages/B11ListeningPage.vue](../../apps/learner-web/src/pages/B11ListeningPage.vue) | PENDING | — |
| LW-A02 | `/practice/listening` | `/listening` | [apps/learner-web/src/pages/B11ListeningPage.vue](../../apps/learner-web/src/pages/B11ListeningPage.vue) | PENDING | — |
| LW-A03 | `/reports/listening` | `/listening` | [apps/learner-web/src/pages/B11ListeningPage.vue](../../apps/learner-web/src/pages/B11ListeningPage.vue) | PENDING | — |
| LW-A04 | `/clips` | `/listening` | [apps/learner-web/src/pages/B11ListeningPage.vue](../../apps/learner-web/src/pages/B11ListeningPage.vue) | PENDING | — |
| LW-A05 | `/courses/reading` | `/reading` | [apps/learner-web/src/pages/B11ReadingPage.vue](../../apps/learner-web/src/pages/B11ReadingPage.vue) | PENDING | — |
| LW-A06 | `/practice/reading` | `/reading` | [apps/learner-web/src/pages/B11ReadingPage.vue](../../apps/learner-web/src/pages/B11ReadingPage.vue) | PENDING | — |
| LW-A07 | `/reports/reading` | `/reading` | [apps/learner-web/src/pages/B11ReadingPage.vue](../../apps/learner-web/src/pages/B11ReadingPage.vue) | PENDING | — |
| LW-A08 | `/courses/speaking` | `/speaking` | [apps/learner-web/src/pages/B11SpeakingPage.vue](../../apps/learner-web/src/pages/B11SpeakingPage.vue) | PENDING | — |
| LW-A09 | `/phonetics` | `/speaking` | [apps/learner-web/src/pages/B11SpeakingPage.vue](../../apps/learner-web/src/pages/B11SpeakingPage.vue) | PENDING | — |
| LW-A10 | `/recording` | `/speaking` | [apps/learner-web/src/pages/B11SpeakingPage.vue](../../apps/learner-web/src/pages/B11SpeakingPage.vue) | PENDING | — |
| LW-A11 | `/practice/shadowing` | `/speaking` | [apps/learner-web/src/pages/B11SpeakingPage.vue](../../apps/learner-web/src/pages/B11SpeakingPage.vue) | PENDING | — |

### 5.2 设置分区与重定向

| 审查编号 | 路由/分区 | 实际页面或去向 | 当前状态 | 证据 / 提交 / 远程收据 |
|---|---|---|---|---|
| LW-S01 | `/settings/profile` | SettingsPage.vue：目标、显示偏好、账号 | PENDING | — |
| LW-S02 | `/settings/notifications` | SettingsPage.vue：NotificationPreferencesPanel | PENDING | — |
| LW-S03 | `/settings/privacy` | SettingsPage.vue：隐私、同意撤回 | PENDING | — |
| LW-S04 | `/settings/devices` | SettingsPage.vue：设备与会话 | PENDING | — |
| LW-R01 | `/` | 重定向至 `/login`；已登录守卫按事实处理 | PENDING | — |
| LW-R02 | `/adult-gate` | 兼容入口重定向至 `/onboarding` | PENDING | — |
| LW-R03 | `/me` | 重定向至 `/settings/profile` | PENDING | — |
| LW-R04 | `/settings` | 重定向至 `/settings/profile` | PENDING | — |

未知 `:section` 的实际行为纳入 LW-026，不擅自把参数字符串当成新增正式设置分区。完整页面源见 LW-026。

## 6. 移动学习端

地址列记录 H5 hash；每页仍属于同一个 uni-app 项目。表格、底部 tab、onShow 恢复与返回栈须用真实平台操作检查。

| 审查编号 | 真实路由 | 页面源文件 | 本页需展开的场景 | 当前状态 | 证据 / 提交 / 远程收据 |
|---|---|---|---|---|---|
| MB-001 | `#/pages/login/login` | [apps/mobile/src/pages/login/login.vue](../../apps/mobile/src/pages/login/login.vue) | 登录 | IN_REVIEW | 24组渲染通过；空提交原生aria-invalid失败，额度暂停，未签/未推送 |
| MB-002 | `#/pages/register/register` | [apps/mobile/src/pages/register/register.vue](../../apps/mobile/src/pages/register/register.vue) | 注册 | PENDING | — |
| MB-003 | `#/pages/reset-password/reset-password` | [apps/mobile/src/pages/reset-password/reset-password.vue](../../apps/mobile/src/pages/reset-password/reset-password.vue) | 请求/确认两步、完成态 | PENDING | — |
| MB-004 | `#/pages/onboarding/onboarding` | [apps/mobile/src/pages/onboarding/onboarding.vue](../../apps/mobile/src/pages/onboarding/onboarding.vue) | 成人门、同意、目标、定级四幕 | PENDING | — |
| MB-005 | `#/pages/forbidden/forbidden` | [apps/mobile/src/pages/forbidden/forbidden.vue](../../apps/mobile/src/pages/forbidden/forbidden.vue) | 限制说明、退出与可用出口 | PENDING | — |
| MB-006 | `#/pages/assessment/assessment` | [apps/mobile/src/pages/assessment/assessment.vue](../../apps/mobile/src/pages/assessment/assessment.vue) | 开场、作答、反馈、结果与重测 | PENDING | — |
| MB-007 | `#/pages/home/home` | [apps/mobile/src/pages/home/home.vue](../../apps/mobile/src/pages/home/home.vue) | 首页、计划横幅、任务与首次引导 | PENDING | — |
| MB-008 | `#/pages/today/today` | [apps/mobile/src/pages/today/today.vue](../../apps/mobile/src/pages/today/today.vue) | 今日任务与各类空/错态 | PENDING | — |
| MB-009 | `#/pages/learn/learn` | [apps/mobile/src/pages/learn/learn.vue](../../apps/mobile/src/pages/learn/learn.vue) | 课程/内容/续学、队列、错题/补救/复习区域 | PENDING | — |
| MB-010 | `#/pages/practice/practice` | [apps/mobile/src/pages/practice/practice.vue](../../apps/mobile/src/pages/practice/practice.vue) | 练习入口目录与能力关闭提示 | PENDING | — |
| MB-011 | `#/pages/b2-practice/b2-practice` | [apps/mobile/src/pages/b2-practice/b2-practice.vue](../../apps/mobile/src/pages/b2-practice/b2-practice.vue) | 旧综合练习入口、失效内容说明与新入口 | PENDING | — |
| MB-012 | `#/pages/b2-vocabulary/b2-vocabulary` | [apps/mobile/src/pages/b2-vocabulary/b2-vocabulary.vue](../../apps/mobile/src/pages/b2-vocabulary/b2-vocabulary.vue) | 词汇、媒体、SRS 与空/错态 | PENDING | — |
| MB-013 | `#/pages/b3-grammar/b3-grammar` | [apps/mobile/src/pages/b3-grammar/b3-grammar.vue](../../apps/mobile/src/pages/b3-grammar/b3-grammar.vue) | 语法与长难句、练习与降级 | PENDING | — |
| MB-014 | `#/pages/b3-reading/b3-reading` | [apps/mobile/src/pages/b3-reading/b3-reading.vue](../../apps/mobile/src/pages/b3-reading/b3-reading.vue) | 阅读精练入口与正文 | PENDING | — |
| MB-015 | `#/pages/b11-reading/b11-reading` | [apps/mobile/src/pages/b11-reading/b11-reading.vue](../../apps/mobile/src/pages/b11-reading/b11-reading.vue) | 分级阅读、正文、选择与长文滚动 | PENDING | — |
| MB-016 | `#/pages/b10-report/b10-report` | [apps/mobile/src/pages/b10-report/b10-report.vue](../../apps/mobile/src/pages/b10-report/b10-report.vue) | 错题、补救、定级/周期报告、分享 | PENDING | — |
| MB-017 | `#/pages/report-share/report-share` | [apps/mobile/src/pages/report-share/report-share.vue](../../apps/mobile/src/pages/report-share/report-share.vue) | 有效/失效/撤销/错误的只读报告 | PENDING | — |
| MB-018 | `#/pages/world/world` | [apps/mobile/src/pages/world/world.vue](../../apps/mobile/src/pages/world/world.vue) | 成长、赛季、事实空态与关闭模块 | PENDING | — |
| MB-019 | `#/pages/b4-games/b4-games` | [apps/mobile/src/pages/b4-games/b4-games.vue](../../apps/mobile/src/pages/b4-games/b4-games.vue) | 游戏目录、即将开放的原因与返回 | PENDING | — |
| MB-020 | `#/pages/b4-social/b4-social` | [apps/mobile/src/pages/b4-social/b4-social.vue](../../apps/mobile/src/pages/b4-social/b4-social.vue) | 自习室、社交边界、空态与返回 | PENDING | — |
| MB-021 | `#/pages/b4-avatar/b4-avatar` | [apps/mobile/src/pages/b4-avatar/b4-avatar.vue](../../apps/mobile/src/pages/b4-avatar/b4-avatar.vue) | Avatar/衣柜、真实可用操作与状态 | PENDING | — |
| MB-022 | `#/pages/b4-offline/b4-offline` | [apps/mobile/src/pages/b4-offline/b4-offline.vue](../../apps/mobile/src/pages/b4-offline/b4-offline.vue) | 离线包服务边界、提示与返回 | PENDING | — |
| MB-023 | `#/pages/profile/profile` | [apps/mobile/src/pages/profile/profile.vue](../../apps/mobile/src/pages/profile/profile.vue) | 我的、入口、账号状态与退出 | PENDING | — |
| MB-024 | `#/pages/settings/settings` | [apps/mobile/src/pages/settings/settings.vue](../../apps/mobile/src/pages/settings/settings.vue) | 偏好、通知、隐私、撤回、持久化 | PENDING | — |
| MB-025 | `#/pages/devices/devices` | [apps/mobile/src/pages/devices/devices.vue](../../apps/mobile/src/pages/devices/devices.vue) | 设备与会话、当前设备、撤销反馈 | PENDING | — |
| MB-026 | `#/pages/b5-commerce/b5-commerce` | [apps/mobile/src/pages/b5-commerce/b5-commerce.vue](../../apps/mobile/src/pages/b5-commerce/b5-commerce.vue) | 权益、兑换输入、关闭支付 | PENDING | — |
| MB-027 | `#/pages/b6-platform/b6-platform` | [apps/mobile/src/pages/b6-platform/b6-platform.vue](../../apps/mobile/src/pages/b6-platform/b6-platform.vue) | 主题、语言、画质、动效与持久化 | PENDING | — |
| MB-028 | `#/pages/support/support` | [apps/mobile/src/pages/support/support.vue](../../apps/mobile/src/pages/support/support.vue) | 帮助、工单、受限动作和失败反馈 | PENDING | — |
| MB-029 | `#/pages/b3-listening/b3-listening` | [apps/mobile/src/pages/b3-listening/b3-listening.vue](../../apps/mobile/src/pages/b3-listening/b3-listening.vue) | 听力旧入口的关闭说明与返回 | PENDING | — |
| MB-030 | `#/pages/b11-listening/b11-listening` | [apps/mobile/src/pages/b11-listening/b11-listening.vue](../../apps/mobile/src/pages/b11-listening/b11-listening.vue) | 听力/Clips 当前关闭说明与返回 | PENDING | — |
| MB-031 | `#/pages/b3-speaking/b3-speaking` | [apps/mobile/src/pages/b3-speaking/b3-speaking.vue](../../apps/mobile/src/pages/b3-speaking/b3-speaking.vue) | 口语/音标旧入口的关闭说明与返回 | PENDING | — |
| MB-032 | `#/pages/b11-speaking/b11-speaking` | [apps/mobile/src/pages/b11-speaking/b11-speaking.vue](../../apps/mobile/src/pages/b11-speaking/b11-speaking.vue) | 音标/跟读当前关闭说明与返回 | PENDING | — |
| MB-033 | `#/pages/b3-writing/b3-writing` | [apps/mobile/src/pages/b3-writing/b3-writing.vue](../../apps/mobile/src/pages/b3-writing/b3-writing.vue) | 写作当前关闭说明与返回 | PENDING | — |

## 7. 管理后台

当前权限/审核/客服写入口按源码、服务与配置事实审查；不能把 R1 历史只读范围自动套到后续内容维护与支持修复，也不能据文档宣称写链实时可用。

| 审查编号 | 真实路由 | 页面源文件 | 本页需展开的场景 | 当前状态 | 证据 / 提交 / 远程收据 |
|---|---|---|---|---|---|
| AD-001 | `/login` | [apps/admin-web/src/views/AdminLoginView.vue](../../apps/admin-web/src/views/AdminLoginView.vue) | 登录、错误定位、密码显示、菜单与等待 | PENDING | — |
| AD-002 | `/forbidden` | [apps/admin-web/src/views/AdminForbiddenView.vue](../../apps/admin-web/src/views/AdminForbiddenView.vue) | 权限说明与安全返回 | PENDING | — |
| AD-003 | `/dashboard` | [apps/admin-web/src/views/AdminDashboardView.vue](../../apps/admin-web/src/views/AdminDashboardView.vue) | 指标口径、更新时间、零/暂无/计算中/失败 | PENDING | — |
| AD-004 | `/content` | [apps/admin-web/src/views/AdminContentView.vue](../../apps/admin-web/src/views/AdminContentView.vue) | 内容草稿、审核、发布、冲突、下架/回滚 | PENDING | — |
| AD-005 | `/lexemes` | [apps/admin-web/src/views/AdminLexemeView.vue](../../apps/admin-web/src/views/AdminLexemeView.vue) | 词条、退回/修订、审核意见、差异与批处理 | PENDING | — |
| AD-006 | `/items` | [apps/admin-web/src/views/AdminItemView.vue](../../apps/admin-web/src/views/AdminItemView.vue) | 题目/条目、退回/修订、版本冲突与批处理 | PENDING | — |
| AD-007 | `/phonetics` | [apps/admin-web/src/views/AdminPhoneticsView.vue](../../apps/admin-web/src/views/AdminPhoneticsView.vue) | 音标读取、资料/媒体、能力状态 | PENDING | — |
| AD-008 | `/learners` | [apps/admin-web/src/views/AdminLearnerView.vue](../../apps/admin-web/src/views/AdminLearnerView.vue) | 学员目录、筛选、脱敏、详情 | PENDING | — |
| AD-009 | `/permissions` | [apps/admin-web/src/views/AdminPermissionsView.vue](../../apps/admin-web/src/views/AdminPermissionsView.vue) | 权限读取及当前源码条件写入口、无权解释 | PENDING | — |
| AD-010 | `/commerce` | [apps/admin-web/src/views/AdminCommerceView.vue](../../apps/admin-web/src/views/AdminCommerceView.vue) | 订单/权益、输入、关闭支付与退款边界 | PENDING | — |
| AD-011 | `/audit` | [apps/admin-web/src/views/AdminAuditView.vue](../../apps/admin-web/src/views/AdminAuditView.vue) | 审计列表、筛选、脱敏、导出关闭说明 | PENDING | — |
| AD-012 | `/release` | [apps/admin-web/src/views/AdminB6ReleaseView.vue](../../apps/admin-web/src/views/AdminB6ReleaseView.vue) | 排期/发布权限、勾选、动作与状态 | PENDING | — |
| AD-013 | `/governance` | [apps/admin-web/src/views/AdminB12GovernanceView.vue](../../apps/admin-web/src/views/AdminB12GovernanceView.vue) | 案件、过滤、只读/冻结/权限边界 | PENDING | — |
| AD-014 | `/support` | [apps/admin-web/src/views/AdminSupportView.vue](../../apps/admin-web/src/views/AdminSupportView.vue) | 工单、详情、附件、动作权限与连接边界 | PENDING | — |
| AD-015 | `/recovery` | [apps/admin-web/src/views/AdminRecoveryView.vue](../../apps/admin-web/src/views/AdminRecoveryView.vue) | 恢复单、批准/执行/失败/未知、权限与重试 | PENDING | — |

| 审查编号 | 兼容/未知入口 | 实际去向 | 当前状态 | 证据 / 提交 / 远程收据 |
|---|---|---|---|---|
| AD-R01 | `/` | `/dashboard`，仍经过鉴权/权限守卫 | PENDING | — |
| AD-R02 | `/risk` | `/governance`，仍经过鉴权/权限守卫 | PENDING | — |
| AD-R03 | `/:pathMatch(.*)*` | `/dashboard`，需验证用户可理解的恢复行为 | PENDING | — |

## 8. 官网

公开投影、设备入口、FAQ/弹窗、文档长页逐页复验。官网不保存学习业务 Token；跨端注册 CTA 的语言/主题和目标应实际读回。

| 审查编号 | 真实路由 | 页面源文件 | 本页需展开的场景 | 当前状态 | 证据 / 提交 / 远程收据 |
|---|---|---|---|---|---|
| OS-001 | `/` | [apps/official-site/pages/index.vue](../../apps/official-site/pages/index.vue) | 首屏、导航、注册 CTA、示例与长页锚点 | PENDING | — |
| OS-002 | `/start` | [apps/official-site/pages/start.vue](../../apps/official-site/pages/start.vue) | 设备入口、注册、换设备弹窗、复制成功/失败 | PENDING | — |
| OS-003 | `/courses` | [apps/official-site/pages/courses/index.vue](../../apps/official-site/pages/courses/index.vue) | 公开课程投影、空/错态、CTA | PENDING | — |
| OS-004 | `/courses/:id` | [apps/official-site/pages/courses/[id].vue](../../apps/official-site/pages/courses/[id].vue) | 方法/内容详情、有效与未知 id、面包屑 | PENDING | — |
| OS-005 | `/method` | [apps/official-site/pages/method.vue](../../apps/official-site/pages/method.vue) | 学习方法、图文节奏与 CTA | PENDING | — |
| OS-006 | `/world` | [apps/official-site/pages/world.vue](../../apps/official-site/pages/world.vue) | 体验、图文、动效降级与 CTA | PENDING | — |
| OS-007 | `/pricing` | [apps/official-site/pages/pricing.vue](../../apps/official-site/pages/pricing.vue) | 方案投影、免费/关闭/空/错态 | PENDING | — |
| OS-008 | `/download` | [apps/official-site/pages/download.vue](../../apps/official-site/pages/download.vue) | 各平台真实下载投影、不可用解释 | PENDING | — |
| OS-009 | `/about` | [apps/official-site/pages/about.vue](../../apps/official-site/pages/about.vue) | 介绍、内容顺序、长页与链接 | PENDING | — |
| OS-010 | `/help` | [apps/official-site/pages/help.vue](../../apps/official-site/pages/help.vue) | 帮助、FAQ、键盘与展开状态 | PENDING | — |
| OS-011 | `/announcements` | [apps/official-site/pages/announcements.vue](../../apps/official-site/pages/announcements.vue) | 公告列表、内容与空态 | PENDING | — |
| OS-012 | `/status` | [apps/official-site/pages/status.vue](../../apps/official-site/pages/status.vue) | 状态说明、公告/帮助入口 | PENDING | — |
| OS-013 | `/privacy` | [apps/official-site/pages/privacy.vue](../../apps/official-site/pages/privacy.vue) | 隐私文档、目录、长文与返回 | PENDING | — |
| OS-014 | `/terms` | [apps/official-site/pages/terms.vue](../../apps/official-site/pages/terms.vue) | 条款文档、目录、长文与返回 | PENDING | — |
| OS-015 | `/compliance` | [apps/official-site/pages/compliance.vue](../../apps/official-site/pages/compliance.vue) | 合规公示、可读性与链接 | PENDING | — |
| OS-016 | `/minors` | [apps/official-site/pages/minors.vue](../../apps/official-site/pages/minors.vue) | 未成年人阶段说明、可读性与出口 | PENDING | — |

| 共享状态编号 | 触发 | 源文件 | 当前状态 | 证据 / 提交 / 远程收据 |
|---|---|---|---|---|
| OS-E01 | 未知 URL、未知课程 id、Nuxt 错误 | [apps/official-site/error.vue](../../apps/official-site/error.vue) | PENDING | — |

## 9. 共享布局随页复验

这张表记录跨页面影响，不代替逐页表。源码范围调整或共享修复后由主 Agent 添加受影响页面清单与复验收据。

| 检查编号 | 共享入口 | 源文件 | 当前状态 | 需复验的范围 |
|---|---|---|---|---|
| SH-LW | 学习端 AuthLayout / AppShell / v2 样式 | [apps/learner-web/src/layouts/AuthLayout.vue](../../apps/learner-web/src/layouts/AuthLayout.vue)、[apps/learner-web/src/layouts/AppShell.vue](../../apps/learner-web/src/layouts/AppShell.vue)、[apps/learner-web/src/theme/v2-tokens.scss](../../apps/learner-web/src/theme/v2-tokens.scss)、[apps/learner-web/src/theme/v2-pages.scss](../../apps/learner-web/src/theme/v2-pages.scss) | PENDING | 认证三页；已审业务页的导航/搜索/消息弹窗、断点、主题、焦点 |
| SH-MB | 移动页眉 / 旧公共样式 / v2 token | [apps/mobile/src/components/MobilePageHeader.vue](../../apps/mobile/src/components/MobilePageHeader.vue)、[apps/mobile/src/uni.scss](../../apps/mobile/src/uni.scss)、[apps/mobile/src/theme/v2-tokens.scss](../../apps/mobile/src/theme/v2-tokens.scss) | PENDING | 页眉、tab、滚动、密码按钮、主题、旧选择器覆盖 |
| SH-AD | 管理壳 / Element Plus 适配 / v2 样式 | [apps/admin-web/src/App.vue](../../apps/admin-web/src/App.vue)、[apps/admin-web/src/styles.css](../../apps/admin-web/src/styles.css)、[apps/admin-web/src/styles/v2-console.css](../../apps/admin-web/src/styles/v2-console.css)、[apps/admin-web/src/styles/v2-tokens.css](../../apps/admin-web/src/styles/v2-tokens.css) | PENDING | 导航/搜索、权限、移动抽屉、表格横滚、teleport 弹窗、主题 |
| SH-OS | 官网壳 / 页眉页尾 / 弹窗 | [apps/official-site/layouts/default.vue](../../apps/official-site/layouts/default.vue)、[apps/official-site/components/SiteHeader.vue](../../apps/official-site/components/SiteHeader.vue)、[apps/official-site/components/SiteFooter.vue](../../apps/official-site/components/SiteFooter.vue)、[apps/official-site/components/SiteModal.vue](../../apps/official-site/components/SiteModal.vue) | PENDING | 响应式导航、锚点、弹窗、CTA、语言/主题与长页 |

## 10. 初始接手记录

- 2026-10-13：依据当前正式路由与源文件建立索引；94 个唯一页面源组件、别名/设置/兼容入口均列出。LW-001 设置为 IN_REVIEW，其余 PENDING。
- 首轮源码候选问题已交主 Agent：学习端登录触摸目标与表单定位、两端找回密码切步遗留错误、Web/mobile 高对比 token 缺项、业务 v2 focus token 值类型、移动旧密码定位样式。这里是待复现线索，不是浏览器已确认缺陷或页面完成证据。
- 索引建立阶段没有修改业务签收、没有执行部署、没有操作 Git，也没有记录任何页面 UI_VERIFIED/PUSHED_SCOPED。
