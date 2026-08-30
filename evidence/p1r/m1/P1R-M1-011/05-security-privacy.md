# 安全与隐私边界

客户端不能提交或覆盖 principal、tenant、owner、adult Gate、consent、phase、policy、content rights、版本和恢复控制权。IAM eligibility 只以服务端聚合的 version/digest pin 进入 planning input；canonical target event 使用精确 18 字段 allow-list，拒绝 raw authority、profile、任务、恢复和内部错误字段。

三条 B9 写操作同时绑定 Bearer security、本地 PEP、`If-Match`、expected state version 和幂等指纹。GoalOptions 按 goalCode exactly-once，timezone 使用冻结形状；B1 adapter 对未知目标、缺失 snapshot 或非法时长失败关闭。

First-day/recovery 仅暴露 learner-safe 状态和引用。`degradedReason` 是唯一降级原因字段；raw error、stack trace、approval/audit/operator command 和跨主体 recovery 均被拒绝。
