# 恢复与回滚

同一 placement session 与内容/规则快照支持 checkpoint 后恢复，不得为网络重试创建替代 session。首个完成 result/report 持久化成功后才能产生 completion fact；计划生成失败必须保留 assessment report，并形成 owner-scoped recovery 状态。

workflow 对重复、乱序、重放和消费重试使用冻结 effect key，learning-service 只能创建或重放唯一 active plan；补偿和人工恢复不得跨 owner 写表，也不得覆盖原 placement 结果。SKIPPED baseline 与后续重校准报告必须分别保留。

如需撤销静态契约，先回退 `aac5c3462e01f3b3bec34bb13e7cd9f74ff34f72`，再回退任务启动提交 `35d78f930249fe5c2e0a235134b24f5b50ce67b5`，随后重跑 placement、生成类型、merge/generate/validate、两条固定 compatibility、P1R、B26、typecheck、Evidence 和 diff 门禁。不得移动不可变基线，也不得把源码回滚解释为运行数据、Kafka 或 Saga 回滚。
