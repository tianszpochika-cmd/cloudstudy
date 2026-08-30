# 运行状态

最终状态严格为：

- `contractMaturity=D2_CONTRACT_READY`
- `runtimeStatus=NOT_RUNTIME_VERIFIED`
- B26 `runtimeGate=static-only`
- B26 `runtimeStatus=pending`
- B26 `defaultDecision=NO-GO`

本机审计、生成物、类型检查、单元测试、compatibility 和候选 Java 代码都不证明对象存储、媒体 worker、录音、播放、数据库或 Kafka 链路已运行。

M2-004 负责真实 owner schema/object store/删除与保留，M2-005 负责 Kafka/Outbox/consumer，M2-006 负责 workflow/Saga/人工恢复；后续 M3/M5/M8 负责后台处理、学习页面、浏览器/设备和 E2E。
