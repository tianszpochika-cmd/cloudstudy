# 管理端审计导出验收缺口

范围：`PAGE-P1-ADMIN-AUDIT`、`J13.5`、`P1R-M1-017`、`P1R-M6-009`。结论：审计列表 `PARTIAL`；审计导出 `BLOCKED`，不能记为人工验收通过。

## 实际行为与修复

- 既有管理端“创建脱敏导出”将 `AUDIT_EXPORT` 作为 `SUPPORT` 通用命令交给 `admin-ops-service`。成功响应只代表管理命令写入转发队列；其目标服务仍是 `admin-ops-service`。它未创建 `audit-service` 的任务、未产生导出文件、状态或一次性下载授权，因此旧成功提示不真实。
- 当前 `audit-service` 仅实现 `/internal/v1/audit/events` 摄取及 append-only 事实表。M1-017 的四条内部导出接口属于 `D2_CONTRACT_READY / NOT_RUNTIME_VERIFIED`；Gateway 不允许浏览器直接调用。
- 本轮移除了浏览器的假导出命令入口，页面显示禁用的“导出暂不可用”；`admin-ops-service` 对直接提交的 `AUDIT_EXPORT` 准备和执行均返回 `503 ADMIN_AUDIT_EXPORT_UNAVAILABLE`，且不写转发命令或假审计回执。
- 只读审计页面要求 `admin.audit.read`，既有服务却要求 `audit.export`。本轮将 `admin-ops-service` 的审计列表与支持审计快照权限改为 `admin.audit.read`，继续按已验证主体和租户过滤；导出权限仍单独为 `audit.export`。
- B13 管理命令和准备命令的 OpenAPI source/canonical 响应补充 `503 ApiServiceUnavailable`，与失败关闭响应一致。

## 验证

- `mvn -q -f services/admin-ops-service/pom.xml -Dtest=AdminAuditExportFailClosedTest test`：通过。测试覆盖读/导出权限分离、假任务请求 503、无转发及无审计伪回执。
- `TEMP=TMP=C:\Temp` 下 `mvn -q -f services/admin-ops-service/pom.xml test`：65 tests，0 failures，0 errors，2 skipped。首次未设置临时目录时，JWKS 测试的本机 loopback 初始化失败；设置后复跑通过。
- 只读查询本地 IAM 测试数据：两条 `test-caud-%@local.invalid` 合成审计账号均含 `auditor` 角色和 `admin.audit.read` 权限，且保有独立的 `audit.export` 权限；未读取账号密码或 Token。
- `pnpm --filter @englishflow/admin-web build`：Vue 类型检查和 Vite build 通过；`test:b12` 2/2 通过；相关 `git diff --check` 通过。
- `pnpm contracts:merge:check` 仍提示 canonical merge drift；`pnpm contracts:generate:check` 在未关联的 IAM account-deletions `x-idempotency` 处失败。两条 B13 命令的 source 与 canonical 响应码已逐条核对一致，但全量契约检查尚未通过。
- 共享 Java 服务占用原 `target` JAR，直接 `package` 无法覆盖该运行文件；在独立临时目录成功生成 Boot JAR：`C:\Temp\cloudstudy-uat-admin-ops-20260923094831\target\admin-ops-service-0.1.0-SNAPSHOT.jar`，SHA-256 `2DA5F5A9EF951FEE5653C11C9E6908B5D2F6FA702C218204A0F66A6805A21B6C`。
- 本轮未重启共享 Java 服务、未更换 Docker 镜像；运行中的旧包仍需随下一批一起更新。未取得审计角色登录后的浏览器导出 E2E 证据。

## 后续闭环

在 `audit-service` 由其独立 schema 持久化导出任务及脱敏副本，完成服务端权限/目的/审批/范围验证、异步处理、状态与失败恢复、过期和一次性短时下载授权、完整不可变审计；由 `admin-ops-service` 建设受控外部投影和命令入口，再经 Gateway 与管理端接入。必须补充同租户成功、越权/跨租户拒绝、下载重放/过期、脱敏扫描及故障恢复的运行证据后，才能重新启用按钮。
