# 兼容与事件迁移

本次 promotion 为 M1-013_LEARNING_LOOP_CONTRACT_PROMOTION。冻结来源为 a07a58a7d245295c54d39487a6669545d077c513，不可变治理基线为 868c2177f62b6d2cf613bed702686dddcfe6943f；历史契约基线 463c4b238caceb1592bff6c61327c00ab9bac922 与来源检查点两条固定 Git compatibility 均为 0 breaking。

B1/B2 的 daily task、plan/today、SRS、错题、mastery 和报告入口都明确映射至 B10 canonical route，并保留 adapter/deprecation 语义，不能取得独立 plan、SRS 或 mastery 写权。B10 historical assessment event、B2 vocabulary SRS event 与 B2 assessment/mastery event 保持 historical-only；它们不因读取兼容而变成新的 canonical 事实。

assessment.item.assessed.v2 把 assessment-service 的可信 outcome 交给 learning-service 和 workflow-service 的受治理 consumer group。learning.mastery.projected.v2 与 learning.review.scheduled.v2 固定 learning-service producer、topic、aggregate partition、payload allow-list、lineage、版本和可靠性引用。客户端不是 Kafka producer；离线 clientEventId/clientSeq/baseStateVersion/contentVersionId/payloadHash 只作为 owner API 的幂等、顺序和冲突输入。
