# P1R-M1-017 隐私导出与账号删除 D2 契约

> 本文是 `P1R-M1-017` 的专属 D2 source fragment 说明。它冻结接口、状态、权限与恢复边界，不构成数据库、Kafka、工作流、浏览器或 E2E 运行证据。

## 事实 owner 与边界

- `learner-service.privacy` 是隐私导出 request、status、expiry、短时下载 grant 和 export receipt 的唯一事实 owner。
- `iam-service` 是账号删除 request、168 小时冷静期、撤回、执行、会话/设备撤销和主体最终状态的唯一事实 owner。
- `workflow-service` 只编排 owner-local command、重试、DLQ、对账和人工恢复任务，不能跨 schema 修改任何领域事实。
- 每个领域 owner 必须先判定 legal hold，再在自己的事实边界删除、匿名化或最小化保留，并提交版本化 receipt。未知 legal hold 一律拒绝执行。

## 隐私导出

公开入口是 `createM1017PrivacyExport`、`getM1017PrivacyExportStatus`、`createM1017PrivacyExportDownloadGrant` 与 `getM1017PrivacyExportReceipt`。请求只能由已验证主体在二次认证后发起；主体、租户、owner、状态、过期时间、policy 版本和 receipt 都由服务端派生。

导出状态严格为：

```text
REQUESTED → COLLECTING → ASSEMBLING → READY → DOWNLOAD_ISSUED → EXPIRED
     └──────────────────────────────→ FAILED → RECOVERY_REQUIRED
RECOVERY_REQUIRED → COLLECTING | EXPIRED
```

下载 grant 必须一次性、短时、`Cache-Control: no-store`，且不得写入普通事件、日志或审计正文。导出 receipt 只允许显示最小化的 owner、digest、legal-hold 决定和完成时间；不含导出原文。

## 账号删除

公开入口是 `createM1017AccountDeletionRequest`、`getM1017AccountDeletionStatus` 和 `cancelM1017AccountDeletionRequest`；`executeM1017AccountDeletion`、owner receipt 与 recovery 仅能由受信任 workload 调用。

```text
PENDING_COOLING_OFF --(168 小时后)--> EXECUTING --> ANONYMIZED
          └--(二次认证撤回)---------> CANCELLED
EXECUTING --> RECOVERY_REQUIRED --> EXECUTING
```

`ANONYMIZED` 前必须撤销全部会话、refresh family、设备与 access JTI，并对每个预期 owner 的 receipt 完成对账。任何失败或不一致都进入 `RECOVERY_REQUIRED`；已经成功的 owner receipt 不得因为重试而重复执行。法律要求保留的记录必须匿名化/最小化并以 `RETAINED_LEGAL_HOLD` receipt 表达，不能以 Redis TTL、缓存清理或仅禁用登录替代删除。

## 失败关闭与后续集成

所有 public request schema 都拒绝 `subjectId`、`tenantId`、`owner*`、`status/state`、`executeAt`、`legalHoldDecision`、session-revocation 和 receipt authority 字段。内部 owner receipt 也从 workload identity 派生 owner/tenant，而不是信任 body。

E1 不生成或修改 event fragment、event catalog、AsyncAPI 或 B26。统筹轨道负责将 `EVENT-GAP-BIND-PRIV-001` 和 `EVENT-GAP-USR-DEL-001` 投影到 canonical event governance。真实 owner schema/事务、Outbox/Kafka、Saga、恢复、浏览器和 `E2E-P1-PRIVACY/RECOVERY` 分别由 M2、M6 与 M8 验收。
