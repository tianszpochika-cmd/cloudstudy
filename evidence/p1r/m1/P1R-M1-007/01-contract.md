# 契约证据

- `reliability-policy.json` 固定 7 条 canonical 事件的治理引用、8 个可靠性记录 Schema、5 个 Outbox 状态、6 个 consumer 状态与最多 5 次 retry。
- 原始事实由服务端生成 `eventId` 并以自身为 `rootEventId`；派生控制事件生成新 `eventId`，保留 source root，并把 `causationEventId` 绑定到直接来源。客户端不能提供或改写这些身份。
- 领域事实与 owner-local Outbox 原子提交；publisher 采用 lease、broker ack 后标记发布和至少一次投递。consumer effect 与 dedupe receipt 原子提交，随后才提交 offset。
- retry 受预算和错误分类约束；DLQ 保留不可变原始关联；replay 绑定 action digest、独立审批并经过相同 consumer path；顺序按 aggregate/version 处理。
- Saga 契约固定 7 个 Saga 状态、8 个 step 状态、4 个 compensation 状态、10 个人工恢复状态和 22 个 receipt 字段；workflow/audit 不得跨 owner 写表、使用 Kafka RPC 或 2PC。
- 契约校验通过：377 operations、536 OpenAPI schemas、154 events、104 event payload schemas、7 AsyncAPI channels、21 AsyncAPI operations、13 JSON Schemas。

复现入口见 manifest 的 reliability、Saga、merge、generate、validate 与双不可变基线 compatibility 命令。
