# 兼容、事件与 GAP 迁移

本次 promotion 为 `P1R-M1-014`，来源基线为 `e3514c359e6f6be5445cf46a7734325b2835b941`，不可变治理基线为 `868c2177f62b6d2cf613bed702686dddcfe6943f`。canonical OpenAPI、GAM/SOC v2 events、catalog、AsyncAPI/B26 static routing、generated TypeScript 与 compatibility checker 都在最终源码中固定。

关闭的 D2 责任是 `CONTRACT-GAP-GAM-001`、`EVENT-GAP-BIND-GAM-001` 与 `EVENT-GAP-BIND-SOC-001`。这只代表契约和静态治理闭合，不代表 event 已被 broker 投递或 consumer 已运行。

B4/B12 v1 route、event、Java 与 migration 继续是 historical adapter/candidate，不能获得独立事实写入、双写或 runtime Evidence 资格。
