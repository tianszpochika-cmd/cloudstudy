# 运行证据

运行状态：`NOT_RUNTIME_VERIFIED`。

本证据包没有声称以下事项已运行通过：

- Kafka broker、topic、ACL 或凭据已创建；
- Outbox 已向 broker 投递；
- consumer 已去重、重试、进入 DLQ 或完成回放；
- 重复、乱序、宕机、重启、补偿或人工恢复已执行；
- B26 静态输入已晋升为运行 Evidence。

这些事项分别由 `P1R-M1-007` 的可靠性契约和 `P1R-M2-005` 的真实运行实现与验证承接。
