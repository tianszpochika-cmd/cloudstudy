# P1R-M1-017 audit-service 审计导出契约

本文件描述 E3 提供的独立 canonical OpenAPI source。为避免与 E2 同时编辑 `packages/contracts/fragments/b13/b13-commerce-admin-analytics.openapi.json`，本轨道只维护 `packages/contracts/fragments/m1-017-audit-export.openapi.json`、policy 和失败关闭测试；现有 contract merge 会拾取该独立 source，统筹 Agent 负责统一生成 canonical outputs、AsyncAPI/Gateway/compatibility 和 Evidence。

## owner 与暴露边界

- `audit-service` 是审计记录与导出任务的唯一 owner；`audit-service` 不具备 public route eligibility。
- 对外 admin 页面只能经 `admin-ops-service` projection；四个补丁路径全部是 `/internal/v1`，Gateway 对外暴露必须保持 DENY。
- `workflow-service` 只负责重试、恢复与 receipt；不得写 audit-service 之外的领域表，也不得改变原始审计事实。
- 账号、租户、主体、角色、权限、状态、审计 ID 和下载过期时间均由服务端/工作负载身份派生；客户端 authority 为 `NONE`。

## 补丁路径

| Method | Path | Permission | 作用 |
|---|---|---|---|
| POST | `/internal/v1/audit/exports` | `audit.export.create` | 创建异步脱敏导出任务 |
| GET | `/internal/v1/audit/exports/{exportId}` | `audit.export.read` | 查询服务端派生状态与 recovery receipt |
| POST | `/internal/v1/audit/exports/{exportId}/download` | `audit.export.download` | 签发一次性短时 `grantRef`，不返回 token/永久 URL |
| POST | `/internal/v1/audit/exports/{exportId}/recovery` | `audit.export.recover` | workflow-only retry/rebuild/revoke receipt |

请求 schema 必须 closed；创建请求仅允许时间窗口、结构化 scope、事件族、格式和 `approvalRef`。不得出现 `tenantId`、`subjectId`、`ownerId`、`role`、`permissions`、`status`、`state`、`priority`、`assignment`、`SLA` 或原始内容字段。

## 导出、脱敏与不可变审计

导出状态为 `REQUESTED/PROCESSING/READY/RETRY_SCHEDULED/FAILED_RETRYABLE/FAILED_FINAL/EXPIRED/REVOKED`，状态、tenant scope、attempt、expiry 和 download availability 只能由 owner 返回。导出副本过期后删除，过期下载必须 DENY；下载回执只含 `grantRef`、内容 digest、expiry、one-time、redacted 和审计引用。

审计记录 append-only、hash-chained，仅保留主体/租户 hash、resource reference、decision、reason code、request/trace/command/event ID、时间和前后摘要 hash。密码、Token、支付凭证、原始音频、raw body、自由文本、下载 URL 和任何原始导出内容禁止进入审计或响应。

重试预算为最多 5 次（含首次）；超预算、法律保全和 policy deny 进入最终失败。所有 retry/rebuild/revoke 必须返回 receipt，并声明 `domainFactsUntouched=true`。真实数据库、短时下载、Kafka、workflow、PEP、浏览器和跨服务 Evidence 不在本补丁范围，仍保持 `NOT_RUNTIME_VERIFIED`，由 M2/M6/M8 验收。

机器可读 source：`packages/contracts/fragments/m1-017-audit-export.openapi.json`；policy：`config/p1r-m1-017-audit-export.v1.json`；失败关闭测试：`tests/p1r/m1-017/p1r-m1-017-audit-export.test.mjs`。
