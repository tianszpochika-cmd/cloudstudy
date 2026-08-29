# Phase 1 学习闭环功能设计

本文件覆盖学习者最核心的八个能力域，目标是让每个学习动作都能完成“目标 → 练习 → 反馈 → 复习 → 闭环复盘”。

> **v2 架构绑定**：本阶段通过 `api-gateway` 访问目标领域服务；每个域的契约、数据、权限和事件以本文件的“契约与事实源”及 [v2 微服务技术架构](../../02-architecture/v2-microservices-architecture.md) 为准。现有 `services/core-api` 只承担迁移兼容，不是本版目标事实源。

## 1. 本阶段的共同交互约束

- 先判断阶段、年龄/主体、内容版本、权限和可用性，再渲染核心 CTA。
- 所有学习动作都必须回到“目标 → 练习 → 反馈 → 复习 → 复盘”；社交、游戏和商业模块只能作为辅助出口。
- 所有写操作具备自动保存、幂等、失败恢复和可回放证据；不让客户端直接修改跨域事实。
- 所有登录后 API 请求使用平台 IAM 签发的 JWT Bearer（Access Token）；Refresh Token 轮换、重放检测、撤销和设备下线由 IAM 会话边界统一处理。
- 登录/注册页面可以品牌化，但不得在前端或业务服务签发 JWT；401、403、过期、撤销和刷新失败必须分别呈现可理解的恢复动作。
- 移动端、iPad、learner-web 的业务状态相同，页面组件按平台分别实现；admin-web 和 official-site 不复用学习者导航。

## 2. 域级设计

### ONB · 新手入学、自适应测评与语言世界地图

**本版单元**：32；Phase 1 22 / Phase 2 4 / Phase 3 6  
**设计入口**：[03-Phase1-学习闭环功能设计.md](03-Phase1-学习闭环功能设计.md)  
**路由宿主**：onboarding/*；learn/home；learn/map；courses  
**终端**：apps/mobile（H5/App/iPad）+ apps/learner-web（PC/PWA）

**交互意图**：让用户在最少决策成本下完成目标选择、定级、首周计划和断点恢复。

**主流程**：进入 → 选择目标/测评 → 保存草稿 → 生成计划 → 进入今日任务 → 断点恢复

**动作与反馈**：选择/测评 → 确认 → 生成或恢复学习计划。成功后 回到今日任务、复习或下一步学习；写操作失败保留已保存内容，错误按 retryable 决定是否重试。

**状态设计**：ST-B/ST-C；测评会话 CREATED/IN_PROGRESS/INTERRUPTED/COMPLETED；未解锁、无推荐和弱网必须可解释。八态细则见 [统一交互与页面状态设计](01-统一交互与页面状态设计.md)。

**契约与事实源**：Gateway → learner-service + learning-service；usr_learning_profile、learning_plan、learning_session、content_version。公开内容可浏览；学习画像和计划仅本人可读写；阶段、内容版本和年龄 Gate 由服务端校验

**事件**：onboarding.goal_selected.v1、onboarding.assessment_completed.v1、learning.plan_resumed.v1。所有事件沿 requestId、traceId、eventId/clientEventId 关联到领域事实。

**验收**：首次进入可完成；中断可恢复；重复提交不重复建计划；地图锁定态、空推荐、加载、错误、离线和权限态均可回退到可学习路径。

**逐条登记**：在 [980plus 功能点设计登记册](08-980plus-功能点设计登记册.md) 中按域筛选 ONB；每一条需保留来源、状态、设计锚点和 review 结论。

### VOC · 词汇、词根词缀、短语与 SRS 记忆引擎

**本版单元**：70；Phase 1 48 / Phase 2 12 / Phase 3 10  
**设计入口**：[03-Phase1-学习闭环功能设计.md](03-Phase1-学习闭环功能设计.md)  
**路由宿主**：courses；practice/srs；practice/quick；practice/mastery；vocab/*  
**终端**：apps/mobile（H5/App/iPad）+ apps/learner-web（PC/PWA）

**交互意图**：把内容浏览、主动回忆、信心度反馈、SRS 排程和 D+1/D+7 验证串成可回放的记忆闭环。内容范围遵循合法来源与可追溯授权边界。

**主流程**：进入词书/生词本 → 查看词条 → 主动回忆/作答 → 选择信心度 → 即时反馈 → 写入 SRS → 到期复习

**动作与反馈**：浏览/筛选 → 作答或评定 → 提交 → 反馈 → 加入下一轮复习。成功后 回到今日任务、复习或下一步学习；写操作失败保留已保存内容，错误按 retryable 决定是否重试。

**状态设计**：ST-D/ST-E/ST-F；NEW/LEARNING/MASTERED/CONSOLIDATED；队列为空、内容版本失效、媒体失败、重复复习和离线恢复。八态细则见 [统一交互与页面状态设计](01-统一交互与页面状态设计.md)。

**契约与事实源**：Gateway → content-service + learning-service；vocab_*、chunk、expression、lrn_srs_state、review_event、content_version。内容来源仅限自有、开放许可或合法授权；第三方品牌、教材、词书、释义、例句、音频、题目和统计数据须绑定有效授权凭证及使用范围，缺失或过期不得发布。 已发布内容可读；个人生词、掌握度和复习记录仅本人可读写；内容编辑权限不进入学习端。

**事件**：vocab.item_viewed.v1、srs.review_submitted.v1、srs.schedule_rebuilt.v1、mastery.updated.v1。所有事件沿 requestId、traceId、eventId/clientEventId 关联到领域事实。

**验收**：同一 Idempotency-Key 不重复记账；复习状态只由 VOC/SRS 事实源更新；断网先入有序队列，重连后按 clientSeq 合并。

**逐条登记**：在 [980plus 功能点设计登记册](08-980plus-功能点设计登记册.md) 中按域筛选 VOC；每一条需保留来源、状态、设计锚点和 review 结论。

### GRM · 语法知识树、长难句 X 光机与弱点图谱

**本版单元**：54；Phase 1 36 / Phase 2 10 / Phase 3 8  
**设计入口**：[03-Phase1-学习闭环功能设计.md](03-Phase1-学习闭环功能设计.md)  
**路由宿主**：courses/grammar；learn/session；grammar/*；reports/weakness  
**终端**：apps/mobile（H5/App/iPad）+ apps/learner-web（PC/PWA）

**交互意图**：让用户从语法点、句子结构、错误原因和针对性练习之间形成可解释的学习路径。

**主流程**：选择知识点/句子 → 展开规则或 X 光结构 → 练习 → 查看规则反馈 → 记录弱点 → 再练习

**动作与反馈**：展开/定位 → 练习 → 提交 → 查看错因 → 进入修复任务。成功后 回到今日任务、复习或下一步学习；写操作失败保留已保存内容，错误按 retryable 决定是否重试。

**状态设计**：ST-D/ST-E/ST-F；知识树部分加载、DAG 解析失败、练习版本过期、无弱点、服务降级均需可解释。八态细则见 [统一交互与页面状态设计](01-统一交互与页面状态设计.md)。

**契约与事实源**：Gateway → content-service + learning-service + assessment-service；grammar_point、sentence、syntax_dag、mastery_projection、attempt。学习者只读已发布规则和本人错因；教研编辑/审核在 admin-web 完成；X 光结构不改变原始题目事实。

**事件**：grammar.point_opened.v1、syntax.xray_viewed.v1、grammar.practice_submitted.v1、weakness.repaired.v1。所有事件沿 requestId、traceId、eventId/clientEventId 关联到领域事实。

**验收**：结构图加载失败时退化为线性句法；规则化反馈可离线展示；错因、掌握度和题目版本可回放。

**逐条登记**：在 [980plus 功能点设计登记册](08-980plus-功能点设计登记册.md) 中按域筛选 GRM；每一条需保留来源、状态、设计锚点和 review 结论。

### LST · 精听、听力雷达、听写与视听短剧 Clips

**本版单元**：42；Phase 1 28 / Phase 2 8 / Phase 3 6  
**设计入口**：[03-Phase1-学习闭环功能设计.md](03-Phase1-学习闭环功能设计.md)  
**路由宿主**：courses/listening；media；practice/listening；reports/listening  
**终端**：apps/mobile（H5/App/iPad）+ apps/learner-web（PC/PWA）

**交互意图**：在媒体播放稳定的基础上，将泛听、精听、听写、字幕对照和结果复盘分层设计。

**主流程**：选择媒体 → 缓冲/播放 → A-B/慢速/字幕 → 听写或精听 → 提交 → 差异反馈 → 复听/复习

**动作与反馈**：播放/定位 → 输入或选择 → 提交 → 比对反馈 → 复听或加入任务。成功后 回到今日任务、复习或下一步学习；写操作失败保留已保存内容，错误按 retryable 决定是否重试。

**状态设计**：ST-D/ST-E/ST-G；BUFFERING/PLAYING/PAUSED/ENDED；媒体失败、字幕缺失、下载失败和耳机/系统权限需降级。八态细则见 [统一交互与页面状态设计](01-统一交互与页面状态设计.md)。

**契约与事实源**：Gateway → content-service + media-service + learning-service + assessment-service；媒体/版权归 content+media，播放进度归 learning，听写 attempt/判分归 assessment，均绑定 content_version。媒体权利、下载权限和设备音频权限由服务端与端侧共同校验；原始录音不进入普通日志。

**事件**：media.started.v1、media.segment_completed.v1、listening.dictation_submitted.v1、media.downloaded.v1。所有事件沿 requestId、traceId、eventId/clientEventId 关联到领域事实。

**验收**：弱网可暂停并恢复；字幕/音频不可用时提供文本或练习替代；播放进度和听写结果不得重复提交。

**逐条登记**：在 [980plus 功能点设计登记册](08-980plus-功能点设计登记册.md) 中按域筛选 LST；每一条需保留来源、状态、设计锚点和 review 结论。

### RDG · 分级阅读、沉浸阅读器与故事模式

**本版单元**：38；Phase 1 24 / Phase 2 6 / Phase 3 8  
**设计入口**：[03-Phase1-学习闭环功能设计.md](03-Phase1-学习闭环功能设计.md)  
**路由宿主**：courses/reading；reader/*；practice/reading；reports/reading  
**终端**：apps/mobile（H5/App/iPad）+ apps/learner-web（PC/PWA）

**交互意图**：让阅读内容、查词、收藏、分支、阅读进度和理解测验在一个连续阅读空间完成。

**主流程**：筛选分级内容 → 打开阅读器 → 阅读/查词/收藏 → 分支或段落测验 → 保存进度 → 完成复盘

**动作与反馈**：筛选/打开 → 阅读和辅助操作 → 保存 → 测验 → 查看理解反馈。成功后 回到今日任务、复习或下一步学习；写操作失败保留已保存内容，错误按 retryable 决定是否重试。

**状态设计**：ST-D/ST-E/ST-F；内容下线、分支非法、进度冲突、查词失败、无推荐和离线阅读必须可恢复。八态细则见 [统一交互与页面状态设计](01-统一交互与页面状态设计.md)。

**契约与事实源**：Gateway → content-service + learning-service + assessment-service；内容/分支归 content，阅读进度/批注归 learning，阅读测验 attempt/判分归 assessment，均绑定 content_version。已发布且有权利的内容可读；个人批注/收藏仅本人可见；编辑端不复用学习端阅读权限。

**事件**：reading.opened.v1、reading.progress_saved.v1、reading.lookup_used.v1、reading.quiz_submitted.v1。所有事件沿 requestId、traceId、eventId/clientEventId 关联到领域事实。

**验收**：滚动和分页均不丢失进度；版本变化提示用户选择迁移或重新开始；错误态保留已保存的最后进度。

**逐条登记**：在 [980plus 功能点设计登记册](08-980plus-功能点设计登记册.md) 中按域筛选 RDG；每一条需保留来源、状态、设计锚点和 review 结论。

### SPK · 48 国际音标、跟读、Shadowing 影子跟读

**本版单元**：52；Phase 1 30 / Phase 2 14 / Phase 3 8  
**设计入口**：[03-Phase1-学习闭环功能设计.md](03-Phase1-学习闭环功能设计.md)  
**路由宿主**：courses/speaking；phonetics；recording；practice/shadowing  
**终端**：apps/mobile（H5/App/iPad）+ apps/learner-web（PC/PWA）

**交互意图**：提供规则化口语自练、录音回放和音标学习，不把 Phase 1 的规则反馈包装成 AI 评分。

**主流程**：查看示范 → 申请麦克风 → 录音 → 本地回放/重录 → 保存或上传 → 脚本化反馈 → 再练习

**动作与反馈**：录音 → 回放/重录 → 保存 → 复练。成功后 回到今日任务、复习或下一步学习；写操作失败保留已保存内容，错误按 retryable 决定是否重试。

**状态设计**：ST-E/ST-G；MIC_PERMISSION_DENIED/RECORDING/UPLOADING/LOCAL_ONLY/FAILED；无麦克风时提供静音跟读替代。八态细则见 [统一交互与页面状态设计](01-统一交互与页面状态设计.md)。

**契约与事实源**：Gateway → content-service + media-service + assessment-service；recording_asset、phoneme_lesson、shadowing_session、content_version。设备麦克风权限在用户主动点击后申请；录音归属本人；Phase 1 不调用 ASR、AI 评分或数字人。

**事件**：speaking.permission_requested.v1、recording.started.v1、recording.saved.v1、shadowing.completed.v1。所有事件沿 requestId、traceId、eventId/clientEventId 关联到领域事实。

**验收**：拒绝麦克风仍可学习；录音上传失败可保留本地副本并允许重试；任何结果都能关联内容版本和会话。

**逐条登记**：在 [980plus 功能点设计登记册](08-980plus-功能点设计登记册.md) 中按域筛选 SPK；每一条需保留来源、状态、设计锚点和 review 结论。

### WRT · 汉译英、模板仿写、病句改错与素材库

**本版单元**：44；Phase 1 26 / Phase 2 12 / Phase 3 6  
**设计入口**：[03-Phase1-学习闭环功能设计.md](03-Phase1-学习闭环功能设计.md)  
**路由宿主**：courses/writing；practice/writing；reports/writing；writing/*  
**终端**：apps/mobile（H5/App/iPad）+ apps/learner-web（PC/PWA）

**交互意图**：以规则、模板、对照和可回放草稿为核心，支持写作提交、修订和复盘。

**主流程**：选择题型/素材 → 编辑草稿 → 本地自动保存 → 提交 → 规则/对照反馈 → 修订 → 留存版本

**动作与反馈**：输入/选择模板 → 保存草稿 → 提交 → 查看反馈 → 修订或重做。成功后 回到今日任务、复习或下一步学习；写操作失败保留已保存内容，错误按 retryable 决定是否重试。

**状态设计**：ST-D/ST-E/ST-F；DRAFT/SUBMITTING/FEEDBACK_READY/RETRY_REQUIRED；草稿冲突、内容下线和保存失败可恢复。八态细则见 [统一交互与页面状态设计](01-统一交互与页面状态设计.md)。

**契约与事实源**：Gateway → content-service + assessment-service + learning-service；writing_prompt、writing_attempt、writing_feedback_rule、draft_revision、content_version。草稿和练习记录仅本人可读；公开素材按 contentVersionId 和权利状态控制；Phase 1 不提供生成式改写。

**事件**：writing.draft_saved.v1、writing.submitted.v1、writing.feedback_viewed.v1、writing.revised.v1。所有事件沿 requestId、traceId、eventId/clientEventId 关联到领域事实。

**验收**：输入过程中不因网络抖动丢稿；提交按幂等键去重；反馈必须标出规则依据和原文位置。

**逐条登记**：在 [980plus 功能点设计登记册](08-980plus-功能点设计登记册.md) 中按域筛选 WRT；每一条需保留来源、状态、设计锚点和 review 结论。

### ASM · 做题中心、四六级/考研模考与掌握度闭环

**本版单元**：80；Phase 1 52 / Phase 2 16 / Phase 3 12  
**设计入口**：[03-Phase1-学习闭环功能设计.md](03-Phase1-学习闭环功能设计.md)  
**路由宿主**：practice/home；practice/session；checkpoint；exam/*；reports/*  
**终端**：apps/mobile（H5/App/iPad）+ apps/learner-web（PC/PWA）

**交互意图**：统一承载题队、练习会话、自动保存、提交、错题验证、D+1/D+7 和报告复盘。

**主流程**：选练习/模考 → 创建会话 → 作答/自动保存 → 暂停/恢复 → 提交 → 结果和错因 → 延迟验证 → 报告

**动作与反馈**：开题 → 作答 → 自动保存 → 提交 → 查看结果 → 进入修复/复习。成功后 回到报告或修复任务；写操作失败保留已保存内容，错误按 retryable 决定是否重试。

**状态设计**：ST-E/ST-F；CREATED/IN_PROGRESS/INTERRUPTED/SUBMITTING/COMPLETED/AUTO_SUBMITTED/CANCELLED/EXPIRED。八态细则见 [统一交互与页面状态设计](01-统一交互与页面状态设计.md)。

**契约与事实源**：Gateway → content-service + assessment-service + learning-service；题目/答案规则版本归 content，attempt/checkpoint/判分/report 快照归 assessment，mastery_projection/复习调度归 learning。练习和结果仅本人可写读；模考/报告受内容版本和权益控制；管理端只读脱敏结果或经过授权的审计数据。

**事件**：assessment.started.v1、attempt.saved.v1、assessment.submitted.v1、mastery.verification_due.v1、report.generated.v1。所有事件沿 requestId、traceId、eventId/clientEventId 关联到领域事实。

**验收**：断点恢复不丢作答；超时自动提交可追溯；重复提交不重算奖励/掌握度；报告能回到题目和错因。

**逐条登记**：在 [980plus 功能点设计登记册](08-980plus-功能点设计登记册.md) 中按域筛选 ASM；每一条需保留来源、状态、设计锚点和 review 结论。


## 3. 评审顺序

1. 先评审域级流程和边界；
2. 再按登记册逐条确认来源、独立验收和是否需要 SUBFEAT；
3. 再生成 OpenAPI、迁移、事件和页面任务；
4. 最后用真实设备/浏览器检查加载、空、错误、离线、权限、恢复和性能降级。
