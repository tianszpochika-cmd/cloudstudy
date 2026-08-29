# B28 本机真实运行验证

## 结论

B28 已于 2026-08-24 完成。运行证据为 `evidence/b28/b28-runtime-20260824121425.json`，由 `b28-runtime-probe` 产生，模式为 `local-real`，状态为 `PASS`。

本章实际完成了：

- Docker Compose 的 MySQL、Redis、Kafka、MinIO、IAM JWT 和兼容 RabbitMQ 健康检查；
- 23 个根迁移的真实 MySQL checksum/账本校验及 Phase 1 持久化数据写入校验；
- 11 个 owner schema、独立数据库账号和各自迁移表的真实对账；
- 从 MySQL owner row 重建 3 个 Redis 投影，并执行 TTL 与读回校验；
- 重启 MySQL 后重新检查迁移账本、持久化数据和服务依赖健康状态；
- B28 运行门禁 `runtimeStatus=PASS`、`runtimeEvidencePending=0`。

## 代码变更

- `scripts/database/lib/mysql-client.mjs`：主机 MySQL 客户端不存在时自动使用 Docker 内客户端，不改变数据库语义；
- `scripts/database/reconcile-owner-schemas.mjs`：创建本地 owner schema/账号、执行迁移，并对已完整落地 schema 做校验跳过；部分迁移会 fail-closed；
- `scripts/runtime/b28-runtime-probe.mjs`：串联工具链、基础设施、迁移、owner 对账、Redis 重建和重启读回，生成运行证据；
- `database/mysql/seeds/dev/V0023__b25-phase1.sql`：固定本地连接的 utf8mb4 collation，修复 MySQL 8 默认 collation 与测试数据变量比较冲突。

## 未包含

B28 不代表 14 个 Java 进程已经全部 readiness，也不代表注册/登录、Gateway 业务路由或四端页面交互已经完成；这些属于 B29–B34 的后续门禁。
