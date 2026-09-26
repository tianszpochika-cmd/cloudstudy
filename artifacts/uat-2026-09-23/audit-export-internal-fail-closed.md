# P1R-M1-017 审计导出内部边界：安全失败关闭

## 本轮结论

管理端审计导出仍为 **BLOCKED**。本轮仅让 `audit-service` 的四条 M1-017 内部契约路径具备可验证的拒绝行为；没有创建导出任务、脱敏副本、下载授权或审计回执，也没有启用管理端按钮。源契约仍标记 `D2_CONTRACT_READY / NOT_RUNTIME_VERIFIED`。

| 内部路径 | 允许的已验证服务身份 | 所需权限 | 目前通过校验后的结果 |
| --- | --- | --- | --- |
| `POST /internal/v1/audit/exports` | `admin-ops-service`、`workflow-service` | `audit.export.create` | `503 SERVICE_UNAVAILABLE` |
| `GET /internal/v1/audit/exports/{exportId}` | 同上 | `audit.export.read` | `503 SERVICE_UNAVAILABLE` |
| `POST /internal/v1/audit/exports/{exportId}/download` | 同上 | `audit.export.download` | `503 SERVICE_UNAVAILABLE` |
| `POST /internal/v1/audit/exports/{exportId}/recovery` | `workflow-service` | `audit.export.recover` | `503 SERVICE_UNAVAILABLE` |

入口只接受 Spring Security 已验证的服务 JWT，要求 `token_type=service`、`sub=service_id=client_id`、`tenant_id=platform`、指定服务白名单和精确 `permissions` claim。访问令牌、错误服务、错租户或缺权限返回 401/403；写请求必须带长度 8–128 的 `Idempotency-Key`，路径 ID 必须符合契约格式，格式错误返回 400。所有控制器错误响应使用标准 `ApiErrorEnvelope`、`X-Request-Id` / `X-Trace-Id` / `X-API-Version` 和 `Cache-Control: no-store`，不返回任务 ID、授权引用、URL 或源数据。此处校验幂等键格式，但没有持久任务，因此不宣称幂等重放、CAS 或状态查询已实现。

审计导出专属 OpenAPI fragment 为缺少的 400/503 响应补齐声明。按集成边界，本轮没有修改聚合 `openapi.json`、Gateway 策略、IAM 服务客户端配置或管理端。四条路径继续保持 `internal`，**无可加入 Gateway 的浏览器直达路由**。现有 IAM 服务客户端尚未配置上述四种导出权限，因此当前运行配置下没有真实服务身份可以创建导出任务。

## 验证

- `mvn -q -f services/audit-service/pom.xml -Dtest=AuditExportUnavailableControllerTest test`：首轮 4 tests，0 failures；随后增加追踪头一致性测试并通过全套测试。MockMvc 覆盖四条路由、无 Token、用户 Token、错身份/租户/权限、恢复专用身份、错误幂等键和路径、无虚假任务/授权内容。
- `mvn -q -f services/audit-service/pom.xml test`：27 tests，0 failures，0 errors，1 skipped（既有 Flyway migration 测试）。
- `node --test --test-reporter=dot tests/p1r/m1-017/p1r-m1-017-audit-export.test.mjs`：4 tests 通过。
- 专属 fragment JSON 解析及四条操作的 503/权限映射通过；相关 `git diff --check` 通过。
- 没有重启共享服务或 Docker；运行中的镜像/服务尚未包含这次变更。

## 使真实导出可用的依赖

1. 定义并接入由服务端验证的审批事实和导出目的策略；现有 `approvalRef` 字符串不可直接当作审批通过证据。
2. 建立 `audit-service` 自有导出任务、幂等请求摘要、版本化状态迁移和真实审计事实；失败/下载/恢复必须有不可变、可关联的审计记录。
3. 明确跨 owner 审计源记录投影与可导出字段清单；落实脱敏扫描、租户范围、法务保全、加密对象存储及副本过期删除。现有摄取表和契约不足以推断可导出的完整数据集。
4. 完成异步工作流、有限次数重试、CAS 恢复；下载需要服务端签发和消费短时一次性授权，重放与过期必须拒绝。没有这些客体时不得返回成功或模拟下载。
5. 在 IAM 为经过授权的 `admin-ops-service` / `workflow-service` 配置精确导出权限；由 `admin-ops-service` 建受控浏览器投影，再补相应 Gateway 公共路由。最后以真实管理员同租户成功、越权拒绝、脱敏结果、过期/重放和故障恢复 E2E 才能解除管理端禁用状态。
