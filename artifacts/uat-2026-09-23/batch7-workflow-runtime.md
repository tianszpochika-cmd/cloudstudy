# 第七批工作流权限与补偿边界运行回归（2026-09-23）

## 换包与数据保护

本批仅更新 `workflow-service` JAR；另外 15 个 Java 服务由本任务的本地 runner 随组短暂停启，五个 Docker 基础设施容器和四个前端开发进程未停止。迁移前导出整个 `workflow_service` schema 到 `C:\Temp\cloudstudy-uat-db-backup-20260923-batch7\workflow-before.sql`（298,304 字节，SHA-256 `3A8D99AA99ADF78AADEFC9AB656FBF20C30C1602ACE64187D845140DE60C272C`），旧工作流 JAR 另存 `C:\Temp\cloudstudy-workflow-before-batch7.jar`（SHA-256 `B95773AF8226D6571A90A2398EAECE31E98C64DE34CBF0F763B50C0CDC147888`）。

本地 owner 迁移预检显示仅 V2 待应用、V1 校验和无漂移；使用独立管理迁移脚本应用 V2 后，`p1r_schema_history` 为 V1/V2，`workflow_request_idempotency` 表存在。运行凭据维持 DML 范围。最终 JAR SHA-256 为 `80D3FF49170753496389484DEEB8D349171AB90450294A6EC394904E108440A0`；本任务 runner 重新报告 16/16 Java 服务就绪。

## 已验证的修复

- 工作流服务从 IAM 已验证 JWT 的 `permissions` 列表建立 `PERM_` authority，按读取、申请、命令分别检查 `admin.recovery.read/request/command`，所有这些入口同时要求 `tenant_id=platform`；内部 Saga 启动仅接受 `workflow.saga.start`。匿名或不匹配权限默认拒绝。
- 第一次运行发现业务层的 400/404/409 异常被安全过滤链对 `/error` 的二次分派改写成 403。允许已检查过原始请求的 `ERROR` 分派进入标准错误响应后，错误码恢复为原始状态。该修复不放开新的业务 REQUEST 路径。
- [原始 Gateway/owner 检查](workflow-security-runtime.json)最终 **22/22 PASS**：合成成人 Gate 与同意；无权账号在 owner/Gateway 403；读、申请和命令权限隔离；匿名 401、缺键 400、未知 Saga 404；无 transport 的 Saga 留在 `COMPENSATION_FAILED`、步骤 `FAILED`；同键重放原响应，同键异 body/异 Saga ID 在 owner 和 Gateway 均 409。
- 每轮合成 Saga、步骤和持久幂等收据均按唯一 ID 精确清理；最后一轮清理 1 条 Saga、1 条步骤、1 条收据，账号设为 `DISABLED` 且有效会话 0。其他 Saga 和业务数据未动。`mvn -q -f services/workflow-service/pom.xml test` 通过，`node --check` 和定向 `git diff --check` 通过。
- B26 七条公开路由已声明与运行一致的精确权限；`pnpm contracts:merge:check`、`contracts:validate`、`contracts:generate:check` 通过。媒体上传授权失败关闭例外见[契约专项](media-upload-url-contract-boundary.md)。

## 仍未通过的业务边界

真实 owner 补偿缺稳定下游幂等键、步骤原子认领和 owner 回执，目前 transport 故意拒绝，不能将本地重放 PASS 解释为 Saga 业务补偿通过。正式 staff 权限发放流程未找到，本次权限测试用合成账号在本地 IAM 表临时授予再禁用；高风险撤权后的旧 JWT 窗口、策略版本检查和跨租户授权的 HTTP 正向矩阵仍需进一步取证。内部 Saga 启动未见 `workflow.saga.start` 的正式发放/Gateway 路由，服务 token 当前也不满足本入口的 `access` token 校验。

本批本地 JAR/数据库实测不代表 Docker 容器内迁移、权限或公网运行已经通过。
