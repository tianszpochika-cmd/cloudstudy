# 身份与 Outbox 待签收包（仅研究，未实施）

状态：OPEN / PREPARATION_PARTIAL_NOT_READY。未修改 PrincipalId、正式 OpenAPI、canonical event catalog、身份 schema、task-spec 或注册业务。

## 当前源码事实

1. IAM `PrincipalId(UUID)` / `toString()` 为裸 UUID；`JwtTokenService` 将其直接作为 JWT `sub`。IAM 控制器和 JDBC hydration 使用 `UUID.fromString`，全局加前缀会破坏这些读取路径。
2. canonical `M1018IamAccountBootstrapCreated.principalId` 要求 `^prn_[A-Za-z0-9._:-]{15,127}$`；transport 要求 `aggregateId = payload.principalId`、topic `platform.iam.v1`、schema/schemaVersion `iam.event.v2`、version 2、eventName `iam.account.bootstrap.created.v2`。
3. learner 已兼容两种输入格式，但未证明它们是同一 owner：`VerifiedLearnerPrincipalFactory` 优先选 verified JWT 的 `principal_id/principalId`（prn_），无 claim 时选 UUID sub；`LearnerHttpPrincipals.require` 直接选 sub，接受 UUID 或 prn_。仅“正则都接受”无法证明两个入口或 bootstrap 投影的 owner 一致。
4. `JdbcAuditFactPort.append` 返回 void；审计 INSERT 使用传入 `AuditDecision.decisionId()`。Outbox 必须复用同一 decisionId，不能假定数据库生成审计 ID。

## 可审查决策候选

| 候选 | 必须签收的范围 | 风险 |
|---|---|---|
| A：保留内部 UUID / JWT sub，增加显式版本化事件边界映射 | 新注册 canonical event 使用明确可逆 `prn_ + canonical UUID`；IAM codec 与 learner 消费边界必须验证映射、记录同一 owner UUID；两种 learner HTTP factory 保持同一身份选择规则；任意旧 opaque prn_ 不能一律 strip prefix，需要显式映射事实或拒绝 | 不更改 canonical 正则，但需 learner owner/PEP/投影证据；仅 IAM emit 前缀不足以关闭冲突 |
| B：将内部身份、JWT 与数据库统一升级为 prn_ | 全部 IAM hydration、session/account/audit/schema、Token/PEP/各消费 owner 和迁移/回滚设计 | 跨服务/身份 schema 扩围，超出本卡原准备授权；不得修改 PrincipalId.toString 后宣称兼容 |
| C：正式修改 canonical schema 接受裸 UUID | 按冻结兼容流程签收 source/binding/hash/consumer 与旧事件兼容；同步契约生成物与审查 | 不能仅改正则或测试期望；原 M1-018 冻结门禁不自动放行 |

建议优先独立评审 A 的边界 codec 和 owner 等价证明；这只是建议。签收前不实现、不生成被当作已批准的事件样例，不宣称 UUID/prn_ 冲突关闭。完整事件样例须在选定表示后同时提供合法 envelope/payload 与裸 UUID、actor/aggregate mismatch、traceId/requestId 不合法等负例，并运行 canonical Schema 校验。

## 主审可签收的 Outbox 实现清单候选

以下是具名文件提案，不是 task-spec 授权；实际名单需与恢复出的原卡四文件、当前迁移号和身份决议合并后签收。当前 IAM 迁移截止 V18，因此 V19 仅是当次候选，不应绕过并发迁移检查。

| owner | 拟文件/职责 |
|---|---|
| iam-service | `src/main/resources/db/migration/V19__create_iam_outbox.sql`：本服务表、稳定 eventId/dedupeKey、pending/retry/lease/ack 状态、唯一约束与索引；不修改身份 schema |
| iam-service | `domain/IamOutboxEvent.java`、`domain/IamOutboxPort.java`、`domain/IamOutboxRelayPort.java`：append/claim/ack/retry 清晰区分，注册事务仅 append |
| iam-service | `domain/JdbcIamOutbox.java`、`domain/JdbcIamOutboxRelay.java`：同一本地 JDBC 事务参加 append；lease/发布ack条件更新；跨进程与重试负例 |
| iam-service | `integration/IamOutboxKafkaRelay.java`：broker ACK 之后再记 published，至少一次投递，异常保留 pending/retry；不使用 Kafka RPC/2PC |
| iam-service | `config/IamEventRelayProperties.java`、`config/IamEventRelayConfiguration.java`、现有 `IamRuntimeConfiguration.java`、`application.yaml`、`pom.xml`：relay默认关闭、明确外置 broker/topic、统一依赖版本与同一事务装配 |
| iam-service | `domain/PasswordAccountService.java` 的 `register/appendAudit`、`web/IamProviderBoundaryController.java` 的注册幂等/establish边界：传播同一AuditDecision，固定创建时间；不能在 HTTP 响应后独立双写事件；不新增其他 IAM canonical 事件 |
| iam-service + learner-service | 身份 codec/消费 owner 映射文件属于身份决议扩围，必须单独具名签收；本卡不声称 learner 全量消费联调完成 |
| QA / iam-service | schema/adapter 真 MySQL 测试、注册+审计+Outbox共同回滚、relay broker故障/ACK丢失/重发同eventId、claim并发、非法envelope、payload脱敏与配置拒绝测试；普通mock不能替代 |

可复用的实现模式来自 content-service 的 `ContentOutboxPort/RelayPort`、`JdbcContentOutbox/Relay`、`ContentOutboxKafkaRelay`；只能复用模式，不能跨服务写 content 表或共享 ORM。精确 class 命名仍须主审在 task-spec 中固定后实施。

## TC03 仍未执行

- A：在专用全新库、签收 schema 后，以可撤回的必要 audit/Outbox INSERT 故障证明账号/设备/会话/幂等事实共同回滚，再按 infrastructure-failure 契约重试；本轮未注入故障。
- B：只暂停本卡自有 relay/独立 broker fixture。事务成功仍应 201，pending事实不能消失；恢复后 ACK 先于published；重发沿用eventId，consumer去重。不得停止共享 Kafka。
- C：409业务冲突遵循既有幂等拒绝，不把“移除冲突后同键201”当事务回滚证明。

已有 Windows t3g 的 Flyway validate/零基线只证明当时环境；本机没有创建专用数据库、未验证迁移历史/政策，也没有复用旧库、repair、清库或注册。TC01～03、真实受限JWT→领域403、实际Set-Cookie均 OPEN。
