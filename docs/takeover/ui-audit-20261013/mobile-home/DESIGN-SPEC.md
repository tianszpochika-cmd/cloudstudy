# MB007 首页设计规格（候选实施稿）

状态：`PRIVATE_CANDIDATE_C7 / UI_NOT_SIGNED / BROWSER_NOT_RUN`。本文件描述已落地候选的**实际实现**，不是验收结论。参照图 `docs/takeover/ui-audit-20261013/mobile-home/concept.png`（根 `view_image` 目检图，SHA256 `589d4047e6cc81778798b5312e9cf95c81a7a6b0ead550a5109cc8de786fae09`），实施以其结构与文字锁定为准，图像细差按 Root 文字修正。

## 0. C7 注记（覆盖 C6 与下文冲突处）

- **空态冲突修正**：assessment guide 只显示“目标已保存，可继续测评。”+ 复用“进入测评”，不再列单步“定级/剩余步骤”，footer 不再重复“进入测评”；gate/consent/goal guide 用真实剩余步骤 + “继续设置”。
- **NO_PLAN**：有 guide 时只保留“还没有学习计划”标题，不重复设置描述/第二个“开始设置”；无 guide 保持原出口；其他 empty reason 不被覆写。
- **0 任务**：不显示“0 项”计数；**进度**：无确认/空任务不渲染，stale 只显示“进度待更新”，不写 0%。
- 文案 diff 与四源 C7 冻结哈希见 `dsh-20261021-author/C7-CANDIDATE.md`；C6 源码/报告在 `archive/c6-20261021/`。

## 0. C6 注记（覆盖 C5 与下文冲突处）

- **native placeholder 命中修正**：C5 的 `:deep(input::placeholder)` 被 uni 编译为 `uni-input::placeholder`，命不中真实 input。C6 改为 `:deep(.uni-input-input::placeholder)`，保持 `var(--yx-text-secondary)`、`opacity:1`、`font:inherit`。未改全局、未脚本注入、未降对比要求。
- Root C5 唯一真实 FAIL 是 en-dark native placeholder；zh-light390/1280 已 ok；en320/200% normal-contrast 属 `NOT_MEASURED` 脚本分类。
- 编译检查只证明 selector 目标已变，真实 en-dark 计算色仍需 Root 复验；C6 不写 browser PASS。
- 四源 C6 冻结哈希见 `dsh-20261021-author/C6-CANDIDATE.md`；C5 源码/报告在 `archive/c5-20261021/`。

## 0. C5 注记（覆盖 C4 与下文冲突处）

- **搜索 placeholder**：`placeholder-style` 使用 `var(--yx-text-secondary)`、`opacity:1`、字体继承；H5 scoped deep 同时覆盖 `.uni-input-placeholder` 与 `input::placeholder`，避免只改 host 时内部仍为 `#808080/#757575`。未改全局 token、未改字体栈、未用 `overflow:hidden`。
- **heading**：“今日任务”“课程内容”加 `role="heading" aria-level="2"`；H1 仍唯一。copy/布局未改。
- Root C4 matrix `REDLINE_FAIL` 原件保留在 `dsh-20261021-matrix/runs/codex-20261021-c4-smoke-1/`；C4 源码/报告归档 `archive/c4-20261021/`。
- 四源 C5 冻结哈希见 `dsh-20261021-author/C5-CANDIDATE.md`。

## 0. C4 注记（覆盖 C3 与下文冲突处）

- **i18n 路径修正**：`homeCopy` 已从 `mobile.auth.home` 移到 `mobile.home`（与 auth/assessment/onboarding 同层）；页面 `tr('mobile.home.*')` 现在解析真实文案。C4 静态 lookup 61 key × 2 locale 通过，非 UI PASS。
- **retryPlan 迟到计划**：仅本页 `retryPlan` 向既有 `refreshPlanQueue` 可选谓词传 `actionCurrent(action)`（当前页/epoch/owner/action），不扩大 store。
- **字体/200%**：不盲改字体栈、不遮 overflow；等 Root CDP/字体测量与正确文案复验后再判。
- 四源 C4 冻结哈希见 `dsh-20261021-author/C4-CANDIDATE.md`；C3 源码/报告在 `archive/c3-20261021/`。

## 0. C3 修订（覆盖下文与 C1/C2 的冲突处）

1. **页面宽度选择器**改为 `:root .home-page`（0,3,0），不再使用 `.home-page.home-page`；目的仅覆盖全局 `.yx-page.yx-page`（0,2,0）的 860px/22px，原因写在样式注释。
2. **入口与动作 token 分离**：`entrySeq`（读取）与 `actionSeq`（导航/重试忙碌）各自计数；导航尝试不再使同一 epoch 的有效读取失效。`pageEpoch` 由 onShow/onHide/身份变更统一递增。`activeEntry` 只防同一 epoch/同一 owner 的重复读取；新 epoch 可立即发新读，旧响应由 store 的 `homeGeneration` supersede，旧 finally 不清新锁/新 busy。
3. **reading 覆盖整轮**：`reading` 从 `ensureMobilePageAccess` 成功后覆盖 `loadHome` + 必要 guide 事实读取；期间只显示一行“正在读取今日任务…”，隐藏进度、任务、课程、计划解释、空态和次出口，避免露上一轮 plan/explanation/guide。
4. **导航**改用 `openUniPage(url)` 并 await 其 `void | Promise<unknown>` 返回；learn 为正式 tab，走 `switchTab` 与既有 pending-query 交接，不复制 key、不双导航。没有 400ms 猜测计时器；失败反馈仅在仍在本页、同 owner、当前路由为 `/pages/home/home` 时显示。
5. **按钮字号**：主/次/文字动作/行按钮标签均为 16px；14px 只用于说明、计数、状态、meta。清除与设置均 44×44。
6. **未知 planNotice 不再映射**成“目标已保存”事实：仅与 store 两条已知原文精确相等时映射 i18n，其他原文保留。
7. **课程不可用只出现一次**：`contentStatus=UNAVAILABLE` 单独分支，不再与 `shelf==='error'` 重复。
8. **搜索 ARIA/focus**：复用既有 `$el.querySelector('.uni-input-input')` 桥接，向原生 input 写入 `aria-label/placeholder/type/autocomplete`；清除后 `nextTick` 聚焦，且仅当前页/同 owner 时执行。
9. **滚动**：`REQUIRED`/`REDUCED`（motion 非 `on`）用 `pageScrollTo duration 0` 与 `scrollIntoView behavior:'auto'`；成功聚焦 `#course-heading`，失败回退 DOM，仍失败才显示“没能跳到课程内容，请向下滚动。”；异步 success/fail 回调校验当前页与 owner。
10. **字体**：页级与 button/input 显式继承 `var(--v2-font)`；字体实际渲染由浏览器复核。
11. **入口重入修复**：同 owner 的旧 home GET 在离开/返回后不再阻塞新 onShow；新 epoch 立即新读；status watcher 与 onShow 的重复读取由同一 epoch 的 `activeEntry` 抑制。

以下各节为 C2 版规格，C3 以上述修订为准；未列出的布局、文案与状态保持。

## 1. 布局与排版

| 项 | 规格 | 实现 |
|---|---|---|
| 页面宽度 | 移动 20px 侧距；桌面内容 max 720px，居中 | `.yx-page.home-page.home-page { max-width:720px; padding-left/right:20px }`，覆盖 `.yx-page` 的 860px/22px |
| 顶部 | 品牌小字 + 设置 outline 按钮 44×44 | `.home-topbar`；品牌 `mobileT('brand')` 15px/1.5/650；按钮 `AppIcon name="gear"` 22px，边框 `var(--yx-text-secondary)` |
| H1 | 单 H1，28px / 1.4 / 650 | `<text role="heading" aria-level="1">`；`mobile.home.h1`；无第二视觉标题 |
| 正文 | 16px / 1.5 | 任务标题、课程标题、进度句、主按钮 |
| 辅助 | ≥14px / 1.6 | meta、描述、状态、计数、提示、次按钮 |
| 进度 | 文本 + 8px 轨道；真实 `completed/target` | 文本“已学 {done} 分钟 · 目标 {target} 分钟”；宽度 `min(100, done/target*100)%`（5/15=33.333%，非图像示意）；`target=0` 或 `stale` 时只显示“今日任务已读取”，不画 0% |
| 任务列表 | 开放列表，分隔线，无卡片框 | 每个任务 `padding:20px 0` + `border-top`；标题不截断（`overflow-wrap:break-word; word-break:normal`） |
| 首任务主 CTA | 首个可执行任务行内唯一主按钮，48px | 该行 `flex-basis:100%`，按钮全宽、`min-height:48px`、16px |
| 其他可执行任务 | 行内次级动作 44px | ghost 按钮，`min-height:44px`、14px |
| 非互动状态 | 完成/锁定/不可用保留行，状态文字 + 图标，不放按钮 | `check` / `lock` / `x` 图标 + 文案；颜色非唯一信号 |
| 课程 | 搜索 + 开放列表，无卡片框 | 搜索 48px 高、边框 `var(--yx-text-secondary)`；行 `min-height:64px`；标题完整换行 |
| 错题本 | 单导航行 | 标题“错题本” + 副文案“回顾做过的错题” + chevron；≥72px |
| 底部次入口 | 安静文字动作，44px | “修改目标” / “进入测评”，无边框、品牌色 14px |
| 搜索清除 | 44×44，`aria-label` | 仅在有输入时出现；`AppIcon name="x"` |
| 焦点 | 2px `var(--yx-focus)`，offset 2px | 所有按钮/输入/行可见；搜索容器 `:focus-within` |
| 圆角 | `var(--yx-radius-card)` / `var(--yx-radius-button)`；进度条 pill | 不新增 token |
| 动效 | 不新增装饰动效；沿用 `data-motion` | 仅系统滚动/焦点，无渐变/漂浮 |

**颜色**：只消费 `--yx-*` 语义 token（`text-primary`、`text-secondary`、`surface-page/card/soft`、`border`、`brand`、`action`、`on-brand`、`danger`、`focus`）。控件边界用 `text-secondary` 以满足 ≥3:1；分隔线用 `border`。无 hex、无 `--v2-grad`、无 `#fff`、无品牌色硬编码。四主题（亮/暗/跟随系统/高对比）由 `useMobileExperience()` 的 `experienceStyle` 提供；高对比映射沿用 `packages/design-tokens/src/mobile.ts`。

## 2. 精确文案（`mobile.home.*`，zh-CN / en-US）

| key | zh-CN | en-US |
|---|---|---|
| `h1` | 今日学习 | Today's learning |
| `progress` | 已学 {done} 分钟 · 目标 {target} 分钟 | {done} min learned · {target} min goal |
| `progressUnknown` | 今日任务已读取 | Today's tasks loaded |
| `checking` | 正在确认学习状态… | Checking your learning access… |
| `loading` | 正在读取今日任务… | Loading today's tasks… |
| `errorTitle` | 今日任务暂不可用 | Today's tasks are unavailable |
| `errorHint` | 请稍后重试。 | Please try again shortly. |
| `retry` | 重试 | Retry |
| `forbiddenTitle` | 暂时无法查看今日任务 | Today’s tasks are not available to this account |
| `forbiddenDesc` | 当前账号没有查看今日任务的权限。你仍可以管理账号或查看帮助。 | This account cannot view today’s tasks. You can still manage your account or get help. |
| `tasks` | 今日任务 | Today's tasks |
| `taskCount` | {count} 项 | {count} |
| `minutes` | {count} 分钟 | {count} min |
| `statusCompleted` | 已完成 | Completed |
| `statusLocked` | 未解锁 | Locked |
| `statusUnavailable` | 内容暂不可用 | Content unavailable |
| `continueLearning` | 继续学习 | Continue learning |
| `startLearning` | 开始学习 | Start learning |
| `continueShort` | 继续 | Continue |
| `viewShort` | 查看 | View |
| `noTasks` | 今天还没有安排任务。 | No tasks scheduled for today. |
| `noTasksHint` | 可从下方选择课程。 | Choose a course below. |
| `guideAction` | 继续设置，开始学习 | Continue setup to start learning |
| `guideRemaining` | 剩余步骤：{steps} | Remaining steps: {steps} |
| `guideLabel.gate` | 还需要确认成人身份 | Confirm your adult eligibility first |
| `guideLabel.consent` | 还需要完成必要同意 | Required consent is still needed |
| `guideLabel.goal` | 还需要保存学习目标 | Your learning goal is not saved yet |
| `guideLabel.assessment` | 目标已保存，下一步进入定级 | Goal saved. Next is placement |
| `guideLabel.rejected` | 当前版本暂不能向你开放学习 | Learning is not available for this account |
| `stepsText.gate` | 确认身份、必要同意、学习目标 | Confirm identity, Required consent, Learning goal |
| `stepsText.consent` | 必要同意、学习目标 | Required consent, Learning goal |
| `stepsText.goal` | 学习目标 | Learning goal |
| `stepsText.assessment` | 定级 | Placement |
| `fl.noPlan` | 继续设置，开始学习 | Continue setup to start learning |
| `fl.noContent` | 第一次学习还没有可完成的任务 | No tasks are available for your first lesson yet |
| `fl.incomplete` | 继续完成第一次学习 | Continue your first lesson |
| `planConflict` | 计划版本已变化，请重新读取。 | The plan changed. Read it again. |
| `planReplanFailed` | 目标已保存。计划还没有按新目标重排。 | Goal saved. Your plan has not been re-ordered yet. |
| `planReadFailed` | 今日计划暂时未能读取。 | Today's plan could not be read. |
| `courses` | 课程内容 | Courses |
| `searchLabel` / `searchPlaceholder` | 搜索课程 | Search courses |
| `searchClear` | 清除搜索 | Clear search |
| `resultCount` | 共 {total} 门，匹配 {count} 门 | {count} of {total} courses |
| `catalogEmpty` | 书架里还没有可学习的内容。 | No courses are available yet. |
| `noMatches` | 没有匹配的课程。 | No courses match your search. |
| `shelfError` | 课程暂时没能加载。 | Courses could not be loaded. |
| `shelfUnavailable` | 课程列表暂不可用。 | The course list is unavailable. |
| `noSummary` | 暂无简介 | No description yet |
| `mistakes` | 错题本 | Mistakes |
| `mistakesDesc` | 回顾做过的错题 | Review the questions you answered incorrectly |
| `changeGoal` | 修改目标 | Change goal |
| `takeAssessment` | 进入测评 | Take assessment |
| `loginNote` | 登录后，继续查看你的学习进度。 | Sign in to see your learning progress. |
| `loginAction` | 登录后继续 | Sign in to continue |
| `navFailed` | 页面暂时无法打开，请重试。 | The page could not be opened. Please try again. |
| `coursesJumpFailed` | 没能跳到课程内容，请向下滚动。 | Could not jump to courses. Scroll down instead. |
| `empty.noPlan.title/description/action` | 还没有学习计划 / 先完成设置，再开始今天的练习。/ 开始设置 | No learning plan yet / Finish setup first, then start today’s practice. / Start setup |
| `empty.completed.title/description/action` | 今天的学习已经完成 / 已保存的练习还在。/ 查看课程 | Today’s learning is complete / Your saved practice is still here. / View courses |
| `empty.noContent.title/description/action` | 暂时没有可学习的内容 / 可以先看现在能打开的内容。/ 查看课程 | No learning content available right now / You can look at the content that is available now. / View courses |
| `empty.noReview.title/description/action` | 今天没有到期的复习 / 可以新学一节，或先看课程。/ 查看课程 | No reviews due today / You can start a new lesson or browse courses. / View courses |

服务端内容边界：`planQueue.explanation`、任务 `title/description/unavailableReason`、课程 `title/summary`、`shelfNote` 原文直接显示，不翻译、不拼接、不覆盖 `contentLocale`。`planNotice` 为 store 本地文案，页面按已知两种状态映射为 `planConflict` / `planReplanFailed`（字符串匹配，见 GAP）；非中英混杂。

## 3. 状态矩阵

| 状态 | 触发 | 呈现 | 动作 |
|---|---|---|---|
| 门校验中 | `accessChecked=false`（首次/每次 onShow） | 一行 `checking`，无旧业务/次出口 | 无 |
| 未登录 | `!session.isAuthenticated` | 一行 `loginNote` + 文字动作 | 登录 |
| 首页读取中 | `homeStatus idle/loading` | 一行 `loading` | 无 |
| 首页失败 | `offline/error` | 标题 + 说明 + 44px 重试，无假空态 | `loadHome()` |
| 无权限 | `forbidden` | 标题 + 说明，不提供“重试”假动作 | 全局 403 分流负责；不吞 |
| 正常 | `ready/empty/unavailable` | 进度 + 状态句 + 引导 + 任务 + 课程 + 错题本 + 次入口 | 见下 |
| 进度不可确认 | `target=0` 或 `stale` 或无任务 | 只显示 `progressUnknown`，不画 0% | 无 |
| 引导：gate/consent/goal | `showOnboardingGuide` 且步骤匹配 | 标签 + 剩余步骤 + 44px 引导按钮 | onboarding |
| 引导：assessment | 目标已存、未定级 | 同上 | assessment |
| 引导：rejected | `adultGate=REJECTED` | 不显示引导 | 全局 forbidden 分流 |
| 计划读取中 | `planQueueStatus idle/loading` | 不显示任务空态（避免“没任务”误读） | 无 |
| 计划失败 | `planQueueStatus=error` | `planReadFailed` + 重试 | `refreshPlanQueue()` |
| 计划空：NO_PLAN | `emptyReason=NO_PLAN` | 空态标题/说明 + “开始设置” | onboarding |
| 计划空：COMPLETED | `emptyReason=COMPLETED` | 完成态 + “查看课程”（无自己导航） | 滚动书架 |
| 计划空：NO_CONTENT | `emptyReason=NO_CONTENT` | 空态 + 有课程时“查看课程” | 滚动书架 |
| 计划空：NO_DUE_REVIEW | `emptyReason=NO_DUE_REVIEW` | 空态 + 有课程时“查看课程” | 滚动书架 |
| 无任务且有原因缺失 | tasks 空、plan ready、reason null | `noTasks`（不编造 actions） | 无 |
| 任务：首可执行 | AVAILABLE/IN_PROGRESS 且有 contentCode 的第一条 | 标题/meta/描述 + 全宽主 CTA | learn（带 contentCode + taskId） |
| 任务：其他可执行 | 同上非首条 | 行内 ghost “继续/查看” | learn（带 contentCode + taskId） |
| 任务：已完成 | COMPLETED | 行 + check + “已完成”，无按钮 | 无 |
| 任务：锁定 | LOCKED | 行 + lock + “未解锁”，无按钮 | 无 |
| 任务：不可用 | UNAVAILABLE | 行 + x + 原因（无原因用“内容暂不可用”）；描述与原因相同不重复 | 无 |
| 课程：结果 | 有可访问且匹配 | 行列表；有查询时显示计数 | 打开课程 |
| 课程：空目录 | 可访问数 0 | `catalogEmpty` | 无 |
| 课程：无匹配 | 查询无命中 | `noMatches` + 清除入口 | 清除 |
| 课程：失败/不可用 | `contentStatus=UNAVAILABLE` | `shelfUnavailable` + 重试；同时保留搜索 | `loadHome()` |
| 忙碌 | `busy!=null` | 所有动作按钮 disabled（不隐藏） | 无 |
| 导航失败 | navigate 抛错/路径未变 | `navFailed`（仅登录且同页时） | 重试 |
| 身份切换 | `identityRevision` 变化 | 清搜索/错误/guide；store reset 清 home | — |

`planEmpty` 仅在 `planQueueStatus ready|empty` 时成立；`error` 时显示失败行而不是空态。`showNoTasks` 还要求 `planSettled && !planReadFailed`，避免计划失败被显示成“今天没任务”。

## 4. 动作与导航

| 动作 | 目标 | 说明 |
|---|---|---|
| 设置 | `/pages/settings/settings` | `navigateTo`，guard 生效 |
| 引导 | `/pages/onboarding/onboarding` 或 `/pages/assessment/assessment` | 由 `selectOnboardingResumeStep` 决定，事实仍来自 session marker + server plan |
| 首任务/其他任务 | `/pages/learn/learn?contentCode=…&taskId=…` | 仅 AVAILABLE/IN_PROGRESS 且有 contentCode；不伪造完成写口 |
| 课程行 | `/pages/learn/learn?contentCode=…` | 仅 PUBLISHED |
| 空态 courses | `#course-shelf` 就地滚动 | `uni.pageScrollTo({selector})`，失败回退 H5 `scrollIntoView`；不重新打开 home |
| 错题本 | `/pages/b10-report/b10-report` | 单导航行，无数量编造 |
| 修改目标 | `/pages/onboarding/onboarding` | 安静次入口 |
| 进入测评 | `/pages/assessment/assessment` | 安静次入口；不代替定级事实 |
| 登录 | `/pages/login/login` | 未登录回退 |
| 重试首页/计划 | `store.loadHome()` / `store.refreshPlanQueue()` | 有 busy；401 由全局清会话并导航 |

导航实现：`getUniRuntime().navigateTo({url})`，runtime 返回 Promise 时 `await`；失败后轮询 `currentMobilePagePath()`，路径变化视为 guard 已接管，不显示错误。**局限**：`openUniPage` 对 tab 页的 query 交接是同步 void，本页所有动作目标均非 tab，因此未使用该分支；若未来新增 tab 目标，需按 `openUniPage` + `consumePendingNavigationQuery` 约定另行说明，不在本页发明 API。

## 5. 追踪映射

| 层 | 值 |
|---|---|
| PAGE | `PAGE-P1-LEARN-HOME`（主）；`PAGE-P1-TODAY`、`PAGE-P1-PLAN-MAP`、`PAGE-P1-COURSE-SHELF`、`PAGE-P1-MISTAKES-MASTERY`、`PAGE-P1-ASSESSMENT` |
| JNY | `JNY-P1-03`（目标）、`JNY-P1-04`（定级）、`JNY-P1-05`（首日/首页/每日任务）、`JNY-P1-08`（错题） |
| RULE | `RULE-P1-DAILY-PLAN`、`RULE-P1-SESSION` |
| INT | `INT-P1-003`、`INT-P1-004` |
| E2E | `E2E-P1-FIRST-DAY`、`E2E-P1-TODAY-SESSION` |
| R1 | `R1-017`（引导/Session marker）、`R1-032`（计划横幅）、`R1-033`（解释）、`R1-034`（任务指针）、`R1-035`（空态分流）、`R1-037`（跨端读回）、`R1-040`（书架/搜索/续学）、`R1-041`（计划今日交互） |
| GAP | 本页完整 `FEAT/PRD-ATOM/V2-980`、`ARCH-*`、书架 `INT-*`、`ACT-P1-SYSTEM` 未在现有卡闭合；不补造 |

## 6. 与参照图的 intentional differences

1. **无亮紫渐变背景**：全部用 `--yx-*` 表面/文字色；参照图为演示偏亮紫。
2. **进度按真实数学**：`5/15 = 33.33%`；参照图进度条约 20% 仅为示意。
3. **状态按真实任务状态**：完成/锁定/不可用显示文字状态，不放“死按钮”；不可用原因只出现一次（状态位），描述重复时省略。
4. **无每行装饰图标**：仅保留状态图标（check/lock/x）与 chevron；任务/课程不配装饰性文档/书本/耳机图标，避免字符串装饰。
5. **搜索增加清除与计数**：44px 清除按钮、`共 N 门，匹配 M 门`；参照图只有输入框。
6. **进度不可确认时不画 0%**：参照图默认有目标；候选在 `stale`/`target=0` 时给诚实文案。
7. **错误/空态是轻量文本行**：不使用大等待框/大卡片。
8. **桌面 720px 阅读线**：参照图仅移动端。
9. **中文/英文与 200% 文字**：所有关键行可换行，标题 `word-break:normal`，不拆成字母列。
10. **次入口为文字动作**：参照图带图标；候选保留“修改目标/进入测评”文案与 44px 命中区，不新增图标依赖。

## 7. 可访问性与边界

- 单 H1；按钮原生 `button` + `tabindex=0` + `role=button`；`aria-label` 覆盖设置、搜索、清除；进度条 `role=progressbar` + `aria-valuenow/min/max`；状态行 `role=status`，错误 `role=alert`。
- 颜色不单独表状态：完成/锁定/不可用均有文字与图标。
- 焦点：`outline: 2px var(--yx-focus)`，搜索 `:focus-within`。
- 控件尺寸：主 48px、次 44px、搜索 48px、清除 44px、课程行 ≥64px、错题行 ≥72px。
- 对比：控件边界用 `text-secondary`，文字/背景用语义 token；高对比主题由 token 适配。**未实测**对比值，Root 浏览器侧需按实际主题测量。
- 不改 `pages.json`/5 tab/共享 Header/Token/API/权限；`completeTask` 不接线，首页不虚构完成。
- 已知 GAP：`learner.home.read` 与客户端 `learning.plan.read` 门不匹配（未改权限）；`planNotice` 本地文案靠字符串识别；`shelfNote` 从 summary 文本探测“已锁定”；服务端 `planNotice/explanation/unavailableReason/summary` 可能为中文；`scrollToCourses` 的原生 selector 支持未验；导航 await 在 guard 重定向下只能以路径变化判定。
