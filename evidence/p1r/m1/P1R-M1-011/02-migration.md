# 兼容与事件迁移

本次 promotion 为 `M1-011_LEARNER_PLANNING_CONTRACT_PROMOTION`，冻结来源契约为 `cd92378bd8ba0c57c920fc6e79db52de717b0b05`，不可变治理基线为 `868c2177f62b6d2cf613bed702686dddcfe6943f`，前序 promotion 为 `M1-010_ASSESSMENT_CONTRACT_PROMOTION`。

B1 onboarding options/profile/first-goal 保留为明确 deprecated adapter；未知或缺失 canonical 目标事实返回 422，不能默认或空成功。`learner.target.updated.v1` 具备 producer、data owner、两个 consumer group、topic、partition key 与 payload allow-list，晋升为 canonical D2；profile/first-day 事件继续 historical-only。

`EVENT-GAP-ONB-001` 已由 M1-018 以 canonical Evidence 关闭 D2 registry 项；真实 Outbox、broker、ACL、投递和消费仍为 `NOT_RUNTIME_VERIFIED`，不能由该静态 promotion 冒充。
