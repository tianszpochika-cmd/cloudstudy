# PAGE-P1-ADMIN-AUDIT 审计导出 404 独立复核

日期：2026-09-23。范围：契约、Gateway、Admin Web、admin-ops-service、audit-service 的当前工作树源码、聚焦测试和运行容器内构件。本轮不修改服务、数据库或契约，不启停进程、不构建 Docker。已确认当前运行构件包含 503 失败关闭代码；尚无带正式授权身份的浏览器/Gateway HTTP 复测。

## 404 的当前状态

此前 [admin-gap](admin-gap.md) 记录：Admin Web 通过通用 `/api/v1/admin/ops/commands` 提交 `SUPPORT/audit-export/AUDIT_EXPORT`，admin-ops 在 SUPPORT 投影表找不到 `audit-export`，返回 `ADMIN_RESOURCE_NOT_FOUND` 404。这条通用命令没有创建 audit-service 导出任务。

当前工作树已有失败关闭调整：[AdminOpsService](../../services/admin-ops-service/src/main/java/com/englishflow/adminops/application/AdminOpsService.java) 在权限检查后、投影查询及任何命令转发前对 `AUDIT_EXPORT` 返回 `ADMIN_AUDIT_EXPORT_UNAVAILABLE` 503；[AdminAuditView](../../apps/admin-web/src/views/AdminAuditView.vue) 的导出按钮显示“导出暂不可用”且禁用。这样避免了误报“资源不存在”以及虚假的导出成功，但**导出功能仍未实现**。现有 [AdminAuditExportFailClosedTest](../../services/admin-ops-service/src/test/java/com/englishflow/adminops/application/AdminAuditExportFailClosedTest.java) 验证读权限与导出权限分离、未转发命令、未追加虚假审计和 503 结果。

**batch12 运行镜像核对：** 当前 UAT 容器中，admin-web、admin-ops-service、audit-service 实际仍使用 `583ab627-uat-batch9-202609231740` 镜像；batch12 只更新了 mobile H5 与 learner Web。只读提取运行中 admin-ops JAR 的 `AdminOpsService.class`，其 SHA-256 为 `fcaa646c4924e3397219ae8bcacfb3a1874b033c6f5eab0b1d2c5162d2548397`，与本轮测试编译的本地 class **字节一致**，包含 `ADMIN_AUDIT_EXPORT_UNAVAILABLE`。运行中 audit-service JAR 的 `AuditExportUnavailableController.class` SHA-256 为 `958b69aaf591dd4c9fc0e71ff1cf3bd4aeb00a92561d05c477892d96027e8344`，也与本地编译类字节一致。admin-web 容器静态资源包含“导出暂不可用”。因此当前镜像层面已具备失败关闭，而非仅本地源码；这不等同于授权 HTTP 实测或导出功能可用。

## 为什么不能把旧命令接到审计服务

1. [M1-017 OpenAPI](../../packages/contracts/fragments/m1-017-audit-export.openapi.json) 的四个导出操作只在 `/internal/v1/audit/exports`，明确 `externalExposure=DENY`、`clientAuthority=NONE`、`runtimeStatus=NOT_RUNTIME_VERIFIED`；[policy](../../config/p1r-m1-017-audit-export.v1.json) 也禁止直接公开 audit-service 和提升旧 `/api/v1/admin/audit-logs/export`。Gateway 目前仅有 admin-ops 审计**列表** GET 和通用命令 POST，没有独立审计导出外部路由。[GatewayRouteExecutionPolicy](../../services/api-gateway/src/main/java/com/englishflow/gateway/policy/GatewayRouteExecutionPolicy.java)
2. 通用 [CommandRequest](../../services/admin-ops-service/src/main/java/com/englishflow/adminops/domain/CommandRequest.java) 只接受少量操作属性，不包含 M1-017 创建请求必填的 `windowStart/windowEnd/scope/eventFamilies/format/approvalRef`。`AUDIT_EXPORT` 被暂列在 SUPPORT domain 不能充当正式 audit-service owner 编排；伪造一个 SUPPORT 投影只能绕开 404，无法提供审批、授权范围或审计任务事实。
3. [audit-service 导出控制器](../../services/audit-service/src/main/java/com/englishflow/audit/adapter/http/AuditExportUnavailableController.java) 当前只验证服务 JWT 的调用方、租户和操作权限，随后返回 503；没有创建、查询、下载或恢复作业。现有 [schema](../../services/audit-service/src/main/resources/db/migration/V1__create_audit_service_schema.sql) 为追加审计事实、摄取回执及 legal hold，没有导出任务、脱敏副本、短时 grant 或一次性消费表。
4. [业务设计 §9](../../docs/06-design/v2-980plus/phase1-business-operation/05-后台内容运营与客服业务流程.md) 要求大规模导出有审批、字段 allow-list、脱敏、异步任务、短时下载和下载审计。当前缺少 admin-ops 对外创建/状态/下载契约及其用户 PEP、审批引用验证与职责分离规则、由 admin-ops 获取 IAM 服务身份并调用 audit-service 的适配、导出副本过期与一次性下载实际实现、失败恢复和端到端证据。直接重用通用命令或暴露 internal URL 会绕过这些要求。

因此本轮**不新增外部导出路由，也不把 503 改为假 202**。下一纵切应先冻结 admin-ops 外部契约和审批决策，再实现服务间身份、audit owner 的持久异步任务/脱敏与下载机制、workflow receipt，最后通过 Gateway 和浏览器验证。管理端只读审计列表与审计导出是两条不同链路；列表正常不能作为导出验收。

## 聚焦验证

| 验证 | 结果 | 范围 |
| --- | --- | --- |
| `node --test tests/p1r/m1-017/p1r-m1-017-audit-export.test.mjs` | 4/4 PASS | internal-only、请求/响应 closed schema、禁止公开路径/客户端 authority 及对抗性 mutation；属于静态契约证据。 |
| `mvn -q -pl services/admin-ops-service,services/audit-service -Dtest=AdminAuditExportFailClosedTest,AuditExportUnavailableControllerTest -Dsurefire.failIfNoSpecifiedTests=false test`（同进程 `TEMP/TMP=C:\Temp`） | 2 suites、6 tests、0 failures、0 errors、0 skipped | admin-ops 的 503 失败关闭与 audit-service 内部 401/403/400/503 边界；无真实作业或下载。 |

当前运行构件已把旧 404 对应的代码路径变为准确的失败关闭，并未满足 PAGE-P1-ADMIN-AUDIT 的导出验收。仍需用授权 Gateway/UI 请求核验实际 HTTP 响应；不能用这两组测试或镜像字节比对声称真实导出可用。

镜像核对曾将只读 JAR 副本保存为 `C:\Temp\cloudstudy-admin-ops-inspect-20260923.jar` 与 `C:\Temp\cloudstudy-audit-inspect-20260923.jar`。对这两个**精确路径**执行删除时，自动审批审查拒绝命令，仅给出 `blocked by policy`；副本仍留在 `C:\Temp`。本轮不再尝试删除或绕过该阻止。
