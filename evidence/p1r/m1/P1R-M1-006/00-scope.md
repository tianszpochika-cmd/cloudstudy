# P1R-M1-006 范围

- 结论：`ACCEPTED`
- 最终源码：`3e4ba856742f28ba9d3fc4a3264c4b24c1cafc5a`
- 历史契约基线：`463c4b238caceb1592bff6c61327c00ab9bac922`
- 事件治理冻结基线：`868c2177f62b6d2cf613bed702686dddcfe6943f`
- 独立评审：`agent:m1_005_independent_review:gpt-5.6-luna:max`

本任务统一 Phase 1 事件目录、producer/data owner、consumer group、Kafka topic、聚合分区键、payload/schemaVersion、AsyncAPI send/receive/Kafka binding 和兼容策略，并提供失败关闭的静态门禁。

本任务不实现或证明 Kafka、Outbox、consumer、ACL、DLQ、回放、Saga 或补偿的运行态。所有运行结论保持 `NOT_RUNTIME_VERIFIED`。
