# M1 统一执行日志

更新时间：2026-08-30（Asia/Shanghai）。本记录随实际状态推进，不继承旧 B/DEV/G Evidence。

## 当前任务

- `P1R-M1-001`：`ACCEPTED`；原实现源 `96e1b541cdda8e9e5ad02bc79ea0c5b9032064c4`，Evidence `evidence/p1r/m1/P1R-M1-001/manifest.json`；其列名制品在 `e4618b3` 保持不变。
- `P1R-M1-002`：`ACCEPTED`；原最终实现源 `25705c4caab46449cfaa577db08bd13c8ad13fba`，Evidence `evidence/p1r/m1/P1R-M1-002/manifest.json`，原独立评审 `m1_002_final_review`（Terra Ultra）；共享产物在 `e4618b3` 完成 current-source revalidation。
- `P1R-M1-003`：`ACCEPTED`；原最终实现源 `82b27f4108cfb976a274c2ac0cc34b1c9460a7a7`，Evidence `evidence/p1r/m1/P1R-M1-003/manifest.json`；共享产物在 `21cdd3a` 完成 current-source revalidation。
- `P1R-M1-004`：`ACCEPTED`；不可变来源基线 `e5110f29d73724fd518fd6d4a6a7cbcdb08ece28`，原实现源 `e4618b324e5a93926da0750a8100fc9377ac97ec`，Evidence `evidence/p1r/m1/P1R-M1-004/manifest.json`；共享产物在 `21cdd3a` 完成 current-source revalidation。
- `P1R-M1-005`：`ACCEPTED`；不可变来源基线 `bb0ae3b5f23ff6410b7a0b2629c8730422b0c78d`，最终实现源 `21cdd3a94d0c721c96f5257d26efbb0c1b9354fb`，Evidence `evidence/p1r/m1/P1R-M1-005/manifest.json`，独立终验 `agent:m1_005_independent_review:gpt-5.6-luna:max`。
- `P1R-M1-006`：`ACCEPTED`；不可变来源基线 `463c4b238caceb1592bff6c61327c00ab9bac922`，最终实现源 `3e4ba856742f28ba9d3fc4a3264c4b24c1cafc5a`，独立终验 `agent:m1_005_independent_review:gpt-5.6-luna:max`。只接受 Kafka + AsyncAPI 的 D2 静态目录与失败关闭机制，不把 B26、Kafka、Outbox、ACL 或 consumer runtime 写成 PASS。
- `P1R-M1-007`：`IN_PROGRESS`；不可变来源检查点 `93c764f31daa22c4c58228241a15c5dbd03930ec`。目标是冻结 `eventId/rootEventId/aggregateId/schemaVersion` 关联、Outbox/消费状态机、重试预算、DLQ/replay、Saga/补偿、双人恢复和 receipt schema；不把 B26 或 M2 runtime 写成 PASS。
- M1-006 修改了共享契约、CI 与文档制品，因此 `P1R-M0-005`、`P1R-M1-001` 至 `P1R-M1-005` 的 manifest 已在不覆盖原始 provenance 的前提下绑定 `3e4ba856...` 完成 current-source revalidation；原实现源、原完成时间、原 reviewer 和原 compatibility baseline 仍保留在各自 `provenance`。
- M0 供应链阻塞不在 M1-001 显式依赖内，但继续禁止发布与“M0 全绿”声明。

## M1-006 执行与结果摘要

1. 事件治理源：冻结 canonical/historical/deprecated 分类、producer/data owner、consumer group、topic、aggregate partition key、payload schema 与兼容策略；RabbitMQ/Redis Streams 只能保留历史标记。
2. 生成与失败关闭：从同一目录生成 AsyncAPI channel、send/receive operation 与 Kafka binding，并让 merge/generate/validate/compatibility 对治理字段缺失、漂移、重复 owner 和非法 transport 失败关闭。
3. 对抗测试与独立终验：覆盖未知事件、伪造 producer/consumer、无订阅 operation、topic/partition 漂移、UI telemetry 混入领域总线、敏感 payload 和静态结果冒充 runtime 等负例。

统筹 Agent 独占共享生成物、命令入口、状态、Evidence、提交与远程推送。

- 终验结果：`3e4ba856742f28ba9d3fc4a3264c4b24c1cafc5a` 的 dual-baseline compatibility、fragment/payload 完整性、B26 exact binding、generated `schemaVersion` 和 CI guard 由独立 reviewer 接受；P1R `186/186`、B26 `26/26`、merge/generate/validate 与 Git compatibility 均通过。
- D2 边界：输出仍为 `D2_CONTRACT_READY` / `NOT_RUNTIME_VERIFIED`；B26 为 `static-only`、`runtimeStatus=pending`、`defaultDecision=NO-GO`。Outbox/dedupe/retry/DLQ/replay/Saga 的完整可靠性语义仍由 `P1R-M1-007` 冻结，真实 Kafka broker/topic/ACL 创建、Outbox→broker→consumer 投递、重复/乱序/宕机/回放验证仍由 `P1R-M2-005` 验收；`P1R-M0-006` 继续 `BLOCKED`。

## M1-007 执行轨道

1. Outbox 与消费可靠性：冻结事务边界、状态迁移、lease/ack、幂等去重、原子 effect/receipt、重试预算、DLQ 原始关联和有序处理。
2. Replay、Saga 与人工恢复：冻结 immutable source、同 consumer path、审批分离、补偿 owner、禁止跨库写、恢复任务和关闭回执。
3. Schema 与失败关闭：建立 canonical D2 policy、JSON Schema/生成物、B26 历史候选交叉检查和对抗变异测试；所有输出保持 `NOT_RUNTIME_VERIFIED`。

统筹 Agent 独占共享生成物、状态、Evidence、提交与远程推送。真实 Kafka broker/topic/ACL、Outbox publisher、consumer 去重和故障重放归 `P1R-M2-005`，workflow Saga/人工恢复运行实现归 `P1R-M2-006`。

## M1-003 执行轨道

1. IAM 权限契约：只修改 B8 OpenAPI 源，冻结 principal、成人 Gate、consent、tenant、RBAC/ABAC、admin policy 生命周期与内部 PEP/PDP 输入输出。
2. 失败关闭校验：只新增 M1-003 结构化审计/测试与命令入口，覆盖客户端伪造 authority、缺失 owner/tenant、默认拒绝、成人/同意限制、双人审批、撤销和缓存失效。
3. 设计一致性：只对齐 ADR-0010、安全边界和契约说明，明确控制面、服务本地 PEP、远程 PDP 触发条件与 fail closed 语义。

统筹 Agent 独占公共生成物、兼容基线、状态、Evidence、提交与远程推送。运行期 IAM、领域服务 PEP、真实数据库与 Gateway 仍分别属于 M2-002/M2-003/M1-004。

实际调度：`m1_003_policy_contract`（Terra Ultra）完成权限契约源；根级线程上限阻止另外两名执行 Agent 启动，因此 `root-coordinator` 在互斥文件边界内接管失败关闭审计和设计一致性；`m1_003_final_review`（Luna Max）只读独立终验。没有调用模型未知的历史 Agent，也没有把未启动轨道记录成已完成。

## M1-002 执行轨道

1. IAM 契约源：只修改认证 OpenAPI 源，拆分 Web Cookie 与原生安全存储请求/响应，并固定 RS256/JWKS、轮换、重放、撤销和错误语义。
2. 失败关闭校验：只修改 P1R 认证审计/测试，拒绝混合凭据、弱化 Cookie、可变算法或不完整错误契约。
3. 设计一致性：只修改 ADR-0013 与契约说明，明确 transport profile、discriminator 和会话终止边界；只读确认生成设计文档已无 OAuth client/redirect 与“禁止密码直登”冲突。

统筹 Agent 独占 canonical 合并、生成物、台账、状态轨迹、Evidence、最终提交和远程推送。三个执行 Agent 分别为 `m1_002_auth_contract`（Terra Ultra）、`m1_002_auth_audit`（Luna Max）和只读终验 `m1_002_final_review`（Terra Ultra）；因根级线程名额和公共合约依赖采用顺序调度，没有使用模型未知的历史 Agent。

## M1-001 结果摘要

- canonical API：367 operations / 486 schemas；317 个 JSON 2xx 与 385 个标准错误响应通过公共语义检查。
- 幂等：165 个外部写，164 个 required，1 个具名 signed-access 例外。
- 分页：58 个 `list*` + 2 个已有 Cursor 操作统一为 cursor；P1R 34/34。
- 兼容：以 `4d7f73a867ff3e1db8582eab7593c173625bc8a3` 为不可变基线，OpenAPI/events/schema 均 0 breaking。

## M1-002 结果摘要

- 认证传输：`WEB_COOKIE` 与 `NATIVE_SECURE_STORAGE` 使用具名请求/响应 schema 和 `data.authTransport` discriminator；生成客户端不再暴露可选 Refresh Token 的混合响应。
- 会话安全：固定短时 RS256、RSA JWKS、`kid`/缓存/轮换/重叠与 unknown-kid fail closed；固定 rotation、reuse/replay、family/session revoke、logout、reset 和清 Cookie 语义。
- 契约工具：新增 `p1r:auth-contract:check` 与 10 个失败关闭测试；canonical 计数为 367 operations / 497 schemas，Git baseline 0 breaking。
- 验证：P1R 44/44、B8 29/29、G1 6/6；完整 G 的 G0/G3 两项旧 source marker 失败经独立评审确认不由本任务引入。

## M1-003 结果摘要

- 权威上下文：principal、tenant、role/permission 由 IAM 派生，resource owner/content rights 由领域 owner 提供；客户端 authority 字段不能放大权限。
- 准入与授权：成人 Gate、required consent、RBAC+ABAC、默认拒绝、本地 PEP/远程 PDP、可信服务身份和异常 fail closed 已形成严格契约。
- 策略治理：新增 8 个控制面操作和 1 个结构化 PDP 操作，覆盖 draft/submit/独立 approve/activate/revoke、职责分离、审计、幂等和缓存失效。
- 契约工具：新增 `p1r:iam-policy-contract:check` 与 13 个失败关闭测试；canonical 计数为 377 operations / 536 schemas，Git baseline 0 breaking。
- 验证：P1R 57/57、B8 29/29、G1 6/6；独立 Luna Max 评审接受最终源。完整 G 仍是既有 39/41，D2 不替代 M2 运行实现。

## M1-004 执行与结果摘要

1. Gateway policy：`root-coordinator` 负责 route/Origin/Cookie/JWT/rate/error/audit/direct-connect 合同源、canonical 合并和设计对齐。
2. 失败关闭校验：`m1_003_policy_contract`（Terra Ultra）负责专项审计和 15 个变异测试；因根级历史线程占用，未启动模型未知的历史 Agent。
3. 独立终验：`m1_003_final_review`（Luna Max）只读复核实现源并给出 `ACCEPT`，范围严格限定在 D2。

- 路由所有权：52 条 rule 唯一覆盖 326/326 public operations；0 未匹配、0 等优先级冲突；51/51 internal operations 外部 `DENY`。
- 安全合同：精确 Origin、credentialed CORS 无 wildcard、Cookie CSRF/Origin/Referer、native secure storage、RS256/JWKS、具名 rate class、429 `Retry-After`、统一错误、关联 ID、脱敏审计和直连阻断均有正反例。
- 验证：Gateway 15/15、P1R 72/72、B7 28/28、B8 29/29、G1 6/6；merge/generate/validate/typecheck PASS；相对 `e5110f2` 的 OpenAPI/events/schema 兼容均 0 breaking。
- 未越界：真实 WebFlux 安全、public-path、Redis 限流、持久审计、网络隔离和跨进程 Evidence 仍归 `P1R-M2-001`；完整 G 保持既有 39/41，M0-006 仍 `BLOCKED`。

## M1-005 执行与结果摘要

1. 数据政策源：新增当前 P1R 机器可读 owner 矩阵，覆盖 Gateway 无业务 schema 边界、IAM、audit/workflow 平台 owner 和 11 个 Phase 1 领域 owner；明确 schema/凭据/Flyway/Redis/tenant/retention/删除与回滚责任。
2. 静态失败关闭：验证 owner/schema/namespace 唯一、Gateway/core-api 禁止新写、迁移命名与责任、跨服务写/join/shared ORM 禁止，以及旧 Redis/B25 候选映射不能被误判为当前运行事实。
3. 设计一致性：只对齐数据所有权、迁移和保留边界；空库、存量库、owner grants、Redis 重建、tenant 负例和回滚仍须由 `P1R-M2-004` 提供真实运行 Evidence。

- 政策基线：15 个服务、14 个 data owner；Gateway 无业务 schema、数据库凭据、Flyway 和领域写权限；12 个现有 migration 候选、2 个 M2-004 计划集合、29 个 Redis 条目、8 个 M2 运行缺口。
- 失败关闭：递归扫描 migration 与 owner SQL，覆盖 executable comments、ANSI_QUOTES、compact USE、dynamic SQL、MySQL 注释/引号/转义模式、backtick、嵌套目录和 Maven/Gradle Gateway persistence dependency；policy/B25/Redis 结构摘要拒绝未知字段、单条缺字段和类型漂移。
- 验证：专项 34/34、P1R 106/106、Redis/B25 static、IAM/Gateway、B7 28/28、B8 29/29、G1 6/6、契约生成/校验/typecheck/兼容、计划与 diff 均 PASS；独立 Luna Max adversarial 终验 ACCEPT。
- 未越界：结果只证明 static/D2，`runtimeStatus=NOT_RUNTIME_VERIFIED`；Java 动态拼接 SQL 是未来静态工具 P2，真实 owner grants、TenantScope、Redis rebuild、回滚与 retention runtime 仍归 M2-004。
