# 契约验收

P1_DAILY_PLAN_V1 固定候选事实、稳定排序 tuple、RECOVERY_REQUIRED 至 OPTIONAL 的七级优先级、5/15/30/45 分钟预算、最多 10% 上浮、积压 CATCH_UP 与 learner-safe reason code；相同版本化输入必须产生同一任务序列。plan/today/task 由 learning-service 持有内容/规则 pin、版本、完成、重排和历史保留语义，并只衔接 M1-010 的 assessment session/checkpoint/attempt/report，不另造第二套判分或 session 状态机。

SM2_Q03_V1 是唯一 Phase 1 SRS 算法。它固定 q=0..3、服务端 objective outcome cap、EF/interval/repetition/lapse、rounding/clamp、学习者时区日历日、UTC dueAt，以及旧版本、倒序、提前复习、内容 pin 冲突与算法迁移的拒绝/恢复语义。同一 lrn_srs_state 不能由两条入口双写；completeB10LearningReview 是唯一 canonical 公开 SRS 写入口。

P1_MISTAKE_REPAIR_V1 固定错误分类、合法内容 variant、REVIEW_QUEUE → LEARNING → DELAY_VERIFY_D1 → DELAY_VERIFY_D7 → MASTERED 与失败 REOPENED。P1_MASTERY_V1 固定去重版本、至少三条分隔证据、D+7 gate、85/95 阈值、猜测/模糊限制和关键错误降级；SRS stage、repair workflow state 和 mastery stage 是三个独立字段体系。P1_REPORT_V1 固定日/周/阶段窗口、asOf/sourceWatermark、版本 pin、分子/分母、迟到事实、重建、对账和来源追踪，缺失事实必须显示处理中而不是 0。

本次冻结 11 条 B10 canonical learning route，以及 assessment.item.assessed.v2、learning.mastery.projected.v2、learning.review.scheduled.v2 三条受治理的 canonical 事件。事件治理和 payload schema 是 D2 契约，不是 broker 发布、投递或消费已运行的声明。
