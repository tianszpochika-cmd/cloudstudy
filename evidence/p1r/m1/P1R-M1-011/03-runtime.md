# 运行边界

本 Evidence 仅证明仓库内静态契约、生成物、兼容投影、治理清单和失败关闭测试，状态固定为 `NOT_RUNTIME_VERIFIED`。

真实 learner/learning owner schema、grant、事务和 Outbox 属于 `P1R-M2-004`；Kafka topic/ACL、投递、消费、重复/乱序、DLQ/replay 属于 `P1R-M2-005`；placement→plan Saga、补偿、人工恢复与 closure receipt 属于 `P1R-M1-012`/`P1R-M2-006`。B26 保持 `static-only`、`pending`、`NO-GO`。

当前 Gateway 没有把 `POST /api/v1/onboarding/goals/first` 路由到 core-api，但这不是网络隔离或真实运行证明。core-api 直连兼容实现、浏览器、设备和 E2E 均未由本任务验证。
