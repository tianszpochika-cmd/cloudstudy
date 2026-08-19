# 后端服务

初期采用“模块化单体 + 专项 Worker”，而不是一开始拆成大量微服务：

- core-api：账户、课程、学习、练习、复习、订阅和运营 API。
- ai-orchestrator：模型供应商适配、提示词、工具调用、结构化反馈和安全策略。
- realtime-voice：实时语音会话、转写、打断和会话事件。
- content-worker：内容生成、清洗、审核、发布和索引。
- notification-worker：学习提醒、复习通知和消息任务。
- analytics-worker：事件消费、指标聚合和数据同步。
- job-runner：通用异步任务与定时任务。

当某个模块出现独立扩缩容、权限或数据隔离需求时，再将它拆成独立部署单元。
