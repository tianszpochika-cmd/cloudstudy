# 兼容与事件迁移

本次 promotion 为 `M1-012_PLACEMENT_CONTRACT_PROMOTION`。冻结来源为 `270b0dfbf8dbec1329b8dc7036ee3e7490a8ffb3`，不可变治理基线为 `868c2177f62b6d2cf613bed702686dddcfe6943f`，历史契约基线 `463c4b238caceb1592bff6c61327c00ab9bac922` 同时通过。

B1 的 start/read/submit-step/skip/report 五条旧入口均为明确 deprecated adapter，不能获得新的 owner 或计分权威。canonical 入口只来自 B10 placement fragment；普通 assessment attempt 事件不能代替 placement 完成事实。

`assessment.placement.completed.v1` 冻结 assessment producer/data owner、workflow/learning consumer group、topic、`placement_session` 聚合分区、payload allow-list、lineage、兼容策略和可靠性引用。B26 仅增加静态路由，不被晋升为真实 broker、ACL、投递或消费证明。

`CONTRACT-GAP-ONB-002`、`EVENT-GAP-ONB-002` 与 `EVENT-GAP-PLACEMENT-PLAN` 只获得静态 D2 closure；真实运行仍归 M2-004/005/006。
