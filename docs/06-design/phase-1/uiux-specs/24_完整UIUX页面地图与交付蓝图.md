# 语学星 Phase 1 完整 UI/UX 页面地图与交付蓝图

> 状态：主管收敛版 / Phase 1 UI Freeze Candidate  
> 日期：2026-08-20  
> 适用端：Mobile App / H5、iPad、Web、Admin Web  
> 产品边界：18+ 成人与大学生；规则化学习闭环；AI Tutor、AI 评分、K12 与未成年人入口不在本阶段

## 0. 前端项目映射（已冻结）

- `apps/mobile`：唯一的 uni-app 学习端，覆盖 Mobile H5、iOS、Android、iPad；微信小程序是后续条件编译目标。
- `apps/learner-web`：独立的 PC Web、平板浏览器和 PWA 学习工作台，使用本蓝图的学习者信息架构但采用 Web 导航壳。
- `apps/admin-web`：独立的 Admin Web，使用独立权限、审计和高密度后台信息架构。
- `apps/official-site`：独立的官网公开页面，不属于登录后的学习者路由地图。

本蓝图共享路由语义、状态契约和设计 Token；页面 DOM、导航壳和平台交互由对应项目分别实现。`apps/miniapp-wechat` 不作为第五个业务项目。

## 1. 这份文档解决什么问题

当前需求矩阵覆盖的功能很多，但不需要把每一项都设计成一张互相孤立的页面。本蓝图把全部功能收敛为：

1. 五个学习者一级入口；
2. 十个可复用页面族；
3. 一条从目标、练习、反馈、复习到复盘的主闭环；
4. 一套跨 Mobile / Pad / Web 的导航、状态和组件规则；
5. 一份可以交给 Vue 3 + TypeScript + uni-app 实现的页面交付顺序。

设计原则是：打开后立即知道下一步、每次反馈都能解释、退出后能够恢复、奖励服务于学习、功能边界对用户透明。

## 2. 事实源与冻结决策

### 2.1 事实源优先级

当文档或旧稿件出现冲突时，按以下顺序解释：

1. `requirements/` 中的 Phase 1 范围与验收约束；
2. `docs/06-design/design-system.md` 与 Phase 1 UI/UX 规格；
3. 本蓝图的页面地图、状态和跨端约束；
4. `mockups/complete-ui-ux-command-center.html` 总控原型；
5. 各业务页面族原型与旧版概念稿。

`19–23` 的专项文档纳入本阶段设计事实源；旧版稿件可以用于视觉参考，但不得绕过本蓝图新增一级导航或 Phase 2 功能。

### 2.2 视觉与交互基线

| 决策 | 统一方案 |
|---|---|
| 视觉方向 | A 极光星图为品牌基线；B 纸页专注用于阅读、语法和写作内容面板；C 任务舱用于练习 Session、计时和结果反馈 |
| 主题 | 浅色与深色同等设计；统一使用 `html[data-theme="light|dark"]`，旧稿 `data-mode` 仅作迁移兼容 |
| 学习者一级导航 | 学习 / 练习 / 世界 / 课程 / 我的 |
| iPad 导航 | 横屏或宽度达到 Rail 阈值使用左侧紧凑导航；竖屏保留底部五 Tab；页面内容不重复堆放两套导航 |
| Web 导航 | 左侧展开式导航 + 顶部状态/搜索 + 右侧上下文摘要；Admin 使用独立 Web IA |
| iPhone 设备稿 | 以 iPhone 16 Pro Max 纵向规格作为 Mobile 展示基准：Dynamic Island、状态栏、电池、底部 Home Indicator、硬件圆角均属于设备壳，不属于业务内容 |
| 反馈方式 | 成功用状态变化和轻量 Toast；需要决策的内容用 Bottom Sheet；危险、付款、权限、注销用明确确认页/弹层 |
| 动效 | 默认开启；全局支持关闭/减弱；复杂地图、3D 与粒子必须响应 `AdaptivePerformanceEngine` |
| 文案边界 | 不羞辱、不用“落后/失败者”标签；测评只显示“参考估算”；跟读和写作只做录音回放、规则比对与用户自评 |

## 3. 产品信息架构

### 3.1 全局入口（不属于五 Tab）

`Splash → 登录/注册 → 协议与隐私 → 18+确认 → 目标 → 每日时长 → 规则化测评 → 结果 → Study Plan → 第一课`

必须支持：

- 手机验证码、微信、Apple 登录入口的统一账号状态；
- 18+确认与隐私同意的可审计记录；
- 测评中断后恢复；
- 测评结果标注“参考估算”，不能包装为官方认证或 AI 诊断；
- 生成计划前可返回修改目标与每日时长；
- Deep Link 目标失效时回退到对应一级入口，并解释原因；
- 维护公告、版本升级和权限说明的可关闭状态。

### 3.2 学习者五 Tab

| 一级入口 | 用户问题 | 主要页面族 | P0 范围 |
|---|---|---|---|
| 学习 | 今天做什么、从哪里继续、路径到哪 | Learning Dashboard / Plan / Map / Detail Sheet | 首页、今日任务、断点续学、计划、地图、节点详情、计划重排 |
| 练习 | 现在练什么、错在哪里、何时复测 | Practice Hub / Practice Session / Result | SRS、Mistake Repair、Quick Practice、Checkpoint、CET、反馈与掌握中心 |
| 世界 | 学习成长、XP、角色和轻社交 | Growth Dashboard / Game / Reward / Social | 等级、Streak、任务、基础 Avatar、免费奖励箱、轻量排行榜 |
| 课程 | 找到内容并进入学习 | Content Shelf / Content Detail / Immersive Player | 场景课程、词汇、语法、精听、分级阅读、跟读、写作基础 |
| 我的 | 记录、权益、设置、隐私和服务 | Profile / Report / Settings / Commerce / Support | 报告、消息、会员、Household、订单、隐私、客服、同步 |

### 3.3 Admin Web

Admin 不进入学习者五 Tab，采用独立 Web 应用：

`Dashboard → 内容资产 → 题库/组卷 → 双审工作台 → 版本 Diff → 发布/回滚 → 用户/权益 → 客服工单 → 消息/Deep Link → 数据与审计 → 权限配置`

奖励概率、权益补发、退款、内容下线、敏感内容拦截、Feature Flag 和实验配置必须有角色权限与审计日志。

## 4. 路由地图

路由是页面事实源的最小粒度。具体实现可使用 uni-app 页面目录，但必须保留以下语义命名，便于 Deep Link、埋点和测试定位。

### 4.1 学习与 onboarding

| Route key | 页面 | 主入口 | 关键状态 |
|---|---|---|---|
| `onboarding/welcome` | 欢迎与登录 | 首次启动 | 未登录、协议未同意、维护 |
| `onboarding/age` | 18+确认 | 登录后 | 未确认、拒绝、返回修改 |
| `onboarding/goal` | 目标与每日时长 | onboarding | 未选择、已选择、冲突提示 |
| `onboarding/assessment` | 规则化水平测评 | onboarding | 未开始、进行中、恢复、提交中、失败 |
| `onboarding/result` | 参考结果 | assessment | 结果可解释、重新测评、修改目标 |
| `onboarding/plan` | Study Plan | result | 生成中、可调整、已确认 |
| `learn/home` | Adaptive Home | 学习 | 正常、今日完成、离线、过期任务 |
| `learn/plan` | 计划与日历 | 学习 | 计划中、落后、自动重排、休息日 |
| `learn/map` | 学习地图 | 学习 | 未解锁、可学习、进行中、已完成、归档 |
| `learn/node/:id` | 节点详情 | map | 详情、前置条件不足、内容不可用 |
| `learn/session/:id` | 断点续学 | home | 恢复、进行中、同步中、完成 |

### 4.2 练习

| Route key | 页面 | 关键状态 |
|---|---|---|
| `practice/home` | Practice Hub | 推荐、队列为空、离线队列、额度提示 |
| `practice/srs` | SRS 复习首页 | 新词、到期、积压、无可复习内容 |
| `practice/srs/session/:id` | 词汇/短语/表达 Session | 回忆、翻面、信心度、退出恢复、完课 |
| `practice/mistakes` | Mistake Repair 队列 | 待修复、规则回顾、变式题、延迟复测 |
| `practice/quick` | Quick Practice | 3/5/10/20 分钟、生成中、完成 |
| `practice/checkpoint` | Checkpoint | 说明、计时、自动保存、交卷、结果 |
| `practice/cet` | CET 模拟 | 说明、计时、标记题目、答题卡、交卷、报告 |
| `practice/result/:id` | 统一结果与反馈 | 正确/错误解释、薄弱点、下次复习、继续练 |
| `practice/mastery` | Memory & Mastery Center | 掌握等级、趋势、复测入口 |

SRS、Mistake Repair、Checkpoint、CET 和课程练习必须复用同一套 `PracticeSession` 外壳：顶部进度/退出、题面区、答案区、提交区、反馈区、恢复和完成状态。

### 4.3 世界、课程、我的

| Route key | 页面族 | 主要页面 |
|---|---|---|
| `world/home` | Growth Dashboard | XP、等级、Streak、每日/每周任务 |
| `world/game/:id` | Game Session | 说明、进行中、结算、XP 反馈 |
| `world/avatar` | Avatar Studio | 快照、基础衣柜、保存穿搭、低配降级 |
| `world/reward` | Reward | 免费奖励箱、概率说明、开启结果、历史、重复物品转碎片 |
| `world/collection` | Collection Book | 空、已收集、套装进度 |
| `world/study-room` | Study Room | P1 实时房间；P0 可先提供匿名成员卡、动态与排行榜 |
| `courses/home` | Content Shelf | 场景、技能、分级阅读、课程筛选 |
| `courses/:id` | Content Detail | 课程包、单元、进度、继续学习 |
| `courses/grammar` | Grammar | 规则卡、知识树、句子积木 |
| `courses/listening` | Listening | 精听播放器、听写、播放/缓存状态 |
| `courses/reading` | Reading | 阅读器、查词、收藏表达、Sentence Mining |
| `courses/speaking` | Speaking | 跟读、录音、回放、自评、权限拒绝 |
| `courses/writing` | Writing | 汉译英、仿写、规则比对、参考答案 |
| `me/home` | Profile | 个人状态、报告摘要、权益与服务入口 |
| `me/reports` | Reports | 日报、周报、月报、掌握趋势 |
| `me/messages` | Messages | 学习、社交、会员、安全、系统消息 |
| `me/commerce` | Commerce | VIP、Household、订单、退款、恢复购买 |
| `me/settings` | Settings | 显示、音频、性能、设备、权限、账号安全 |
| `me/privacy` | Privacy & Data | 导出、录音清理、学习进度重置、注销确认 |
| `me/support` | Support | FAQ、工单、内容纠错、工单状态 |
| `me/sync` | Sync & Download | 下载、同步、冲突、离线恢复 |
| `admin/dashboard` | Admin Dashboard | 用户、留存、内容、风险、工单、财务摘要 |

## 5. 页面族与复用规则

### 5.1 Learning Dashboard

用于 `learn/home`、`world/home`、`me/home` 和 Admin Dashboard 的信息总览。

- 顶部：问候/上下文、状态和一级动作；
- 首屏：一个主任务，不同时抢夺多个 CTA；
- 中段：进度、解释、下一步；
- 底部：低优先级数据和入口；
- Mobile 使用垂直信息流，Pad/Web 使用双栏或三栏；
- 首页推荐必须能回答“为什么推荐”。

### 5.2 Content Detail

用于课程包、课程单元、语法规则、表达详情、Avatar/奖励详情。

- 统一头部、内容摘要、进度、主 CTA、相关入口；
- 付费或权限状态必须在主 CTA 附近说明；
- 内容未发布、过期或地区不可用时，使用明确空态和回退入口；
- 查词、规则、概率说明使用 Bottom Sheet，不打断主路径。

### 5.3 Practice Session

用于所有答题/复习/模拟考试。

- 顶部显示当前进度、计时（需要时）、退出；
- 退出不可直接丢进度：保存后退出、继续、放弃三选一；
- 正误反馈不能只用颜色，必须含错误类型、解释和修复入口；
- 提交幂等，网络失败时保留本地答案并显示同步状态；
- 完成页给出本次表现、下次复习时间和返回路径。

### 5.4 Immersive Player

用于听力、阅读、跟读和写作输入。

- 主媒体区保持单一焦点；
- 播放、暂停、进度、变速、字幕/文本、收藏使用可识别图标并有文字辅助；
- 麦克风权限先解释用途，再请求权限；拒绝后仍能浏览示例与自评；
- Phase 1 不显示 AI 评分、相似度、自动改写或虚构诊断。

### 5.5 Result & Feedback

用于练习、Checkpoint、CET、课程单元和游戏结算。

- 第一层回答“完成了什么”；
- 第二层回答“哪里需要继续”；
- 第三层提供“现在继续/明日复测/返回计划”三个清晰方向；
- 成就、XP、奖励不能遮挡学习反馈，也不能让付费影响学习数值。

### 5.6 Settings / Commerce / Admin

- Settings 使用分组列表，危险操作单独分组并二次确认；
- Commerce 明示套餐、权益、订单和退款状态，不把未完成支付当作成功；
- Admin 使用 Table / Filter / Detail / Editor / Diff / Audit 六件套；
- Admin 的状态颜色仅作辅助，文字状态与审计信息必须可读。

## 6. 关键闭环

### 6.1 首次定位

`欢迎 → 登录 → 18+ → 目标 → 时长 → 测评 → 参考结果 → Study Plan → 第一课`

完成标准：用户知道目标、每天投入、第一步学习内容；任何一步中断都能恢复，不重复提交。

### 6.2 每日学习与断点续学

`首页 → 今日主任务 → Session → 完成反馈 → 下次复习 → 回到首页`

首页首屏必须有一个可继续任务；若任务已过期，提供“今天完成 / 重新排期 / 查看计划”而不是红色警告。

### 6.3 词汇 SRS

`主动回忆 → 翻面 → 播放/查看释义 → 选择信心度 → 下一词 → D+1/D+7 复测`

用户看到的是“忘了/模糊/想起/熟练”等可理解状态；底层算法状态不得直接替代用户语言。

### 6.4 Mistake Repair

`Practice Hub → 推荐原因 → 规则回顾 → 变式题 → 延迟复测 → 完成反馈`

不重复刷原题作为主要修复策略；错误反馈必须能回到规则、词汇或课程内容。

### 6.5 听说读写

`课程内容 → 播放/阅读/录音/写作 → 查词或收藏表达 → 加入复习队列 → 复盘`

录音只保存用户明确选择保留的内容，提供清除入口；写作只使用规则比对、关键词、参考答案与用户自评。

### 6.6 Checkpoint / CET

`说明 → 计时答题 → 标记题目 → 自动保存 → 退出恢复 → 交卷确认 → 结果 → 薄弱点修复`

交卷是高风险动作，必须显示未答题、标记题数量和最终确认；网络错误不能让已保存答案消失。

### 6.7 成长与奖励

`完成学习 → XP/Streak → 成就 → 免费奖励箱 → 衣柜/图鉴`

奖励箱只能由学习行为免费获得；概率透明、不可充值抽取、不可交易、不可提现，装扮不影响学习数值。

### 6.8 商业与隐私

`我的 → 权益对比 → 套餐 → 支付 → 订单 → 权益生效/退款`

`我的 → 设置 → 隐私与数据 → 导出/清除/注销`

Household 共享会员权益，不共享学习数据；支付失败、退款中、权益未生效和恢复购买都必须有独立状态。

## 7. 状态矩阵

### 7.1 全局状态

| 状态 | 视觉 | 主动作 |
|---|---|---|
| Loading | Skeleton 保留结构，不阻塞整页 | 等待；局部按钮显示进行中 |
| Empty | 说明 + 原因 + 一个主 CTA | 去学习、去筛选、去添加或返回 |
| Error | 说明发生什么、是否保留输入 | 重试、离线查看、返回 |
| Offline | 顶部非侵入状态条 | 查看已下载、等待网络、稍后同步 |
| Permission denied | 解释用途和替代方案 | 去授权、继续无录音模式 |
| Sync conflict | 显示本地与云端时间 | 保留本地、使用云端、查看差异 |
| Content unavailable | 解释内容未发布/已下线 | 返回课程、查看相近内容 |
| Dangerous action | 独立确认内容、影响范围 | 取消、确认 |

### 7.2 Session 状态

`未开始 → 进行中 → 暂停/切后台 → 恢复 → 提交中 → 已完成`

异常分支：

- 崩溃：`恢复上次 Session / 放弃本地进度`；
- 同步失败：`本地已保存 / 等待上传`；
- 重复提交：返回幂等结果，不新建重复记录；
- 内容更新：保存当前题状态，提示重新载入未开始部分；
- 过期：解释过期原因，允许重新排入计划。

### 7.3 媒体与录音状态

`未播放 → 加载中 → 播放中 ↔ 暂停 → 播放完成`

异常：缓冲、音频不可用、未下载、麦克风未授权、录音中、录音处理中、已保存、已丢弃、录音失败。所有状态均有文字标签或可访问名称，不能只用颜色或动画表达。

### 7.4 商业状态

`可购买 → 已选择 → 支付处理中 → 支付成功 → 权益生效`

异常：支付取消、支付失败、待补单、退款中、已退款、权益即将到期、Household 邀请待接受/已加入/已退出。

## 8. 跨端布局与设备规则

| 维度 | Mobile | Pad | Web |
|---|---|---|---|
| 设备容器 | iPhone 16 Pro Max 纵向基准，安全区 + Dynamic Island + Home Indicator | 横屏侧栏；竖屏底部 Tab；摄像头点不使用 Dynamic Island 形态 | 浏览器工作区，不渲染移动状态栏或 Dynamic Island |
| 导航 | 底部五 Tab；Session 内隐藏非必要入口 | 宽屏左侧 Rail；窄屏回到底部 Tab | 左侧 Rail + 顶部状态 + 右侧摘要 |
| 内容宽度 | 单列，信息流优先 | 540–760px 主内容，详情可双栏 | 960–1280px 工作区，内容/摘要分栏 |
| Sheet | Bottom Sheet | 侧边 Sheet 或 Dialog | 右侧 Context Panel 或 Dialog |
| 触控 | 最小 44×44pt，手势不作为唯一方式 | 触控与键盘均可 | 鼠标、键盘、快捷键均可 |
| 回退 | 顶部返回 + 系统手势可回退 | 顶部返回/侧栏 | 面包屑、返回、路由回退 |
| 动效 | 低配可降级，支持减少动效 | 地图/3D 按算力降级 | 不影响表格和键盘操作 |

### 8.1 iPhone 16 Pro Max 设备稿验收

- 业务内容不越过屏幕四角和圆角安全区；
- Dynamic Island 与业务标题保持安全距离；
- 状态栏时间、信号、Wi‑Fi、电池作为设备壳显示；
- 底部导航与 Home Indicator 不重叠；
- 手机壳内部不出现第二个滚动条；只有业务内容区可滚动；
- 深色模式下黑色设备壳、极光屏幕和文字对比度一致；
- 大字体和减少动效不会遮挡按钮或导致关键操作消失。

## 9. 组件契约与实现交接

建议实现为以下基础组件族：

`AppShell`、`DeviceFrame`、`PrimaryNav`、`PageHeader`、`TaskCard`、`ProgressCard`、`PracticeSession`、`AnswerOption`、`FeedbackPanel`、`AudioPlayer`、`Recorder`、`ContentSheet`、`ResultSummary`、`EmptyState`、`ErrorState`、`OfflineBanner`、`SyncConflictDialog`、`DangerConfirm`、`AdminTable`、`AuditTimeline`。

每个页面在实现前需要补齐以下最小契约字段：

| 字段 | 说明 |
|---|---|
| route | 页面语义路由与参数 |
| entry | 从哪个一级入口/Deep Link 进入 |
| API contract | 使用的 OpenAPI operationId，不在客户端手写裸 `any` |
| state | loading/empty/error/offline/permission/sync 等状态 |
| permission | 麦克风、通知、相册、支付或账号权限 |
| analytics | 页面曝光、主 CTA、完成、退出、异常恢复事件 |
| persistence | 本地草稿、Session 恢复、同步游标或幂等键 |
| fallback | 低配、弱网、资源缺失和功能关闭时的降级 |

### 9.1 建议埋点命名

采用 `surface_action_result` 结构，不记录音频原文或敏感学习内容：

- `onboarding_assessment_started/completed/resumed`
- `learn_task_opened/continued/completed/rescheduled`
- `practice_session_started/submitted/completed/resumed`
- `practice_feedback_opened/repair_started`
- `media_played/paused/failed`
- `recording_started/saved/discarded/permission_denied`
- `commerce_checkout_started/succeeded/failed/refund_requested`
- `privacy_export_requested/account_deletion_confirmed`
- `sync_conflict_detected/resolved`

## 10. 原型交付地图

| 交付物 | 作用 | 当前状态 |
|---|---|---|
| `mockups/complete-ui-ux-command-center.html` | 唯一 Aurora UI Suite 主稿：Onboarding、五 Tab、Skills、Admin、三端设备、明暗主题、页面地图与验收面板 | v0.3，已完成浏览器交互回归 |
| `uiux-specs/22_移动端核心学习闭环与页面状态.md` | 移动端从 onboarding 到复盘的流程与异常状态 | 已完成 |
| `uiux-specs/23_跨端设计系统与基础设施页面规范.md` | 跨端 Token、基础设施与状态规范 | 已完成并完成文档复核 |

主稿负责路线、角色、页面族和三端设备之间的导航与展示；设计规格负责路由、契约、状态、验收和边界。HTML 主稿与规格文档共同构成当前本地 UI/UX 事实源。

`aurora-light-lab.html`、`practice-hub.html`、`complete-*-lab.html` 以及早期 Mobile/Web/iPad 分散稿继续保留为历史参考，便于核对设计演进；它们不再独立维护，也不覆盖 Aurora UI Suite 主稿。

## 11. P0 / P1 交付顺序

### P0-1：信任与首日闭环

1. 登录、协议、18+、目标、时长、测评、结果、Study Plan；
2. 首页、今日任务、断点续学、计划与地图节点；
3. SRS Session、Practice Hub、Mistake Repair、统一反馈；
4. 听力、阅读、跟读、写作的基础可用 Session；
5. Checkpoint/CET 的自动保存、恢复、交卷、成绩和修复入口。

### P0-2：平台信任链路

1. 我的、报告、消息、设置、设备、权限、隐私和数据导出；
2. VIP/Household/订单/支付失败/退款；
3. 帮助、客服、内容纠错、下载、离线、同步冲突；
4. Admin 内容编辑、双审、版本 Diff、发布回滚、工单与审计。

### P1：成长与扩展

1. 完整 Avatar Studio、衣柜、收藏图鉴和基础游戏扩展；
2. Study Room 实时房间、番茄钟、白噪音和预设互动；
3. Language Clips、完整音标实验室、3D 口腔发音与高级内容；
4. 多游戏矩阵、赛季、复杂活动、完整实验配置。

P1 入口在 Phase 1 未开启时直接隐藏，不显示灰色按钮或“即将开放”的空壳。

## 12. 主管验收清单

### 体验

- [ ] 五 Tab 职责不重叠：学习管路径，练习管 Session，世界管成长，课程管内容，我的管记录与服务；
- [ ] 首页 3 秒内知道今天的主任务；
- [ ] 所有 Session 支持退出、恢复、提交中、完成和失败恢复；
- [ ] 错误反馈包含原因、解释、下一步，不只显示红色；
- [ ] 所有危险/支付/权限/注销动作有明确确认或回退；
- [ ] Study Room 无私聊、自由评论和未审 UGC；
- [ ] 奖励箱免费获得、概率透明、装扮不影响学习数值；
- [ ] Phase 1 不出现 AI Tutor、AI 评分、K12 或未成年人入口。

### 跨端

- [ ] Mobile、Pad、Web 都能完成主闭环；
- [ ] iPad 横竖屏导航按规则切换；
- [ ] iPhone 设备壳无嵌套滚动、越界圆角或刘海遮挡；
- [ ] Web 无移动 Dynamic Island/状态栏；
- [ ] 浅色/深色 Token 和对比度一致；
- [ ] 键盘、读屏、大字号、减少动效有替代路径；
- [ ] 低配设备可降级，关闭 3D/粒子后主流程仍可用。

### 工程交接

- [ ] 页面 route、API operationId、状态、权限、Deep Link、埋点已登记；
- [ ] 学习答案、录音与个人数据不写入仓库或日志；
- [ ] 本地草稿、Session 恢复、同步冲突和幂等键有明确所有者；
- [ ] 前端使用共享组件和生成类型，不引入裸 `any`；
- [ ] 每个 P0 页面族至少有一个成功路径和一个异常恢复路径的可点击原型。

## 13. 结论

这套方案把“很多功能”收敛为“少量页面族 + 明确状态 + 可恢复闭环”。下一阶段不再以增加孤立首页为目标，而是按 P0-1、P0-2、P1 顺序，把总控原型中的每个入口替换成真实业务 Session、反馈、服务和异常页面。只有页面地图、状态、契约和验收清单同时满足，Phase 1 UI/UX 才进入可开发冻结状态。
