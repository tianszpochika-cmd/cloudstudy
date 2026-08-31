# Phase 1 成长、社群、商业与后台功能设计

本文件覆盖游戏化、受控社群、用户基础、通知同步、商业化和管理后台。它们服务于学习闭环，并不拥有其他域的学习事实。

> **v2 架构绑定**：本阶段通过 `api-gateway` 访问目标领域服务；每个域的契约、数据、权限和事件以本文件的“契约与事实源”及 [v2 微服务技术架构](../../02-architecture/v2-microservices-architecture.md) 为准。现有 `services/core-api` 只承担迁移兼容，不是本版目标事实源。

## 1. 本阶段的共同交互约束

- 先判断阶段、年龄/主体、内容版本、权限和可用性，再渲染核心 CTA。
- 所有学习动作都必须回到“目标 → 练习 → 反馈 → 复习 → 复盘”；社交、游戏和商业模块只能作为辅助出口。
- 所有写操作具备自动保存、幂等、失败恢复和可回放证据；不让客户端直接修改跨域事实。
- 所有登录后 API 请求使用平台 IAM 签发的 JWT Bearer（Access Token）；Refresh Token 轮换、重放检测、撤销和设备下线由 IAM 会话边界统一处理。
- 登录/注册页面可以品牌化，但不得在前端或业务服务签发 JWT；401、403、过期、撤销和刷新失败必须分别呈现可理解的恢复动作。
- 移动端、iPad、learner-web 的业务状态相同，页面组件按平台分别实现；admin-web 和 official-site 不复用学习者导航。

## 2. 域级设计

### GAM · 游戏化数值、学习游戏、3D 衣柜与奖励箱

**本版单元**：92；Phase 1 68 / Phase 2 14 / Phase 3 10  
**设计入口**：[04-Phase1-成长社群商业后台功能设计.md](04-Phase1-成长社群商业后台功能设计.md)  
**路由宿主**：world；games/*；avatar；reward；collection；streak  
**终端**：apps/mobile（H5/App/iPad）+ apps/learner-web（PC/PWA）

**交互意图**：P0 仅上线 1 款学习游戏：拼句小火车 (Sentence Train)；P1 扩展至总计 4 款；6~8 款是长期目标，不属于 P0 或 P1 交付承诺。 把学习结果转成可审计的 XP、星币、连续学习、成长资产和非现金奖励，不破坏学习闭环。

**主流程**：进入世界/游戏 → 选择玩法 → 完成学习相关动作 → 结算 → 查看流水 → 领取/装备 → 回到学习任务

**动作与反馈**：进入 → 选择 → 开始 → 结算 → 领取/回放。成功后 回到今日任务、复习或下一步学习；写操作失败保留已保存内容，错误按 retryable 决定是否重试。

**状态设计**：ST-H；结算中、资产缺失、奖励待确认、离线不发奖、性能降级和幂等补偿。八态细则见 [统一交互与页面状态设计](01-统一交互与页面状态设计.md)。

**契约与事实源**：Gateway → gamification-service；xp_ledger、coin_ledger、streak、avatar、reward_chest、game_session。P0 仅上线 1 款学习游戏：拼句小火车 (Sentence Train)；P1 扩展至总计 4 款；6~8 款是长期目标，不属于 P0 或 P1 交付承诺。学习结果驱动奖励；客户端不能直接记账。账本只追加，纠错只能以补偿分录表达；随机奖励只能免费、非现金、不可提现/交易，且由服务端版本化目录、概率公示、抽取审计与阶段 Gate 控制。可信完成仅按五元组（producerService、eventName、schemaVersion、qualifiedPredicate、rewardRuleVersion）及 lineage/dedupe 判定：`assessment.item.assessed.v2` 仅 `CORRECT_VERIFIED + objectiveCorrect=true + guessSignal=false`，`learning.mastery.projected.v2` 仅通过 D7 的真实掌握跃迁，未来 `learning.task.completed.v2` 仅在其专用契约完成后接入；`learning.review.scheduled.v2`、`learning.task.completed.v1` 和旧 B4/B12/v1 均不是奖励来源。以上是 P1R-M1-014 的 D2 静态契约，不构成 runtime 验证。

**事件（P1R-M1-014 canonical）**：`gamification.xp.ledger_posted.v2`、`gamification.reward.granted.v2`。游戏 session 仍由本域 REST 状态机管理；`gamification.session_started.v1`、`xp.ledger_posted.v1`、`reward.granted.v1`、`avatar.equipped.v1` 仅保留为旧 B4/B12 的历史/迁移名称，不是当前 canonical Kafka 事件，也不是 runtime 已验证声明。canonical 事件沿 requestId、traceId、eventId、dedupeKey 关联到领域事实。

**验收**：重复事件不重复发奖；断网不产生伪奖励；低配设备可退到 2.5D/静态切片；无现金随机抽奖和学习无关变现；免费随机奖励的目录/概率/抽取/审计引用可回放，账本不覆盖历史分录。

**逐条登记**：在 [980plus 功能点设计登记册](08-980plus-功能点设计登记册.md) 中按域筛选 GAM；每一条需保留来源、状态、设计锚点和 review 结论。

### SOC · 虚拟自习室、排行榜与受控低 UGC 社区

**本版单元**：38；Phase 1 24 / Phase 2 8 / Phase 3 6  
**设计入口**：[04-Phase1-成长社群商业后台功能设计.md](04-Phase1-成长社群商业后台功能设计.md)  
**路由宿主**：world/study-room；leaderboard；feed；social/*  
**终端**：apps/mobile（H5/App/iPad）+ apps/learner-web（PC/PWA）

**交互意图**：提供低审核成本的陪伴和成就反馈，控制互动边界，不引入陌生人私聊和开放发帖。空间语义固定为：`PUBLIC_THEME_ROOM`（公开主题房，20～30 人，P0、enabled=true）、`INVITE_STUDY_ROOM`（邀请学习室，2～8 人，P1、enabled=false）和 `CHECKIN_GOAL_GROUP`（共同目标/打卡组，3～10 人，P1、enabled=false）。邀请学习室可有座位/租约；打卡组不具有座位、租约或实时在场语义。

**主流程**：浏览房间/榜单 → 加入或占座 → 专注/预设互动 → 结束 → 结算学习时长 → 查看榜单

**动作与反馈**：浏览 → 加入/占座 → 专注/互动 → 退出 → 查看结果。成功后 回到今日任务、复习或下一步学习；写操作失败保留已保存内容，错误按 retryable 决定是否重试。

**状态设计**：ST-I/ST-H；座位租约、WS 断连、匿名、空房、成员受限、榜单延迟和离线补偿。八态细则见 [统一交互与页面状态设计](01-统一交互与页面状态设计.md)。

**契约与事实源**：Gateway → social-service；study_room、seat_lease、leaderboard_snapshot、preset_interaction、presence_event。`PUBLIC_THEME_ROOM` 与 `INVITE_STUDY_ROOM` 的座位租约固定为 90 秒 TTL、30 秒续租、60 秒断线恢复宽限、5 分钟无学习活动释放，并仅支持 25/45 分钟专注；`CHECKIN_GOAL_GROUP` 明确禁止租约。专注分钟只按 `P1_FOCUS_CREDIT_V1` 结算：服务端时间已到 `endsAt`、租约仍有效且 `focusVersion` 匹配时，只有 `COMPLETED` 可记入 25/45 分钟；`FOCUSING/PAUSED/ABORTED/AUTO_RELEASED` 均记 0，客户端 FINISH、心跳、自报时长或离线成功都不是证明，也不能直接触发奖励。榜单只消费三类已结算事实：social-service 本地 `M1014FocusSession` 的 `FOCUS_MINUTES`、`learning.mastery.projected.v2` 的 `MASTERED_WORDS` 和 `gamification.xp.ledger_posted.v2` 的 `XP`；快照必须带 metric/period/timezoneId/projectionVersion/ruleVersion/tieBreakVersion/snapshotAt/watermark/auditRef，并按昵称/匿名/退出脱敏。举报只提交 targetType、targetRef、reasonCode，reporter 与 case/audit 均由服务端派生。互动使用预设动作或审核词库，拒绝自由文本、私聊、图片、音频和链接；房间和榜单按隐私设置脱敏；客服和风控仅按授权范围处理。以上是 P1R-M1-014 的 D2 静态契约，不构成 runtime 验证。

**事件（P1R-M1-014 canonical）**：`study_room.seat_joined.v2`、`study_room.focus_started.v2`、`study_room.seat_left.v2`、`leaderboard.snapshot_published.v2`、`social.report.created.v2`。`study_room.joined.v1`、`study_room.focus_started.v1`、`study_room.left.v1`、`leaderboard.refreshed.v1` 与其他旧 B4/B12/v1 名称仅限历史/迁移，不得被描述为 canonical 或已验证 runtime 绑定。canonical 事件沿 requestId、traceId、eventId、dedupeKey 关联到领域事实。

**验收**：租约过期可恢复或重新入座；WS 断连不丢学习时长；空房和受限互动提供可学习替代入口。

**逐条登记**：在 [980plus 功能点设计登记册](08-980plus-功能点设计登记册.md) 中按域筛选 SOC；每一条需保留来源、状态、设计锚点和 review 结论。

### USR · 用户画像、多端认证、设备管理与个人中心

**本版单元**：64；Phase 1 46 / Phase 2 6 / Phase 3 12  
**设计入口**：[04-Phase1-成长社群商业后台功能设计.md](04-Phase1-成长社群商业后台功能设计.md)  
**路由宿主**：auth/*；onboarding；me；settings；privacy；devices  
**终端**：apps/mobile（H5/App/iPad）+ apps/learner-web（PC/PWA）+ apps/official-site（登录入口）

**交互意图**：保障身份、设备、偏好、个人中心、隐私和注销流程一致，并让多端恢复可解释。

**主流程**：登录/注册 → 验证 → 建立会话 → 管理设备/偏好 → 读取个人中心 → 修改/注销 → 审计和恢复

**动作与反馈**：输入/验证 → 确认 → 更新 → 二次确认或进入冷静期。成功后 回到今日任务、复习或下一步学习；写操作失败保留已保存内容，错误按 retryable 决定是否重试。

**状态设计**：ST-A/ST-J；SESSION_CREATED/REFRESHING/REVOKED；设备冲突、风险验证、注销冷静期、隐私拒绝和恢复。八态细则见 [统一交互与页面状态设计](01-统一交互与页面状态设计.md)。

**契约与事实源**：Gateway → iam-service + learner-service；user、device、preference、user_learning_profile、account_deletion、privacy_request。默认拒绝；身份、设备、隐私和注销以服务端主体为准；客户端不得提交 userId、tenantId、ownerId 覆盖认证上下文。

**事件**：auth.signed_in.v1、device.registered.v1、preference.updated.v1、account.deletion_requested.v1。所有事件沿 requestId、traceId、eventId/clientEventId 关联到领域事实。

**验收**：token 刷新最多一次静默重试；敏感操作二次确认；注销可撤回且最终匿名化有任务和审计证据。

**逐条登记**：在 [980plus 功能点设计登记册](08-980plus-功能点设计登记册.md) 中按域筛选 USR；每一条需保留来源、状态、设计锚点和 review 结论。

### INF · 统一通知、离线同步、弱网异常与全局基础

**本版单元**：74；Phase 1 56 / Phase 2 10 / Phase 3 8  
**设计入口**：[04-Phase1-成长社群商业后台功能设计.md](04-Phase1-成长社群商业后台功能设计.md)  
**路由宿主**：messages；sync；download；support；status；settings/notifications  
**终端**：apps/mobile + apps/learner-web 承载消息、同步、下载和客服；apps/admin-web 承载运营通知；apps/official-site 仅承载公开状态、下载和合规入口，不承载登录后同步或消息

**交互意图**：把通知、下载、离线包、同步冲突、客服和全局异常变成每个功能都能复用的基础体验。

**主流程**：触发任务/通知 → 排队/下载/同步 → 展示进度 → 成功或冲突 → 恢复/重试 → 写入审计和埋点

**动作与反馈**：查看 → 操作 → 排队 → 同步/恢复。成功后 回到今日任务、复习或下一步学习；写操作失败保留已保存内容，错误按 retryable 决定是否重试。

**状态设计**：ST-J/ST-K；QUEUED/RUNNING/SUCCEEDED/CONFLICT/FAILED/CANCELLED；网络、空间、版本和权限错误分别呈现。八态细则见 [统一交互与页面状态设计](01-统一交互与页面状态设计.md)。

**契约与事实源**：Gateway → notification-service + media-service + workflow-service；message、offline_package、sync_event、support_ticket、device_capability。通知、文件、相册和客服数据按设备权限、用户同意、租户和角色隔离；敏感原文不得进普通日志。

**事件**：notification.delivered.v1、sync.enqueued.v1、sync.conflict_detected.v1、support.ticket_created.v1。所有事件沿 requestId、traceId、eventId/clientEventId 关联到领域事实。

**验收**：网络超时不直接判定业务失败；同步按 clientEventId/clientSeq 去重；冲突可解释且不静默覆盖本地学习事实。

**逐条登记**：在 [980plus 功能点设计登记册](08-980plus-功能点设计登记册.md) 中按域筛选 INF；每一条需保留来源、状态、设计锚点和 review 结论。

### COM · 商业化会员与统一收银台（家庭组仅保留后续目标）

**本版单元**：46；Phase 1 32 / Phase 2 8 / Phase 3 6  
**设计入口**：[04-Phase1-成长社群商业后台功能设计.md](04-Phase1-成长社群商业后台功能设计.md)  
**路由宿主**：commerce/*；me/membership；orders；official-site/pricing  
**终端**：apps/mobile + apps/learner-web + apps/official-site；收银和回调由 commerce-service 统一拥有

**当前冻结边界**：`P1R-M1-015` 只冻结 D2 静态契约，唯一 active provider 为 `SANDBOX_HMAC`；`productionPaymentEnabled=false`、`autoRenewalEnabled=false`，真实凭据、真实 provider route/traffic 均禁止。微信、支付宝、Apple IAP 是后续生产接入目标，家庭组、优惠券和账号/会员合并也不进入当前 canonical 写路径；它们不得被本文的功能库存描述解释为已经实现或可运行。

**交互意图**：把 SKU、不可变价格快照、订单、支付尝试、回调收据、权益流水/快照、退款、对账和审计引用放入可追溯的商业链路，避免前端、Gateway 或支付成功页自行授予权益。生产支付只有在资质、平台审核、sandbox、验签、退款、对账、回滚、审计、隐私与安全/PEP Gate 全部形成运行证据后才可另行开启。

**主流程**：浏览方案 → 选择 SKU → 创建订单 → 支付/回调 → 权益激活 → 使用 → 到期/退款/降级

**动作与反馈**：查看 → 选择 → 下单 → 回调确认 → 查看权益/退款。成功后 回到今日任务、复习或下一步学习；写操作失败保留已保存内容，错误按 retryable 决定是否重试。

**状态设计**：ST-L/ST-J；PENDING/ACTIVE/GRACE/EXPIRED/REVOKED；支付等待、重复回调、退款和权益延迟可追溯。八态细则见 [统一交互与页面状态设计](01-统一交互与页面状态设计.md)。

**契约与事实源**：Gateway → commerce-service；`sku`、`price_snapshot`、`order`、`payment_attempt`、`callback_receipt`、`entitlement_ledger`、`entitlement_snapshot`、`refund`、`reconciliation` 与 `audit_ref`。家庭组不属于当前事实集合。订单与权益按服务端主体隔离；财务、客服、审计为独立 scope，客户端提交的 tenant/owner/provider/result/entitlement 等权限或结果事实一律不可信。

**事件**：当前 canonical 仅为 `commerce.order.created.v2`、`commerce.payment.requested.v2`、`commerce.payment.callback_received.v2`、`commerce.payment.verified.v2`、`commerce.entitlement.activated.v2`、`commerce.entitlement.revoked.v2`、`commerce.refund.settled.v2`、`commerce.reconciliation.discrepancy_recorded.v2`、`commerce.reconciliation.recovery_receipted.v2`。B5/B13 的 v1 commerce 事件只作 historical input，不双发、不晋升 canonical。所有事件沿 requestId、traceId、eventId/clientEventId 关联到领域事实。

**验收**：`SANDBOX_HMAC` 回调必须验证 workload 身份、单 active HMAC key、规范化签名元组以及订单/支付尝试/金额/币种绑定，并按 tenant + provider + providerEventId 去重；同事件不同摘要必须拒绝。前端不展示或授予未确认权益；退款和到期降级为不可变流水并可回放。以上均为静态验收口径，不代表 sandbox runtime、真实渠道、密钥轮换或回放已经验证。

**逐条登记**：在 [980plus 功能点设计登记册](08-980plus-功能点设计登记册.md) 中按域筛选 COM；每一条需保留来源、状态、设计锚点和 review 结论。

### ADM · 教研 CMS、双审流、运营中台与风控合规

**本版单元**：74；Phase 1 48 / Phase 2 12 / Phase 3 14  
**设计入口**：[04-Phase1-成长社群商业后台功能设计.md](04-Phase1-成长社群商业后台功能设计.md)  
**路由宿主**：admin/dashboard；content/*；review/*；ops/*；risk/*；audit/*  
**终端**：apps/admin-web（Vue 3 + Element Plus）；学习端只消费已发布内容

**交互意图**：让内容、版本、媒体、审核、运营、风控、客服、财务和审计拥有明确的职责边界。

**主流程**：检索 → 编辑草稿 → 校验 → 提交一审 → 二审 → 发布/定时发布 → 监控 → 回滚/归档

**动作与反馈**：检索 → 编辑 → 提交 → 双审 → 发布/回滚。成功后 回到今日任务、复习或下一步学习；写操作失败保留已保存内容，错误按 retryable 决定是否重试。

**状态设计**：ST-M/ST-N；DRAFT/IN_REVIEW/APPROVED/PUBLISHED/ARCHIVED；REJECTED、ROLLBACK_PENDING 作为动作结果表达。八态细则见 [统一交互与页面状态设计](01-统一交互与页面状态设计.md)。

**契约与事实源**：Gateway → admin-ops-service + content-service + commerce-service + analytics-service；content_version、review_task、audit_log、feature_flag、risk_case、export_job、media_asset。内容来源仅限自有、开放许可或合法授权；第三方品牌、教材、词书、释义、例句、音频、题目和统计数据须绑定有效授权凭证及使用范围，缺失或过期不得发布。 默认拒绝；content-editor、review L1、review L2、finance、auditor、客服等为独立 scope；作者不能审自己的版本。

**事件**：content.version.submitted.v1、content.version.reviewed.v1、content.version.published.v1、content.version.unpublished.v1、content.version.rolled_back.v1、audit.exported.v1。内容后台事件只使用服务端生成的 eventId，并沿 requestId、traceId、commandId、auditId 关联到领域事实；clientEventId 不能成为发布、审核或回滚权威输入。

**验收**：双审职责分离；发布/下线/导出/风控/退款均审计；异步任务可查询；租户隔离和脱敏导出可证明。

**逐条登记**：在 [980plus 功能点设计登记册](08-980plus-功能点设计登记册.md) 中按域筛选 ADM；每一条需保留来源、状态、设计锚点和 review 结论。


## 3. 评审顺序

1. 先评审域级流程和边界；
2. 再按登记册逐条确认来源、独立验收和是否需要 SUBFEAT；
3. 再生成 OpenAPI、迁移、事件和页面任务；
4. 最后用真实设备/浏览器检查加载、空、错误、离线、权限、恢复和性能降级。
