# 运行与验证证据索引

本目录保存按日期、批次和运行环境形成的验证快照，不是需求、架构或当前配置的事实源。旧快照中的 Java 版本、依赖数量、认证方案、端口状态、契约计数和测试结果只说明当次运行，不得覆盖当前代码与配置。

dev 当前读取顺序：

1. [迭代 2 当前进度](../06-design/v2-980plus/redesign/CURRENT-PROGRESS.md) → [根交接](../../CURRENT-HANDOFF.md) → [R1 卡计划](../06-design/v2-980plus/redesign/dev-plan-R1.md)。
2. [当前架构](../02-architecture/v2-microservices-architecture.md)、[本地开发指南](local-development.md)及 `config/` / canonical 契约。
3. [2026-10-06 本机环境验证](local-environment-verification-2026-10-06.md)：只说明当次环境和测试范围，不改变 R1 卡验收。
4. 历史 P1R/B/G、`b36-validation.md`、56 页覆盖/三态台账及九月报告只作为复用/审计候选；不能代替本轮干净库与独立验收，也不构成当前开工队列。原读取顺序见[九月历史交接](../../CURRENT-HANDOFF-ARCHIVE-2026-09-28.md)。

带具体日期、runId 或 B 编号的报告应保持可审计，不为追随新口径而改写历史结果。若其中含已废弃的外部认证、五项必需依赖、旧契约计数或旧页面旅程，只能按历史快照解释；新开发和新验收必须引用当前权威入口。

## 历史快照清单

以下文件按类型罗列，**仅作可审计的历史记录**，其结论不构成当前状态。带日期的报告保持原样，不随口径更新而改写。

### 批次验证快照（B2–B36 与 G）

[b2-validation.md](b2-validation.md)、[b3-validation.md](b3-validation.md)、[b4-validation.md](b4-validation.md)、[b5-validation.md](b5-validation.md)、[b6-validation.md](b6-validation.md)、[b7-validation.md](b7-validation.md)、[b8-validation.md](b8-validation.md)、[b9-validation.md](b9-validation.md)、[b10-validation.md](b10-validation.md)、[b11-validation.md](b11-validation.md)、[b12-validation.md](b12-validation.md)、[b13-validation.md](b13-validation.md)、[b14-validation.md](b14-validation.md)、[b15-validation.md](b15-validation.md)、[b16-validation.md](b16-validation.md)、[b17-validation.md](b17-validation.md)、[b18-validation.md](b18-validation.md)、[b19-validation.md](b19-validation.md)、[b20-validation.md](b20-validation.md)、[b21-validation.md](b21-validation.md)、[b22-validation.md](b22-validation.md)、[b23-validation.md](b23-validation.md)、[b24-validation.md](b24-validation.md)、[b25-validation.md](b25-validation.md)、[b26-validation.md](b26-validation.md)、[b27-validation.md](b27-validation.md)、[b28-validation.md](b28-validation.md)、[b29-validation.md](b29-validation.md)、[b30-validation.md](b30-validation.md)、[b31-validation.md](b31-validation.md)、[b32-validation.md](b32-validation.md)、[b33-validation.md](b33-validation.md)、[b34-validation.md](b34-validation.md)、[b35-validation.md](b35-validation.md)、[b36-validation.md](b36-validation.md)、[g-gate-validation.md](g-gate-validation.md)。

### 本机与浏览器运行记录

- [local-runtime-smoke-2026-08-23.md](local-runtime-smoke-2026-08-23.md)：本机运行时冒烟记录。
- [local-runtime-verification-2026-09-21.md](local-runtime-verification-2026-09-21.md)：本机真实运行验证快照（T1–T21：多服务真实链路、运行期抓出的 17 项缺陷、未闭合项清单）。
- [browser-functional-test-2026-09-22.md](browser-functional-test-2026-09-22.md)：真实浏览器功能测试与全栈启动（4 前端 36 页；抓出权限命名前后端不一致与工单列表 500 两项缺陷；含 Docker 打包结果与测试账号说明）。
- [local-real-data-browser-full-test-2026-08-26.md](local-real-data-browser-full-test-2026-08-26.md)：真实数据浏览器全量测试。
- [web-h5-browser-test-report-2026-08-23.md](web-h5-browser-test-report-2026-08-23.md)：Web/H5 浏览器测试报告。
- [test-phase-handoff-2026-08-22.md](test-phase-handoff-2026-08-22.md)：测试阶段交接记录。
- [auth-jwt-local-validation-2026-08-27.md](auth-jwt-local-validation-2026-08-27.md)：认证/JWT 本机验证记录。

### 主题运行文档（非快照，仍按当时口径解释）

- [local-development.md](local-development.md)：本地开发与启动说明。
- [local-real-10x-fixture.md](local-real-10x-fixture.md)：本机 10x 夹具说明。
- [deployment.md](deployment.md)：部署说明。
- [observability.md](observability.md)：可观测性接入说明。
- [incident-runbook.md](incident-runbook.md)：故障处置手册。
- [analytics-ingress.md](analytics-ingress.md)：分析数据入口说明。
- [b30-b36-evidence-index.md](b30-b36-evidence-index.md)：B30–B36 证据索引。
- [p1r-m1-017-audit-export.md](p1r-m1-017-audit-export.md)：P1R M1-017 审计导出记录。
