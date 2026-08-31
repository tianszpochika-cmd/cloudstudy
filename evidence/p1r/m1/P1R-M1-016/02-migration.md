# 迁移与兼容证据

- B12 是通知 canonical family；B11 通知、B5 learner support、B13 admin support 的 v1 操作和事件仅作 historical adapter/input。
- B13 historical create adapter 继续 deprecated，但已精确绑定 `admin-ops-service.support` owner、`support.ticket.create.self`、服务端可信身份和闭合的 M1016 请求；客户端 priority 注入被拒绝。
- source-bound compatibility 固定来源基线 `878f9ebc0591844467ac79facf4f00296058137f`、历史 CI 基线 `463c4b238caceb1592bff6c61327c00ab9bac922` 与 immutable governance `868c2177f62b6d2cf613bed702686dddcfe6943f`。
- 两条固定 Git compatibility 均报告 OpenAPI/events/schema compatible，`breakingChanges=[]`，且 M1-016 projection 为唯一允许的增量。
- 本任务没有迁移运行数据、创建数据库或 Kafka 资源，也没有切换真实通知/客服流量；这些迁移与回滚仍由 M2/M6/M8 验证。
