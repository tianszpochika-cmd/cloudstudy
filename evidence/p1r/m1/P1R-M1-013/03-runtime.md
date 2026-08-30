# 运行边界

本 Evidence 只证明仓库内静态规则、OpenAPI、事件治理、生成物、兼容投影、失败关闭 checker 与测试结果。运行状态固定为 NOT_RUNTIME_VERIFIED。

P1R-M2-004 负责真实 owner schema、grant、migration、事务和 Outbox 持久化；P1R-M2-005 负责 Kafka broker/topic/ACL、投递、consumer、重复/乱序、故障、DLQ 与 replay；P1R-M2-006 负责真实 Saga、补偿、scheduled/manual recovery 和 immutable closure receipt。Gateway/服务进程、数据库、Kafka、worker、浏览器、真机、离线数据库和 E2E 均未在本任务启动或验收。

B26 仍为 static-only、pending、NO-GO。任何将本次 D2 静态检查描述为 HTTP、PEP、数据库、Kafka delivery、consumer processing 或 runtime-ready 证据的说法均无效。
