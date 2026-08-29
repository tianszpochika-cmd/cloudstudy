# Phase 1 UI/UX 需求追溯与页面状态补充设计

> **状态：Historical / Superseded（历史 v1 UI/UX 补充）。** `P1-BASELINE-20260820` 仅用于旧任务回放；新一轮业务设计、任务与验收以 [`../../v2-980plus/README.md`](../../v2-980plus/README.md) 为唯一基线。
> 唯一事实范围：本文件只补充 UI/UX 可追溯关系、页面状态和验收映射，不改变需求账本、共享 README、功能矩阵、API 契约或代码。  
> 阅读基线：[AGENTS.md](../../../../AGENTS.md)、[requirements](../../../../requirements/README.md)、[Phase 1 跨文档基线](../../../../requirements/backlog/Phase-1范围冻结与跨文档基线.md)、[feature-matrix.md](../../../../requirements/feature-matrix.md)、[UIUX 00~24](../uiux-specs/00_README_设计文档索引.md)、[detailed-specs 01~08](../../detailed-specs/01_Onboarding与自适应首屏详细设计.md)。

## 0. 范围与追溯口径

### 0.1 目标

本文件把 Phase 1 的 171 个 FEAT 逐项连接到：

1. 四个冻结前端项目：mobile、learner-web、admin-web、official-site；
2. 已冻结的语义页面路由或其明确宿主页面；
3. 可验证的进入入口、成功、空、加载、错误、离线、权限和恢复状态；
4. 可回放的 Deep Link、埋点事件族和验收证据。

“补齐”只表示把已有需求或详细设计已经描述的能力放到既有页面宿主和状态模型中；不表示创建新的业务项目、页面族、业务对象、FEAT 或接口。

### 0.2 源文档与 ID 规则

| 事实 | 本文件采用的处理 |
|---|---|
| requirements/feature-matrix.md 有 171 个 Phase 1 FEAT | 171 行全部保留，按 ONB、VOC、GRM、WRT、LST、RDG、SPK、ASM、GAM、SOC、USR、INF、COM、ADM 分组。 |
| 源需求、UIUX、详细设计中没有 SUBFEAT-* 编号 | 不虚构 SUBFEAT。详细设计中的实现子能力在“补充能力”章节用 TECH-* 标识，仅用于 UI 宿主、状态和验收追踪，不回写共享矩阵。 |
| detailed-specs/06 明确只有 GAM001~GAM022 | Grammar Blaster、Catch the Meaning 等扩展仍挂在既有 GAM 运行时和功能开关下，不创建 GAM023/GAM024。 |
| UIUX 24 冻结了语义路由；UIUX 22 保留了部分旧别名 | 本文件以 UIUX 24 的 canonical route 为主，以 UIUX 22 的路径作为兼容 Deep Link/迁移别名，并标出冲突，不把别名当成第二套页面。 |
| 实际 uni-app 文件目录尚未由 UI 规范冻结 | 表中的 route 是语义路由；mobile 的页面目录由 uni-app 编译目标实现，但不得改变语义和状态。 |
| official-site 只承载公开品牌、课程、价格、下载、SEO、合规公示 | 认证后的学习、练习、社群和个人数据不映射到 official-site。 |

### 0.3 四端代码

| 代码 | 项目 | Phase 1 责任 |
|---|---|---|
| M | apps/mobile | uni-app Vue3；移动 H5、iOS、Android、iPad；后续微信小程序由同一项目条件编译。 |
| L | apps/learner-web | Vue3 学习 Web；PC Web、平板浏览器和 PWA 工作区。 |
| A | apps/admin-web | Vue3 + Element Plus；教研、审核、运营、商业化、客服和权限审计。 |
| O | apps/official-site | 未登录公开官网；品牌、课程介绍、价格、下载、SEO 和合规公示。 |

### 0.4 统一 Deep Link 规则

表中 Deep Link 使用 canonical route 加 query/path 参数，不新造 scheme。通知、站外二维码、官网 CTA、系统推送和后台预览均应落到同一语义路由。目标无效时显示解释性空状态，不静默跳回首页；受保护目标在登录前保存原始目标，登录/授权完成后恢复；内容版本失效、权限变化或删除时保留可解释的恢复入口。

### 0.5 统一埋点规则

每个页面至少具备 view、primary action、result 三类事件；事件必须带 requestId/traceId、匿名 user/device/session 标识、contentVersion/featureFlag（适用时）、network/performanceLevel 和 result。埋点不得携带原始答案、录音、私密笔记、支付凭证或自由文本。下表中的“埋点”是事件族或 detailed-specs 中的规范事件名，实际事件沿用已有版本后缀和统一 envelope。

## 1. 状态模型：页面必须可落地的八类状态

下列状态码供全本文档复用。每个 FEAT 行的“状态”至少指定一组状态码；组内必须覆盖成功、空、加载、错误、离线、权限、恢复七类，或明确说明该类不适用且展示为何不适用。

| 状态码 | 适用页面 | 成功 | 空 | 加载 | 错误 | 离线 | 权限 | 恢复 |
|---|---|---|---|---|---|---|---|---|
| ST-A | 登录、注册、资料、首选项 | 已保存并可继续 | 未填写/无设备/无绑定 | 骨架屏或按钮 pending | 校验、冲突、限流 | 保留草稿，提示联网后提交 | 年龄、账号或设备权限不足 | 重试、继续草稿、重新验证 |
| ST-B | 年龄、目标、测评与学习计划 | 已确认/已生成/可开始 | 尚未开始或未选择 | 题目、音频、结果计算骨架 | 保存失败、测评失效、音频失败 | 自动保存本地队列，显示待同步 | 未满 18 岁、未登录或测评无权访问 | 恢复 session、重新计算、跳过到规则允许的下一步 |
| ST-C | 首页、计划、地图、节点、任务流 | 计划/任务/节点可操作 | 无计划、无推荐、无到期任务、无解锁节点 | 首页/地图/任务骨架，地图分层加载 | 推荐、地图或快照失败 | 展示最近缓存，禁止伪造新完成状态 | 未登录、目标锁定或 feature flag 关闭 | 继续断点、重试推荐、重新排期 |
| ST-D | 词汇、短语、语法、读写内容详情 | 内容、释义、关系、练习入口完整 | 无筛选结果、无例句/关系、内容已下线 | 内容分段/媒体/图谱骨架 | 版本不兼容、媒体/图谱失败 | 已下载内容只读或进入离线队列 | 课程、地区、VIP 或版权限制 | 切换可用版本、重载、回到来源 |
| ST-E | SRS、题目、模考、听说读写训练 | 已提交、得分、可进入下一题/复习 | 题队为空、无可练习题、未生成队列 | 题目/题队/自动保存骨架 | 提交失败、重复提交、内容版本变更 | 本地保存并标记待同步，禁止重复结算 | 未登录、题库/课程无权、录音权限拒绝 | 幂等重试、恢复 checkpoint、重新载入题目 |
| ST-F | 反馈、修复、掌握、报告、证书 | 反馈、修复、报告或证书可查看 | 无错题、样本不足、无报告/无证书 | 评分/报告/海报生成骨架 | 评分、结算、报告或海报失败 | 展示最近已同步结果，待同步结果显式标记 | 结果被保护、分享/证书权限不足 | 重新计算、查看证据、重试同步/生成 |
| ST-G | 播放器、波形、口腔模型、录音 | 播放/录音/回放/降级渲染成功 | 无媒体、无字幕、无录音 | 媒体/波形/模型骨架 | 解码、WebGL、麦克风、上传失败 | 已下载媒体播放；录音/答案入本地队列 | 麦克风、存储、版权或设备权限拒绝 | 切换 2D/静态帧、重试上传、恢复录音 |
| ST-H | XP、连胜、游戏、Avatar、宝箱、收藏 | 奖励到账、状态保存、关卡完成 | 无任务、无收藏、无可穿戴物/无可开宝箱 | 状态、资产、排行榜骨架 | 结算、资产、渲染或版本失败 | 缓存展示，不发放未经服务器确认的奖励 | 关卡锁定、未登录、未达成资格、feature flag 关闭 | 补偿结算、恢复布局、重放确定性结果 |
| ST-I | 自习室、实时座位、排行榜、群组、动态 | 加入/占座/专注/群组操作完成 | 无房间、无座位、无成员/无动态 | WebSocket snapshot/列表骨架 | 心跳、租约、连接或群组操作失败 | 显示最后 snapshot，禁止伪造在线状态 | 房间、匿名、群组或字段权限不足 | 重新连接、重新入座、恢复租约/退出清理 |
| ST-J | 我的、通知、隐私、设备、删除账号 | 修改/读取/删除流程完成 | 无消息、无设备、无偏好、无历史 | 列表/权限/导出骨架 | 更新、导出、删除或 token 失败 | 本地偏好可改，服务端变更待同步 | 隐私、设备、账号或通知权限拒绝 | 重新认证、取消删除、重新同步 |
| ST-K | 下载、同步、帮助、工单、纠错 | 下载校验/同步/工单提交完成 | 无下载包、无 FAQ、无工单、无纠错 | 队列、进度、搜索、附件骨架 | 校验、游标、冲突、附件或工单失败 | 离线包和本地队列可操作 | 内容包、附件或客服入口无权限 | 续传、冲突解决、重置游标、重试 |
| ST-L | Free/VIP、SKU、订单、支付、退款、家庭组 | 权益/订单/账单状态可核对 | 无 SKU、无订单、无发票/无家庭成员 | 价格、订单、支付回调、对账骨架 | 支付拒绝、回调不可信、退款/对账失败 | 显示最近权益，禁止离线确认支付成功 | 资格、地区、渠道、家庭组权限不足 | 查询订单、恢复购买、人工审核/补偿；支付功能未满足资格时显示关闭原因 |
| ST-M | 后台内容、审核、用户风险、报表、开关 | 保存、提交、审核、发布或查询成功 | 无待审、无筛选结果、无数据/无权限范围 | 表格、编辑器、DAG、指标骨架 | 校验、版本、导入、发布、权限或数据延迟失败 | 后台不伪造写入成功；显示最近快照 | RBAC/数据域/二审权限拒绝 | 草稿保留、重新拉取、回滚/重新提交 |
| ST-N | 仅有后端结果、回调、异步任务的 FEAT | 结果通过页面投影或后台审计可见 | 无需用户操作或没有可展示数据 | 显示任务进度/轮询结果/后台队列 | 显示可解释失败与 requestId | 记录本地待同步或后台重试，不承诺已完成 | 服务端策略、资质、内部角色限制 | 重试、人工复核、补偿/回放 |
| ST-O | 官网公开页面 | 页面/公开课程/价格/下载/合规内容可见 | 无公开内容或已下线 | SEO/内容骨架 | 资源/内容/跳转失败 | 显示缓存公开内容，不进入登录态 | 不提供学习权限；登录业务转入 M/L | 返回公开入口、重新加载、转到登录前保存目标 |

## 2. 页面、入口与路由总表

### 2.1 学习端 canonical route

| 页面组 | canonical route | M/L | 主要入口 | 受保护 Deep Link 与状态宿主 |
|---|---|---|---|---|
| 欢迎 | onboarding/welcome | M/L | 首次启动、退出登录、未完成 onboarding | 外部邀请/推送未登录时保存原目标；ST-A/B |
| 年龄确认 | onboarding/age | M/L | welcome、未完成资料恢复 | 18+ gate；未满 18 进入合规说明，不进入学习业务；ST-A/B |
| 目标与日程 | onboarding/goal | M/L | age、我的设置、计划调整 | UIUX 22 的 onboarding/preferences 为迁移别名；ST-A/B |
| 测评入口与答题 | onboarding/assessment | M/L | onboarding、首页未完成卡片、恢复通知 | sessionId 通过 query/path 传递；兼容 assessment/intro、assessment/session/:sessionId；ST-B/E |
| 测评结果 | onboarding/result | M/L | 测评提交、历史通知 | assessmentId；兼容 assessment/result/:assessmentId；ST-B/F |
| 学习计划 | onboarding/plan、learn/plan | M/L | 测评结果、首页、设置 | planId；兼容 study-plan/proposal/:planId；ST-B/C |
| 学习首页 | learn/home | M/L | M 学习 tab、L 登录后默认页、通知 | 兼容 home；未登录先保存目标；ST-C |
| 学习地图 | learn/map、learn/node/:id | M/L | 学习 tab/地图、首页节点 | nodeId；锁定节点显示解锁条件，不伪造页面；ST-C/D |
| 继续学习 | learn/session/:id | M/L | 首页继续卡片、通知、历史 | 兼容 learning/continue/:sessionId；ST-C/E |
| 练习首页 | practice/home | M/L | M 练习 tab、L 左侧导航、首页 Quick Practice | mode、source、duration；ST-C/E |
| SRS 队列 | practice/srs | M/L | 练习首页、词汇详情、到期通知 | mode=due、wordbook/chunk/expression；ST-D/E |
| SRS session | practice/srs/session/:id | M/L | SRS 队列、继续学习 | sessionId；ST-E/G |
| 错题 | practice/mistakes | M/L | 练习首页、反馈、报告 | itemId；兼容 review/mistakes/:itemId；ST-F/E |
| 快速练习 | practice/quick | M/L | 首页/练习首页、任务卡 | mode/limit；ST-E/F |
| Checkpoint/模考 | practice/checkpoint、practice/cet | M/L | 地图 checkpoint、课程/练习、考试入口 | checkpointId/paperId；ST-E/F |
| 练习结果/修复结果 | practice/result/:id | M/L | 练习提交、历史、报告 | 兼容 practice/repair/result/:sessionId；ST-F |
| 掌握与复习 | practice/mastery | M/L | 练习首页、报告、词汇库 | 兼容 review/today；itemId/schedule；ST-F |
| 世界/游戏 | world/home、world/game/:id | M/L | M 世界 tab、L 左侧导航、任务/奖励通知 | gameId；功能开关关闭时入口隐藏；ST-H |
| Avatar/奖励/收藏 | world/avatar、world/reward、world/collection | M/L | 世界首页、个人资料、奖励通知 | itemId/chestId；ST-H |
| 自习室 | world/study-room | M/L | 世界首页、社群入口、邀请 Deep Link | roomId/groupId；ST-I |
| 课程首页与详情 | courses/home、courses/:id | M/L | M 课程 tab、L 导航、官网公开课程 CTA | courseId/unitId；公开介绍转登录后保存目标；ST-D/C |
| 语法、听力、阅读、口语、写作 | courses/grammar、courses/listening、courses/reading、courses/speaking、courses/writing | M/L | 课程详情、任务卡、搜索 | contentId/lessonId；ST-D/E/G |
| 我的 | me/home、me/reports、me/messages | M/L | M 我的 tab、L 顶部头像/导航、通知 | report period、messageId；ST-F/J |
| 设置/隐私/支持/同步 | me/settings、me/privacy、me/support、me/sync | M/L | 我的、错误恢复、系统通知 | ticketId、syncId；ST-J/K |
| 商业化 | me/commerce | M/L | 我的权益、官网价格 CTA、订单通知 | skuId/orderId/refundId；支付资格不足显示关闭原因；ST-L/O |

### 2.2 后台与官网宿主

| 项目 | 已冻结宿主 | 入口 | 路由状态与不确定性 |
|---|---|---|---|
| admin-web | admin/dashboard + UIUX 23 的 DashboardTemplate、ContentTemplate、LearningTemplate、SettingsTemplate | 登录后 Dashboard、左侧导航、待审/告警通知 | UIUX 24 只冻结 admin/dashboard 语义入口；Content、Review、Users、Orders、Support、Audit 等是同一 admin-web 的页面区和 query/context，不在本文件发明未经 UI 规范冻结的 URL。具体路由仍是缺口，见第 7 节。 |
| official-site | 官网公开首页、课程介绍、价格/下载/合规公示宿主 | 搜索、广告、公开链接、登录前 CTA | UIUX 规范没有给出独立 canonical route；本文件只把 O 映射到公开宿主和外链入口，不把其当作学习业务页面。 |

## 3. 入口、状态、埋点与验收通用约定

| 页面族 | 成功验收最小证据 | 入口/Deep Link 验收 | 埋点验收 |
|---|---|---|---|
| Learning Dashboard | 首页显示目标、今日任务、到期/错题、继续位置，完成后能进入下一复习 | 首次、通知、登录恢复和失效目标均有解释 | view、primary CTA、recommend reason、resume/retry 结果可按 session 回放 |
| Content Detail | 内容版本、媒体/关系/练习入口和来源一致；下线/版权限制可见 | course/content/search/notification 均能保存并恢复目标 | viewed、expanded、media、lookup/report、degraded |
| Practice Session | 题目、自动保存、幂等提交、反馈、退出恢复、D+1/D+7 状态可复核 | sessionId/questionId 不丢失；重复打开不重复结算 | view、answer change/submit、save、offline queue、result |
| Immersive/Media | 波形/模型/字幕与降级画质可操作；权限拒绝可恢复 | media/content/session 参数受保护且失效可解释 | play/pause/fallback、recording permission/upload、quality |
| Result & Feedback | 结果、证据、错误原因、下一复习/修复入口完整；样本不足不伪造 | resultId/report period 可分享或恢复，权限不足不泄露 | result view、repair、report、share/generation 结果 |
| Settings/Commerce | 变更、冲突、删除、恢复购买、退款和隐私保护均有确认与结果 | order/ticket/sync/privacy Deep Link 校验权限和幂等 | request、success/fail/retry、conflict、destructive confirm |
| Admin | RBAC、数据域、草稿、审核、发布、回滚、审计证据可见 | 待审/告警进入正确后台上下文；越权停留在解释页 | view、draft、review、publish、risk、reconcile、flag |

## 4. Phase 1 FEAT 全量追溯矩阵

### 4.1 矩阵缩写与验收代码

项目列中的 M、L、A、O 与第 0.3 节一致；“—”表示该项目不是该 FEAT 的业务宿主，不是遗漏。后台内容维护通过 ADM 域映射到 A，不把后台编辑器冒充学习者页面。

| 代码 | 埋点约定 |
|---|---|
| E-UI | UIUX 24 的 surface_action_result：记录 surface、action、result、source、route、session；用于详细设计没有单独事件名的 UI 操作。 |
| E-HOME | home_view、home_primary_cta_click、recommend_reason_open、quick_practice_select、continue_view/resume/restart、checkpoint_migrate/conflict_resolved。 |
| E-ONB | onboarding_assessment_started/completed/resumed + E-UI 的 goal/time/skip/plan/map action；不读取原始测评答案。 |
| E-PRA | practice_question_view、answer_change、answer_submit、question_mark、exit、practice_result_view、repair_next_click。 |
| E-REV | review_schedule_view、review_queue_view/start/load_choice/reason_open/backlog_defer、mistake_repair_view/start/complete/defer/report。 |
| E-MEDIA | media_played/paused/failed、playback fallback、recording_started/saved/discarded、recording permission、sync/retry。 |
| E-GAM | detailed-specs/06 的 gamification.*、quest.*、collection.*、chest.*、avatar.*、space.*、season.* 事件。 |
| E-SOC | detailed-specs/07 的 soc.*、privacy.*、auth.*、notification.*、offline_package.*、sync.*、support.* 事件。 |
| E-COM | detailed-specs/08 的 commerce.* 事件；支付回调、JWS、订单原文和凭证只在服务端审计，不进入客户端埋点。 |
| E-ADM | detailed-specs/08 的 admin.*、safety.*、risk.*、ops.* 事件。 |

| 验收代码 | 必须证明的结果 |
|---|---|
| A1 | 18+ 用户能在首日完成目标/日程、规则测评或跳过、首个学习目标和下一步复习；断点可恢复，错误不形成空死路。 |
| A2 | 内容有版本、来源、媒体/权限和练习入口；空内容、下线、版权限制、弱网和降级均可解释。 |
| A3 | 题目/媒体/录音 session 可自动保存、幂等提交、离线排队、恢复；不重复结算，不丢题或答案。 |
| A4 | 反馈包含依据、错误原因、掌握/复习时间或“样本不足”；可进入修复、D+1/D+7、报告或证书。 |
| A5 | 播放、波形、口腔模型和录音在权限拒绝、设备不支持、弱网、四级画质下都有可操作降级。 |
| A6 | XP/金币/连胜/关卡/游戏/Avatar/宝箱/收藏状态以服务端结算为准；离线不伪造奖励，能恢复确定性结果。 |
| A7 | 自习室、群组和动态遵守匿名/字段权限、租约和连接恢复；不显示虚假的在线或占座状态。 |
| A8 | 登录、设备、通知、隐私、删除、纠错和客服流程有确认、幂等、冲突和恢复证据。 |
| A9 | Free/VIP/订单/支付/退款/家庭组状态可核对；支付资格未满足时不出现可误导的成功路径。 |
| A10 | 后台 RBAC、数据域、草稿、双审、发布/下线/回滚、风险、报表、开关和审计证据可复核。 |

### 4.2 ONB：新手入学、自适应测评与语言世界地图（22/22）

| FEAT | 功能 | M | L | A | O | 入口 / 页面路由 | 状态 | Deep Link | 埋点 | 验收 |
|---|---|---:|---:|---:|---:|---|---|---|---|---|
| FEAT-ONB-001 | 学习目标选择器 | ✓ | ✓ | — | — | welcome/age → onboarding/goal | ST-B | onboarding/goal | E-ONB | A1：四类目标可选、保存、恢复，影响计划与首页排序 |
| FEAT-ONB-002 | 每日学习时长设定 | ✓ | ✓ | — | — | onboarding/goal 内日程区 | ST-B | onboarding/goal?duration=5/15/30/45 | E-ONB | A1：仅允许 5/15/30/45，显示预期天数并可改计划 |
| FEAT-ONB-003 | 非 AI 规则化自适应定级 | ✓ | ✓ | — | — | onboarding/assessment | ST-B/E | onboarding/assessment?mode=adaptive | E-ONB | A1/A3：词汇4+语法3+听力3，动态难度、自动保存、可恢复 |
| FEAT-ONB-004 | 测评报告与 CEFR 等级判定 | ✓ | ✓ | — | — | onboarding/assessment → onboarding/result | ST-B/F | onboarding/result?assessmentId=... | E-ONB | A1/A4：等级、词汇估计、首周建议和可解释依据可查看 |
| FEAT-ONB-005 | 免测跳过与快速定级 | ✓ | ✓ | — | — | onboarding/assessment 次按钮 | ST-B | onboarding/assessment?mode=skip | E-ONB | A1：资质/等级选择有确认和审计，跳过后仍生成可继续计划 |
| FEAT-ONB-006 | 沉浸主地图拓扑渲染 | ✓ | ✓ | — | — | learn/home → learn/map | ST-C | learn/map?region=... | E-UI | A1：3D/2.5D/2D 画质降级，地图节点路径与服务端拓扑一致 |
| FEAT-ONB-007 | 关卡迷雾与解锁机制 | ✓ | ✓ | — | — | learn/map → learn/node/:id | ST-C | learn/node/:id | E-UI | A6：锁定态展示前置条件；完成前置后可恢复解锁，不以客户端判定奖励 |
| FEAT-ONB-008 | 节点星级评价体系 | ✓ | ✓ | — | — | learn/node/:id / practice/result/:id | ST-C/F | learn/node/:id?result=... | E-UI | A4/A6：1~3 星依据正确率与用时，满星宝箱入口可追溯 |
| FEAT-ONB-009 | 关卡节点类型差异化 | ✓ | ✓ | — | — | learn/map、learn/node/:id | ST-C/E | learn/node/:id?type=normal/review/boss/checkpoint | E-UI | A3/A4：普通、复习、Boss、Checkpoint 的题队/CTA/结果不同且不伪造 |
| FEAT-ONB-010 | Adaptive Home 千人千面 | ✓ | ✓ | — | — | 登录后默认 learn/home | ST-C | learn/home | E-HOME | A1：不同目标显示不同优先任务；推荐失败、无推荐和离线有替代入口 |
| FEAT-ONB-011 | Continue Learning 断点续学 | ✓ | ✓ | — | — | learn/home → learn/session/:id | ST-C/E | learn/session/:id | E-HOME | A3：恢复模块、步数、未提交答案和耗时；过期/冲突可重启或迁移 |
| FEAT-ONB-012 | Daily Stream 任务流 | ✓ | ✓ | — | — | learn/home → practice/home | ST-C/E | learn/home?view=daily | E-HOME | A1/A3：新词、到期、错题任务按来源展示，完成后更新下一项 |
| FEAT-ONB-013 | XP/Coins/Streak 状态栏 | ✓ | ✓ | — | — | learn/home 顶部状态栏 | ST-C/H | learn/home?panel=progress | E-HOME/E-GAM | A6：状态来源一致，待结算/离线不显示为已到账 |
| FEAT-ONB-014 | 场景目录与筛选 | ✓ | ✓ | — | — | courses/home → courses/:id | ST-D | courses/home?catalog=scenario | E-UI | A2：机场、餐饮、酒店等场景可筛选；无结果不跳回空白首页 |
| FEAT-ONB-015 | Airport Pack | ✓ | ✓ | A（内容供给） | — | courses/:id / learn/node/:id | ST-D/E | courses/:id?pack=airport | E-UI | A2/A3：场景单元、对话、交错练习、进度和版权版本可复核 |
| FEAT-ONB-016 | Dining/Hotel Pack | ✓ | ✓ | A（内容供给） | — | courses/:id / learn/node/:id | ST-D/E | courses/:id?pack=dining-hotel | E-UI | A2/A3：餐饮/酒店单元与来源一致，内容下线有替代说明 |
| FEAT-ONB-017 | 交错 chunk/dialogue 练习 | ✓ | ✓ | — | — | learn/node/:id → practice/home/session | ST-E/D | practice/home?source=interleaved&nodeId=... | E-PRA | A3：chunk 卡、听力、固定角色扮演、组句、快测按既定 5 步可恢复 |
| FEAT-ONB-018 | 场景考试与证书 | ✓ | ✓ | A（内容/审核） | O（公开说明） | courses/:id / practice/checkpoint | ST-E/F/L/O | practice/checkpoint?scenarioId=... | E-PRA/E-UI | A4/A9：完成条件、80% 门槛、证书状态和失效原因可见 |
| FEAT-ONB-019 | 全局搜索 | ✓ | ✓ | — | O（公开课程搜索） | L 顶部/M 搜索 → content host | ST-D/O | search?q=...&scope=...（语义入口，具体 search route 未冻结） | E-UI | A2：聚合词汇/短语/语法/课程结果，受保护结果先登录且保留 q |
| FEAT-ONB-020 | 通知 badge | ✓ | ✓ | A（配置/发送） | — | me/messages、首页状态栏 | ST-J/K | me/messages?messageId=... | E-SOC | A8：未读数、类别、Deep Link、失效目标解释和已读幂等 |
| FEAT-ONB-021 | 地图缩放与平移 | ✓ | ✓ | — | — | learn/map | ST-C/G | learn/map?region=...&zoom=... | E-UI | A5：0.5~2 倍/LOD 和低配 2D fallback，触控/键盘可操作 |
| FEAT-ONB-022 | Tutorial overlay | ✓ | ✓ | — | — | onboarding/plan、learn/home 首次进入 | ST-C/B | learn/home?tutorial=... | E-UI | A1：只在首次/未完成显示，可跳过、恢复，不遮挡主 CTA 和无障碍焦点 |

### 4.3 VOC：词汇、词根词缀、短语与 SRS（30/30）

| FEAT | 功能 | M | L | A | O | 入口 / 页面路由 | 状态 | Deep Link | 埋点 | 验收 |
|---|---|---:|---:|---:|---:|---|---|---|---|---|
| FEAT-VOC-001 | 权威词书矩阵 | ✓ | ✓ | A（内容供给） | — | courses/home → courses/:id、practice/srs | ST-D | courses/:id?type=wordbook&wordbookId=... | vocab.wordbook.listed/viewed/item_opened.v1 | A2：词书、版本、适用目标和进度来源一致 |
| FEAT-VOC-002 | 词书切换与进度 | ✓ | ✓ | — | — | courses/:id / practice/srs | ST-D/E | practice/srs?wordbookId=... | vocab.wordbook.switch_started/succeeded/failed.v1 | A3：切换不丢 SRS 状态，失败可恢复原词书 |
| FEAT-VOC-003 | 频率/难度/考试热度 | ✓ | ✓ | A（标签供给） | — | 词书筛选、词汇库 | ST-D | courses/:id?filter=frequency/difficulty/exam | vocab.frequency.filter_used.v1、vocab.exam_heat.viewed.v1 | A2：筛选结果可解释，无结果有清除筛选恢复 |
| FEAT-VOC-004 | IPA 与音频 | ✓ | ✓ | A（媒体供给） | — | 词汇详情 courses/:id | ST-D/G | courses/:id?itemId=...&panel=pronunciation | vocab.audio.played/failed.v1 | A2/A5：IPA、音频、播放失败和离线媒体可恢复 |
| FEAT-VOC-005 | 双语释义与词性 | ✓ | ✓ | A（内容供给） | — | 词汇详情 | ST-D | courses/:id?itemId=...&panel=definition | vocab.definition.expanded/reported.v1 | A2：释义/词性版本化，举报不带自由文本原文 |
| FEAT-VOC-006 | 例句与高亮 | ✓ | ✓ | A（内容供给） | — | 词汇详情 | ST-D/G | courses/:id?itemId=...&panel=examples | vocab.example.viewed/audio_played/mined_started.v1 | A2：例句高亮、音频、挖掘入口和版权状态可见 |
| FEAT-VOC-007 | 3D 口腔入口 | ✓ | ✓ | — | — | courses/speaking → 词汇详情 | ST-G | courses/:id?itemId=...&panel=anatomy | vocab.anatomy.opened/degraded.v1 | A5：只进入既有口腔模型宿主，低配降为 2D/静态，不阻塞学习 |
| FEAT-VOC-008 | 派生/同反义关系 | ✓ | ✓ | A（关系供给） | — | 词汇详情关系面板 | ST-D | courses/:id?itemId=...&panel=relations | vocab.relation.opened/item_queued.v1 | A2/A3：关系图可展开，关联项可加入队列且去重 |
| FEAT-VOC-009 | 词根词缀 | ✓ | ✓ | A（内容供给） | — | courses/grammar 或词汇详情 | ST-D | courses/:id?itemId=...&panel=morpheme | vocab.morpheme.opened.v1、vocab.root.lesson_clicked.v1 | A2：词根/词缀与课程版本一致，可跳转课程 |
| FEAT-VOC-010 | 易混词 | ✓ | ✓ | A（内容供给） | — | 词汇详情、practice/quick | ST-D/E | practice/quick?mode=confusable&itemId=... | vocab.confusable.viewed/answered.v1 | A3/A4：对比、选择、反馈和错误原因可复核 |
| FEAT-VOC-011 | SM-2 调度 | ✓ | ✓ | — | — | practice/srs、词汇详情调度说明 | ST-E/F | practice/srs?mode=due | learning.srs.calculated.v1 | A3/A4：调度结果来自 lrn_srs_state，客户端不另算 |
| FEAT-VOC-012 | Ebbinghaus 计划解释 | ✓ | ✓ | — | — | practice/srs 调度说明 | ST-E/F | practice/srs?panel=schedule | learning.srs.schedule_explained.v1 | A4：D+1/D+7 与下次时间有解释，不展示无法证明的精确预测 |
| FEAT-VOC-013 | 主动回忆卡 | ✓ | ✓ | — | — | practice/srs/session/:id | ST-E/G | practice/srs/session/:id | learning.card.front_viewed/revealed/next_clicked.v1 | A3：未揭示/揭示/下一张状态和退出恢复完整 |
| FEAT-VOC-014 | 四档信心度 | ✓ | ✓ | — | — | SRS card | ST-E | practice/srs/session/:id?panel=confidence | learning.confidence.selected.v1 | A3/A4：四档选择幂等提交并影响下一复习 |
| FEAT-VOC-015 | 逾期平滑 | ✓ | ✓ | — | — | practice/srs | ST-E/F | practice/srs?mode=backlog | learning.srs.overdue_detected/backlog_smoothed.v1 | A3：积压分层/延后有说明、确认和恢复，不丢到期项 |
| FEAT-VOC-016 | 四选一释义 | ✓ | ✓ | — | — | practice/quick 或 session | ST-E | practice/session/:sessionId/question/:questionId?type=meaning | practice.vocab.meaning_choice.started/submitted.v1 | A3：选择、提交、反馈、重复打开不重复结算 |
| FEAT-VOC-017 | 听音选择 | ✓ | ✓ | — | — | practice/quick 或 session | ST-E/G | practice/session/:sessionId/question/:questionId?type=audio | practice.vocab.audio_choice.played/submitted.v1 | A3/A5：音频失败可重试/切换文字，不绕过必需媒体 |
| FEAT-VOC-018 | 完形填空 | ✓ | ✓ | — | — | practice/quick 或 session | ST-E | practice/session/:sessionId/question/:questionId?type=cloze | practice.vocab.cloze.started/submitted.v1 | A3：空值、答案、反馈和离线队列可恢复 |
| FEAT-VOC-019 | 字母重排 | ✓ | ✓ | — | — | practice/quick 或 session | ST-E | practice/session/:sessionId/question/:questionId?type=anagram | practice.vocab.anagram.started/completed.v1 | A3：重排/撤销/提交和错误反馈一致 |
| FEAT-VOC-020 | 键盘拼写 | ✓ | ✓ | — | — | practice/quick 或 session | ST-E | practice/session/:sessionId/question/:questionId?type=spelling | practice.vocab.spelling.started/submitted.v1 | A3：键盘/输入法、拼写反馈、弱网保存和恢复可测 |
| FEAT-VOC-021 | 生词收藏 | ✓ | ✓ | — | — | 词汇详情、practice/srs | ST-D/E | courses/:id?panel=collection | vocab.collection.added/removed/filtered.v1 | A2/A3：收藏与 SRS 入队边界清晰，可撤销、去重 |
| FEAT-VOC-022 | 已掌握词 | ✓ | ✓ | — | — | practice/mastery | ST-F | practice/mastery?status=mastered | learning.mastery.entered/at_risk.v1、vocab.mastered.removed_from_collection.v1 | A4：掌握、风险、重新打开和退出收藏有来源 |
| FEAT-VOC-023 | 词库筛选 | ✓ | ✓ | — | — | courses/:id、practice/mastery | ST-D | courses/:id?filter=... | vocab.library.filter_used/page_loaded.v1 | A2：分页/筛选加载、空结果、恢复滚动位置可验证 |
| FEAT-VOC-024 | phrase/chunk 知识库 | ✓ | ✓ | A（内容供给） | — | courses/:id、词汇详情 | ST-D | courses/:id?type=chunk&chunkId=... | vocab.chunk.listed/viewed/queued.v1 | A2/A3：chunk 来源、例句、入队和版本一致 |
| FEAT-VOC-025 | chunk SM-2 | ✓ | ✓ | — | — | practice/srs | ST-E/F | practice/srs?object=chunk&chunkId=... | learning.chunk.review_submitted/schedule_updated.v1 | A3/A4：chunk 使用 canonical chunk_id，共用 lrn_srs_state |
| FEAT-VOC-026 | 句子挖掘 | ✓ | ✓ | — | — | 例句/阅读详情 → practice/srs | ST-D/E | practice/srs?source=mining&sourceId=... | vocab.expression.mine_started/created/added_to_srs.v1 | A2/A3：来源可回溯，原始句子隐私和版权不进入埋点 |
| FEAT-VOC-027 | 表达库 | ✓ | ✓ | — | — | courses/:id、practice/srs | ST-D/E | courses/:id?type=expression&expressionId=... | vocab.expression.tag_added/tag_removed/review_started.v1 | A2/A3：标签、表达和复习队列可恢复、可撤销 |
| FEAT-VOC-028 | 词根课程 | ✓ | ✓ | A（内容供给） | — | courses/grammar → courses/:id | ST-D/E | courses/:id?type=root&rootId=... | vocab.root_course.started/example_opened/completed.v1 | A2/A4：课程单元、例词、完成状态与来源一致 |
| FEAT-VOC-029 | 词族树 | ✓ | ✓ | A（关系供给） | — | 词汇详情 | ST-D/G | courses/:id?panel=family&itemId=... | vocab.family.expand/node_opened/degraded.v1 | A2/A5：关系展开、渲染降级和关联详情可访问 |
| FEAT-VOC-030 | 反批量刷题保护 | ✓ | ✓ | — | A（策略配置） | practice/srs/session/:id | ST-E/F | practice/srs/session/:id?guard=... | risk.vocab.flagged/decision.v1 | A3/A4：300ms dwell/节流/风险提示不阻断正常恢复，结算以服务端为准 |

### 4.4 GRM：语法、长难句 X 光机（12/12）

| FEAT | 功能 | M | L | A | O | 入口 / 页面路由 | 状态 | Deep Link | 埋点 | 验收 |
|---|---|---:|---:|---:|---:|---|---|---|---|---|
| FEAT-GRM-001 | 语法知识树 | ✓ | ✓ | A（内容供给） | — | courses/grammar | ST-D/G | courses/grammar?nodeId=... | grammar.tree.viewed/expanded/node_selected.v1 | A2：节点、锁定条件、版本和二维降级可操作 |
| FEAT-GRM-002 | 公式卡片 | ✓ | ✓ | A（内容供给） | — | courses/grammar | ST-D | courses/grammar?cardId=... | grammar.card.viewed/section_expanded/exercise_clicked.v1 | A2：规则、例句、练习入口和空章节有明确状态 |
| FEAT-GRM-003 | 考试陷阱 | ✓ | ✓ | A（内容供给） | — | courses/grammar、practice/quick | ST-D/E | practice/quick?mode=grammar-trap&itemId=... | grammar.trap.viewed/diff_expanded/practice_started.v1 | A3/A4：对比、差异展开和针对练习可复核 |
| FEAT-GRM-004 | 填空/改错 | ✓ | ✓ | — | — | practice/session/:id/question/:id | ST-E/F | practice/session/:sessionId/question/:questionId?type=grammar-fill | grammar.exercise.started/submitted/feedback_viewed.v1 | A3/A4：规则化评分、错误依据和恢复一致 |
| FEAT-GRM-005 | 语法选择 | ✓ | ✓ | — | — | practice/session/:id/question/:id | ST-E/F | practice/session/:sessionId/question/:questionId?type=grammar-choice | grammar.choice.option_selected/submitted/explanation_viewed.v1 | A3/A4：选项、提交、解释、重复提交幂等 |
| FEAT-GRM-006 | 六维弱点图 | ✓ | ✓ | — | — | practice/mastery、me/reports | ST-F | practice/mastery?dimension=... | grammar.mastery.viewed/dimension_selected/explanation_expanded.v1 | A4：六维证据、样本不足、下一练习入口可见 |
| FEAT-GRM-007 | 针对性练习包 | ✓ | ✓ | — | — | practice/home、practice/quick | ST-C/E/F | practice/quick?source=grammar-weakness&packId=... | grammar.targeted_pack.created/started/completed.v1 | A3/A4：由弱点证据生成并能完成/重试，不显示 AI 生成暗示 |
| FEAT-GRM-008 | 长难句彩色切片 | ✓ | ✓ | — | — | courses/grammar、courses/:id | ST-D/G | courses/grammar?xraySentenceId=... | xray.sentence.opened/slice.selected/translation.toggled.v1 | A2/A5：token/slice 选中、翻译切换和无障碍文本一致 |
| FEAT-GRM-009 | 交互语法树 | ✓ | ✓ | A（DAG 内容供给） | — | courses/grammar | ST-D/G | courses/grammar?view=xray&nodeId=... | xray.node.expanded/collapsed/render.downgraded.v1 | A5：Vue Flow/G6 或 2D fallback，渲染失败仍可读文本 |
| FEAT-GRM-010 | 慢速/正常音频同步 | ✓ | ✓ | A（媒体供给） | — | courses/grammar、courses/listening | ST-D/G | courses/grammar?xraySentenceId=...&audio=... | xray.audio.started/segment_highlighted/completed.v1 | A2/A5：0.5x~2.0x 保持音高、时间轴与切片同步 |
| FEAT-GRM-011 | 语块重排 | ✓ | ✓ | — | — | practice/session/:id/question/:id | ST-E/F | practice/session/:sessionId/question/:questionId?type=block-reorder | grammar.block_sort.started/reordered/submitted.v1 | A3/A4：拖拽/键盘重排、撤销、提交、反馈和恢复 |
| FEAT-GRM-012 | 黄金句仿写 | ✓ | ✓ | — | — | courses/writing、practice/session/:id | ST-E/F | practice/session/:sessionId/question/:questionId?type=imitation | grammar.imitation.started/slot_filled/submitted.v1 | A3/A4：固定槽位、规则反馈和下一复习可追溯 |

### 4.5 WRT：写作训练（5/5）

| FEAT | 功能 | M | L | A | O | 入口 / 页面路由 | 状态 | Deep Link | 埋点 | 验收 |
|---|---|---:|---:|---:|---:|---|---|---|---|---|
| FEAT-WRT-001 | 中译英梯度训练 | ✓ | ✓ | — | — | courses/writing → practice/session/:id | ST-E/F | practice/session/:sessionId/question/:questionId?type=translation | writing.translation.started/hint_viewed/submitted.v1 | A3/A4：梯度、提示、提交、规则反馈和恢复完整 |
| FEAT-WRT-002 | 规则参考与评分 | ✓ | ✓ | A（规则内容） | — | practice/result/:id、courses/writing | ST-F | practice/result/:id?panel=writing-rubric | writing.translation.graded/scoring_point.expanded/mastery_marked.v1 | A4：评分点有规则依据，未达到条件不误标掌握 |
| FEAT-WRT-003 | 写作模板 | ✓ | ✓ | A（模板供给） | O（公开课程说明） | courses/writing | ST-D/E | courses/writing?templateId=... | writing.template.list_viewed/version_selected/practice_started.v1 | A2/A3：模板版本、适用目标、开始练习和下线提示一致 |
| FEAT-WRT-004 | 病句改错/校对 | ✓ | ✓ | — | — | courses/writing → practice/session/:id | ST-E/F | practice/session/:sessionId/question/:questionId?type=proofreading | writing.proofreading.issue_selected/corrected/submitted.v1 | A3/A4：问题定位、改正、提交与解释可回放 |
| FEAT-WRT-005 | 素材引用库 | ✓ | ✓ | A（内容/版权供给） | O（公开素材说明） | courses/writing | ST-D | courses/writing?type=material&materialId=... | writing.material.list_viewed/version_opened/favorited.v1 | A2：来源、版本、收藏和版权限制可见，不把原文写入埋点 |

### 4.6 LST：听力精练与 Language Clips（6/6）

| FEAT | 功能 | M | L | A | O | 入口 / 页面路由 | 状态 | Deep Link | 埋点 | 验收 |
|---|---|---:|---:|---:|---:|---|---|---|---|---|
| FEAT-LST-001 | 毫秒字幕/波形/AB 段落 | ✓ | ✓ | A（媒体供给） | — | courses/listening | ST-D/G | courses/listening?contentId=...&segment=... | listening.material_viewed/waveform_ready/waveform_fallback/play_started/paused/seeked/segment_selected/loop_started/ab_set/ab_completed/subtitle_mode_changed/timeline_drift_detected.v1 | A2/A5：字幕、波形、AB 点和时间轴一致，加载/降级/无字幕可解释 |
| FEAT-LST-002 | 音频变速且保持音高 | ✓ | ✓ | — | — | listening player | ST-G | courses/listening?contentId=...&speed=0.5/1/2 | listening.speed_changed/pitch_preserve_failed/playback_quality_downgraded.v1 | A5：只允许 0.5x~2.0x，变速失败有降级和恢复 |
| FEAT-LST-003 | 音变雷达 | ✓ | ✓ | A（标注供给） | — | courses/listening | ST-D/G | courses/listening?contentId=...&panel=sound-change | listening.radar_opened/sound_change_filter_changed/sound_change_explained/sound_change_replayed/annotation_missing.v1 | A2/A5：标注缺失不显示伪解释，筛选/重播/降级可验证 |
| FEAT-LST-004 | 听写训练 | ✓ | ✓ | — | — | courses/listening → practice/session/:id | ST-E/G/K | practice/session/:sessionId/question/:questionId?type=dictation | listening.dictation_started/replay/submitted/result_viewed/hint_used/offline_queued.v1 | A3/A5：输入、重播、提示、结果和离线队列可恢复 |
| FEAT-LST-005 | 拼写错误高亮/重播/提示 | ✓ | ✓ | — | — | practice/result/:id / dictation feedback | ST-F/G | practice/result/:id?panel=dictation-diff | listening.dictation_live_diff/error_type_viewed/hint_used/answer_revealed/self_rated.v1 | A4/A5：错误类型证据、重播、揭示和自评不伪造自动评分 |
| FEAT-LST-006 | Language Clips | ✓ | ✓ | A（版权/媒体供给） | O（公开介绍） | courses/listening | ST-D/E/G | courses/listening?type=clips&clipId=... | clips.opened/subtitle_revealed/segment_looped/word_lookup/shadowing_started/comprehension_submitted/playback_fallback.v1 | A2/A5：字幕、片段循环、查词、跟读和理解题遵守版权/离线状态 |

### 4.7 RDG：分级阅读与故事模式（4/4）

| FEAT | 功能 | M | L | A | O | 入口 / 页面路由 | 状态 | Deep Link | 埋点 | 验收 |
|---|---|---:|---:|---:|---:|---|---|---|---|---|
| FEAT-RDG-001 | CEFR 分级文章库 | ✓ | ✓ | A（内容供给） | O（公开课程介绍） | courses/reading | ST-D | courses/reading?level=A1&articleId=... | reading.catalog_viewed/filter_applied/article_opened/completed/article_content_blocked.v1 | A2：等级、筛选、文章版本和下线状态可见 |
| FEAT-RDG-002 | 双语/查词/SRS | ✓ | ✓ | — | — | courses/reading → practice/srs | ST-D/E/G | courses/reading?articleId=...&paragraph=...&word=... | reading.word_lookup/word_pronunciation_played/sentence_structure_opened/mining_created/mining_removed/bilingual_mode_changed/paragraph_audio_played.v1 | A2/A3：查词、双语、句法、挖掘、发音和 SRS 入队可恢复 |
| FEAT-RDG-003 | 排版/主题/无障碍 | ✓ | ✓ | — | — | courses/reading、me/settings | ST-D/G/J | courses/reading?articleId=...&theme=... | reading.typography_changed/theme_changed/accessibility_mode_changed/layout_anchor_restored/layout_fallback.v1 | A5：字体、主题、锚点、屏幕阅读器和布局 fallback 可验证 |
| FEAT-RDG-004 | 分支故事 | ✓ | ✓ | A（内容供给） | — | courses/reading | ST-D/E/F | courses/reading?type=branching&storyId=...&nodeId=... | reading.branch_opened/choice_shown/selected/replayed/completed.v1 | A3/A4：选择、分支恢复、重玩、完成和内容版本一致 |

### 4.8 SPK：音标、口腔、跟读与固定角色扮演（6/6）

| FEAT | 功能 | M | L | A | O | 入口 / 页面路由 | 状态 | Deep Link | 埋点 | 验收 |
|---|---|---:|---:|---:|---:|---|---|---|---|---|
| FEAT-SPK-001 | 48 个音标 | ✓ | ✓ | A（音标 manifest） | — | courses/speaking | ST-D/G | courses/speaking?phonemeId=... | phonetics.catalog_opened/symbol_viewed/demo_played/spelling_pattern_viewed/point_read_started.v1 | A2/A5：EN_48_PHASE1 的 20 元音+28 辅音均有 IPA、示例、媒体和版本 |
| FEAT-SPK-002 | 3D 口腔模型 | ✓ | ✓ | — | — | courses/speaking | ST-G | courses/speaking?phonemeId=...&panel=mouth | phonetics.mouth_model_opened/mouth_layer_toggled/mouth_frame_scrubbed/mouth_quality_selected.v1、performance.phonetics_fallback/webgl_context_lost.v1 | A5：Ultra/High/Medium/Performance 与 2D/静态帧可切换，WebGL 丢失不阻塞 |
| FEAT-SPK-003 | 最小对立对 | ✓ | ✓ | A（内容供给） | — | courses/speaking → practice/session/:id | ST-D/E/G | practice/session/:sessionId/question/:questionId?type=minimal-pair | phonetics.pair_opened/pair_answered/pair_explanation_viewed/pair_self_rated.v1 | A3/A5：对比音频、作答、解释、自评和音频失败可恢复 |
| FEAT-SPK-004 | 录音/双波形/自评 | ✓ | ✓ | — | — | courses/speaking → practice/session/:id | ST-E/G | practice/session/:sessionId/question/:questionId?type=recording | speaking.mic_permission_requested/granted/denied、recording_started/stopped/discarded、waveform_ready、recording_played/self_rated、upload_started/completed/failed、recording_deleted.v1 | A3/A5：麦克风拒绝、录音本地加密、回放、删除、上传和待同步均有恢复 |
| FEAT-SPK-005 | 0.5x Shadowing | ✓ | ✓ | — | — | courses/speaking | ST-E/G | courses/speaking?type=shadowing&contentId=... | speaking.shadowing_started/delay_calibrated/paused/resumed/completed/segment_replayed/fallback.v1 | A3/A5：300~800ms 校准、暂停/恢复、片段重播和 fallback 可测；无 ASR/AI 分数 |
| FEAT-SPK-006 | 固定角色扮演 | ✓ | ✓ | A（脚本供给） | — | courses/speaking → practice/session/:id | ST-E/G | practice/session/:sessionId/question/:questionId?type=roleplay&roleId=... | speaking.roleplay_opened/role_selected/turn_played/choice_selected/recording_started/completed.v1 | A3/A5：固定脚本、角色、选择、录音和结束状态可回放；无 LLM/RTC |

### 4.9 ASM：做题中心、模考与掌握闭环（20/20）

| FEAT | 功能 | M | L | A | O | 入口 / 页面路由 | 状态 | Deep Link | 埋点 | 验收 |
|---|---|---:|---:|---:|---:|---|---|---|---|---|
| FEAT-ASM-001 | 选择题题型 | ✓ | ✓ | A（题库供给） | — | practice/home → practice/session/:id | ST-E/F | practice/session/:sessionId/question/:questionId?type=choice | question_viewed/option_selected/answer_submitted/answer_scored/error_cause_confirmed.v1 | A3/A4：选项、提交、评分、错误原因和幂等可回放 |
| FEAT-ASM-002 | 连线题型 | ✓ | ✓ | A（题库供给） | — | practice/session/:id | ST-E/F/G | practice/session/:sessionId/question/:questionId?type=connect | connect_started/completed/answer_submitted/scored/component_degraded.v1 | A3/A5：触控/鼠标/键盘连线和降级均可提交 |
| FEAT-ASM-003 | 拖拽排序题型 | ✓ | ✓ | A（题库供给） | — | practice/session/:id | ST-E/F/G | practice/session/:sessionId/question/:questionId?type=sort | drag_started/reordered/undo_clicked/reset_clicked/answer_scored.v1 | A3/A5：排序、撤销、重置、键盘操作和评分一致 |
| FEAT-ASM-004 | Daily Stream 组题 | ✓ | ✓ | — | — | learn/home、practice/home | ST-C/E/K | practice/home?source=daily | stream_requested/built/degraded/resumed/completed.v1 | A1/A3：依据目标/时长构建题队，空队和弱网可恢复 |
| FEAT-ASM-005 | 批量结算与庆祝 | ✓ | ✓ | — | — | practice/result/:id | ST-F/H | practice/result/:id?settlement=... | batch_started/settled/reward_granted/celebration_shown/skipped.v1 | A4/A6：结算幂等、奖励待确认、庆祝可跳过且结果不丢 |
| FEAT-ASM-006 | 自动错题归因 | ✓ | ✓ | — | — | practice/result/:id、practice/mistakes | ST-F | practice/mistakes?itemId=... | mistake_created/merged/error_cause_suggested/confirmed/mastery_state_changed.v1 | A4：归因可确认/更正，原题、规则和来源可回溯 |
| FEAT-ASM-007 | 当日修复 | ✓ | ✓ | — | — | practice/mistakes → practice/result/:id | ST-E/F | practice/mistakes?itemId=...&mode=repair | repair_queued/started/submitted/passed/failed.v1 | A4：修复入队、完成/失败、再次安排和退出恢复 |
| FEAT-ASM-008 | D+1 验证 | ✓ | ✓ | — | — | practice/mastery、通知 → session | ST-E/F/J | practice/mastery?verify=d1&itemId=... | verification_scheduled/exposed/submitted/d1_passed/d1_failed/overdue.v1 | A4：PENDING_RETRY→DELAY_VERIFY_D1，过期/失败重新安排可见 |
| FEAT-ASM-009 | D+7 验证 | ✓ | ✓ | — | — | practice/mastery、通知 → session | ST-E/F/J | practice/mastery?verify=d7&itemId=... | d7_due/exposed/submitted/passed/failed/mastered_marked.v1 | A4：D+7 通过才进入 MASTERED；失败、逾期、重开可回放 |
| FEAT-ASM-010 | 四级掌握度 | ✓ | ✓ | — | — | practice/mastery、词汇详情 | ST-F | practice/mastery?itemId=... | mastery_state_changed/reason_viewed/next_review_viewed/reopened.v1 | A4：NEW/LEARNING/MASTERED/CONSOLIDATED 对外状态一致，REOPENED 有原因 |
| FEAT-ASM-011 | 错题列表/筛选 | ✓ | ✓ | — | — | practice/mistakes | ST-F | practice/mistakes?filter=...&itemId=... | mistake_list_viewed/filter_applied/detail_viewed/manual_marked.v1 | A4：按错误类型/来源/优先级筛选，空列表给下一入口 |
| FEAT-ASM-012 | Quick Practice | ✓ | ✓ | — | — | practice/quick | ST-C/E/F | practice/quick?mode=...&limit=... | quick_practice_started/mode_selected/timeout/completed.v1 | A3/A4：模式/数量/超时/完成和结果入口一致 |
| FEAT-ASM-013 | Checkpoint | ✓ | ✓ | A（题目/节点配置） | — | learn/node/:id → practice/checkpoint | ST-E/F/C | practice/checkpoint?checkpointId=... | checkpoint_unlocked/started/submitted/passed/failed/node_unlocked.v1 | A3/A4：解锁条件、考试、通过后节点解锁和失败恢复可核对 |
| FEAT-ASM-014 | CET4/6 模考 | ✓ | ✓ | A（试卷供给） | — | practice/cet | ST-E/F | practice/cet?paperId=...&exam=cet4/6 | exam_paper_viewed/started/section_entered/answer_saved/submitted/report_ready.v1 | A3/A4：分段、计时、答题保存、提交、报告和样本说明可见 |
| FEAT-ASM-015 | 考研英语一/二模考 | ✓ | ✓ | A（试卷供给） | — | practice/cet | ST-E/F | practice/cet?paperId=...&exam=ky1/2 | exam_catalog_filtered/paper_selected/section_started/submitted/report_viewed.v1 | A3/A4：英语一/二筛选、试卷版本、报告和恢复一致 |
| FEAT-ASM-016 | 反作弊/切屏检测 | ✓ | ✓ | A（规则/审计） | — | practice/cet、practice/session/:id | ST-E/F/M | practice/session/:sessionId?mode=exam | anti_cheat_event_received/visibility_hidden/focus_lost/fullscreen_exit/clock_skew_detected/heartbeat_missed/warning_shown.v1 | A3/A10：只做约定的页面/心跳检测，无摄像头/录屏；告警可解释且不误删结果 |
| FEAT-ASM-017 | 答题卡 | ✓ | ✓ | — | — | practice/session/:id | ST-E/G | practice/session/:sessionId?panel=answer-sheet | answer_sheet_opened/navigated/marked/sync_pending.v1 | A3：题号导航、标记、同步 pending、恢复定位一致 |
| FEAT-ASM-018 | 模考诊断 | ✓ | ✓ | A（报告配置） | — | practice/result/:id | ST-F/M | practice/result/:id?report=diagnostic | report_generation_started/completed/metric_expanded/weakness_evidence_opened/percentile_unavailable_shown.v1 | A4/A10：指标、弱点证据、百分位样本不足和生成失败可解释 |
| FEAT-ASM-019 | 日报/周报 | ✓ | ✓ | — | — | me/reports | ST-F/J/K | me/reports?period=day/week | daily_report_viewed/weekly_report_viewed/focus_waveform_expanded/error_trend_opened/report_range_changed.v1 | A4：任务、掌握、错误趋势、专注波形和无数据状态可见 |
| FEAT-ASM-020 | 分享海报 | ✓ | ✓ | — | O（公开落地页如已配置） | me/reports → result/share | ST-F/J/O | me/reports?period=week&share=... | share_asset_requested/generated/saved/shared/failed.v1 | A4/A8：海报脱敏、生成失败可重试，未授权不泄露学习明细 |

### 4.10 GAM：游戏化星系与成长系统（22/22）

| FEAT | 功能 | M | L | A | O | 入口 / 页面路由 | 状态 | Deep Link | 埋点 | 验收 |
|---|---|---:|---:|---:|---:|---|---|---|---|---|
| FEAT-GAM-001 | XP 与等级 | ✓ | ✓ | — | — | world/home、me/home | ST-H | world/home?panel=xp | gamification.xp.granted/level.changed/reward.rejected/reward.pending_review.v1 | A6：XP 只由服务端结算，pending/rejected 有原因并能恢复 |
| FEAT-GAM-002 | 连胜 | ✓ | ✓ | — | — | world/home、me/home | ST-H | world/home?panel=streak | gamification.streak.day_qualified/status_changed/milestone_reached/reminder_shown.v1 | A6：按学习资格计算，跨日/时区/离线状态可解释 |
| FEAT-GAM-003 | 冻结与救援 | ✓ | ✓ | — | — | world/home、me/commerce（如需权益） | ST-H/L | world/home?panel=streak-rescue | gamification.streak.frozen/rescue_started/succeeded/failed.v1 | A6/A9：救援资格、失败、权益限制和恢复入口清晰 |
| FEAT-GAM-004 | 周末保护 | ✓ | ✓ | — | — | world/home、me/home | ST-H | world/home?panel=weekend-protection | gamification.streak.protection_updated/day_protected/protection_rejected.v1 | A6：保护天数、拒绝原因和服务端状态一致 |
| FEAT-GAM-005 | 金币与固定目录 | ✓ | ✓ | A（目录/运营） | — | world/reward、me/home | ST-H | world/reward?panel=coins/catalog | gamification.coins.granted/spent/balance.reconciled/fixed_catalog.viewed.v1 | A6：固定目录、余额对账、失败补偿；不出现付费随机购买 |
| FEAT-GAM-006 | 每日任务 | ✓ | ✓ | A（任务配置） | — | world/home、learn/home | ST-H/C | world/home?panel=daily-quests | quest.daily_created/progressed/completed/claimed.v1 | A6：进度、完成、领取和离线待结算状态一致 |
| FEAT-GAM-007 | 每周任务 | ✓ | ✓ | A（任务配置） | — | world/home | ST-H | world/home?panel=weekly-quests | quest.weekly_created/weekly_progressed/weekly_claimed.v1、chest.granted.v1 | A6：周周期、进度、领取和宝箱来源可追溯 |
| FEAT-GAM-008 | 成就 | ✓ | ✓ | A（成就配置） | — | world/collection | ST-H | world/collection?tab=achievements&achievementId=... | achievement.progressed/unlocked/showcase_updated/shared.v1 | A6：成就条件、解锁、展示/分享脱敏和恢复一致 |
| FEAT-GAM-009 | Sentence Train | ✓ | ✓ | — | — | world/game/:id | ST-H/E | world/game/:id?gameCode=sentence-train | sentence_train.started/round.judged/completed.v1、hint.used.v1 | A3/A6：回合、提示、结束、超时和结算状态可恢复 |
| FEAT-GAM-010 | Word Match | ✓ | ✓ | — | — | world/game/:id | ST-H/E | world/game/:id?gameCode=word-match | word_match.card_revealed/pair_judged/combo.updated/completed.v1 | A3/A6：配对、连击、结束和重复打开不重复奖励 |
| FEAT-GAM-011 | Word Defense | ✓ | ✓ | — | — | world/game/:id | ST-H/E | world/game/:id?gameCode=word-defense | word_defense.wave_started/answer_judged/health_changed/completed.v1 | A3/A6：波次、答题、生命和完成结算一致 |
| FEAT-GAM-012 | Word Puzzle | ✓ | ✓ | A（开关/内容） | — | world/game/:id | ST-H/E | world/game/:id?gameCode=word-puzzle | word_puzzle.started/piece_unlocked/completed.v1、feature_flag_blocked.v1 | A3/A6：开关关闭时入口隐藏/解释；碎片和结算可恢复 |
| FEAT-GAM-013 | Avatar | ✓ | ✓ | — | — | world/avatar | ST-H/G | world/avatar?avatarId=... | avatar.editor.opened/config.saved/render_mode.selected/snapshot.ready/snapshot.fallback.v1 | A5/A6：配置、渲染模式、快照和性能 fallback 可保存 |
| FEAT-GAM-014 | Wardrobe | ✓ | ✓ | A（资产供给） | — | world/avatar | ST-H/G | world/avatar?tab=wardrobe&itemId=... | avatar.wardrobe.viewed/item.tried_on/loadout.saved/conflict/item.equipped.v1 | A6：试穿、装备、冲突和资产版本可恢复 |
| FEAT-GAM-015 | 资产质量 | ✓ | ✓ | A（资产质量校验） | — | world/avatar、world/collection | ST-H/G/M | world/collection?filter=quality | avatar.item.definition_published/quality_viewed/quality_validation_failed.v1、collection.quality_filtered.v1 | A5/A6/A10：质量等级、缺失资源、过滤和后台校验结果可解释 |
| FEAT-GAM-016 | 免费奖励箱 | ✓ | ✓ | A（发放配置） | — | world/reward | ST-H | world/reward?chestId=... | chest.granted/viewed/open_requested/opened.v1 | A6：免费来源、资格、已开/待开和重复请求幂等 |
| FEAT-GAM-017 | 宝箱类型与动画 | ✓ | ✓ | A（配置） | — | world/reward | ST-H/G | world/reward?chestId=...&view=animation | chest.animation.started/skipped/result.revealed/animation.fallback.v1 | A5/A6：动画可跳过、低配 fallback，结果先于动画可靠 |
| FEAT-GAM-018 | 概率与历史 | ✓ | ✓ | A（审计） | — | world/reward | ST-H/M | world/reward?panel=probability-history&chestId=... | chest.probability.viewed/probability.version_changed/chest.audit.created/chest.history.viewed.v1 | A6/A10：概率版本、历史和审计可见；无付费随机抽取路径 |
| FEAT-GAM-019 | 重复物品转碎片 | ✓ | ✓ | — | — | world/reward、world/collection | ST-H | world/collection?panel=shards | collection.item_obtained/duplicate_converted/shard_balance_changed/fixed_redeemed.v1 | A6：重复转换、碎片余额、固定兑换和补偿可核对 |
| FEAT-GAM-020 | Collection Book | ✓ | ✓ | A（资产配置） | — | world/collection | ST-H/G | world/collection?tab=book&setId=... | collection.book.viewed/filter_changed/set_progressed/set_completed.v1 | A6：套装、筛选、进度、完成和资源缺失状态一致 |
| FEAT-GAM-021 | Study Space | ✓ | ✓ | A（治理/资产） | — | world/study-room | ST-I/G | world/study-room?panel=space&roomId=... | space.opened/item.placed/layout.saved/layout.restored/render_fallback.v1 | A5/A7：空间布局、物件、恢复和渲染降级不影响专注状态 |
| FEAT-GAM-022 | Learning Season | ✓ | ✓ | A（赛季配置） | — | world/home | ST-H/M | world/home?panel=season&seasonId=... | season.published/enrolled/points_granted/tier_unlocked/reward_claimed/closed.v1 | A6/A10：赛季发布、报名、积分、档位、领取、关闭和历史可见 |

### 4.11 SOC：自习室、排行榜与受控社群（10/10）

| FEAT | 功能 | M | L | A | O | 入口 / 页面路由 | 状态 | Deep Link | 埋点 | 验收 |
|---|---|---:|---:|---:|---:|---|---|---|---|---|
| FEAT-SOC-001 | 房间大厅 | ✓ | ✓ | A（治理） | — | world/study-room | ST-I | world/study-room?view=lobby&roomId=... | soc_room_list_view、soc_room_join_submit/result | A7：房间筛选、加入结果、无房间和重连可解释 |
| FEAT-SOC-002 | 座位与状态 | ✓ | ✓ | A（运营查看） | — | world/study-room | ST-I | world/study-room?roomId=...&view=seats | soc_seat_board_view、soc_seat_snapshot_render | A7：座位/专注状态来自 snapshot，租约失效不显示占用 |
| FEAT-SOC-003 | 番茄钟与白噪音 | ✓ | ✓ | — | — | world/study-room | ST-I/G | world/study-room?roomId=...&focus=... | soc_focus_start/pause/resume/complete、soc_sound_mix_change | A5/A7：本地计时与服务端资格边界清楚，媒体失败可静音恢复 |
| FEAT-SOC-004 | 座位自动释放 | ✓ | ✓ | — | — | world/study-room | ST-I/K | world/study-room?roomId=...&seatId=... | soc_seat_lease_created/renew/auto_released/rejoin | A7：租约、心跳、自动释放、重新加入和退出清理可回放 |
| FEAT-SOC-005 | 预置气泡 | ✓ | ✓ | A（审核） | — | world/study-room | ST-I | world/study-room?roomId=...&panel=bubbles | soc_bubble_catalog_view、send_click/result、received、ugc_rejected | A7：只能发送预置/受控内容；审核拒绝和空目录有提示 |
| FEAT-SOC-006 | 专注/单词排行榜 | ✓ | ✓ | A（运营） | — | world/study-room | ST-I/F | world/study-room?panel=leaderboard&range=... | soc_leaderboard_view/filter/opt_out/snapshot/anomaly | A7：匿名/退出、快照、异常标记和无数据状态一致 |
| FEAT-SOC-007 | 隐私与匿名 | ✓ | ✓ | A（治理） | — | world/study-room、me/privacy | ST-I/J | me/privacy?panel=community | privacy_center_view、privacy_setting_change、anonymous_view | A7/A8：匿名、字段脱敏、退出公开范围和恢复可验证 |
| FEAT-SOC-008 | 系统动态 | ✓ | ✓ | A（审核/运营） | — | world/study-room | ST-I/J | world/study-room?panel=feed&feedId=... | soc_feed_view/impression/like/unlike | A7：动态、点赞幂等、下线/无动态/连接失败可解释 |
| FEAT-SOC-009 | 成员展示 | ✓ | ✓ | A（治理） | — | world/study-room | ST-I/J/G | world/study-room?roomId=...&memberId=... | soc_showcase_open、field_masked、asset_fallback | A7：字段权限、头像/资产 fallback、匿名展示不泄露个人信息 |
| FEAT-SOC-010 | 学习小组 | ✓ | ✓ | A（运营/客服） | — | world/study-room | ST-I/J | world/study-room?groupId=... | soc_group_create/invite/join/checkin/goal/reward | A7：创建、邀请、加入、目标、签到、奖励和退出权限可回放 |

### 4.12 USR：账号、设备与隐私（7/7）

| FEAT | 功能 | M | L | A | O | 入口 / 页面路由 | 状态 | Deep Link | 埋点 | 验收 |
|---|---|---:|---:|---:|---:|---|---|---|---|---|
| FEAT-USR-001 | 自有账号密码注册与登录 | ✓ | ✓ | — | — | login 登录面板（具体 auth 子路由由契约冻结） | ST-A | login?return=... | auth_register、auth_login、auth_password_error、auth_account_locked | A8：账号/IP/设备限流、密码错误、锁定、注册和回到原目标可验证 |
| FEAT-USR-002 | 小程序平台能力边界 | ✓ | — | — | — | login 登录面板；M 统一条件编译 | ST-A | login?return=... | auth_login、platform_capability_denied | A8：平台能力不替换自有 IAM，未通过 Gate 时保持拒绝且可恢复 |
| FEAT-USR-003 | 移动端安全登录边界 | ✓ | — | — | — | login 登录面板 | ST-A | login?return=... | auth_login、secure_storage_unavailable、session_restore | A8：Keychain/Keystore 不可用时拒绝保存 Refresh Token，登录和目标恢复可验证 |
| FEAT-USR-004 | JWT refresh | ✓ | ✓ | — | — | 所有受保护页面的全局会话层 | ST-J/N | 任一受保护 Deep Link；原目标保留 | auth_refresh_attempt/success/failure/reuse_detected | A8：刷新/复用检测失败不丢当前目标，不把服务端失败显示为学习完成 |
| FEAT-USR-005 | 设备列表与踢出 | ✓ | ✓ | A（风险处置） | — | me/settings | ST-J | me/settings?panel=devices&deviceId=... | auth_device_list、kick_submit/result、logout_others | A8：设备、最近活动、踢出/全端退出和再次认证可验证 |
| FEAT-USR-006 | 资料编辑 | ✓ | ✓ | — | — | me/home、me/settings | ST-A/J | me/home?panel=profile | user_profile_view/update/conflict | A8：资料校验、冲突、离线草稿和成功回读一致 |
| FEAT-USR-007 | 删除/匿名化账号 | ✓ | ✓ | A（客服/审计） | — | me/privacy | ST-J/N | me/privacy?panel=delete-account | account_deletion_view/request/cancel/execute/retry | A8：二次确认、冷静期/取消、执行/重试、数据保留边界和审计可见 |

### 4.13 INF：消息、通知、离线、同步与客服（8/8）

| FEAT | 功能 | M | L | A | O | 入口 / 页面路由 | 状态 | Deep Link | 埋点 | 验收 |
|---|---|---:|---:|---:|---:|---|---|---|---|---|
| FEAT-INF-001 | 站内消息 | ✓ | ✓ | A（消息配置） | — | me/messages | ST-J/K | me/messages?messageId=... | notification_center/list/read/mark_all/deeplink | A8：未读、已读幂等、消息失效和业务目标恢复可验证 |
| FEAT-INF-002 | 本地/远程推送 | ✓ | ✓ | A（发送/模板） | — | me/settings、系统推送 → target route | ST-J/K | 目标 canonical route；未登录先保存 | push_permission/register/schedule/delivered/open | A8：权限延迟请求、送达/打开、失效目标和取消注册可回放 |
| FEAT-INF-003 | 通知偏好 | ✓ | ✓ | A（策略配置） | — | me/settings | ST-J | me/settings?panel=notifications | notification_preference_view/change/dnd/unsubscribe | A8：类别、免打扰、退订、设备差异和离线草稿可验证 |
| FEAT-INF-004 | 离线词书/音频 | ✓ | ✓ | A（包配置） | — | me/sync、courses/:id | ST-K/G/D | me/sync?panel=downloads&packageId=... | offline_package/download_start/pause/resume/verify | A2/A5：包版本、大小、暂停续传、校验失败、空间不足和删除可恢复 |
| FEAT-INF-005 | 同步 | ✓ | ✓ | — | — | me/sync、全局状态条 | ST-K/J/N | me/sync?syncId=... | sync_queue/push/event_result/pull/conflict/cursor_reset | A3/A8：队列、游标、冲突策略、重放/重置和已同步边界可核对 |
| FEAT-INF-006 | 弱网重试与 skeleton | ✓ | ✓ | — | — | 所有页面状态层 | ST-C/E/G/K | 保留当前 canonical route 和参数 | network_offline/online、request_retry/exhausted、skeleton | A3/A5：不全屏阻塞、不丢输入；重试耗尽有下一步，恢复后可继续 |
| FEAT-INF-007 | 内容纠错 | ✓ | ✓ | A（审核工作台） | — | courses/:id、me/support | ST-D/K/M | me/support?type=correction&contentId=... | content_correction/open/submit/duplicate/status/resolved | A2/A8/A10：来源、状态、重复提交、处理结果和隐私边界可见 |
| FEAT-INF-008 | FAQ/工单 | ✓ | ✓ | A（客服） | O（仅公开 FAQ 如实际配置） | me/support | ST-K/J | me/support?ticketId=... | support_faq/view/search、ticket_create/message/attachment/resolved | A8/A10：FAQ 空态、工单、附件权限、消息、关闭和重开可验证 |

### 4.14 COM：商业化、权益与订单（9/9）

| FEAT | 功能 | M | L | A | O | 入口 / 页面路由 | 状态 | Deep Link | 埋点 | 验收 |
|---|---|---:|---:|---:|---:|---|---|---|---|---|
| FEAT-COM-001 | Free 权益 | ✓ | ✓ | A（权益配置） | O（公开说明） | me/commerce、官网价格/课程说明 | ST-L/O | me/commerce?plan=free | commerce.entitlement.free_checked/limit_reached.v1 | A9：免费范围、限制、到期/降级和数据保留可见 |
| FEAT-COM-002 | Pro 权益矩阵 | ✓ | ✓ | A（权益配置） | O（公开价格说明） | me/commerce | ST-L/O | me/commerce?plan=pro | commerce.entitlement.activated/expired.v1 | A9：权益按版本矩阵展示，过期降级不删除学习数据 |
| FEAT-COM-003 | 订阅 SKU | ✓ | ✓ | A（SKU/运营） | O（价格公开） | me/commerce、官网价格 CTA | ST-L/O | me/commerce?skuId=... | commerce.sku.viewed/order.created.v1 | A9：SKU、周期、地区、资格和关闭原因可核对 |
| FEAT-COM-004 | 微信支付 | ✓ | ✓ | A（订单/对账） | — | me/commerce | ST-L/N | me/commerce?skuId=...&channel=wechat | commerce.wechat.requested/payment.callback_rejected/payment.verified.v1 | A9：P1 默认关闭；未达资质/沙箱/退款/对账条件时不出现成功 CTA |
| FEAT-COM-005 | 支付宝 | ✓ | ✓ | A（订单/对账） | — | me/commerce | ST-L/N | me/commerce?skuId=...&channel=alipay | commerce.alipay.requested/notified/verified.v1 | A9：回调不可信、通知重复、验证失败和关闭原因可见 |
| FEAT-COM-006 | Apple IAP | ✓ | — | A（订单/对账） | — | me/commerce | ST-L/N | me/commerce?skuId=...&channel=apple | commerce.apple.jws.received/verified/transaction.rejected/subscription.changed.v1 | A9：JWS/交易拒绝/订阅变化状态可核对；无资质不宣称已购买 |
| FEAT-COM-007 | 恢复购买/补单 | ✓ | ✓ | A（收单/人工复核） | — | me/commerce | ST-L/N | me/commerce?panel=recovery&orderId=... | commerce.recovery.scan/settled/reviewed.v1 | A9：恢复扫描、补单、人工复核、幂等和审计可验证 |
| FEAT-COM-008 | Household | ✓ | ✓ | A（客服/权益） | — | me/commerce | ST-L/J | me/commerce?panel=household&groupId=... | commerce.household.invited/joined/member_removed.v1 | A9：邀请、加入、移除、成员权限和数据隔离可验证 |
| FEAT-COM-009 | 订单/账单/发票/自动续费 | ✓ | ✓ | A（财务/客服） | — | me/commerce | ST-L/J/N | me/commerce?orderId=...&panel=billing | commerce.order.viewed/invoice.requested.v1 | A9：订单、发票请求、自动续费、退款入口和状态对账一致 |

### 4.15 ADM：教研 CMS、运营、审核与风险（10/10）

> admin-web 的业务区均以 UIUX 23 的 ContentTemplate、DashboardTemplate、ImmersiveTemplate、SettingsTemplate 及其中的 review/support/audit 页面区为宿主。UIUX 24 没有冻结独立 admin 子路由，因此下表中的 area/type/draftId 仅是 Deep Link 目标参数；在路由实现冻结前不得把它们扩展成第二套页面或项目。

| FEAT | 功能 | M | L | A | O | 入口 / 页面路由 | 状态 | Deep Link | 埋点 | 验收 |
|---|---|---:|---:|---:|---:|---|---|---|---|---|
| FEAT-ADM-001 | 词汇/chunk 编辑器 | — | — | ✓ | — | admin/dashboard → ContentTemplate（vocab/chunk） | ST-M | admin/dashboard?area=content&type=vocab&draftId=...（URL 子路由待冻结） | admin.vocab.draft_saved、admin.asset.bound | A10：草稿、词条/chunk、资产、版本、预览和未发布隔离 |
| FEAT-ADM-002 | 语法/DAG 编辑器 | — | — | ✓ | — | admin/dashboard → ContentTemplate（grammar/DAG） | ST-M/G | admin/dashboard?area=content&type=grammar&draftId=...（URL 子路由待冻结） | admin.grammar.dag_validated、admin.content.previewed | A10/A5：DAG 校验、预览、渲染 fallback、版本和错误定位可复核 |
| FEAT-ADM-003 | 题目导入 | — | — | ✓ | — | admin/dashboard → ContentTemplate（question import） | ST-M/K | admin/dashboard?area=content&type=question-import&jobId=...（URL 子路由待冻结） | admin.import.started/row_rejected/completed | A10：导入进度、逐行拒绝原因、幂等重试和原始文件权限可见 |
| FEAT-ADM-004 | 试卷组装 | — | — | ✓ | — | admin/dashboard → ContentTemplate（paper assembly） | ST-M | admin/dashboard?area=content&type=paper&paperId=...（URL 子路由待冻结） | admin.exam.blueprint_created/item_adjusted | A10：蓝图、题目约束、调整、版本和预览与 learner 试卷一致 |
| FEAT-ADM-005 | 双审发布 | — | — | ✓ | — | admin/dashboard → ContentTemplate（review queue 页面区） | ST-M/N | admin/dashboard?area=review&contentId=...（URL 子路由待冻结） | admin.review.submitted/approved、admin.content.published | A10：草稿→提交→双审→发布/下线/回滚链路和审计证据完整 |
| FEAT-ADM-006 | 敏感前置拦截 | — | — | ✓ | — | admin/dashboard → SettingsTemplate（safety/review 页面区） | ST-M/N | admin/dashboard?area=safety&contentId=...（URL 子路由待冻结） | safety.precheck.blocked、safety.review.overruled | A10：前置拦截、人工复核、驳回/放行原因和权限隔离可复核 |
| FEAT-ADM-007 | 用户/风险 | — | — | ✓ | — | admin/dashboard → LearningTemplate/SettingsTemplate | ST-M/J/N | admin/dashboard?area=risk&userId=...（URL 子路由待冻结） | risk.decision.created、risk.user.suspended/appealed | A10/A8：风险决定、停用、申诉、隐私字段最小化和审计可见 |
| FEAT-ADM-008 | 纠错工作台 | — | — | ✓ | — | admin/dashboard → ContentTemplate/SettingsTemplate（support 页面区） | ST-M/K | admin/dashboard?area=correction&caseId=...（URL 子路由待冻结） | support.correction.created/resolved | A10/A8：纠错去重、处理、发布关联、反馈和权限可验证 |
| FEAT-ADM-009 | 运营/质量/财务看板 | — | — | ✓ | — | admin/dashboard → DashboardTemplate | ST-M/N | admin/dashboard?area=dashboard&metric=...（URL 子路由待冻结） | ops.dashboard.viewed、ops.metric.lagged、finance.reconciliation.alerted | A10：指标时间窗、延迟、无样本、对账告警和快照来源可见 |
| FEAT-ADM-010 | Feature Flag/A-B | — | — | ✓ | — | admin/dashboard → SettingsTemplate | ST-M/N | admin/dashboard?area=flags&flagId=...（URL 子路由待冻结） | ops.flag.exposed/updated、ops.experiment.assignment | A10：P1 开关关闭即隐藏入口，分流、版本、回滚和曝光审计一致 |

## 5. 详细技术设计中 UI 文档未充分显式化的补充能力

本节只补齐宿主、状态、入口、Deep Link、埋点和验收，不新增 FEAT、页面或 API。TECH-* 是追踪标签，不是需求矩阵 ID。所有补充能力必须挂在第 4 节已有页面；没有既有宿主的技术能力仍然是后端/后台缺口，不得凭空造页面。

| TECH | detailed-specs 中的能力 | 既有 UI 宿主与入口 | 状态 | Deep Link | 埋点/审计 | UI/UX 补充与验收 |
|---|---|---|---|---|---|---|
| TECH-PLAT-001 | AdaptivePerformanceEngine 的 Ultra/High/Medium/Performance 四级画质和设备自适应 | learn/map、X-Ray、speaking mouth、world/game、world/avatar、study-room | ST-C/G/H/I | 保留当前 route；只在设置/调试上下文记录 performanceLevel | E-UI + performance.level_selected/downgraded | 所有沉浸宿主提供可见的质量降级结果和恢复入口；低配至少可用 2.5D SVG/2D 静态切片；验收覆盖手机、iPad、Windows Web/PWA |
| TECH-PLAT-002 | 地图/图谱 LOD、WebGL context lost、2D fallback | learn/map、courses/grammar、courses/speaking | ST-C/D/G | learn/map?region=...；courses/grammar?xraySentenceId=...；courses/speaking?phonemeId=... | performance.*、对应 render.downgraded/fallback | fallback 不改变节点、规则、音标或学习结果；恢复 WebGL 后可重新加载，不回到首页 |
| TECH-ONB-001 | 规则测评题型组成、难度 1~6、首始 A2 参考和确定性结果 | onboarding/assessment、onboarding/result | ST-B/F | onboarding/assessment?sessionId=...；onboarding/result?assessmentId=... | E-ONB；结果审计记录 | UI 明示“规则测评”，展示结果依据和未完成/重算状态；不得出现 AI 评分文案 |
| TECH-ONB-002 | 地图节点 LOCKED/UNLOCKED/COMPLETED/MASTERED、NORMAL/REVIEW/BOSS/CHECKPOINT 和 1~3 星 | learn/map、learn/node/:id、practice/checkpoint | ST-C/F | learn/node/:id?type=... | E-UI + checkpoint_* | 节点详情 sheet 统一展示解锁条件、星级规则、下一入口和错误恢复，不再另造节点页面 |
| TECH-VOC-001 | lrn_srs_state 单一来源、vocab_id/chunk_id/expression_id canonical ID、review_event 与快照 | practice/srs、practice/srs/session/:id、practice/mastery | ST-E/F/K/N | practice/srs/session/:id?objectType=...&objectId=... | learning.srs.calculated、review_submitted、sync_queue | UI 不暴露内部表名，但显示对象类型、复习状态、下次时间和同步 pending；验收证明同一对象不出现两套进度 |
| TECH-VOC-002 | 300ms dwell 防批量刷卡、逾期 backlog 平滑和 PENDING_SYNC | practice/srs/session/:id、practice/srs | ST-E/K/N | practice/srs?mode=due/backlog | risk.vocab.flagged/decision、learning.srs.overdue_detected/backlog_smoothed | 防刷提示不得把正常慢网当作弊；排队、重试、结算和最终状态可回放，原始答案不入 telemetry |
| TECH-GRM-001 | X-Ray 的 token/slice/node/edge DAG 数据模型和 Vue Flow/G6/2D 降级 | courses/grammar | ST-D/G | courses/grammar?view=xray&xraySentenceId=... | xray.sentence.opened、xray.node.*、render.downgraded | UI 提供片段、节点、连线和纯文本阅读顺序；DAG 数据错误定位到版本/节点，不显示空白图 |
| TECH-GRM-002 | 规则化评分、版本化规则卡、模板和素材，不使用 AI 生成反馈 | courses/grammar、courses/writing、practice/result/:id | ST-D/E/F | courses/writing?templateId=...；practice/result/:id?panel=rubric | grammar.*、writing.* | 反馈必须链接到规则/评分点/素材版本；计算失败显示未计算，不生成看似确定的分数 |
| TECH-MEDIA-001 | Wavesurfer token virtualization、毫秒时间轴、AB 循环、字幕同步 | courses/listening、courses/reading、courses/speaking | ST-D/G/E | 保留 contentId/segment/paragraph/phonemeId | E-MEDIA + listening.*/reading.* | 长波形只渲染可视切片；滚动/缩放不发生全量 DOM 重排；无字幕/波形 fallback 仍能播放或读文本 |
| TECH-MEDIA-002 | 0.5x~2.0x pitch-preserving、解码失败和播放质量降级 | 所有播放器和跟读宿主 | ST-G | 当前媒体 Deep Link 加 speed 参数 | listening.speed_changed、xray.audio.*、playback_quality_downgraded | 速度、音高、片段高亮和进度一致；失败时可切换正常播放/静音/重试 |
| TECH-SPK-001 | 录音本地 AES-256-GCM、Keychain/Keystore、presigned URL/multipart、删除生命周期 | courses/speaking、me/sync | ST-G/K/J/N | practice/session/:id?type=recording；me/sync?panel=uploads | speaking.recording_*、upload_*、recording_deleted | UI 只显示权限、录音保留/删除、上传和待同步状态；不提供下载原始录音的未授权入口，不把音频送入埋点 |
| TECH-SPK-002 | 麦克风权限、300~800ms shadowing 校准、固定 roleplay、无 ASR/LLM/RTC | courses/speaking、practice/session/:id | ST-E/G | courses/speaking?type=shadowing/roleplay | speaking.mic_permission_*、delay_calibrated、roleplay.* | 权限说明在真正录音前出现；拒绝可看示范或自评，不能写成 AI 发音分数；校准失败有手动重试 |
| TECH-ASM-001 | 题目 session 状态机、服务端时钟、答案保护、幂等提交、版本变更 | practice/session/:id、practice/result/:id | ST-E/F/N | sessionId/questionId/resultId | E-PRA、answer_saved、answer_submitted、result_sync_retry | 页面刷新/多开/回退不重复结算；时间到、内容版本变更和服务器拒绝均可解释 |
| TECH-ASM-002 | 反作弊仅使用 visibility/focus/fullscreen/clock/heartbeat，不使用摄像头、录屏、麦克风 | practice/cet、practice/session/:id | ST-E/F/M | practice/cet?paperId=... | anti_cheat_event_received、warning_shown | 入口告知范围；告警不泄漏安全规则细节但给出申诉/联系客服入口；未授权设备不被误判为已通过 |
| TECH-ASM-003 | PENDING_RETRY、DELAY_VERIFY_D1、DELAY_VERIFY_D7、MASTERED、REOPENED 的状态投影 | practice/mastery、practice/mistakes、通知 → session | ST-F/J/N | practice/mastery?itemId=...&verify=d1/d7 | verification_*、mastery_state_changed、review_schedule_view | UI 显示当前状态、原因、下一时间和可做动作；状态只由服务端推进，重试结果可审计 |
| TECH-GAM-001 | 免费宝箱确定性开奖、seedCommit/HMAC/概率版本/审计、重复物品转碎片、禁止现金交易 | world/reward、world/collection | ST-H/M/N | world/reward?chestId=... | chest.probability.*、chest.audit.created、collection.duplicate_converted | 结果页先于动画可靠，展示来源/概率版本/历史；没有付费随机抽取、现金兑换或玩家交易 UI |
| TECH-GAM-002 | 六 gameCode 与四级性能降级；扩展游戏受 feature flag 控制 | world/game/:id | ST-H/G/M | world/game/:id?gameCode=... | game feature_flag_blocked、performance.* | 只承载矩阵已有 GAM001~022；扩展能力隐藏/解释，不新增 GAM023/024 或新导航 |
| TECH-SOC-001 | WebSocket snapshot、座位租约、心跳、专注状态和断线重连 | world/study-room | ST-I/K | world/study-room?roomId=... | soc_*、network_offline/online | snapshot 旧时显示 stale；租约失效自动释放，重连后按服务端状态恢复，不把本地计时当在线事实 |
| TECH-USR-001 | 设备身份绑定、JWT refresh reuse detection、Apple JWK refresh、踢出和删除 | onboarding/welcome、me/settings、me/privacy | ST-A/J/N | 当前受保护 Deep Link 保留 return | auth_*、account_deletion_* | 认证失败/刷新失败不吞掉原目标；重新认证、全端退出、删除/取消和审计可回放 |
| TECH-INF-001 | 离线包、同步 cursor、push/pull、冲突解决和 cursor reset | me/sync、当前学习/练习宿主 | ST-K/J/N | me/sync?syncId=... | offline_package.*、sync.*、checkpoint_conflict | 冲突给出字段/版本/选择或服务端策略说明；队列状态与最终回执一致，无法恢复时提供安全重置 |
| TECH-COM-001 | WeChat/Alipay callback、Apple JWS、退款、恢复购买、对账和资质开关 | me/commerce；A 的 DashboardTemplate/SettingsTemplate | ST-L/N/M | me/commerce?orderId=...；admin/dashboard?area=finance | E-COM、finance.reconciliation.alerted | 客户端只显示服务端已核验状态；支付默认 OFF 时显示关闭原因，回调/JWS/对账/退款不冒充用户页面 |
| TECH-ADM-001 | contentVersion、provenance、双审、发布/下线/回滚和资产版权 | admin/dashboard → ContentTemplate（content/review 页面区）；learner content host 只读投影 | ST-M/D/N | admin/dashboard?area=review&contentId=...（子路由待冻结） | admin.content.*、admin.review.*、safety.* | 前台只能看到已发布版本；草稿、回滚、版权证据和 audit trail 可被角色允许的后台用户回放 |
| TECH-ADM-002 | 风险决定、敏感前置/后置双审、feature flag/A-B assignment | admin/dashboard → SettingsTemplate（safety/risk/flags 页面区） | ST-M/N | admin/dashboard?area=safety/risk/flags&targetId=...（子路由待冻结） | risk.*、safety.*、ops.flag.* | flag 关闭即时隐藏 P1 入口；风险/双审/分流有版本和操作者审计，后台越权显示 permission denied |
| TECH-PRIV-001 | 原始答案、音频、私密笔记、支付凭证不进入客户端埋点；请求 trace 和可回放审计 | 全部页面；后台审计上下文 | ST-J/N | 保留当前目标，不在 Deep Link 携带敏感值 | 统一 envelope + audit trail | 验收以埋点抓包/脱敏快照证明；出现敏感数据时视为 DoD 阻塞项 |

## 6. 无法直接落 UI 的后端/后台功能与缺口

下列项目已经在第 4、5 节找到“投影宿主”或“入口”，但不能被页面本身替代。它们必须由后端、后台或基础设施交付；在其合同、权限、审计和验收证据冻结前，UI 只能显示 pending、不可用、错误或人工复核状态，不能虚构成功。

### 6.1 只能作为后端事实源的功能

| 范围 | 无法由 UI 单独完成的事实 | 当前 UI 可做的最小投影 | 交付缺口 |
|---|---|---|---|
| 测评/推荐 | 规则测评的自适应难度、CEFR 映射、推荐排序、Daily Stream 组题、计划天数 | 显示题目、计算中、结果证据、推荐失败和重试 | 需要 deterministic engine 的版本、输入输出 schema、idempotency 和审计回放 |
| SRS/掌握 | lrn_srs_state、版本化改进型 SM-2（Phase 1 唯一算法）、`algorithmVersion`、review_event、D+1/D+7、REOPENED、逾期平滑；FSRS 仅为后续经评审、迁移和效果验证后的候选 | 显示状态、下次时间、队列、pending sync、解释和恢复 | 需要唯一事实源、canonical object ID、迁移策略、并发/幂等和历史快照；不能由 mobile/Web 各自计算 |
| 题目/模考 | 题目组装、服务端计时、答案保护、批量结算、错误归因、反作弊事件判断、报告百分位样本 | 显示题目状态、计时、提交/待同步、告警、样本不足 | 需要 session state machine、server clock、答案隔离、证据链和申诉路径 |
| 音频/录音 | 变速保音高、转码、字幕/时间轴、离线包、presigned URL/multipart、录音加密/删除 | 显示播放、波形、降级、权限、上传和同步 | 需要媒体 manifest、版权策略、密钥/设备存储生命周期和上传回执 |
| 口语 Phase 1 | 48 音标 manifest、固定 roleplay、shadowing 校准；明确无 ASR、LLM、AI 分数、RTC | 示范、录音、自评、固定脚本、权限和 fallback | 需要能力开关和审计保证“无 AI”；否则不得把服务端能力暴露成 UI |
| 社群实时 | WebSocket snapshot、座位 lease、心跳、在线状态、断线重连、异常排行榜 | 显示 stale、重连、自动释放和最后快照 | 需要实时协议、版本/游标、租约和异常策略；UI 不能判定在线或占座 |
| 同步/离线 | cursor、push/pull、冲突解决、事件重放、重置游标、包校验 | 显示队列、冲突、重试、恢复和只读缓存 | 需要冲突模型、优先级、数据保留、幂等键和最终回执 |
| 认证/隐私 | 账号密码哈希、JWT refresh reuse、JWKS、设备踢出、删除/匿名化执行 | 显示权限、重新认证、冷静期、取消和结果 | 需要 Token/设备绑定协议、密码重置、删除任务和审计/保留边界；UI 不能自己“删除成功” |
| 商业化 | 渠道资质、支付 callback/JWS、订单状态机、退款、恢复购买、对账、家庭权益 | 显示资格、价格、pending、失败、订单查询和关闭原因 | P1 支付默认 OFF；需 sandbox、资质、退款、对账、回滚、审计全部通过后才能打开 CTA |
| 奖励安全 | seedCommit/HMAC、概率版本、免费箱确定性结果、重复转碎片、禁止现金交易 | 显示来源、概率/历史、动画 fallback、结果和补偿 | 需要服务端随机/审计证明和不可篡改事件；UI 不得实现开奖或发奖励 |
| 安全合规 | 前置敏感拦截、后置核验、版权/来源、审计、隐私字段最小化 | 显示 blocked、review、permission denied、下线和人工入口 | 需要规则版本、双审角色、覆盖关系和证据包；没有后端决定时不能提供“已发布/已合规” |

### 6.2 admin-web 的页面/路由缺口

1. UIUX 23 给出了后台信息架构和模板，但 UIUX 24 只冻结了 admin/dashboard 语义入口，没有冻结 Content、Review、Users、Risk、Orders、Refunds、Support、Audit、Flags 等 canonical sub-route、参数 schema、返回/失效 Deep Link 和跨页 session 恢复规则。第 4.15 节因此只映射到同一 admin/dashboard 宿主，并明确标记“URL 子路由待冻结”。
2. 词汇/chunk 编辑器、语法 DAG 校验、题目导入逐行错误、试卷蓝图、双审队列、敏感复核、风险申诉、纠错工作台、财务对账告警和 A/B 分流在 detailed-specs 中有技术流程，但 UIUX 文档没有逐页的线框、字段级状态、空/加载/错误/恢复证据。现阶段不能再造一组管理页面来掩盖该缺口。
3. admin 的 RBAC、角色×动作×数据域矩阵、最小可见字段、二审互斥、审计查看权限、批量操作确认和回滚入口尚未在页面路由与验收 ID 上形成一份冻结注册表；这是后台交付前置条件。

### 6.3 official-site 的落地缺口

1. UIUX 规范冻结了 official-site 的职责，但没有给出官网 canonical route、公开内容版本、价格/下载/合规页面的 page ID 和 Deep Link 注册表。因此 COM 的 O 映射仅表示公开说明/CTA 宿主，不能替代认证后的 me/commerce。
2. 官网到登录后的 course/commerce 目标需要明确 return URL 白名单、失效目标、地区/资格判断和隐私告知；在该协议冻结前，官网只能展示公开信息并把用户带到 onboarding/welcome。
3. 公开 FAQ、分享海报落地页、应用下载页是否由 official-site 承载尚未形成需求基线中的独立 FEAT；本文件只标注“如实际配置”，不新增页面或需求。

### 6.4 仍需补进 UI/验收证据包的横切缺口

| 缺口 | 必须补的证据 |
|---|---|
| canonical route 注册表 | 四端 route、query/path schema、登录前 return、失效目标、权限失败、版本迁移和通知 Deep Link 一一登记 |
| 事件注册表 | 页面/动作/结果、版本、字段脱敏、requestId/traceId、network/performanceLevel、离线补发和去重规则 |
| 页面状态证据 | 每个 FEAT 的 success/empty/loading/error/offline/permission/recovery 截图或自动化状态 fixture；不能只交默认成功态 |
| 响应式与性能 | M 的移动 H5/iOS/Android/iPad、L 的 PC Web/PWA/平板、四级性能和低配 fallback 的证据 |
| 无障碍 | 键盘、焦点、屏幕阅读器、触控目标、减弱动效、字体/主题和录音/支付权限拒绝路径 |
| 发布与回滚 | A 的 draft/review/publish/offline/rollback、learner 的内容版本失效提示、O 的公开版本和 SEO/合规链接 |
| 失败恢复 | 弱网、队列、冲突、重复提交、媒体失败、录音上传失败、支付 pending/拒绝、删除取消和人工复核 |

## 7. 覆盖核对、冲突处理与交付闸门

### 7.1 FEAT 计数核对

| 域 | FEAT 数 | 本文件映射区段 | 核对结果 |
|---|---:|---|---|
| ONB | 22 | 4.2 | 全量 |
| VOC | 30 | 4.3 | 全量 |
| GRM | 12 | 4.4 | 全量 |
| WRT | 5 | 4.5 | 全量 |
| LST | 6 | 4.6 | 全量 |
| RDG | 4 | 4.7 | 全量 |
| SPK | 6 | 4.8 | 全量 |
| ASM | 20 | 4.9 | 全量 |
| GAM | 22 | 4.10 | 全量；不创建 GAM-023/024 |
| SOC | 10 | 4.11 | 全量 |
| USR | 7 | 4.12 | 全量 |
| INF | 8 | 4.13 | 全量 |
| COM | 9 | 4.14 | 全量 |
| ADM | 10 | 4.15 | 全量 |
| **合计** | **171** | **4.2~4.15** | **171/171；SUBFEAT-* 为 0，不虚构编号** |

### 7.2 已识别的基线冲突

| 冲突 | 本文件处理 |
|---|---|
| 旧 UI 文档出现每日 5/10/20/30，冻结基线为 5/15/30/45 | 所有 UI 映射只写 5/15/30/45；旧值不作为设计入口 |
| 旧音频预设与冻结基线不一致 | 所有变速/同步/播放器验收只写 0.5x~2.0x 且保持音高 |
| 内部 SRS 状态别名与对外 API 状态不同 | 页面只投影 NEW、LEARNING、MASTERED、CONSOLIDATED；D+1/D+7/Reopened 原因按 TECH/ASM 规则展示 |
| UIUX 22 使用 assessment/intro、assessment/session 等旧路径，UIUX 24 冻结 onboarding/assessment | canonical route 使用 UIUX 24；旧路径只作为兼容 Deep Link，不形成第二页面 |
| detailed-specs/06 描述六 gameCode，矩阵只有四个游戏 FEAT | 挂在 GAM001~022 和 feature flag；不增加 FEAT/GAM 子页面 |
| 详细设计写到 AI/RTC 的未来能力，Phase 1 基线禁止 | UI 只提供规则化测评、固定角色、录音自评、示范和降级；不出现 AI/LLM/ASR/RTC 页面 |

### 7.3 Definition of Done 交付门槛

在该文档所列映射进入开发验收前，证据包至少应能从任一 FEAT 反查到：

1. route 与所属项目；入口和 Deep Link 的参数/登录前 return；
2. success、empty、loading、error、offline、permission、recovery 的可复现 fixture；
3. operationId/契约、contentVersion 或 ruleVersion、幂等键、埋点和审计字段；
4. M 的移动 H5/iOS/Android/iPad、L 的 PC Web/PWA/平板、A 的 RBAC、O 的公开边界；
5. Ultra/High/Medium/Performance、键盘/屏幕阅读器、弱网/冲突/恢复、隐私/版权/回滚证据；
6. 学习闭环：目标 → 练习 → 反馈 → 复习 → 报告/复盘；没有“提交后无下一步”的页面；
7. Phase 1 隔离：18+、无 K12、无 AI 生成/AI 评分/RTC 对话，P1 关闭时入口和 Deep Link 均安全地显示不可用或隐藏。

### 7.4 本次写入边界

本次设计只写入本文件。没有修改 requirements、共享 README、feature matrix、UIUX 源文档、detailed-specs、契约、数据库、启动脚本或代码。后续若要解决第 6 节的路由、合同或后台能力缺口，应按仓库 AGENTS.md 的 contract-first、ADR 和 DoD 流程另行变更。
