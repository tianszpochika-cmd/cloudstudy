# 本地配置与 Feature Flag

配置分三层：

1. `.env.example` 只保存可公开的本地默认值和占位符；真实凭证通过未提交的 `.env`、运行环境 Secret 或部署平台注入。
2. `config/local-ports.json` 是本机固定端口唯一事实源；不得由 Agent 自动递增端口。
3. `config/feature-flags.json` 是当前 Phase 1 的默认旗标快照。安全、支付、AI 和未成年人能力默认关闭，业务代码必须 fail-closed。

变更 Feature Flag 必须同时记录操作者、时间、原因、影响范围和回滚值；生产环境不直接读取本地配置文件。
