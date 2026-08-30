# 兼容与事件迁移

本次 promotion 为 `M1-010_ASSESSMENT_CONTRACT_PROMOTION`，来源契约基线固定为 `760621e45b9adc95a6aa40fb1678a8d3ebc87797`，前序 promotion 为 `M1-009_MEDIA_CONTRACT_PROMOTION`。

旧 attempt-scoped B10 checkpoint 和 B2 assessment/exam 写路径保持 `deprecated`、adapter-only 和明确 owner/next task；它们不再是 canonical 写入口。B2 anti-cheat 仅为 `HISTORICAL_NON_AUTHORITATIVE`，不能映射为 score、reward 或 ban。

assessment submitted/assessed 事件仍为历史 payload 候选，禁止 raw response、answer rule、recording 和 canonical promotion。assessed 历史 payload 只允许 `OBJECTIVE` outcome；`EVENT-GAP-BIND-ASM-001` 未关闭。
