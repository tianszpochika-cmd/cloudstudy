# 运行边界

本 Evidence 只证明仓库中的 policy、OpenAPI、事件治理、生成物、兼容投影、失败关闭 checker 与静态测试。运行状态固定为 `NOT_RUNTIME_VERIFIED`。

`config/b26-event-runtime.json` 保持 `mode=static-only`、`runtimeStatus=pending`、`defaultDecision=NO-GO`；`runtimeEvidence=null`，静态或合成证据均不能晋升运行态。

真实 schema/grant/migration/transaction/Outbox 属于 M2-004；Kafka broker/topic/ACL、consumer、DLQ/replay 属于 M2-005；Saga、补偿与人工恢复属于 M2-006。M5-013、M7、M8 与 M0-006 的责任和阻塞均未被本任务关闭。
