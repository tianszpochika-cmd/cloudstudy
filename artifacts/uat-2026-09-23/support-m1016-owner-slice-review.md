# M1-016 客服 owner 七态/消息/CAS 可实施性复核

日期：2026-09-23。范围：`admin-ops-service.support`、M1-016 canonical 契约、Phase 1 客服业务设计和本机 `127.0.0.1:13306` 旧 owner 表。只执行只读查询、聚焦测试并写本报告；**没有修改旧工单、数据库、服务代码、Gateway 或前端**，也没有启停服务或构建 Docker。本机表计数是该 MySQL 实例的快照，不代表隔离 UAT 容器的数据量。

## 当前事实与旧数据边界

- [M1-016 任务](../../requirements/backlog/v2-phase1-rebaseline/execution/P1R-M1-016.md)、[policy](../../config/p1r-notification-sync-support-contract.v1.json) 和 [Phase 1 客服设计 §6](../../docs/06-design/v2-980plus/phase1-business-operation/05-后台内容运营与客服业务流程.md) 将 ticket、message、assignment、SLA、resolution、retention 全部归 `admin-ops-service.support`；canonical 状态为 `OPEN/ASSIGNED/WAITING_USER/WAITING_INTERNAL/RESOLVED/CLOSED/REOPENED`。写入必须有 `expectedVersion` CAS、幂等、授权主体和不可变审计；消息需要扫描后的正文内容引用，不能只有 hash。
- 现行 [V1/V2 schema](../../services/admin-ops-service/src/main/resources/db/migration/V1__create_admin_ops_service_schema.sql) 的 `support_ticket` 仍以 `ticket_status`、`redacted_summary`、`description_fingerprint`、`ticket_version` 保存旧工单；没有 canonical message、assignment/SLA history、contentRef、retention/reconciliation 字段或消息版本。当前 JDBC store 仅在 `ticket_version` 上做旧表 CAS。[JdbcAdminOpsAdapters](../../services/admin-ops-service/src/main/java/com/englishflow/adminops/adapter/jdbc/JdbcAdminOpsAdapters.java)
- 本机旧表为 101 条：`OPEN 56 / ACKNOWLEDGED 1 / IN_PROGRESS 1 / WAITING_CUSTOMER 17 / RESOLVED 25 / CLOSED 1`；74 条 `last_audit_id` 缺失。分类为旧 `ACCOUNT_ACCESS 11 / BILLING 11 / CONTENT_CORRECTION 11 / LEARNING_DATA 19 / PRIVACY_REQUEST 10 / TECHNICAL 39`。没有 `support_ticket_message` 表。没有查询或写出主体 ID、描述或附件内容。
- 六态与七态不能按字符串或猜测自动映射。`ACKNOWLEDGED/IN_PROGRESS` 缺 assignment history，`WAITING_CUSTOMER` 缺 canonical 消息事实；同名的 `RESOLVED/CLOSED` 也缺 resolution、owner reconciliation 与 legal hold 证据。旧分类除 `CONTENT_CORRECTION` 名称相同外，其余语义未必一一对应；即使名称相同，仍缺正式内容引用。**101 条旧工单须原样留在旧表，作为 `LEGACY_HASH_ONLY` 非可操作读取，不能补假引用、假审计或假 policy。**
- 当前 [SupportController](../../services/admin-ops-service/src/main/java/com/englishflow/adminops/web/SupportController.java) 对旧创建/转移一律 503，读取结果显示 `workflowVersion=LEGACY_HASH_ONLY`、`actionable=false`；这是正确的失败关闭。它的旧读取 `state` 仍可能是六态字符串，不能把此投影作为 M1-016 七态响应验收。现行 [SupportTicketService](../../services/admin-ops-service/src/main/java/com/englishflow/adminops/support/SupportTicketService.java) 内部仍使用六态、旧 draft 的客户端 `priority` 和无 `expectedVersion` 参数的转移；这些方法未形成 canonical M1-016 写入口。
- 新 [SupportWorkflowState/Policy](../../services/admin-ops-service/src/main/java/com/englishflow/adminops/support/SupportWorkflowPolicy.java) 只是未接入 owner store 的纯策略：调用方传入 `Actor` 和 `verifiedContentRef/verifiedOwnerResult/ownerReconciled` 等布尔值，策略本身没有从已验证主体、ticket owner、内容/领域 owner receipt 派生事实。它的测试证明状态表部分规则，不证明权限、跨主体、消息持久化或真实 CAS。

## 不能安全开放最小新记录纵切的依赖

| 依赖 | 现状 | 少了它会怎样 |
| --- | --- | --- |
| 正文/附件可信引用 | 契约要求 `contentRefId + sha256 + redactionVersion + scanStatus=CLEAN + objectVersion + safePreviewRef`，附件还要 media owner 授权；support 运行代码只识别旧 hash/媒体元数据，仓库内未见可供其验证上述内容引用的 owner 适配 | 新工单或消息若只保存 hash，客服仍无法阅读/回复；若信任请求里的 `CLEAN` 标志，会放开未扫描内容。 |
| 服务端策略事实 | canonical priority、assignment、SLA policy/version/dueAt 和 retention policy/version/until/legalHold/owner receipt 均须服务端派生；旧默认 SLA 与客户端 priority 不能充当已批准策略，M1-017 仍负责保留/法律保留运行边界 | 无法构造契约要求的完整合法新工单，尤其不能安全关闭或清理。 |
| 领域结果与主体授权 | `WAITING_INTERNAL → RESOLVED` 等需要可信 `ownerResultRef`，关闭前需 reconciliation receipt；学习者消息/重开要按 ticket owner 判定，staff 先验权限/租户 | 现有纯策略的调用者布尔值不能代替 owner 回执或跨主体 PEP。 |
| 原子持久化 | 新 ticket/message 需要分别递增 `stateVersion/messageVersion/assignmentVersion`，幂等键同请求摘要重放，异请求 409；ticket CAS、消息插入、history、审计/outbox 与幂等回执需同 owner 事务 | `synchronized`、旧单列 CAS 或先转发通知后更新 ticket 都不足以保证多实例一致性和失败回滚。 |

因此本轮没有新增迁移或把新路径接入现有旧表。仅建空表和通过 mock 测试会制造“已实现七态/消息”的误导；没有可信内容引用、策略和回执时，能安全创建的 canonical 新记录数量仍为 0。

## 下一步可审查的实现顺序

1. 冻结内容引用验证端口及其 owner、服务端 priority/SLA/retention 策略来源、owner result/reconciliation receipt 校验；所有未知状态 fail closed。保留现有旧表只读，**新 M1-016 记录使用独立的新 owner 表**，不能对旧行 `UPDATE` 补列来冒充迁移。
2. 在新表中明确唯一键与事务边界：ticket ID、tenant/owner、七态、独立版本；message 的 `(ticketId,messageVersion)` 顺序键，以及按 ticket/已验证作者作用域约束的 `clientMessageRef` 和幂等键；assignment/SLA history、resolution/retention、审计/outbox/回执引用。新建和变更使用数据库 `WHERE state_version=expectedVersion` CAS，并在同一事务核对幂等摘要与审计结果。
3. 新 owner service 从验证过的身份派生 tenant/owner：学习者只能访问自己的 ticket，staff 先具备管理权限；未知/跨主体给受控拒绝。可信引用和策略检查在任何成功回执前执行。七态转换使用经过 owner 事实验证的策略上下文，不能直接暴露由客户端设置的 `Evidence` 布尔值。
4. 待新服务与测试闭合，再建立 learner/admin 到同一 owner 的受控 route adapter；旧表维持明确的 legacy 读取标记，不混入 canonical 七态列表。最后单独收集 Gateway、浏览器和跨服务证据。

## 本轮验证

| 验证 | 结果 | 证明范围 |
| --- | --- | --- |
| M1-016 contract/generated-types Node tests | 87/87 PASS | D2 静态契约、生成类型和对抗性约束，不是运行时实现。 |
| `SupportWorkflowPolicyTest`、`InMemorySupportTicketStoreCasTest`、`SupportControllerFailClosedTest` | 3 suites / 5 tests / 0 failures、0 errors、0 skipped | 纯七态转移规则、单进程内存 CAS 和旧 HTTP controller 503；不证明 MySQL 消息/CAS/跨主体/审计链。 |

结论：旧记录和旧命令应继续保持原样与失败关闭。完整 M1-016 owner 纵切尚不能安全接入；上述四类可信依赖明确后再实现新表和事务链，不把当前静态 PASS 升格为产品完成。
