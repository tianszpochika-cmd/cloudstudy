# 契约验收

十个 canonical learner route 均绑定服务 owner、Bearer security、默认拒绝权限和服务端可信主体。profile、target、preferences 三条写操作要求 `Idempotency-Key` 与十进制 `If-Match` 精确等于请求体 `expectedStateVersion`；同键同载荷重放原结果，同键异载荷或版本冲突返回 409。

GoalOptions 必须恰好包含 `FOUNDATION/COLLEGE_CET/POSTGRADUATE_ENGLISH/WORKPLACE_DAILY` 四个 goalCode 各一次，时长只允许 `5/15/30/45`。B9 profile 的 `targetGoal` 仅为历史读影子，PATCH 失败关闭为 422；B1 旧入口只允许闭合映射或 422，不获得新的目标权威。

planning input 绑定 target/profile/preferences/content/IAM eligibility 的版本和摘要，不暴露 raw adult Gate、consent、phase、policy 或 rights 权威。First-day 仅允许 `NOT_READY/PROCESSING/READY/DEGRADED`；READY 在 OpenAPI/checker 层要求 `taskCount >= 1`、`tasks.minItems >= 1`，DEGRADED 的唯一原因字段为 `degradedReason`。生成 TypeScript 只承诺公共/分支必填、discriminator 与可表达的 `not -> never`，数值与数组基数仍由 wire validator 负责。
