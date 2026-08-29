# 运行与验证证据索引

本目录保存按日期、批次和运行环境形成的验证快照，不是需求、架构或当前配置的事实源。旧快照中的 Java 版本、依赖数量、认证方案、端口状态、契约计数和测试结果只说明当次运行，不得覆盖当前代码与配置。

当前读取顺序：

1. 当前需求与设计：[`../06-design/v2-980plus/README.md`](../06-design/v2-980plus/README.md)。
2. 当前架构：[`../02-architecture/v2-microservices-architecture.md`](../02-architecture/v2-microservices-architecture.md)。
3. 当前本机验收台账：[`../../requirements/backlog/v2-B28plus-Phase1-本机真实全栈与MCP浏览器验收任务基线.md`](../../requirements/backlog/v2-B28plus-Phase1-本机真实全栈与MCP浏览器验收任务基线.md)。
4. 当前本机交接结论：[`b36-validation.md`](b36-validation.md)，仍为 `LOCAL-TEST-NO-PASS`。
5. 当前发布门禁：[`../../requirements/backlog/G0-G4-治理门禁任务基线.md`](../../requirements/backlog/G0-G4-治理门禁任务基线.md)，仍为 `BLOCKED/NO-GO`。
6. 当前机器配置只从 `config/`、固定端口表、契约 canonical 文件和实际检查命令读取；不得从旧 validation 报告反推。

带具体日期、runId 或 B 编号的报告应保持可审计，不为追随新口径而改写历史结果。若其中含已废弃的外部认证、五项必需依赖、旧契约计数或旧页面旅程，只能按历史快照解释；新开发和新验收必须引用当前权威入口。
