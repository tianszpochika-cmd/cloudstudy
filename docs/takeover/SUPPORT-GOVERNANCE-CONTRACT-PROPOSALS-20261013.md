# 契约提案（未改 packages/contracts）— support / governance / recovery

## 1. Support ticket view（admin ops）

在既有 ticket 读模型上增加只读字段（响应已额外返回，schema 若 `additionalProperties:false` 需放行）：

```json
{
  "actionable": { "type": "boolean", "readOnly": true },
  "attachmentCount": { "type": "integer", "minimum": 0, "readOnly": true },
  "workflowVersion": { "type": "string", "enum": ["LEGACY_HASH_ONLY", "VERIFIED_CONTENT_V1"] },
  "unavailableReason": { "type": ["string", "null"], "readOnly": true, "description": "中文不可用原因，仅 actionable=false 时出现" },
  "version": { "type": "integer", "minimum": 0 }
}
```

错误码保持：`SUPPORT_CONTENT_REFERENCE_UNAVAILABLE`（503，无附件创建/流转）。

## 2. Manual recovery execute

`RecoveryView` 增加可选：

```json
{
  "effectDetail": { "type": ["string", "null"], "readOnly": true, "description": "副作用摘要，例如 support_ticket -> IN_PROGRESS" },
  "failureMessage": { "type": ["string", "null"], "readOnly": true }
}
```

## 3. IT-7 closure board

board 已有 `dispositionOpen` / `writeSwitch` / `dispositionButtons`；提案明确语义：

- `writeSwitch`: `FROZEN` | `OPEN`
- `dispositionOpen`: boolean（与配置 `adminops.it7.disposition-open` 对齐）
- 当 `OPEN` 时，`TRIAGE` / `ISOLATE` / `ESCALATE` / `CLOSE` 成功响应携带更新后的 `status` / `disposition`

案件状态枚举提案：`FILED` | `TRIAGED` | `ISOLATED` | `ESCALATED` | `CLOSED`  
处置枚举提案：`NOT_STARTED` | `IN_TRIAGE` | `CONTAINED` | `HANDED_OFF` | `DONE`

## 4. Policy mutations

网关 / IAM 路径本已在契约中（submit / approvals / activate）。本轮无请求体字段变更；UI 使用既有 `expectedRevision` + reason 字段。
