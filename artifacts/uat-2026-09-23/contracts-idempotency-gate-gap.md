# 写接口幂等契约门禁核对

## 已修复的源代码与专属契约

| 操作 | owner 实现 | 幂等保证 |
| --- | --- | --- |
| `verifyAssessmentMistake`、`issueAssessmentVariant` | `assessment-service` 复用 `assessment_idempotency`，在 `@Transactional` 内先按租户、主体、操作、key 原子 claim，锁定错题行，再保存状态和原响应 | 同键同请求返回首次响应，不重复推进 D0/D1/D7 或 variant；同键异请求/异错题 ID 返回 409 |
| `requestWorkflowRecovery`、`approveWorkflowRecovery`、`rejectWorkflowRecovery`、`executeWorkflowRecovery` | `workflow-service` 新增 `workflow_request_idempotency` 和事务封装，原请求、审批状态、执行回执与响应快照在本地同事务；按恢复单 `FOR UPDATE` 串行化状态迁移 | 同键同请求返回首次响应；同键异请求/异恢复单 ID 返回 409；缺失/非法 key 400，错租户 403 |

两组都以 `Idempotency-Key` 为必填入参，专属 OpenAPI fragment 已同步真实 `x-idempotency`、请求头及 409 响应。管理恢复创建请求只接受约定字段并要求 `reason`，审批/执行只接受空 JSON 体，拒绝只接受可选 `reason`；原始请求体参与摘要，同键改体返回 409。管理端 `apps/admin-web/src/api/recovery.ts` 原本已发送 key，无需改客户端。四条管理恢复公共路径已有 Gateway 到 workflow-service 内部路径的精确 rewrite，本轮未改 Gateway。

## 当前仍未关闭的七项

| 操作 | 当前事实 | owner 下一步 |
| --- | --- | --- |
| `compensateWorkflowSaga` | Saga 补偿可调用外部 owner，当前 transport 明确拒绝但仍会改变本地失败状态；同键重试无法返回原响应，跨 owner 原子提交不可用 | workflow-service 建持久命令/回执及 owner 级补偿去重，明确失败响应重放，再加 key 与契约 |
| `validateB9ContentAuto` | content-service 的 POST 实为只读校验，但返回实时 `checkedAt` 且没有 key/响应快照；同体重放并非原响应 | content-service 选择稳定 GET 语义并同步客户端/契约，或持久化 key+请求摘要+报告快照与 409 冲突 |
| `registerMediaAsset` | media-service 虽有 key、指纹和持久 receipt，但资产写、receipt 写和事件发布没有共同事务；崩溃窗口及多实例并发未证实 | media-service 使资产+receipt+outbox 原子提交并加并发/重启测试，再声明完整幂等 |
| `retryMediaAsset` | Controller 要求 key，实际只检查非空；失败状态变为队列后同键重放可能返回 409 | media-service 持久保存请求摘要与原响应，重放先于状态迁移处理 |
| `upsertMediaSubtitle` | 无 key；同键异字幕内容可能覆盖已有内容 | media-service 加 owner 持久 key、摘要、原响应及冲突测试 |
| `mintMediaUploadUrl` | 无 key；每次可重新签发短时 URL/授权 | media-service 明确 grant 生命周期和过期语义，保存同键原 grant、异体冲突，验证重放/过期 |
| `activateMediaAsset` | 无 key；状态推进/版本可能改变，异体请求没有 key 级冲突 | media-service 加持久幂等与状态版本约束、原响应快照 |

不为上述七项添加仅用于通过校验的 `x-idempotency`。另有独立安全缺口：workflow-service 当前资源服务器只验证 access JWT，人工恢复接口没有服务侧管理权限 PEP；本轮未凭空定义 IAM 权限，也不能把幂等修复当作管理恢复功能验收通过。

## 验证与集成界线

- `mvn -q -f services/assessment-service/pom.xml test`：78 tests，0 failures，0 errors，2 skipped。新 `B10MistakeIdempotencyTest` 2/2 通过。
- `mvn -q -f services/workflow-service/pom.xml test`：55 tests，0 failures，0 errors，13 skipped。新 `WorkflowRequestIdempotencyTest` 3/3 通过。
- B10、B26 专属 fragment 的 JSON 解析与幂等请求头/响应声明检查通过；相关 `git diff --check` 通过。
- 主 Agent 已将 B10/B26 专属 fragment 与 M1-017 审计内部路径同步至聚合 `packages/contracts/openapi/v1/openapi.json`；`pnpm contracts:merge` 与 `pnpm contracts:merge:check` 通过，28 OpenAPI / 20 event fragments。`pnpm contracts:validate` 仍在 Saga 补偿接口的 `x-idempotency` 处失败，剩余为上表七条，因此不能作为发布门禁通过证据。
- workflow-service 的 V2 Flyway migration 和两项 owner 实现均未部署到正在运行的 Docker；上述验证是源码/单元层，尚无真实 MySQL 并发、重启或浏览器 E2E 证据。
