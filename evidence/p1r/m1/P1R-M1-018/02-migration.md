# 迁移与兼容证据

- 历史 CI 契约基线固定为 `463c4b238caceb1592bff6c61327c00ab9bac922`，immutable governance 固定为 `868c2177f62b6d2cf613bed702686dddcfe6943f`。
- M1-018 的 source-bound 基线固定为 `97497afe1f31703601d1491c8d47d00121c90089`；两组 Git compatibility 对 OpenAPI/events/schema 均返回 compatible，breaking changes 为空。
- 迁移政策、owner 隔离、Gateway 无业务 schema/write、Redis 静态命名空间和历史候选映射通过固定检查。
- 本任务没有创建真实 schema、grant、topic、ACL、consumer group 或工作流实例；这些由 M2 运行任务验证。
