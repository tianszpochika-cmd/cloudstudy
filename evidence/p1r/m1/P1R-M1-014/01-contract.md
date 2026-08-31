# 契约验收

`P1_REWARD_POLICY_V1` 以 producer、event、schema、predicate 与 rule version 的精确白名单接收可信完成；`learning.task.completed.v1`、`learning.review.scheduled.v2` 与 B4/B12 v1 不得发奖或晋升 canonical。

gamification-service 是 append-only ledger、补偿分录、奖励、catalog 与游戏 session 的唯一 owner；social-service 是 room、seat lease、focus、visibility、leaderboard、preset interaction 与 report 的唯一 owner。客户端不能提交 XP、余额、概率、rank、tenant、owner、角色或任何服务端派生字段。

Phase 1 仅启用 `SENTENCE_TRAIN`。三类空间容量、90 秒 lease、30 秒续租、60 秒恢复窗、5 分钟无活动释放和 25/45 分钟 focus 全部由服务端时钟决定。榜单只使用已结算事实，且具备 snapshot、watermark、版本、tie-break、审计引用与昵称/匿名/opt-out 边界。
