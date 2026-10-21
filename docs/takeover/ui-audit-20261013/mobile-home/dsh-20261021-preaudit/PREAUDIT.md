# MB007 实际首页有界只读预审（2026-10-21）

状态：`PREAUDIT_ONLY / H5_NOT_RUN / NO_PRODUCT_CHANGE`。只读对象 `apps/mobile/src/pages/home/home.vue` 及其直接 domain/API/store/session/navigation、`packages/i18n`、语义 token、既有设计/契约/R1 卡。本次只写本目录两个文件，未改产品/测试/i18n/token/进度索引，未提交、未 fetch/push、未启动浏览器/服务器、未安装依赖。DSH 浏览器 spawn EPERM 已知，未重试。以下为源码关切与设计差异，**不是实际界面 PASS/FAIL**；本报告不宣称 UI 完成。

基线：分支 `dev-redesign`，HEAD `5b3ca5a7` `[实测]`（`git log --oneline -1`）。本地 UI 9 / 远程 7，MB005 `758dc0fb` 与 MB006 C8 均未推，PUBLISH_BLOCKED `[读取]` `CURRENT-HANDOFF.md:3,6`。MB006 C8 已签，本报告不重做 C8 `[读取]` 同上。R1 站级：IT-1 REJECT/IT-2 BLOCKED，未签 READY `[读取]` `CURRENT-HANDOFF.md:61`。保护 manifest `.git/codex-local-backups/ui-audit-20261013/preexisting-work.json` 存在（11308B），未读写覆盖 `[实测]`（`Test-Path`/`Get-Item`）。

## 1. 当前首页真实区域、状态、按钮与数据来源

页文件 207 行，入口 `apps/mobile/src/pages.json:4-9`（`navigationStyle: custom`，标题“学习”），tabBar 第 1 项 `pages/home/home`（`:242-245`）。页根 `useMobileExperience()` 注入 `--yx-*` 主题变量与动效态（`home.vue:5,96`）。

| # | 区域/位置 | 实际内容与动作 | 数据来源 |
|---|---|---|---|
| 1 | 页头 `:98` | `MobilePageHeader page="home" compact`：品牌字标 + 设置按钮（44px）→ `/pages/settings/settings`；compact 下 kicker/description 隐藏，保留 `role=heading aria-level=1` 的标题（当前 i18n 文案“今天学什么？”） | `components/MobilePageHeader.vue:6,13-22,34-36`；`packages/i18n/src/mobile-experience.ts:4,38` |
| 2 | 引导条 `:100` | 条件 `guideVisible`：进度句 + “剩余步骤：…” + 主按钮“继续设置，开始学习”→ `/pages/onboarding/onboarding` 或 `/pages/assessment/assessment` | `store.onboardingResume`（IAM `/iam/principal/me` + `/learner/targets`）；`domain/onboarding-resume.ts:67-74,215-225` |
| 3 | 首学提示 `:101` | `role=status` 一句话（NO_PLAN/NO_CONTENT/INCOMPLETE 三种） | `store.planQueue.firstLearning` ← `GET /learning/today`；`domain/plan-today.ts:158-163` |
| 4 | 计划解释/通知 `:102-103` | 两条可并存 `role=status` 横幅：`planQueue.explanation`、`store.planNotice`（409/重排失败） | `/learning/today`；`store.replanAfterGoal` 409 文案 |
| 5 | 加载态 `:105` | 单卡 `role=status`“正在读取今日任务…” | `homeStatus` idle/loading |
| 6 | 错误态 `:106-110` | `role=alert`“今日任务暂不可用”+ `store.lastError` 或“请稍后重试。”+“重试”→ `store.loadHome()` | `homeStatus` offline/error/forbidden；`stores/learner-content.ts:444-450` |
| 7 | 问候 `:112` | “一点积累，走得更远”+“你好，继续今天的学习”（视觉第二标题，非语义 H1） | 硬编码 |
| 8 | 渐变 hero `:113-122` | “今日学习 · 目标 N 分钟”、“继续推进”、“今日共 N 个任务”、进度行/进度条、“继续课程”（无可用任务时 disabled） | `home.targetMinutes/tasks/completedMinutes`；`store.progress`（completed/target，`:68-71`）；`canContinueCourse`（AVAILABLE/IN_PROGRESS 且有 contentCode） |
| 9 | KPI 三联 `:123-127` | 今日任务数、课程内容数、今日进度%（仅 `hasConfirmedProgress` 时显示第三项） | 同上；`hasConfirmedProgress` 要求 tasks 非空 + target>0 + 非 stale（`:21`） |
| 10 | 今日任务卡 `:129-138` | 标题“今日任务（N）”；`planEmpty` 空态（标题/说明/动作）；无任务通用空态（`:133`，`:hidden` 与 `v-if` 并用）；任务行：标题、描述 + 分钟、UNAVAILABLE 原因；右侧按钮按状态显示“已完成/未解锁/暂不可用/继续课程/查看课程”，仅 AVAILABLE/IN_PROGRESS 且有 contentCode 可点 | `home.tasks`；`planEmpty` ← `planQueueStatus`/`emptyReason`（`:40-44`）；`domain/plan-today.ts:139-156` |
| 11 | 错题本卡 `:140-145` | 固定说明 + “进错题本”→ `/pages/b10-report/b10-report`；无数量、无读取状态 | 静态文案；报告页路由已注册 `pages.json:207` |
| 12 | 课程内容卡 `:147-161` | “课程内容”、锁定说明（`shelfNote` 从 summary 文本嗅探“已锁定”）、搜索框（`v-model`，`type=search`，aria-label/placeholder“搜索课程”）、三态提示、课程行（标题 + 简介/“暂无简介”）→ `/pages/learn/learn?contentCode=…`；`contentStatus=UNAVAILABLE` 时另给 `role=alert`“课程列表暂不可用。” | `home.content` ← `GET /content/learner/catalog`；`isAccessibleContent` 仅 PUBLISHED（`domain/plan-today.ts:165-167`）；`shelfSearchState`（`:169-176`）；`domain/content-release.ts:78-84` |
| 13 | 次级入口 `:164` | 常驻两按钮：“修改目标”→ onboarding，“进入测评”→ assessment（在 `v-else-if="store.home"` 主体之外，加载/错误/未登录也显示） | 路由已注册 `pages.json:179,186` |
| 14 | 登录提示 `:166` | 仅 `!session.isAuthenticated`：“登录后，继续查看你的学习进度。”+“登录后继续”→ `/pages/login/login` | `stores/session.ts:69` |

数据读取链：`onShow` → `ensureMobilePageAccess('/pages/home/home')` → `void store.loadHome(); void loadGuide()`（`home.vue:77`）。`loadHome()` 先 `restore()`，再 `ensureContentLocale`（必要时 `GET /learner/profile|targets|preferences`），随后并发 `GET /api/v1/learner/home?contentLocale` 与 `GET /api/v1/content/learner/catalog?contentLocale`，最后 `refreshPlanQueue()` → `GET /api/v1/learning/today`（`stores/learner-content.ts:444-463`；`api/learner-content.ts:732-738`；`api/plan-today.ts:9-11`）。`loadGuide()` 读 `/iam/principal/me` 与 `/learner/targets`（`api/learner-content.ts:443-533`）。`completeTask` 已有（`POST /onboarding/daily-tasks/{id}/complete`，`api/learner-content.ts:744-747`），但首页未接线，故本页不会把任务置完成、也不会更新已完成分钟。

已知未展示但已读取的事实：`planQueue.arrangements/deferredCount/itemCount/targetMinutes/planVersion`（`store` 已解析）未在首页渲染；`home.projectionVersion/contentEpoch` 未展示；错题本无数据读取。

## 2. 契约、IAM、owner、阶段门与 R1/PAGE/JNY 映射

| 边界 | 已确认事实 | 证据 |
|---|---|---|
| 首页投影 | `GET /api/v1/learner/home`，operationId `getB9LearnerHomeProjection`，owner **learner-service**，`requiredPermission: learner.home.read`，默认 DENY，PEP 本地；信任 subject/tenant/owner/role/permission/phase/adultGate/consent/contentRights/policyVersion；客户端无授权字段 | `packages/contracts/fragments/b9/b9-learner.openapi.json`（约 `:973-1043`）`[读取]`；`p1r-gateway-boundary.openapi.json:2635-2648` |
| 内容目录 | `GET /api/v1/content/learner/catalog`，owner **content-service** | `p1r-gateway-boundary.openapi.json:2798-2809` |
| 今日/计划 | `GET /api/v1/learning/today`，owner **learning-service**；`plans:ensure`/`plans:replan` 同 owner | `p1r-gateway-boundary.openapi.json:3308-3315`；`api/plan-today.ts:13-29` |
| 任务完成 | `POST /onboarding/daily-tasks/{taskId}/complete` 客户端已存在；网关边界片段未检索到同名 public path，owner 未证实 → **GAP** | `api/learner-content.ts:744-747`；网关片段未命中 `[读取]` |
| IAM/阶段门 | Phase 1 仅 18+；服务端 `adultGate=PASSED` + `adultLearningAccess=ELIGIBLE` + `learning.plan.read` 才 `isLearningReady`；受保护路由由 `ensureMobilePageAccess`/拦截器复核 | `stores/session.ts:63-71`；`auth/navigation.ts:229-287,313-316`；根 `AGENTS.md` §2 |
| 页面权限缺口 | 首页契约要求 `learner.home.read`，但客户端页门只校验 `learning.plan.read` → **GAP**（有 plan 读权限但无 home 读权限时页可进入并 403；反向也不能证明放行正确） | 上两行 `[推断]` |
| 内容权限 | 仅 `availability=PUBLISHED` 进入书架；UNPUBLISHED/RIGHTS_PENDING/RIGHTS_EXPIRED/NOT_READY 被过滤；`contentStatus=UNAVAILABLE` 时整卡告警。是否有独立的 `learner.content.read` 权限未在本次片段证实 → **GAP** | `domain/plan-today.ts:165-167`；`content-release.ts:78-84`；`[未验证]` |
| 阶段/签收 | IT-1 REJECT、IT-2 BLOCKED、R1 未 READY；本页 UI 预审不改变站级结论 | `CURRENT-HANDOFF.md:61` |
| PAGE | `PAGE-P1-LEARN-HOME`（canonical `/learn/home`；mobile 当前 `/pages/home/home`，合并态）；关联 `PAGE-P1-TODAY`、`PAGE-P1-PLAN-MAP`、`PAGE-P1-COURSE-SHELF`、`PAGE-P1-MISTAKES-MASTERY`、`PAGE-P1-ASSESSMENT` | `03-全端页面功能登记册.md:77` 及相邻行 |
| JNY | `JNY-P1-03`（目标/时长，PAGE ONB-GOAL）、`JNY-P1-05`（首日计划/首页/每日任务；PAGE PLAN-MAP/LEARN-HOME/TODAY；RULE DAILY-PLAN/SESSION；INT-003/004；E2E FIRST-DAY/TODAY-SESSION）、`JNY-P1-04`（定级）、`JNY-P1-08`（错题） | `02-端到端业务旅程台账.md:62,77,197-199` |
| R1 | R1-017（IC-057/009 引导条，按钮去定级，owner learner-web，依赖 R1-010）；R1-030（BC-023 ensure 计划）；R1-032（BC-025 首页计划横幅，owner learner-web/mobile）；R1-033（BC-026 一句话解释，learning-service）；R1-034（BC-027 任务 practiceRef）；R1-035（BC-028 空态分流）；R1-037（BC-030 跨端读回一致）；R1-038（BC-031 快照不可变）；R1-040（BC-199 书架/搜索/续学）；R1-041（IC-013…021/029 计划今日交互验收）；R1-042（L3 干净库重放，QA） | `dev-plan-R1.md:28,71-83`；`business-chains.md:94-101,390` |
| FEAT/PRD-ATOM/V2-980 | 本次片段未给出该页完整原子 ID 与 ARCH 映射 → **GAP**，不补造 | 未在已读卡/登记册行闭合 `[读取]` |
| INT/E2E | JNY-05 行给出 INT-P1-003/004、E2E-P1-FIRST-DAY/TODAY-SESSION；书架/搜索的 INT-* 未在该行闭合 → **GAP** | 同上 |
| ACT | `ACT-P1-LEARNER`（设计与 traceability）；system 参与失败恢复的精确 ACT 未逐条闭合 → **GAP** | `design-source-traceability.md:21` |

## 3. 简约全面重排方案（不删所需任务）

方向按 Root 已目检的参照：单 H1“今日学习”、轻品牌 + 设置；真实 `已完成/目标` 分钟进度；开放任务列表 + 首任务主 CTA；课程搜索/两行列表；错题本；目标/测评次入口；保留 5 tab。无 hero 渐变、无 KPI 口号卡、不造数。

1. **信息层级**：页头保留字标/设置，H1 只出现一次（“今日学习”）；删除“一点积累，走得更远”“你好，继续今天的学习”“继续推进”与重复 kicker。说明/解释改为正文级一句话，不再用诗性标题占首屏。
2. **今日首任务**：在任务列表上方给“下一步”区，只取第一条 `AVAILABLE/IN_PROGRESS` 且 `contentCode` 的任务（与 `continueCourse()` 同序），显示标题 + 分钟 + 主按钮“继续学习/开始学习”；无可用任务时整区不渲染，不拿“继续推进”占位。按钮复用 `openTask` 的真实行为，不新造完成写口。
3. **真实进度**：仅当 `hasConfirmedProgress`（有任务、target>0、非 stale）显示“已完成 {completed} / {target} 分钟”与进度条；stale 或 target 未知时只显示“已读取今日任务”，不显示 0%、不显示百分比假精度。删除 hero 与 KPI 中重复的任务数/内容数/进度三联。
4. **简洁任务列表**：一张卡，标题“今日任务（{count}）”；行内标题/描述/分钟/不可用原因按真实字段；状态按钮保留 5 态文案与禁用条件（不删 LOCKED/COMPLETED/UNAVAILABLE 行，不把不可用任务藏掉）。`planEmpty` 与“无任务”只能二选一渲染，修掉 `:hidden`+`v-if` 并存。
5. **课程搜索/书架**：搜索框 + 两行列表（标题一行、简介一行，超出省略但可访问全文），显示结果数/总可学数；空目录、无匹配、加载失败三态分开；`UNAVAILABLE` 用整卡告警而非普通空态；release note 改为结构化来源（如 `contentVersionPin`）而非文本嗅探“已锁定”（当前 `shelfNote` 属脆弱实现，改它需另开数据/契约核对）。
6. **错题本**：保留卡与真实入口 `/pages/b10-report/b10-report`；不编造错题数、待复习数；说明只讲“答错的题会收进错题本”。
7. **目标/测评次级出口**：从常驻双主按钮降为安静的次级行/链接，且只在页面可交互态显示；顺序与 onboarding 引导一致（未保存目标先“修改目标”，已保存再“进入测评”）。不把测评当首任务，不因重排删掉 guide。
8. **去装饰**：移除 `--v2-grad` hero、`#fff` 硬编码、KPI 卡、卡中卡描边与多余阴影；统一用 `--yx-*` 语义色/字号/间距/焦点；空态/错误/状态不用品牌色堆叠。四主题（亮/暗/跟随系统/高对比）与减弱动效保持。

边界：只动 `home.vue` + `packages/i18n/src/mobile-experience.ts` 的本页键；如需改 `store` 的请求序号/防重或 `shelfNote` 数据来源，先单列 GAP 与最小测试，不在视觉重排里静默扩共享。

## 4. 中英文确切文案允许清单与状态文案

原则：所有可见文案经 `packages/i18n`；UI 语言与 `contentLocale` 分离（课程标题/简介来自内容语言，不翻译、不覆盖）；数字/计数/分钟走 i18n 参数。下表为**允许使用**的最终文案（zh-CN / en-US），新增键建议置于 `mobile.home.*`；`pages.home.title` 是否改为“今日学习”需与 Root 参照对齐（**决策 GAP**，二者只能有一处生效）。

| 键/场景 | zh-CN | en-US |
|---|---|---|
| H1 | 今日学习 | Today's learning |
| 进度（真实） | 已完成 {done} / {target} 分钟 | {done} of {target} min completed |
| 进度不可确认 | 已读取今日任务 | Today's tasks loaded |
| 首任务主按钮 | 继续学习 | Continue learning |
| 首任务（未开始） | 开始学习 | Start learning |
| 任务卡标题 | 今日任务（{count}） | Today's tasks ({count}) |
| 任务状态 | 已完成 / 未解锁 / 暂不可用 / 继续课程 / 查看课程 | Completed / Locked / Not available / Continue course / View course |
| 无任务 | 今天还没有安排任务。 | No tasks scheduled for today. |
| 无任务补充 | 可从下方选择课程。 | Choose a course below. |
| 加载 | 正在读取今日任务… | Loading today's tasks… |
| 错误标题 | 今日任务暂不可用 | Today's tasks are unavailable |
| 错误说明 | 请稍后重试。 | Please try again shortly. |
| 重试 | 重试 | Retry |
| 课程区标题 | 课程内容 | Courses |
| 搜索 | 搜索课程 | Search courses |
| 结果计数 | 共 {total} 门，匹配 {count} 门 | {count} of {total} courses |
| 空目录 | 书架里还没有可学习的内容。 | No courses are available yet. |
| 无匹配 | 没有匹配的课程。 | No courses match your search. |
| 加载失败 | 课程暂时没能加载。 | Courses could not be loaded. |
| 列表不可用 | 课程列表暂不可用。 | The course list is unavailable. |
| 无简介 | 暂无简介 | No description yet |
| 错题本 | 错题本 | Mistakes |
| 错题说明 | 答错的题目会收进错题本，随时回来补救。 | Incorrect answers go to Mistakes for later review. |
| 错题入口 | 进错题本 | Open Mistakes |
| 次级：目标 | 修改目标 | Change goal |
| 次级：测评 | 进入测评 | Take assessment |
| 未登录 | 登录后，继续查看你的学习进度。 | Sign in to see your learning progress. |
| 未登录按钮 | 登录后继续 | Sign in to continue |
| 引导按钮 | 继续设置，开始学习 | Continue setup to start learning |
| 引导进度 | 剩余步骤：{steps} | Remaining steps: {steps} |
| 引导步骤 | 确认身份 / 必要同意 / 学习目标 / 定级 | Confirm identity / Required consent / Learning goal / Placement |
| 计划解释（服务端） | 服务端原文，不拼接 | Server-provided text, verbatim |
| 计划版本冲突 | 计划版本已变化，请重新读取。 | The plan changed. Read it again. |
| 重排失败 | 目标已保存。计划还没有按新目标重排。 | Goal saved. Your plan has not been re-ordered yet. |

以下现有文案**只允许保留在既有 domain 空态/引导函数**，不得在页面另写一份；若保留则必须经 i18n 包装（当前为硬编码中文，属 GAP）：`还没有学习计划`/`先完成设置，再开始今天的练习。`/`开始设置`；`今天的学习已经完成`/`已保存的练习还在。`/`结束学习`；`暂时没有可学习的内容`/`可以先看现在能打开的内容。`/`看可用内容`；`今天没有到期的复习`/`可以新学一节，或先结束今天。`/`新学或结束`；`今日任务没有加载成功`/`已提交的进度会保留。`/`重试`；`继续设置，开始学习`；`第一次学习还没有可完成的任务`；`继续完成第一次学习`；`今天排不下，已顺延，这不是欠账。`；`今日任务 {n}`/`按服务端内容版本继续学习。`（API 兜底）。禁止新增口号、承诺式或恐吓式文案；禁止把“测量/等级/已掌握”写进首页。

## 5. 页面级 owner / onShow / hide / busy / late GET 安全关切与现有 store 保护

- **owner 链**：页面本身无数据 owner；读模型分别归 learner-service（home）、content-service（catalog）、learning-service（today/plan）；IAM 归成人门/同意/权限。页面不得本地判定 owner、成人门、内容权限或计划状态。
- **onShow**：每次显示都 `ensureMobilePageAccess` 后再 `loadHome()` + `loadGuide()`（`:77`）。从 learn/assessment/onboarding 返回会重复读；`loadHome()` **无 in-flight 去重/请求序号**，同一身份下先发后到的旧响应可能覆盖新响应（当前只有 `stillCurrent(owner)` 身份校验，`:76-91,448`）→ **GAP**，需按“同身份请求序号/最后写入”测试，不能只凭 identityRevision 断言安全。
- **onHide**：本页无 `onHide` 清理；搜索词、`guideReady`、`planNotice` 在页面存活期保留。返回后是否应保留搜索词属产品决策（**GAP**），但不得把旧账号/旧身份的 guide 或 home 投影带入新身份（store 的 `watch(identityRevision, reset)` 会清空，`:137`，需实测）。
- **busy**：无页面级 busy。`homeStatus='loading'` 只驱动加载卡，按钮不禁用；`loadHome` 重入会并发请求；`loadGuide` 在 `await` 前把 `guideReady=false`，失败则永不显示，这正确避免假引导，但没有“读取失败”出口。重试按钮在 `forbidden` 态也调用 `loadHome()`，无权限时会再次 403，应在 UI 上把 403 与网络失败分开（**GAP**，`navigation.ts:326-357` 已有全局 403 分流，但本页未区分展示）。
- **迟到的 GET/写入**：必须保留 `scope()`、`sameIdentity`、`identityRevision`、`watch(...,{flush:'sync'})`、`stillCurrent` 检查（`stores/learner-content.ts:76-91,137,448`）；保留 `LOCAL_REAL_RUNTIME` 下不从缓存把 home 当权威（`:19,145-167`）；保留 `preserveContentProjectionAfterCompletion`（`:517-523`）；保留 401 清会话、`CONSENT_REQUIRED` 回 onboarding、撤回同意去 forbidden（`navigation.ts:326-357`）。不得扩展成新的共享 store 安全层，也不得为首页删这些检查。
- **不默认扩共享**：若为修并发/幂等需要改 store，必须单列最小 diff + 具名测试；本预审不授权改共享。

## 6. 测试矩阵与真实交互要点（全部 NOT_RUN）

| 组 | 必验内容 |
|---|---|
| 真实入口/环境 | 正式 `#/pages/home/home`（canonical `#/` 根入口必须落到本页而非空白）、18183 固定端口、当前源哈希；before/after 同视口截图；DOM/Console Error/水平溢出；构建成功不替代。DSH 浏览器 EPERM 不重试，由 Root 审核脚本后执行。 |
| 状态全覆盖 | idle/loading；ready（5 种 task 状态各一 + 混合）；empty×5（NO_PLAN/COMPLETED/NO_CONTENT/NO_DUE_REVIEW/READY）；home offline/error/forbidden；content READY/EMPTY/UNAVAILABLE；stale=true；guide 各步（gate/consent/goal/assessment）+ `adultGate=REJECTED`；planExplanation 有/无；planNotice 409/失败；未登录深链。逐态核标题、主次动作、禁用语义与“不造任务/计划”。 |
| 搜索原生即时值 | 键盘逐字输入、IME 组合输入（中文拼音未上屏不触发错误过滤）、大小写/首尾空格、清空、无匹配、切语言后重输；断言 `v-model` 在原生 `input` 事件即更新、结果计数与列表即时一致；不得防抖到“看起来没反应”，也不得只在提交时过滤。 |
| 页面恢复/onShow | 从 learn/assessment/onboarding/settings 返回各一次：重新读取、进度与任务状态刷新、搜索词/滚动保留策略一致；快速来回切页不产生旧响应覆盖新响应；同一身份并发两次 `loadHome` 只允许最后一次生效（需请求序号或可证明的幂等）。 |
| busy/重复点击 | 加载中连点重试、连点首任务/课程行/次级入口；只允许一次导航；错误后重试不再累加请求；任务按钮 disabled 期间不可触发。 |
| 迟到响应/身份 | 延迟旧 home/catalog/today/guide 响应；期间切换账号/退出/失权：旧响应不得显示旧任务、旧课程或旧引导；401 后回登录、403 按同意/权限分流。 |
| 权限与内容 | 仅 PUBLISHED 可进书架并可点入；RIGHTS_*/UNPUBLISHED/NOT_READY 不出现为可学；`learner.home.read` 缺失时显式无权限，不伪装空列表（当前页门用 `learning.plan.read`，必须实测该不匹配）。 |
| 契约/不造数 | 空 plan 只显示 `emptyReason` 对应动作；`NO_PLAN` 只去 onboarding，绝不去测评/不生成任务；无 planId 不显示“可开始”；无报告不显示等级；`targetMinutes=0` 不显示 0 分钟进度；错题本不显示数量。 |
| 排版/主题/语言 | 320/390/768/1280 宽；zh-CN/en-US；亮/暗/跟随系统/高对比；200% 文字与长标题/长简介/长错误；正文 16/24、标题 28/39、辅助≥14px；控件≥44/48px；边界/焦点对比≥3:1（含 hero 移除后）；四主题语义色，无硬编码品牌色/`#fff` 文本。 |
| 键盘/指针/屏幕阅读 | Tab 顺序：设置→引导→搜索→首任务→任务行→课程行→次级入口；Enter/Space 激活；焦点可见；heading 层级仅一个 H1；`role=status/alert` 不重复播报；任务状态不只靠颜色。 |
| 工程与范围 | 必要 mobile typecheck/build；具名状态/契约/race 测试；作者与独审绑定同一实际源哈希；真实后台/IAM/native/iPad/Windows 与 fixture 结果分列，不以本页 UI 通过签 R1/IT/发布。 |

## 关键风险（按优先级）

1. 全页硬编码中文，只有 Header 走 i18n；切英文即混合语言。i18n 键与空态文案均未接入。
2. 渐变 hero + `#fff` 文本 + `--v2-grad` 品牌 hex（`theme/v2-tokens.scss:53,89`）绕过 `--yx-*` 语义 token；高对比主题下 hero 变纯品牌色，白字对比未验证。
3. 双标题/双 KPI/多层卡：Header H1 与“你好，继续今天的学习”竞争，hero 与 KPI 重复任务数/进度，卡中卡描边。
4. 大量 22rpx≈11px、21rpx≈10.5px、23rpx≈11.5px 文本，低于 14px 辅助下限。
5. 搜索仅 `v-model` 过滤，无计数/清除/IME 处理；`shelfNote` 以文本包含“已锁定”推断锁定状态，脆弱。
6. `planEmpty` 在 `planQueueStatus` 非 ready/empty 时返回 null，任务卡随即落入“今天还没有安排任务。”，计划读取失败会被误读为“今天没任务”。
7. `:hidden` 与 `v-if` 并用（`:133`），H5 下 `hidden` 属性未必生效，两套空态可能同时出现。
8. 次级入口常驻于状态主体之外：加载/错误/403/未登录时仍显示“修改目标/进入测评”，且“进入测评”不区分是否已保存目标。
9. `loadHome` 无重入保护/请求序号；`onShow` 反复触发，同身份旧响应可能覆盖新响应（需实测，勿先断言）。
10. 权限门不匹配：页门校验 `learning.plan.read`，首页契约要求 `learner.home.read`。
11. 首页不调用 `completeTask`，进度只能由学习页改变；若视觉上做“完成”按钮即造行为。
12. 未登录块在本页受保护路由下近乎不可达，属死状态；保留会误导“可先看首页再登录”。

## 所需依赖 / 下一步

- Root 提供已目检的完整简约首页参照（单 H1、真实进度、首任务 CTA、搜索/二行列表、错题本、次级入口、5 tab）；作者据此实施，不自行改 IA。
- 决策 GAP 需 Root 定：H1 用 `pages.home.title` 还是 `mobile.home.title`；搜索词是否跨 `onShow` 保留；403 与网络失败是否分开展示；是否补 `learner.home.read` 页门（涉及 session/权限，需单列）。
- 实施前确认 i18n 文件最新字节，仅窄补本页键；不覆盖 MB005/MB006 或其他页；不编辑共享 Header/Token 服务本页布局。
- 本页验收由 Root 审核脚本后执行；本报告不产生候选源、截图、PASS、签收、提交或推送。
