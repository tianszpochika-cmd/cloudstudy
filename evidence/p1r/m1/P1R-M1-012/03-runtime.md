# 运行边界

本 Evidence 只证明仓库内静态契约、政策、生成物、兼容投影、事件治理和失败关闭测试，运行状态固定为 `NOT_RUNTIME_VERIFIED`。

真实 assessment/learning owner schema、grant、事务与 Outbox 持久化归 `P1R-M2-004`；Kafka broker/topic/ACL、投递、consumer、重复/乱序、DLQ/replay 归 `P1R-M2-005`；真实 placement→plan Saga、补偿、人工恢复和 closure receipt 归 `P1R-M2-006`。

B26 保持 `static-only`、`pending`、`NO-GO`。Gateway/服务进程、数据库、浏览器、设备和 E2E 没有在本任务中启动或验收。B25/core-api/learner-web 的旧计分、词汇量与 FAST_TRACK 行为仍是历史迁移债务，未获得 canonical/runtime 身份。
