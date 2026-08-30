# P1R-M1-008 范围

- 结论：`ACCEPTED`
- 最终源码：`e05c774b02ece081a5c05145b623f39d1ecd39e1`
- 来源检查点：`18d7d38ed2ad55d95be8985d393c6e7f6c9bbf31`
- 契约状态：`D2_CONTRACT_READY` / `NOT_RUNTIME_VERIFIED`
- 主评审：`agent:m1_008_independent_review:gpt-5.6-luna:max`
- 交叉复核：`agent:m1_008_contract_tooling:gpt-5.6-luna:max`、`agent:m1_005_independent_review:gpt-5.6-luna:max`

本任务冻结内容后台 11 个 canonical command、双审身份与阶段集合、排期发布、公开/学习投影、下线/回滚、B9/B10 content pin 边界，以及 5 个 canonical content lifecycle 事件；同时让 OpenAPI、事件目录、AsyncAPI、生成 TypeScript、兼容比较和失败关闭审计使用同一治理模型。

本任务不创建或验证真实 MySQL、Outbox、Kafka、调度器、投影 worker 或端到端发布链路。B26 保持 `static-only` / `pending` / `NO-GO`；`P1R-M2-004/005/006` 仍未完成，`P1R-M0-006` 仍为 `BLOCKED`。

manifest 摘要只绑定 `e05c774` 中的稳定源码、契约、生成物、测试、策略和设计说明。随后由集成阶段更新的台账、执行日志、状态轨迹、CHANGELOG 与本 Evidence 包自身不进入源码摘要。
