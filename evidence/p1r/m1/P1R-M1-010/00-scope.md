# P1R-M1-010 范围

- 结论：`ACCEPTED`
- 最终源码：`cd92378bd8ba0c57c920fc6e79db52de717b0b05`
- 不可变来源检查点：`760621e45b9adc95a6aa40fb1678a8d3ebc87797`
- 契约状态：`D2_CONTRACT_READY` / `NOT_RUNTIME_VERIFIED`
- 独立终验：`agent:m1_009_contract_audit:gpt-5.6-luna:max`

本任务只冻结 assessment-service 的 session 创建/读取、session-scoped protected checkpoint、attempt 提交、确定性判分摘要和 assessment report 快照。它绑定内容/规则 pin、submission digest、状态互斥、幂等和版本事实，并把 B2 写接口保留为显式 deprecated adapter。

不包含 placement→plan Saga、learning SRS/mastery/聚合报告、真实 owner schema、事务/Outbox、Kafka、Saga、浏览器/设备或 E2E 运行验证。`EVENT-GAP-BIND-ASM-001` 继续 `OPEN`，`P1R-M0-006` 继续 `BLOCKED`。
