# 08｜商业化收单、教研 CMS 与运营中台详细设计

> **Historical / Superseded（历史 v1 设计包）**：仅用于 v1 迁移与审计追溯，不是当前实现指令。当前业务设计、任务、契约与验收以 [v2-980plus/README.md](../v2-980plus/README.md) 为唯一入口；本文的旧数量、时间、架构、认证、事件、支付、版权和项目结构表述不得覆盖现行基线。

> 文档版本：v2.0 深度施工版  
> 基线：requirements/product-requirements.md v3.3、requirements/feature-matrix.md、AGENTS.md  
> 功能范围：FEAT-COM-001～009、FEAT-ADM-001～010，共 19 项  
> 目标服务边界：`commerce-service`（订单/支付/权益）+ `content-service`（内容/版本/版权）+ `admin-ops-service`（后台聚合/审批）+ `analytics-service`（只读指标）；外部请求经 `api-gateway`，权限由 `iam-service`/服务侧 PEP 校验。  
> 迁移兼容：Core API（Java 17 / Spring Boot 3）+ Admin Web（Vue 3 + Element Plus）；仅作为 v1 兼容承载。  
> 数据边界：各目标服务独立 MySQL schema/迁移和 Redis namespace；S3 兼容对象存储；事件采用 Kafka 兼容总线 + Outbox + AsyncAPI。

## 0. 设计结论、范围和不可越界边界

### 0.1 本域交付结论

本域把支付、权益、教研内容、审核、风控、运营指标和配置开关做成可回放、可对账、可审计的规则化后台。所有金额以分为单位保存，所有第三方回调先落原始不可变快照，再在事务内推进订单和权益；所有内容发布先生成不可变 content_version，再让学习域按版本读取。

本文件不是支付厂商 SDK 的替代品。微信支付 V3、支付宝 RSA2、Apple StoreKit 2/JWS 的私钥只存在密钥管理系统，禁止进入代码、日志、数据库和文档样例。文档中的 channelTradeNo、transactionId、userId 均为脱敏示例或字段名。

### 0.2 Phase 1 边界

- 面向 18 岁以上成人和大学生，Free / Pro / Household 权益按明确 SKU 授权。
- 教研内容使用规则校验、敏感词字典、人工双审和发布快照；不调用生成式 AI 自动生成课程、答案、评分或审核结论。
- Apple IAP 只在 iOS App 调起；Web/H5/Android 使用已批准的微信或支付宝渠道。
- 运营指标只展示聚合数据，不向管理员暴露无必要的原始学习音频、原始手机号或支付密文。
- 未成年人/K12、广告竞价、现金抽奖、可提现虚拟货币、实时 AI 客服和 AI 发音评分不属于本域。

### 0.3 依赖和单一事实源

| 能力 | 权威模块 | 本域职责 |
|---|---|---|
| 用户身份 | user/account | 读取 user_id、tenant_id、账号状态 |
| 内容版本 | content/common | 创建审核版本、发布版本、回滚版本 |
| 学习权益 | commerce | 计算 entitlement 并提供只读鉴权 |
| 学习进度 | learning domains | 消费内容版本和权限事件 |
| 订单金额 | commerce | 订单、支付尝试、回调、退款和对账 |
| 风控封禁 | operations | 风险决策、管理员审计和解封 |
| 消息投递 | common event bus | 事件幂等、重试和死信 |

## 1. 统一术语、ID、状态和不变量

### 1.1 Canonical ID 与字段命名

数据库使用 snake_case，REST JSON 使用 camelCase。跨域实体使用下表，不得用平行别名替代：

| 语义 | canonical SQL 字段 | API 字段 | 说明 |
|---|---|---|---|
| 用户 | user_id | userId | 从 access token 取得，不信任 body 覆盖 |
| 商品 | sku_id | skuId | 稳定商品逻辑 ID |
| 订单 | order_id / order_no | orderId / orderNo | order_no 对用户展示 |
| 支付尝试 | payment_attempt_id | paymentAttemptId | 一次渠道调起或回调尝试 |
| 交易 | channel_trade_no | channelTradeNo | 只保存脱敏/必要索引 |
| Apple 原始交易 | original_transaction_id | originalTransactionId | 订阅链路的稳定根 |
| 权益 | entitlement_id | entitlementId | 鉴权唯一事实 |
| 内容 | content_id | contentId | 教研逻辑内容 |
| 版本 | content_version_id | contentVersionId | 学习端读取的不可变版本 |
| 审核任务 | review_task_id | reviewTaskId | 双审状态流 |
| 对账批次 | reconciliation_batch_id | reconciliationBatchId | 财务日/月批次 |
| 风控事件 | risk_event_id | riskEventId | 可回放规则判定 |
| 请求 | request_id | requestId | 全链路追踪 |

### 1.2 订单、支付、订阅和权益状态机

订单状态：

~~~text
CREATED -> PAYING -> PAID -> ENTITLEMENT_PENDING -> COMPLETED
   |          |        |              |
   |          |        |              +-> ENTITLEMENT_FAILED -> MANUAL_REVIEW
   |          +--------+-> CLOSED
   +-> CANCELLED
PAID/COMPLETED -> REFUND_PENDING -> REFUNDED
~~~

支付尝试状态为 CREATED、REQUESTED、CALLBACK_RECEIVED、VERIFIED、REJECTED、TIMEOUT、RECONCILED。回调重复、乱序和延迟不改变已经验证的较高状态；退款只能由已支付交易进入。

订阅状态为 TRIAL、ACTIVE、GRACE、PAUSED、EXPIRED、REVOKED；权益状态为 PENDING、ACTIVE、SUSPENDED、EXPIRED、REVOKED。Apple 的续期、宽限、退款和撤销均以服务端验证的 signedTransactionInfo 与 signedRenewalInfo 为准，客户端只负责展示。

教研内容状态：

~~~text
DRAFT -> IN_REVIEW -> APPROVED -> PUBLISHED -> ARCHIVED
           |              |
           +-> REJECTED <-+
PUBLISHED -> ROLLBACK_PENDING -> ARCHIVED
~~~

### 1.3 不变量

1. order_no、payment_attempt_id、channel_trade_no（在渠道允许时）、transaction_id 具有适当范围内唯一性。
2. 同一订单的实付金额 = 订单项金额 - 折扣 + 税费，单位为分；金额不可使用浮点数。
3. 同一原始 Apple 交易不可同时产生两个 ACTIVE entitlement；同一微信/支付宝回调不能重复记账。
4. 权益发放与订单状态推进在同一事务内写入 outbox；事件重复消费不能重复开通、续期或扣减。
5. 只有两个不同角色完成初审和终审，内容才可进入 APPROVED；发布只能读取 APPROVED 版本。
6. 敏感命中、审核动作、支付回调、退款、封禁和管理员读取敏感数据都必须留下审计记录。
7. Feature Flag 默认关闭；灰度用户必须稳定分桶，实验不得改变订单金额、审核权限或安全策略。
8. 所有管理员写接口必须有 requestId、Idempotency-Key 或 actionId；查询接口必须按权限过滤和分页。

## 2. 19 项功能覆盖矩阵

| 编号 | 子域 | 功能 | 核心产物 |
|---|---|---|---|
| FEAT-COM-001 | 会员 | Free 权益边界 | 权益规则和用量门槛 |
| FEAT-COM-002 | 会员 | Pro VIP 权益矩阵 | SKU 到 entitlement 映射 |
| FEAT-COM-003 | 商品 | 月/季/年/终身 SKU | 商品、价格、币种、版本 |
| FEAT-COM-004 | 收单 | 微信支付 V3 | Native/H5/JSAPI 回调验签 |
| FEAT-COM-005 | 收单 | 支付宝 RSA2 | 同步返回和异步通知验签 |
| FEAT-COM-006 | 收单 | Apple IAP StoreKit 2 | JWS 验证、续订、退款 |
| FEAT-COM-007 | 收单 | 防丢单被动补单 | 启动扫描和服务端重放 |
| FEAT-COM-008 | 权益 | Household 家庭组 | 主账号和最多 3 名成员 |
| FEAT-COM-009 | 订单 | 订单、账单、发票和续费 | 订单查询、退款、发票入口 |
| FEAT-ADM-001 | CMS | 词汇短语编辑器 | 词条、音标、音频和 3D 参数 |
| FEAT-ADM-002 | CMS | 语法树/长句编排器 | DAG、切片、节点校验 |
| FEAT-ADM-003 | CMS | 题库批量导入 | Excel/JSON 解析、查重、错误行 |
| FEAT-ADM-004 | CMS | 试卷组卷向导 | 题型、难度、考种分布 |
| FEAT-ADM-005 | 审核 | 内容双审上线 | Draft 到 Published 状态机 |
| FEAT-ADM-006 | 安全 | 敏感内容前置拦截 | 规则命中、人工复核、留痕 |
| FEAT-ADM-007 | 风控 | 用户档案与封禁 | 风险评分、临时/永久封禁 |
| FEAT-ADM-008 | 工单 | 内容纠错工作台 | 报错、定位、修复、通知 |
| FEAT-ADM-009 | 运营 | 运营与财务大盘 | DAU、留存、GMV、对账 |
| FEAT-ADM-010 | 配置 | Feature Flag/A-B | 稳定分桶、灰度、回滚 |

## 3. 19 项子功能逐项施工规格

每项固定包含目标、前置、主流程、异常、验收和埋点。实现时以 featureCode 作为权限、测试和运营台账的关联键。

### 3.1 FEAT-COM-001｜Free 权益边界

- 目标：提供无需支付即可完成基础学习闭环的明确入口。
- 前置：用户账号 ACTIVE，权益服务已加载当前 entitlement_policy_version。
- 主流程：鉴权请求读取策略快照 → 统计当日已用量 → 返回可用额度和重置时间 → 超额时给出升级入口，不阻断已开始的非付费任务。
- 异常：统计缓存失效时回源 MySQL；策略版本冲突返回 POLICY_VERSION_CONFLICT；不得用客户端计数决定是否放行。
- 验收：免费每日背词 20 个、普通自习室和标准模考 1 套等限制可配置、可解释、按用户时区重置。
- 埋点：commerce.entitlement.free_checked.v1、commerce.entitlement.limit_reached.v1。

### 3.2 FEAT-COM-002｜Pro VIP 权益矩阵

- 目标：将 Pro 购买结果稳定映射为无限复习、完整题库、长难句和倍增奖励等权益。
- 前置：SKU 已审批发布，权益规则有 effective_from/effective_to。
- 主流程：支付完成 → 订单事件 → entitlement upsert → Redis 短缓存 → 客户端刷新。
- 异常：订单已支付但权益未开通进入 ENTITLEMENT_PENDING，由 outbox 重试；重复事件只返回原 entitlement。
- 验收：同一用户多订单不重复加长有效期；退款/撤销按规则收回未使用权益。
- 埋点：commerce.entitlement.activated.v1、commerce.entitlement.expired.v1。

### 3.3 FEAT-COM-003｜灵活订阅周期 SKU

- 目标：使月、季、年和终身等商品的价格、币种和渠道映射可配置、可审计。
- 前置：SKU 通过双审；价格变更生成新 price_version，不更新旧订单含义。
- 主流程：选择 SKU → 创建订单快照 → 选择渠道 → 调起支付 → 回调后按订单快照发放权益。
- 异常：已下单 SKU 下架不影响已创建订单；价格版本失效时阻止新单并提示刷新。
- 验收：订单详情可还原当时商品名称、价格、权益和税费。
- 埋点：commerce.sku.viewed.v1、commerce.order.created.v1。

### 3.4 FEAT-COM-004｜微信支付 V3

- 目标：支持 App Native、H5 和 JSAPI 小程序的统一收单。
- 前置：商户证书在 KMS；平台证书缓存并按序列号选择；金额和 notify_url 来自服务端配置。
- 主流程：创建订单 → 调用微信下单 → 返回调起参数 → 接收回调 → APIv3 解密 → 校验商户号、appid、订单号、金额、时间 → 写 callback snapshot → 结算订单。
- 异常：签名失败、金额不符、订单已关闭、回调重复、微信临时失败分别记录拒绝原因；回调接口返回成功只代表已安全落库。
- 验收：重复回调 100 次只生成一笔 PAID；伪造金额和错误证书均拒绝；超时可主动查询补偿。
- 埋点：commerce.wechat.requested.v1、commerce.payment.callback_rejected.v1、commerce.payment.verified.v1。

### 3.5 FEAT-COM-005｜支付宝 RSA2

- 目标：接入 App/H5 网页收银台并可靠处理异步通知。
- 前置：支付宝公钥和应用私钥由 KMS 管理；签名串按官方字段排序；回调地址白名单化。
- 主流程：创建 trade_no → 返回 order string → 接收同步页面结果但不直接发权益 → 异步 notify 验签 → 校验 app_id、seller_id、out_trade_no、total_amount、trade_status → 结算。
- 异常：同步返回与异步通知不一致时以验签后的异步结果为准；重复 notify 返回 success 但不重复记账。
- 验收：RSA2 失败、金额差异、卖家不匹配和旧通知均拒绝并审计。
- 埋点：commerce.alipay.requested.v1、commerce.alipay.notified.v1、commerce.alipay.verified.v1。

### 3.6 FEAT-COM-006｜Apple IAP StoreKit 2 与 JWS 验签

- 目标：在服务端完成 iOS 自动续订、恢复购买、退款和撤销的可信闭环。
- 前置：App Store Connect 的 bundleId、environment、productId 映射已经审核；Apple root certificate 和公钥缓存可用。
- 主流程：客户端上报 signedTransactionInfo 和 signedRenewalInfo → 服务端解析 JWS header/payload/signature → 验证 x5c 证书链和 alg → 校验 bundleId、appAccountToken、productId、environment → 校验 transactionId/originalTransactionId 唯一性 → 保存不可变交易快照 → 生成或更新 subscription/entitlement。
- 验证要求：必须检查 signedDate、purchaseDate、expiresDate、revocationDate、inAppOwnershipType、subscriptionGroupIdentifier、isUpgraded、offerType 等必要字段；生产环境不能接受 Sandbox 交易；不能相信客户端传入价格、过期时间或用户身份。
- 异常：证书过期、bundleId 不匹配、productId 未配置、交易重复、环境不符、appAccountToken 不符、退款撤销和宽限期分别落不同 errorCode；Apple 服务不可用时进入 VERIFY_PENDING，不直接开通永久权益。
- 验收：同一 originalTransactionId 的重复上报、启动补单、通知乱序、升级降级、宽限期、退款和撤销都可回放；交易快照和权益变化一一对应。
- 埋点：commerce.apple.jws.received.v1、commerce.apple.jws.verified.v1、commerce.apple.transaction.rejected.v1、commerce.subscription.changed.v1。

### 3.7 FEAT-COM-007｜防丢单被动补单

- 目标：解决用户支付成功后关闭 App、网络中断或回调延迟导致的订单未结算。
- 前置：客户端在启动、进入会员页和恢复购买时扫描未完成 StoreKit transaction 或未结算订单。
- 主流程：客户端提交补单凭证 → 服务端按凭证 hash 幂等 → 重新走对应渠道验证 → 绑定 user_id → 推进订单/订阅/权益 → 返回原结算结果。
- 异常：凭证已绑定其他账号进入 FRAUD_REVIEW；凭证暂时无法验证进入 VERIFY_PENDING；补单频率超限返回 429。
- 验收：重复补单不重复延长订阅；客户端不持有权益判定逻辑。
- 埋点：commerce.recovery.scan.v1、commerce.recovery.settled.v1、commerce.recovery.reviewed.v1。

### 3.8 FEAT-COM-008｜Household 多账户共享计划

- 目标：允许一个主账号把家庭权益共享给最多 3 个明确绑定的成员。
- 前置：SKU 标记为 HOUSEHOLD；主账号 ACTIVE 且 entitlement 未过期；成员完成邀请确认。
- 主流程：主账号创建邀请码 → 成员通过同一设备或登录态确认 → 写 member relationship → 重新计算成员 entitlement projection。
- 异常：超过 3 人、邀请过期、账号已绑定其他家庭、主账号退款/注销、成员被封禁均可拒绝；不显示主账号支付敏感信息。
- 验收：主账号可移除成员；移除只影响共享投影，不删除成员账号；成员退出后历史学习数据仍归本人。
- 埋点：commerce.household.invited.v1、commerce.household.joined.v1、commerce.household.member_removed.v1。

### 3.9 FEAT-COM-009｜订单、账单、发票和自动续费

- 目标：让用户可以查询订单状态、渠道、权益周期、退款入口和发票申请指引。
- 前置：只读查询按 user_id 隔离；发票信息单独加密，不写日志。
- 主流程：订单列表 cursor 分页 → 订单详情读取快照 → 对支持渠道展示取消续费/退款说明 → 发起发票申请或客服工单。
- 异常：渠道不支持自动取消时返回外链说明；已关闭订单不可退款；发票字段错误不影响订单。
- 验收：账单金额、订单状态、权益期限和渠道交易号可对账；手机号和地址脱敏。
- 埋点：commerce.order.viewed.v1、commerce.invoice.requested.v1。

### 3.10 FEAT-ADM-001｜词汇与短语可视化编辑器

- 目标：教研员维护词条、IPA、美英音频、例句、3D 口腔参数和内容版本。
- 前置：编辑权限和词库 schema 版本；音频先上传对象存储再绑定 hash。
- 主流程：创建草稿 → 字段校验 → 预览多端降级 → 提交审核。
- 异常：音频 hash 不符、IPA 非法、3D 参数缺少必填骨骼或重复词条拒绝保存。
- 验收：生成内容版本可被 02/04 通过 contentVersionId 引用，不在发布后原地修改。
- 埋点：admin.vocab.draft_saved.v1、admin.asset.bound.v1。

### 3.11 FEAT-ADM-002｜语法树与长难句编排器

- 目标：维护 grammar_point、sentence、token/slice/node/edge DAG 和颜色语义。
- 前置：节点 schema、edge 不成环、句子 token 范围完整。
- 主流程：拖拽编辑 → 运行 DAG/时间轴/颜色校验 → 预览 Vue Flow 与低配 SVG → 提交双审。
- 异常：环、孤立节点、未覆盖 token、无发布入口、不同 content_version 混用均拒绝。
- 验收：发布快照可被 03 消费，回滚不影响已产生的学习记录。
- 埋点：admin.grammar.dag_validated.v1、admin.content.previewed.v1。

### 3.12 FEAT-ADM-003｜题库管理与批量导入

- 目标：批量导入 Excel/JSON，统一映射 question_id、exercise_id、answer schema 和 content_version。
- 前置：模板版本、列名映射、题型 schema、答案保护字段。
- 主流程：上传 → 病毒/文件类型/大小检查 → 解析 → 行级校验 → 查重 → 预览错误清单 → 生成草稿版本。
- 异常：部分行错误不静默跳过；同题不同答案 hash 进入冲突；导入超时进入异步状态。
- 验收：导入报告可下载；同一内容 hash 不重复入库；答案在管理员无权限时不可见。
- 埋点：admin.import.started.v1、admin.import.row_rejected.v1、admin.import.completed.v1。

### 3.13 FEAT-ADM-004｜试卷智能组卷向导

- 目标：按考种、题型、难度和数量生成可解释的试卷草稿。
- 前置：题目均为 APPROVED/PUBLISHED，题型权重和难度分布已配置。
- 主流程：选择约束 → 服务端确定性 seed 采样 → 展示命中明细 → 人工调整 → 保存试卷版本 → 提交审核。
- 异常：库存不足、约束不可满足、题目版本下线或重复命中返回可解释错误，不降低约束悄悄组卷。
- 验收：相同 seed、池版本和约束可复现同一结果；正式试卷发布后题目顺序冻结。
- 埋点：admin.exam.blueprint_created.v1、admin.exam.item_adjusted.v1。

### 3.14 FEAT-ADM-005｜内容双审上线

- 目标：隔离录入、初审、终审和发布权限，保证内容版本可追责。
- 前置：作者和审核人不能为同一人；内容 schema 与安全检查已通过。
- 主流程：DRAFT 保存 → 作者提交 IN_REVIEW → 初审人通过 → 终审主管 APPROVED → 发布人发布 → 写 publish log 和 outbox。
- 异常：驳回回到 DRAFT 并带原因；审核人离职或超时可转派；已发布版本只能新建修订。
- 验收：不满足双人规则不能 APPROVED；每个动作有 actor、role、reason、before/after hash。
- 埋点：admin.review.submitted.v1、admin.review.approved.v1、admin.content.published.v1。

### 3.15 FEAT-ADM-006｜敏感词与涉政涉暴前置拦截

- 目标：在提交和发布前阻断不合规内容，保留命中证据但不扩散敏感原文。
- 前置：规则包版本、命中级别和人工复核权限已配置。
- 主流程：字段归一化 → 规则字典/正则/类别校验 → 记录 hash、命中位置区间和规则版本 → BLOCK 或进入二审 → 人工复核后继续。
- 异常：规则服务不可用时 fail-closed，普通可见内容仍可编辑但不能发布；规则误报只能由有权限审核人处理。
- 验收：命中内容不进入搜索、推荐、学习端缓存或运营大盘；审计记录可回放。
- 埋点：safety.precheck.blocked.v1、safety.review.overruled.v1。

### 3.16 FEAT-ADM-007｜用户全景档案与风控封禁

- 目标：聚合学习、支付、设备和作弊信号，支持临时、永久和自动解封。
- 前置：管理员最小权限、查询原因和脱敏策略。
- 主流程：输入 risk event → 规则计算 → 生成决策 → 写 user risk projection → 通知鉴权缓存 → 对高风险订单和权益加保护。
- 异常：误封可申诉；规则版本回滚不抹除历史决策；管理员不得直接修改余额或订单。
- 验收：封禁生效有 TTL；设备 token 撤销；审计记录包含理由、依据和操作者。
- 埋点：risk.decision.created.v1、risk.user.suspended.v1、risk.user.appealed.v1。

### 3.17 FEAT-ADM-008｜内容纠错工单工作台

- 目标：把前台报错定位到 content_id/content_version_id，形成修复、复审和通知闭环。
- 前置：用户提交脱敏截图、错误类型和客户端版本；工单自动限流。
- 主流程：创建工单 → 去重关联 → 分派教研 → 修改草稿 → 双审 → 发布修复 → 关闭并通知。
- 异常：版本已下线、重复工单、恶意刷单、附件违规时分别合并、拒绝或隔离。
- 验收：旧版本学习记录仍可解释；用户只收到结论和安全摘要，不收到内部审核信息。
- 埋点：support.correction.created.v1、support.correction.resolved.v1。

### 3.18 FEAT-ADM-009｜运营与财务核心大盘

- 目标：以聚合快照展示 DAU、MAU、留存、GMV、退款、转化和对账差异。
- 前置：指标定义、时区、计算窗口和数据延迟标识固定。
- 主流程：事件流/离线任务 → 物化快照 → 权限过滤 → 图表查询 → 显示 lastUpdatedAt 和 completeness。
- 异常：数据延迟或缺失不得显示为 0；对账差异超过阈值创建告警。
- 验收：同一口径可从订单/支付/权益流水回放；金额指标使用分并支持导出脱敏 CSV。
- 埋点：ops.dashboard.viewed.v1、ops.metric.lagged.v1、finance.reconciliation.alerted.v1。

### 3.19 FEAT-ADM-010｜Feature Flag 与 A/B 实验

- 目标：让学习体验可以小流量发布并快速回滚，同时不影响支付、审核和安全。
- 前置：flag 有 owner、默认值、开始/结束时间、目标平台、规则版本和审批人。
- 主流程：服务端按 user_id 稳定 hash 分桶 → 返回 flag snapshot → 客户端只消费非安全开关 → 记录曝光/转化 → 管理员可关闭。
- 异常：规则解析失败回默认关闭；flag 过期自动关闭；实验人群不能包含被保护的支付/风控路径。
- 验收：同一用户跨设备分桶稳定；关闭 flag 在缓存 TTL 内收敛；所有变更可审计。
- 埋点：ops.flag.exposed.v1、ops.flag.updated.v1、ops.experiment.assignment.v1。

## 4. 支付、订阅和权益详细流程

### 4.1 统一收银台时序

~~~text
Client -> Core: POST /commerce/orders
Core -> DB: order snapshot + order_item + idempotency
Core -> Channel: create payment
Core <- Channel: prepay token/order string
Core -> Client: payment parameters
Channel -> Core: signed callback/webhook
Core -> DB: immutable callback snapshot
Core -> Channel: decrypt/verify/query if needed
Core -> DB: payment_attempt VERIFIED, order PAID
Core -> DB: entitlement + outbox event in one transaction
Core -> Client/EventBus: COMPLETED and commerce.entitlement.activated.v1
~~~

支付回调只允许通过 channel adapter 进入，adapter 负责签名、商户号、应用号、金额、订单映射和时间窗校验；domain service 只接收已验证的 PaymentVerifiedCommand。对账任务不会直接修改订单，只能创建 discrepancy 和人工处理任务。

### 4.2 Apple JWS 验签伪代码

~~~text
verifyApple(command):
  parse compact JWS without trusting payload
  check alg in allowed set and x5c exists
  validate certificate chain to cached Apple root
  validate certificate validity and signedDate skew
  verify signature
  decode signedTransactionInfo and signedRenewalInfo
  require bundleId == configured bundleId
  require environment == configured environment
  require productId in published sku mapping
  require appAccountToken maps to command.userId
  if transactionId already exists: return original verified result
  if originalTransactionId belongs to another user: create fraud review
  persist immutable transaction and advance subscription monotonically
~~~

Apple Server Notifications V2 同样必须验签并落 notification snapshot。通知只推进能证明的字段；客户端补单和服务端通知竞态由 originalTransactionId 唯一锁解决。退款、撤销和过期事件不得删除历史订单。

### 4.3 退款、取消和权益回收

退款请求先写 REFUND_PENDING，按渠道调用退款 API 或引导到 Apple 管理页；收到已验证的 refund callback 后写 refund record、更新 entitlement，并发布 commerce.entitlement.revoked.v1。已消费学习内容不追溯删除，但后续 Pro 访问按策略降级。人工退款必须具备 reasonCode、operatorId、审批动作和金额上限。

### 4.4 Household 权益投影

主账号 entitlement 是唯一计费根；成员只拥有 projection。每次主账号购买、续期、退款、暂停、成员加入/移除都重算所有 projection，最多 3 名 ACTIVE 成员。成员不能修改主账号订单、发票或续费；成员账号注销只清理 relationship，不删除自身学习记录。

## 5. 教研内容、双审和安全详细流程

### 5.1 内容版本生命周期

1. 创建内容草稿并分配 content_id；所有资源通过 asset_id 绑定。
2. 运行 schema 校验、查重、引用完整性和资源 hash 校验。
3. 运行敏感规则 precheck；命中 BLOCK 时不允许提交，REVIEW 时生成安全复核任务。
4. 作者提交初审；初审和终审必须是不同 actor，且不能是作者。
5. 终审通过后生成 immutable content_version_id，发布动作原子写入 publish_log 和 outbox。
6. 下线/回滚只改变默认发布指针；旧版本仍可被历史 attempt 和报告引用。

### 5.2 词汇、语法、题库资产校验

| 资产 | 必校验 | 失败码 |
|---|---|---|
| 词条/短语 | canonical spelling、IPA、词性、释义、音频 hash | VOCAB_SCHEMA_INVALID |
| 音频 | MIME、时长、sha256、码率、权限和 retention | MEDIA_ASSET_INVALID |
| 3D 参数 | pose schema、数值范围、fallback 2D 资源 | MOUTH_POSE_INVALID |
| 语法 DAG | node/edge、入口、可达、无环、token 覆盖 | GRAMMAR_DAG_INVALID |
| 题目 | questionType、answer schema、选项唯一、解析版本 | QUESTION_SCHEMA_INVALID |
| 试卷 | 题型/难度/数量约束、seed、版本引用 | EXAM_BLUEPRINT_INVALID |

### 5.3 内容安全留痕

安全服务使用可版本化规则包。保存 rule_version、content_hash、field_code、hit_category、hit_count、decision 和 reviewer_id；不保存敏感原文片段，展示时使用脱敏 token 或 hash。审核结论必须可回放但不可由普通运营人员修改。

## 6. MySQL 8.x 数据定义

下列表由 commerce、cms、ops 子模块拥有；表名按域前缀隔离。所有金额为 BIGINT 分，所有时间为 UTC DATETIME，展示层按用户/运营时区转换。生产迁移应拆分为多个版本并由 Flyway/Liquibase 执行。

~~~sql
CREATE TABLE com_sku (
  sku_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  sku_code VARCHAR(64) NOT NULL,
  product_type VARCHAR(24) NOT NULL,
  entitlement_plan_code VARCHAR(64) NOT NULL,
  billing_period VARCHAR(24) NOT NULL,
  household_seats TINYINT UNSIGNED NOT NULL DEFAULT 0,
  status VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
  version_no INT UNSIGNED NOT NULL DEFAULT 1,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (sku_id),
  UNIQUE KEY uk_sku_code_version (sku_code, version_no),
  KEY idx_sku_status_type (status, product_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE com_sku_price (
  price_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  sku_id BIGINT UNSIGNED NOT NULL,
  currency CHAR(3) NOT NULL,
  amount_minor BIGINT UNSIGNED NOT NULL,
  channel_code VARCHAR(24) NOT NULL,
  external_product_id VARCHAR(160) NULL,
  effective_from DATETIME NOT NULL,
  effective_to DATETIME NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
  PRIMARY KEY (price_id),
  UNIQUE KEY uk_price_channel_product (sku_id, channel_code, external_product_id, effective_from),
  KEY idx_price_effective (sku_id, status, effective_from)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE com_order (
  order_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_no VARCHAR(64) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  currency CHAR(3) NOT NULL,
  original_amount_minor BIGINT UNSIGNED NOT NULL,
  discount_amount_minor BIGINT UNSIGNED NOT NULL DEFAULT 0,
  tax_amount_minor BIGINT UNSIGNED NOT NULL DEFAULT 0,
  payable_amount_minor BIGINT UNSIGNED NOT NULL,
  order_status VARCHAR(32) NOT NULL DEFAULT 'CREATED',
  source_platform VARCHAR(24) NOT NULL,
  idempotency_key VARCHAR(96) NOT NULL,
  request_id VARCHAR(80) NOT NULL,
  expires_at DATETIME NULL,
  paid_at DATETIME NULL,
  closed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (order_id),
  UNIQUE KEY uk_order_no (order_no),
  UNIQUE KEY uk_order_idem (user_id, idempotency_key),
  KEY idx_order_user_status (user_id, order_status, created_at),
  KEY idx_order_expire (order_status, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE com_order_item (
  order_item_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NOT NULL,
  sku_id BIGINT UNSIGNED NOT NULL,
  price_id BIGINT UNSIGNED NOT NULL,
  sku_snapshot JSON NOT NULL,
  quantity SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  amount_minor BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (order_item_id),
  UNIQUE KEY uk_order_sku (order_id, sku_id),
  KEY idx_order_item_sku (sku_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE com_payment_attempt (
  payment_attempt_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  channel_code VARCHAR(24) NOT NULL,
  attempt_no SMALLINT UNSIGNED NOT NULL,
  channel_trade_no VARCHAR(160) NULL,
  external_product_id VARCHAR(160) NULL,
  attempt_status VARCHAR(32) NOT NULL DEFAULT 'CREATED',
  requested_amount_minor BIGINT UNSIGNED NOT NULL,
  verified_amount_minor BIGINT UNSIGNED NULL,
  error_code VARCHAR(64) NULL,
  verified_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (payment_attempt_id),
  UNIQUE KEY uk_attempt_no (order_id, channel_code, attempt_no),
  UNIQUE KEY uk_channel_trade (channel_code, channel_trade_no),
  KEY idx_attempt_status (channel_code, attempt_status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE com_payment_callback (
  callback_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  channel_code VARCHAR(24) NOT NULL,
  callback_event_id VARCHAR(200) NOT NULL,
  channel_trade_no VARCHAR(160) NULL,
  signature_serial VARCHAR(160) NULL,
  encrypted_payload MEDIUMTEXT NOT NULL,
  payload_hash CHAR(64) NOT NULL,
  verify_status VARCHAR(24) NOT NULL DEFAULT 'RECEIVED',
  reject_code VARCHAR(64) NULL,
  received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  verified_at DATETIME NULL,
  PRIMARY KEY (callback_id),
  UNIQUE KEY uk_callback_event (channel_code, callback_event_id),
  KEY idx_callback_trade (channel_code, channel_trade_no, received_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE com_apple_transaction (
  apple_transaction_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  transaction_id VARCHAR(200) NOT NULL,
  original_transaction_id VARCHAR(200) NOT NULL,
  product_id VARCHAR(160) NOT NULL,
  bundle_id VARCHAR(200) NOT NULL,
  environment VARCHAR(16) NOT NULL,
  app_account_token CHAR(36) NULL,
  signed_transaction_hash CHAR(64) NOT NULL,
  purchase_at DATETIME NULL,
  expires_at DATETIME NULL,
  revocation_at DATETIME NULL,
  verification_status VARCHAR(24) NOT NULL DEFAULT 'VERIFIED',
  signed_payload MEDIUMTEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (apple_transaction_id),
  UNIQUE KEY uk_apple_transaction (transaction_id),
  KEY idx_apple_original (original_transaction_id, expires_at),
  KEY idx_apple_user (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE com_apple_notification (
  notification_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  notification_uuid VARCHAR(200) NOT NULL,
  notification_type VARCHAR(64) NOT NULL,
  subtype VARCHAR(64) NULL,
  environment VARCHAR(16) NOT NULL,
  signed_payload MEDIUMTEXT NOT NULL,
  payload_hash CHAR(64) NOT NULL,
  verify_status VARCHAR(24) NOT NULL DEFAULT 'RECEIVED',
  received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at DATETIME NULL,
  PRIMARY KEY (notification_id),
  UNIQUE KEY uk_apple_notification_uuid (notification_uuid),
  KEY idx_apple_notification_type (notification_type, received_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE com_subscription (
  subscription_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  sku_id BIGINT UNSIGNED NOT NULL,
  channel_code VARCHAR(24) NOT NULL,
  original_transaction_id VARCHAR(200) NULL,
  subscription_status VARCHAR(24) NOT NULL,
  period_start_at DATETIME NULL,
  period_end_at DATETIME NULL,
  grace_end_at DATETIME NULL,
  auto_renew_status TINYINT(1) NOT NULL DEFAULT 1,
  source_version INT UNSIGNED NOT NULL DEFAULT 1,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (subscription_id),
  UNIQUE KEY uk_subscription_original (channel_code, original_transaction_id),
  KEY idx_subscription_user_status (user_id, subscription_status, period_end_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE com_entitlement (
  entitlement_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  source_order_id BIGINT UNSIGNED NULL,
  source_subscription_id BIGINT UNSIGNED NULL,
  plan_code VARCHAR(64) NOT NULL,
  entitlement_status VARCHAR(24) NOT NULL DEFAULT 'PENDING',
  starts_at DATETIME NOT NULL,
  ends_at DATETIME NULL,
  policy_version INT UNSIGNED NOT NULL,
  revoke_reason VARCHAR(64) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (entitlement_id),
  KEY idx_entitlement_user_active (user_id, entitlement_status, starts_at, ends_at),
  KEY idx_entitlement_source (source_order_id, source_subscription_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE com_household (
  household_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  owner_user_id BIGINT UNSIGNED NOT NULL,
  entitlement_id BIGINT UNSIGNED NOT NULL,
  household_status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
  invite_code_hash CHAR(64) NULL,
  invite_expires_at DATETIME NULL,
  max_member_count TINYINT UNSIGNED NOT NULL DEFAULT 3,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (household_id),
  UNIQUE KEY uk_household_owner_entitlement (owner_user_id, entitlement_id),
  KEY idx_household_status (household_status, invite_expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE com_household_member (
  household_member_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  household_id BIGINT UNSIGNED NOT NULL,
  member_user_id BIGINT UNSIGNED NOT NULL,
  member_status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
  joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  removed_at DATETIME NULL,
  PRIMARY KEY (household_member_id),
  UNIQUE KEY uk_household_member (household_id, member_user_id),
  UNIQUE KEY uk_user_active_household (member_user_id, member_status),
  KEY idx_household_members (household_id, member_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE com_refund (
  refund_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NOT NULL,
  payment_attempt_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  refund_no VARCHAR(64) NOT NULL,
  amount_minor BIGINT UNSIGNED NOT NULL,
  reason_code VARCHAR(64) NOT NULL,
  refund_status VARCHAR(24) NOT NULL DEFAULT 'REQUESTED',
  channel_refund_no VARCHAR(160) NULL,
  operator_user_id BIGINT UNSIGNED NULL,
  requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME NULL,
  PRIMARY KEY (refund_id),
  UNIQUE KEY uk_refund_no (refund_no),
  UNIQUE KEY uk_channel_refund (channel_refund_no),
  KEY idx_refund_order (order_id, refund_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE com_invoice_request (
  invoice_request_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  order_id BIGINT UNSIGNED NOT NULL,
  invoice_type VARCHAR(24) NOT NULL,
  title VARCHAR(200) NOT NULL,
  tax_no_ciphertext VARBINARY(512) NULL,
  email_ciphertext VARBINARY(512) NULL,
  invoice_status VARCHAR(24) NOT NULL DEFAULT 'REQUESTED',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME NULL,
  PRIMARY KEY (invoice_request_id),
  UNIQUE KEY uk_invoice_order (order_id),
  KEY idx_invoice_user_status (user_id, invoice_status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE com_reconciliation_batch (
  reconciliation_batch_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  channel_code VARCHAR(24) NOT NULL,
  business_date DATE NOT NULL,
  source_file_hash CHAR(64) NOT NULL,
  expected_count INT UNSIGNED NOT NULL DEFAULT 0,
  matched_count INT UNSIGNED NOT NULL DEFAULT 0,
  discrepancy_count INT UNSIGNED NOT NULL DEFAULT 0,
  batch_status VARCHAR(24) NOT NULL DEFAULT 'RECEIVED',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME NULL,
  PRIMARY KEY (reconciliation_batch_id),
  UNIQUE KEY uk_reconcile_channel_day (channel_code, business_date),
  KEY idx_reconcile_status (batch_status, business_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE com_reconciliation_item (
  reconciliation_item_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  reconciliation_batch_id BIGINT UNSIGNED NOT NULL,
  channel_trade_no VARCHAR(160) NULL,
  order_no VARCHAR(64) NULL,
  channel_amount_minor BIGINT UNSIGNED NULL,
  platform_amount_minor BIGINT UNSIGNED NULL,
  result_code VARCHAR(32) NOT NULL,
  discrepancy_reason VARCHAR(160) NULL,
  resolved_by BIGINT UNSIGNED NULL,
  resolved_at DATETIME NULL,
  PRIMARY KEY (reconciliation_item_id),
  UNIQUE KEY uk_reconcile_item (reconciliation_batch_id, channel_trade_no),
  KEY idx_reconcile_result (reconciliation_batch_id, result_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE com_idempotency_record (
  idempotency_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  scope_code VARCHAR(80) NOT NULL,
  user_id BIGINT UNSIGNED NULL,
  idempotency_key VARCHAR(96) NOT NULL,
  request_hash CHAR(64) NOT NULL,
  response_status SMALLINT UNSIGNED NOT NULL,
  response_body JSON NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (idempotency_id),
  UNIQUE KEY uk_idem_scope_key (scope_code, user_id, idempotency_key),
  KEY idx_idem_expire (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE cms_content (
  content_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  content_code VARCHAR(80) NOT NULL,
  content_type VARCHAR(32) NOT NULL,
  owner_domain VARCHAR(24) NOT NULL,
  current_published_version_id BIGINT UNSIGNED NULL,
  content_status VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
  created_by BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (content_id),
  UNIQUE KEY uk_content_code (content_code),
  KEY idx_content_type_status (content_type, content_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE cms_content_version (
  content_version_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  content_id BIGINT UNSIGNED NOT NULL,
  version_no INT UNSIGNED NOT NULL,
  payload JSON NOT NULL,
  payload_hash CHAR(64) NOT NULL,
  schema_version VARCHAR(32) NOT NULL,
  content_status VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
  author_id BIGINT UNSIGNED NOT NULL,
  published_at DATETIME NULL,
  archived_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (content_version_id),
  UNIQUE KEY uk_content_version (content_id, version_no),
  UNIQUE KEY uk_content_payload_hash (content_id, payload_hash),
  KEY idx_content_version_status (content_id, content_status, version_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE cms_asset (
  asset_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  content_version_id BIGINT UNSIGNED NOT NULL,
  asset_type VARCHAR(32) NOT NULL,
  object_key_hash CHAR(64) NOT NULL,
  sha256 CHAR(64) NOT NULL,
  mime_type VARCHAR(96) NOT NULL,
  size_bytes BIGINT UNSIGNED NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'UPLOADED',
  retention_until DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (asset_id),
  UNIQUE KEY uk_cms_asset_sha (sha256),
  KEY idx_cms_asset_version (content_version_id, asset_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE cms_review_task (
  review_task_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  content_id BIGINT UNSIGNED NOT NULL,
  content_version_id BIGINT UNSIGNED NOT NULL,
  review_stage VARCHAR(24) NOT NULL,
  review_status VARCHAR(24) NOT NULL DEFAULT 'PENDING',
  assignee_id BIGINT UNSIGNED NULL,
  submitted_by BIGINT UNSIGNED NOT NULL,
  due_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME NULL,
  PRIMARY KEY (review_task_id),
  UNIQUE KEY uk_review_stage_version (content_version_id, review_stage),
  KEY idx_review_queue (review_status, review_stage, due_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE cms_review_action (
  review_action_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  review_task_id BIGINT UNSIGNED NOT NULL,
  actor_id BIGINT UNSIGNED NOT NULL,
  actor_role VARCHAR(32) NOT NULL,
  action_code VARCHAR(32) NOT NULL,
  reason_code VARCHAR(64) NULL,
  comment_hash CHAR(64) NULL,
  before_hash CHAR(64) NOT NULL,
  after_hash CHAR(64) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (review_action_id),
  KEY idx_review_action_task (review_task_id, created_at),
  KEY idx_review_action_actor (actor_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE cms_publish_log (
  publish_log_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  content_id BIGINT UNSIGNED NOT NULL,
  content_version_id BIGINT UNSIGNED NOT NULL,
  action_code VARCHAR(24) NOT NULL,
  actor_id BIGINT UNSIGNED NOT NULL,
  request_id VARCHAR(80) NOT NULL,
  reason_code VARCHAR(64) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (publish_log_id),
  KEY idx_publish_content_time (content_id, created_at),
  KEY idx_publish_version (content_version_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE cms_import_job (
  import_job_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  job_type VARCHAR(32) NOT NULL,
  template_version VARCHAR(32) NOT NULL,
  source_asset_id BIGINT UNSIGNED NOT NULL,
  requested_by BIGINT UNSIGNED NOT NULL,
  job_status VARCHAR(24) NOT NULL DEFAULT 'QUEUED',
  total_rows INT UNSIGNED NOT NULL DEFAULT 0,
  accepted_rows INT UNSIGNED NOT NULL DEFAULT 0,
  rejected_rows INT UNSIGNED NOT NULL DEFAULT 0,
  error_report_asset_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME NULL,
  PRIMARY KEY (import_job_id),
  KEY idx_import_job_status (job_status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE cms_import_row (
  import_row_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  import_job_id BIGINT UNSIGNED NOT NULL,
  row_no INT UNSIGNED NOT NULL,
  row_hash CHAR(64) NOT NULL,
  row_status VARCHAR(24) NOT NULL,
  error_code VARCHAR(64) NULL,
  error_details JSON NULL,
  draft_content_id BIGINT UNSIGNED NULL,
  PRIMARY KEY (import_row_id),
  UNIQUE KEY uk_import_row (import_job_id, row_no),
  KEY idx_import_row_status (import_job_id, row_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE cms_sensitive_rule (
  sensitive_rule_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  rule_version INT UNSIGNED NOT NULL,
  category_code VARCHAR(32) NOT NULL,
  pattern_hash CHAR(64) NOT NULL,
  severity VARCHAR(16) NOT NULL,
  action_code VARCHAR(24) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
  effective_from DATETIME NOT NULL,
  effective_to DATETIME NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (sensitive_rule_id),
  UNIQUE KEY uk_sensitive_rule_version_hash (rule_version, pattern_hash),
  KEY idx_sensitive_rule_active (status, effective_from, effective_to)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE cms_sensitive_hit (
  sensitive_hit_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  content_id BIGINT UNSIGNED NOT NULL,
  content_version_id BIGINT UNSIGNED NOT NULL,
  sensitive_rule_id BIGINT UNSIGNED NOT NULL,
  field_code VARCHAR(64) NOT NULL,
  content_hash CHAR(64) NOT NULL,
  decision_code VARCHAR(24) NOT NULL,
  reviewer_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (sensitive_hit_id),
  KEY idx_sensitive_hit_version (content_version_id, decision_code),
  KEY idx_sensitive_hit_rule (sensitive_rule_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE cms_correction_ticket (
  correction_ticket_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  reporter_user_id BIGINT UNSIGNED NOT NULL,
  content_id BIGINT UNSIGNED NULL,
  content_version_id BIGINT UNSIGNED NULL,
  ticket_type VARCHAR(32) NOT NULL,
  description_hash CHAR(64) NOT NULL,
  attachment_asset_id BIGINT UNSIGNED NULL,
  ticket_status VARCHAR(24) NOT NULL DEFAULT 'OPEN',
  assignee_id BIGINT UNSIGNED NULL,
  resolution_code VARCHAR(64) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at DATETIME NULL,
  PRIMARY KEY (correction_ticket_id),
  KEY idx_ticket_status (ticket_status, created_at),
  KEY idx_ticket_content (content_id, content_version_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE ops_user_risk (
  risk_projection_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  risk_level VARCHAR(16) NOT NULL DEFAULT 'NORMAL',
  account_action VARCHAR(24) NOT NULL DEFAULT 'ALLOW',
  score DECIMAL(8,3) NOT NULL DEFAULT 0,
  rule_version INT UNSIGNED NOT NULL,
  expires_at DATETIME NULL,
  last_event_at DATETIME NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (risk_projection_id),
  UNIQUE KEY uk_risk_user (user_id),
  KEY idx_risk_action_expire (account_action, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE ops_risk_event (
  risk_event_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  event_code VARCHAR(64) NOT NULL,
  signal_hash CHAR(64) NOT NULL,
  score_delta DECIMAL(8,3) NOT NULL,
  source_domain VARCHAR(32) NOT NULL,
  request_id VARCHAR(80) NOT NULL,
  occurred_at DATETIME NOT NULL,
  PRIMARY KEY (risk_event_id),
  UNIQUE KEY uk_risk_signal (user_id, event_code, signal_hash),
  KEY idx_risk_user_time (user_id, occurred_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE ops_metric_snapshot (
  metric_snapshot_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  metric_code VARCHAR(64) NOT NULL,
  window_start DATETIME NOT NULL,
  window_end DATETIME NOT NULL,
  timezone_code VARCHAR(40) NOT NULL,
  value_decimal DECIMAL(20,6) NULL,
  value_count BIGINT UNSIGNED NULL,
  completeness VARCHAR(24) NOT NULL DEFAULT 'COMPLETE',
  source_watermark DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (metric_snapshot_id),
  UNIQUE KEY uk_metric_window (metric_code, window_start, window_end, timezone_code),
  KEY idx_metric_query (metric_code, window_end)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE ops_feature_flag (
  flag_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  flag_key VARCHAR(96) NOT NULL,
  default_value JSON NOT NULL,
  targeting_rules JSON NOT NULL,
  owner_user_id BIGINT UNSIGNED NOT NULL,
  flag_status VARCHAR(24) NOT NULL DEFAULT 'OFF',
  rule_version INT UNSIGNED NOT NULL DEFAULT 1,
  starts_at DATETIME NULL,
  ends_at DATETIME NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (flag_id),
  UNIQUE KEY uk_flag_key (flag_key),
  KEY idx_flag_status_time (flag_status, starts_at, ends_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE ops_experiment_assignment (
  assignment_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  flag_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  bucket_no SMALLINT UNSIGNED NOT NULL,
  variant_code VARCHAR(64) NOT NULL,
  rule_version INT UNSIGNED NOT NULL,
  assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (assignment_id),
  UNIQUE KEY uk_assignment_flag_user (flag_id, user_id),
  KEY idx_assignment_variant (flag_id, variant_code, assigned_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE ops_audit_log (
  audit_log_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  actor_user_id BIGINT UNSIGNED NULL,
  actor_role VARCHAR(32) NULL,
  action_code VARCHAR(80) NOT NULL,
  resource_type VARCHAR(48) NOT NULL,
  resource_id VARCHAR(96) NOT NULL,
  request_id VARCHAR(80) NOT NULL,
  reason_code VARCHAR(64) NULL,
  before_hash CHAR(64) NULL,
  after_hash CHAR(64) NULL,
  ip_hash CHAR(64) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (audit_log_id),
  KEY idx_audit_resource (resource_type, resource_id, created_at),
  KEY idx_audit_actor (actor_user_id, created_at),
  KEY idx_audit_request (request_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
~~~

DDL 验收：commerce 表不得把支付私钥或完整卡号写入数据库；Apple signed payload 只作为加密/访问受限的验证快照；cms 内容发布后不可原地覆盖；ops 指标必须带完整度和水位；所有管理员动作可按 requestId 回放；清理任务按 retention_until 执行但不删除财务与审核审计主记录。

## 7. REST/OpenAPI 3.0.3 契约

### 7.1 公共规则

所有 API 使用 /api/v1 前缀。用户侧权限为 LEARNER_SELF，管理侧权限按 COMMERCE_READ、COMMERCE_WRITE、CONTENT_EDIT、CONTENT_REVIEW_L1、CONTENT_REVIEW_L2、RISK_OPERATOR、OPS_ANALYST、FINANCE_OPERATOR、FLAG_OWNER 拆分。所有 POST/PUT/PATCH/DELETE 使用 Idempotency-Key；分页使用 cursor；响应统一为 requestId、data、meta，错误统一为 errorCode、message、retryable、details。

### 7.2 API 清单

| 方法 | 路径 | 权限 | 幂等 | 用途 |
|---|---|---|:---:|---|
| GET | /api/v1/commerce/skus | LEARNER_SELF | - | 商品和当前价格 |
| GET | /api/v1/commerce/skus/{skuId} | LEARNER_SELF | - | SKU 权益和渠道 |
| POST | /api/v1/commerce/orders | LEARNER_SELF | 是 | 创建订单 |
| GET | /api/v1/commerce/orders | LEARNER_SELF | - | 我的订单 cursor |
| GET | /api/v1/commerce/orders/{orderId} | LEARNER_SELF | - | 订单详情 |
| POST | /api/v1/commerce/orders/{orderId}/payment-attempts | LEARNER_SELF | 是 | 创建渠道支付尝试 |
| POST | /api/v1/commerce/wechat/callback | CHANNEL_INTERNAL | 事件幂等 | 微信 V3 回调 |
| POST | /api/v1/commerce/alipay/notify | CHANNEL_INTERNAL | 事件幂等 | 支付宝异步通知 |
| POST | /api/v1/commerce/apple/transactions/verify | LEARNER_SELF | 是 | Apple JWS 验证 |
| POST | /api/v1/commerce/apple/recovery/scan | LEARNER_SELF | 是 | IAP 被动补单 |
| POST | /api/v1/commerce/apple/notifications | APPLE_INTERNAL | 事件幂等 | Apple Notification V2 |
| GET | /api/v1/commerce/entitlements/me | LEARNER_SELF | - | 我的权益 |
| POST | /api/v1/commerce/households | LEARNER_SELF | 是 | 创建家庭组 |
| POST | /api/v1/commerce/households/{householdId}/invitations | LEARNER_SELF | 是 | 发起成员邀请 |
| POST | /api/v1/commerce/households/invitations/accept | LEARNER_SELF | 是 | 接受家庭邀请 |
| DELETE | /api/v1/commerce/households/{householdId}/members/{userId} | LEARNER_SELF | 是 | 移除成员 |
| POST | /api/v1/commerce/orders/{orderId}/refunds | LEARNER_SELF | 是 | 申请退款 |
| GET | /api/v1/commerce/invoices | LEARNER_SELF | - | 发票申请列表 |
| POST | /api/v1/commerce/invoices | LEARNER_SELF | 是 | 发票申请 |
| POST | /api/v1/admin/content | CONTENT_EDIT | 是 | 创建内容草稿 |
| PUT | /api/v1/admin/content/{contentId}/draft | CONTENT_EDIT | 是 | 保存草稿 |
| POST | /api/v1/admin/content/{contentId}/validate | CONTENT_EDIT | 是 | schema/引用校验 |
| POST | /api/v1/admin/content/{contentId}/submit-review | CONTENT_EDIT | 是 | 提交初审 |
| GET | /api/v1/admin/reviews | CONTENT_REVIEW_L1/2 | - | 审核队列 |
| POST | /api/v1/admin/reviews/{reviewTaskId}/decision | CONTENT_REVIEW_L1/2 | 是 | 审核通过/驳回 |
| POST | /api/v1/admin/content/{contentId}/publish | CONTENT_REVIEW_L2 | 是 | 发布版本 |
| POST | /api/v1/admin/content/{contentId}/rollback | CONTENT_REVIEW_L2 | 是 | 回滚默认版本 |
| POST | /api/v1/admin/import-jobs | CONTENT_EDIT | 是 | 创建批量导入 |
| GET | /api/v1/admin/import-jobs/{importJobId} | CONTENT_EDIT | - | 导入状态 |
| GET | /api/v1/admin/correction-tickets | CONTENT_EDIT | - | 纠错工单 |
| POST | /api/v1/admin/correction-tickets/{ticketId}/resolve | CONTENT_EDIT | 是 | 处理纠错 |
| GET | /api/v1/admin/risk/users/{userId} | RISK_OPERATOR | - | 风险档案 |
| POST | /api/v1/admin/risk/users/{userId}/actions | RISK_OPERATOR | 是 | 封禁/解封 |
| GET | /api/v1/admin/dashboard/metrics | OPS_ANALYST/FINANCE_OPERATOR | - | 聚合指标 |
| GET | /api/v1/admin/reconciliation/batches | FINANCE_OPERATOR | - | 对账批次 |
| POST | /api/v1/admin/reconciliation/batches/import | FINANCE_OPERATOR | 是 | 导入渠道账单 |
| POST | /api/v1/admin/reconciliation/items/{itemId}/resolve | FINANCE_OPERATOR | 是 | 处理差异 |
| GET | /api/v1/admin/feature-flags | FLAG_OWNER | - | 开关列表 |
| PUT | /api/v1/admin/feature-flags/{flagKey} | FLAG_OWNER | 是 | 更新灰度规则 |

### 7.3 OpenAPI 3.0.3 摘要

~~~yaml
openapi: 3.0.3
info:
  title: EnglishFlow Commerce CMS Operations API
  version: 2.0.0
servers:
  - url: /api/v1
paths:
  /commerce/skus:
    get:
      operationId: listCommerceSkus
      security: [{bearerAuth: []}]
      responses:
        '200': {description: ok}
  /commerce/orders:
    get:
      operationId: listCommerceOrders
      security: [{bearerAuth: []}]
      parameters:
        - {name: cursor, in: query, schema: {type: string}}
      responses:
        '200': {description: ok}
    post:
      operationId: createCommerceOrder
      security: [{bearerAuth: []}]
      parameters:
        - {name: Idempotency-Key, in: header, required: true, schema: {type: string, maxLength: 96}}
      requestBody:
        required: true
        content:
          application/json:
            schema: {$ref: '#/components/schemas/CreateOrderRequest'}
      responses:
        '201': {description: created}
        '409': {description: idempotency conflict}
  /commerce/orders/{orderId}/payment-attempts:
    post:
      operationId: createPaymentAttempt
      security: [{bearerAuth: []}]
      parameters:
        - {name: orderId, in: path, required: true, schema: {type: integer, format: int64}}
        - {name: Idempotency-Key, in: header, required: true, schema: {type: string}}
      responses:
        '201': {description: payment parameters}
  /commerce/apple/transactions/verify:
    post:
      operationId: verifyAppleTransaction
      security: [{bearerAuth: []}]
      parameters:
        - {name: Idempotency-Key, in: header, required: true, schema: {type: string}}
      requestBody:
        required: true
        content:
          application/json:
            schema: {$ref: '#/components/schemas/AppleVerifyRequest'}
      responses:
        '200': {description: verified}
        '202': {description: pending}
  /commerce/entitlements/me:
    get:
      operationId: getMyEntitlements
      security: [{bearerAuth: []}]
      responses:
        '200': {description: ok}
  /admin/content:
    post:
      operationId: createContentDraft
      security: [{bearerAuth: []}]
      parameters:
        - {name: Idempotency-Key, in: header, required: true, schema: {type: string}}
      responses:
        '201': {description: draft created}
  /admin/content/{contentId}/validate:
    post:
      operationId: validateContentDraft
      security: [{bearerAuth: []}]
      responses:
        '200': {description: validation report}
  /admin/content/{contentId}/submit-review:
    post:
      operationId: submitContentReview
      security: [{bearerAuth: []}]
      parameters:
        - {name: Idempotency-Key, in: header, required: true, schema: {type: string}}
      responses:
        '202': {description: review queued}
  /admin/reviews/{reviewTaskId}/decision:
    post:
      operationId: decideReviewTask
      security: [{bearerAuth: []}]
      parameters:
        - {name: reviewTaskId, in: path, required: true, schema: {type: integer, format: int64}}
        - {name: Idempotency-Key, in: header, required: true, schema: {type: string}}
      responses:
        '200': {description: decided}
  /admin/content/{contentId}/publish:
    post:
      operationId: publishContent
      security: [{bearerAuth: []}]
      parameters:
        - {name: contentId, in: path, required: true, schema: {type: integer, format: int64}}
        - {name: Idempotency-Key, in: header, required: true, schema: {type: string}}
      responses:
        '200': {description: published}
  /admin/import-jobs:
    post:
      operationId: createImportJob
      security: [{bearerAuth: []}]
      parameters:
        - {name: Idempotency-Key, in: header, required: true, schema: {type: string}}
      responses:
        '202': {description: queued}
  /admin/risk/users/{userId}/actions:
    post:
      operationId: applyRiskAction
      security: [{bearerAuth: []}]
      parameters:
        - {name: userId, in: path, required: true, schema: {type: integer, format: int64}}
        - {name: Idempotency-Key, in: header, required: true, schema: {type: string}}
      responses:
        '200': {description: applied}
  /admin/dashboard/metrics:
    get:
      operationId: getDashboardMetrics
      security: [{bearerAuth: []}]
      responses:
        '200': {description: aggregated metrics}
  /admin/reconciliation/batches/import:
    post:
      operationId: importReconciliationBatch
      security: [{bearerAuth: []}]
      parameters:
        - {name: Idempotency-Key, in: header, required: true, schema: {type: string}}
      responses:
        '202': {description: queued}
  /admin/feature-flags/{flagKey}:
    put:
      operationId: updateFeatureFlag
      security: [{bearerAuth: []}]
      parameters:
        - {name: flagKey, in: path, required: true, schema: {type: string}}
        - {name: Idempotency-Key, in: header, required: true, schema: {type: string}}
      responses:
        '200': {description: updated}
  /commerce/skus/{skuId}:
    get:
      operationId: getCommerceSku
      security: [{bearerAuth: []}]
      responses: {'200': {description: ok}}
  /commerce/orders/{orderId}:
    get:
      operationId: getCommerceOrder
      security: [{bearerAuth: []}]
      responses: {'200': {description: ok}}
  /commerce/wechat/callback:
    post:
      operationId: receiveWechatCallback
      security: [{bearerAuth: []}]
      responses: {'200': {description: received}}
  /commerce/alipay/notify:
    post:
      operationId: receiveAlipayNotify
      security: [{bearerAuth: []}]
      responses: {'200': {description: received}}
  /commerce/apple/recovery/scan:
    post:
      operationId: scanAppleRecovery
      security: [{bearerAuth: []}]
      parameters:
        - {name: Idempotency-Key, in: header, required: true, schema: {type: string}}
      responses: {'202': {description: pending}}
  /commerce/apple/notifications:
    post:
      operationId: receiveAppleNotification
      security: [{bearerAuth: []}]
      responses: {'200': {description: received}}
  /commerce/households:
    post:
      operationId: createHousehold
      security: [{bearerAuth: []}]
      parameters:
        - {name: Idempotency-Key, in: header, required: true, schema: {type: string}}
      responses: {'201': {description: created}}
  /commerce/households/{householdId}/invitations:
    post:
      operationId: createHouseholdInvitation
      security: [{bearerAuth: []}]
      parameters:
        - {name: householdId, in: path, required: true, schema: {type: integer, format: int64}}
        - {name: Idempotency-Key, in: header, required: true, schema: {type: string}}
      responses: {'201': {description: created}}
  /commerce/households/invitations/accept:
    post:
      operationId: acceptHouseholdInvitation
      security: [{bearerAuth: []}]
      parameters:
        - {name: Idempotency-Key, in: header, required: true, schema: {type: string}}
      responses: {'200': {description: joined}}
  /commerce/households/{householdId}/members/{userId}:
    delete:
      operationId: removeHouseholdMember
      security: [{bearerAuth: []}]
      parameters:
        - {name: householdId, in: path, required: true, schema: {type: integer, format: int64}}
        - {name: userId, in: path, required: true, schema: {type: integer, format: int64}}
        - {name: Idempotency-Key, in: header, required: true, schema: {type: string}}
      responses: {'202': {description: removed}}
  /commerce/orders/{orderId}/refunds:
    post:
      operationId: requestCommerceRefund
      security: [{bearerAuth: []}]
      parameters:
        - {name: orderId, in: path, required: true, schema: {type: integer, format: int64}}
        - {name: Idempotency-Key, in: header, required: true, schema: {type: string}}
      responses: {'202': {description: pending}}
  /commerce/invoices:
    get:
      operationId: listInvoices
      security: [{bearerAuth: []}]
      responses: {'200': {description: ok}}
    post:
      operationId: requestInvoice
      security: [{bearerAuth: []}]
      parameters:
        - {name: Idempotency-Key, in: header, required: true, schema: {type: string}}
      responses: {'201': {description: created}}
  /admin/content/{contentId}/draft:
    put:
      operationId: saveContentDraft
      security: [{bearerAuth: []}]
      parameters:
        - {name: contentId, in: path, required: true, schema: {type: integer, format: int64}}
        - {name: Idempotency-Key, in: header, required: true, schema: {type: string}}
      responses: {'200': {description: saved}}
  /admin/reviews:
    get:
      operationId: listReviewTasks
      security: [{bearerAuth: []}]
      responses: {'200': {description: ok}}
  /admin/content/{contentId}/rollback:
    post:
      operationId: rollbackContent
      security: [{bearerAuth: []}]
      parameters:
        - {name: contentId, in: path, required: true, schema: {type: integer, format: int64}}
        - {name: Idempotency-Key, in: header, required: true, schema: {type: string}}
      responses: {'200': {description: rolled back}}
  /admin/import-jobs/{importJobId}:
    get:
      operationId: getImportJob
      security: [{bearerAuth: []}]
      responses: {'200': {description: ok}}
  /admin/correction-tickets:
    get:
      operationId: listCorrectionTickets
      security: [{bearerAuth: []}]
      responses: {'200': {description: ok}}
  /admin/correction-tickets/{ticketId}/resolve:
    post:
      operationId: resolveCorrectionTicket
      security: [{bearerAuth: []}]
      parameters:
        - {name: ticketId, in: path, required: true, schema: {type: integer, format: int64}}
        - {name: Idempotency-Key, in: header, required: true, schema: {type: string}}
      responses: {'200': {description: resolved}}
  /admin/risk/users/{userId}:
    get:
      operationId: getUserRiskProfile
      security: [{bearerAuth: []}]
      responses: {'200': {description: ok}}
  /admin/reconciliation/batches:
    get:
      operationId: listReconciliationBatches
      security: [{bearerAuth: []}]
      responses: {'200': {description: ok}}
  /admin/reconciliation/items/{itemId}/resolve:
    post:
      operationId: resolveReconciliationItem
      security: [{bearerAuth: []}]
      parameters:
        - {name: itemId, in: path, required: true, schema: {type: integer, format: int64}}
        - {name: Idempotency-Key, in: header, required: true, schema: {type: string}}
      responses: {'200': {description: resolved}}
  /admin/feature-flags:
    get:
      operationId: listFeatureFlags
      security: [{bearerAuth: []}]
      responses: {'200': {description: ok}}
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
  schemas:
    CreateOrderRequest:
      type: object
      required: [skuId, channelCode, clientOrderId]
      properties:
        skuId: {type: integer, format: int64}
        channelCode: {type: string, enum: [WECHAT, ALIPAY, APPLE_IAP]}
        clientOrderId: {type: string, maxLength: 80}
    AppleVerifyRequest:
      type: object
      required: [signedTransactionInfo, environment]
      properties:
        signedTransactionInfo: {type: string}
        signedRenewalInfo: {type: string}
        environment: {type: string, enum: [Production, Sandbox]}
    ErrorResponse:
      type: object
      required: [requestId, error]
      properties:
        requestId: {type: string}
        error:
          type: object
          required: [errorCode, message, retryable]
          properties:
            errorCode: {type: string}
            message: {type: string}
            retryable: {type: boolean}
            details: {type: object}
~~~

### 7.4 典型错误码

| 错误码 | HTTP | 可重试 | 说明 |
|---|---:|:---:|---|
| SKU_NOT_PURCHASABLE | 409 | 否 | SKU 未发布、价格过期或渠道不支持 |
| ORDER_EXPIRED | 409 | 否 | 订单支付窗口已过 |
| PAYMENT_SIGNATURE_INVALID | 400 | 否 | 渠道签名不合法 |
| PAYMENT_AMOUNT_MISMATCH | 422 | 否 | 回调金额与订单快照不同 |
| APPLE_JWS_INVALID | 422 | 否 | JWS、证书链或字段校验失败 |
| APPLE_TRANSACTION_REPLAY | 409 | 否 | 交易已绑定其他用户或重复结算 |
| ENTITLEMENT_PENDING | 202 | 是 | 已安全落库，异步补偿中 |
| REVIEW_ROLE_CONFLICT | 403 | 否 | 作者与审核角色冲突 |
| CONTENT_SCHEMA_INVALID | 422 | 否 | 内容字段或引用校验失败 |
| SENSITIVE_CONTENT_BLOCKED | 422 | 否 | 命中安全规则 |
| RISK_ACTION_FORBIDDEN | 403 | 否 | 操作者无风险权限 |
| RECONCILIATION_DISCREPANCY | 409 | 否 | 对账差异待处理 |
| FLAG_INVALID | 422 | 否 | 灰度规则或默认值非法 |
| IDEMPOTENCY_CONFLICT | 409 | 否 | 同 key 不同 request hash |
| RATE_LIMITED | 429 | 是 | 达到渠道、补单或管理接口限流 |

## 8. 事件、对账、权限和性能

### 8.1 事件 envelope

~~~json
{
  "eventId": "01J...",
  "eventType": "commerce.entitlement.activated.v1",
  "schema": "commerce.event.v1",
  "occurredAt": "2026-08-20T12:00:00Z",
  "actorId": "system",
  "requestId": "req-123",
  "idempotencyKey": "idem-123",
  "aggregateType": "entitlement",
  "aggregateId": "9001",
  "payload": {
    "userId": 123,
    "orderId": 456,
    "planCode": "PRO",
    "startsAt": "2026-08-20T12:00:00Z",
    "endsAt": "2026-09-20T12:00:00Z"
  }
}
~~~

事件目录：commerce.order.created.v1、commerce.payment.requested.v1、commerce.payment.callback_received.v1、commerce.payment.verified.v1、commerce.order.paid.v1、commerce.entitlement.activated.v1、commerce.entitlement.revoked.v1、commerce.subscription.changed.v1、commerce.refund.completed.v1、commerce.household.changed.v1、cms.content.submitted.v1、cms.review.decided.v1、cms.content.published.v1、cms.content.rolled_back.v1、safety.precheck.blocked.v1、risk.decision.created.v1、finance.reconciliation.discrepancy.v1、ops.flag.updated.v1。Outbox 事务提交后投递，消费者按 eventId 去重，失败进入重试队列和死信。

### 8.2 对账流程

1. 财务上传渠道账单或从受信对象存储拉取，校验文件 hash、日期、渠道和金额列。
2. 生成 reconciliation_batch 和逐行 reconciliation_item，不直接更新订单。
3. 以 channel_trade_no/order_no/amount_minor/settled_at 四元组匹配平台记录。
4. MATCHED 自动关闭；渠道有而平台无、平台有而渠道无、金额差异、退款差异进入 DISCREPANCY。
5. 财务操作员提交解决方案，二次审批后写 resolved_by/resolved_at 和 audit_log；需要补单时只调用正式支付验证服务。
6. 批次必须显示 expected_count、matched_count、discrepancy_count、source_watermark 和 completeness。

### 8.3 权限和数据分级

| 数据 | 普通学员 | 教研编辑 | 审核员 | 财务 | 风控 | 运营 |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| 商品/本人订单 | 读 | 读 | 读 | 读 | 受限 | 读 |
| 支付回调原文 | 否 | 否 | 否 | 受限 | 否 | 否 |
| 内容草稿 | 否 | 写本人 | 读脱敏 | 否 | 否 | 读摘要 |
| 敏感命中 | 否 | 仅结果 | 可审 | 否 | 受限 | 否 |
| 用户风险档案 | 否 | 否 | 否 | 否 | 读写 | 摘要 |
| 聚合指标 | 否 | 受限 | 受限 | 财务指标 | 风险指标 | 读 |
| 原始录音/私密资源 | 本人受限 | 否 | 工单授权 | 否 | 工单授权 | 否 |

管理员访问敏感数据必须携带 reasonCode 和 ticketId；导出按字段脱敏、行数限额和水印；所有导出动作写 audit_log。

### 8.4 SLO、缓存和弱网

- SKU/权益只读查询 P95 < 300ms；订单详情 P95 < 500ms；管理内容校验 P95 < 800ms，异步导入和对账返回 202。
- Redis 只保存可重建的权益 projection、SKU 快照、flag 快照和幂等短响应；支付、审核、账本和审计以 MySQL 为准。
- Web/H5 支付页面网络中断时展示订单查询入口，不重复创建订单；移动端恢复购买采用 clientEventId 和 originalTransactionId 幂等。
- 回调处理失败按 1、2、4、8、16 分钟重试，最多 8 次后死信；不可重试的签名/金额/权限错误直接终止。
- Feature Flag、权益和支付安全路径默认 fail-closed；只读指标延迟时显示 stale/dataCompleteness，不伪造 0。

## 9. 测试矩阵和 Definition of Done

### 9.1 单元测试

1. 金额计算使用分和整数，折扣、税费、零元订单和溢出边界正确。
2. 订单状态机拒绝逆向和跨越；重复 callback、重复补单和幂等 key 返回原响应。
3. 微信 V3 解密、商户号/金额/时间校验；支付宝 RSA2 排序、验签和 notify 处理。
4. Apple JWS 证书链、alg、bundleId、environment、productId、appAccountToken、transactionId、originalTransactionId、expires/revocation 字段完整校验。
5. Apple 通知乱序、宽限期、升级降级、退款、撤销和重复交易可回放。
6. Household 最大 3 人、重复邀请、跨家庭绑定、主账号失效和成员移除正确。
7. CMS schema、查重、资源 hash、DAG 无环、题目答案保护和组卷 seed 可复现。
8. 双审角色隔离、驳回、转派、发布和回滚不可越权。
9. 敏感规则版本、命中脱敏、fail-closed 和人工复核审计正确。
10. 风控 TTL、设备撤销、申诉和解封不会修改财务流水。

### 9.2 集成和端到端测试

- iOS StoreKit 2 沙盒验证恢复购买、离线启动、回调延迟、App 重装和用户换机；Production 交易不能在测试配置中误开通。
- 微信 Native/H5/JSAPI、支付宝 App/H5 分别验证成功、取消、重复回调、金额篡改、证书轮换和主动查询。
- 支付成功到权益可见的最终一致性 P95 目标 2 秒；模拟消息重复 100 次仍只开通一次。
- CMS 从草稿到发布跑全链路；不同账号初审/终审；发布后旧版本引用可读；回滚后新请求读取正确版本。
- 导入 10 万行题库，错误行可定位、任务可恢复、不会部分静默发布。
- 对账导入匹配、差异、人工解决、重跑和报表导出均可回放。
- Feature Flag 跨设备稳定分桶，默认关闭、缓存过期收敛、紧急关闭在 SLO 内生效。
- 管理端全量接口验证最小权限、字段脱敏、审计 reasonCode、分页和导出限额。

### 9.3 Definition of Done

1. FEAT-COM-001～009、FEAT-ADM-001～010 共 19 项均具备目标、前置、主流程、异常、验收和埋点。
2. 微信、支付宝、Apple IAP 的回调和验证均服务端可信，私钥/证书/原始敏感数据不进入 Git、日志或普通表字段。
3. 订单、支付尝试、回调、交易、订阅、权益、家庭、退款、发票、对账、内容版本、审核、导入、安全、风控、指标、Flag 和审计 DDL 可拆为正式迁移。
4. REST/OpenAPI 3.0.3 可生成 Java DTO 和前端 TypeScript 类型；所有写接口有幂等和错误码；所有管理动作有权限和审计。
5. Phase 1 保持规则化学习与人工双审边界；AI 生成、AI 审核结论和实时 AI 客服不进入当前实现。
6. 通过 09 全站一致性审计、迁移语法检查、契约解析、单元/集成/端到端和跨端权限测试后，08 才标记为完成。
