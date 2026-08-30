# 契约与治理结果

1. B9 外部写入统一为 `CREATE_DRAFT`、`SAVE_DRAFT`、`VALIDATE_DRAFT`、`SUBMIT_REVIEW`、`REVIEW_FIRST`、`REVIEW_FINAL`、`PUBLISH`、`SCHEDULE_PUBLISH`、`CANCEL_SCHEDULED_PUBLISH`、`UNPUBLISH`、`ROLLBACK`；公共字段、分支必填字段和禁止字段均可机器校验。
2. 双审记录为只读、闭合、按 stage 键控的集合：只允许空、单个 FIRST、或同一 `contentVersionId/contentHash` 的 FIRST+FINAL；拒绝 FINAL-only、重复阶段、未知字段和版本/hash 漂移。
3. 排期任务冻结时区、状态、到期复核、幂等、失败分类、恢复查询和审计关联；到期执行重新检查双审、版权、媒体、Phase/feature Gate 与版本并发。
4. public/learner 投影只暴露 allow-list；审核、答案规则和版权内部证据不能泄漏。`projectionVersion` 与 `contentEpoch` 单调更新，下线与回滚不得重写历史事实。
5. B10 已开始的 session/attempt/report/mastery 保留 immutable active pin；紧急移除可变成显式 `UNAVAILABLE`，`SAFE_FUTURE_FALLBACK` 仅允许未来读取和未开始任务。
6. `content.version.submitted/reviewed/published/unpublished/rolled_back.v1` 进入 canonical 事件治理；reviewed payload 绑定 `contentHash`、`stateVersion`、`commandId` 和 `auditId`。
7. TypeScript 生成器保留 composed schema 的公共字段、root/branch required、必填 discriminator，并把可表达的 `not.required` 禁止字段映射为 `?: never`；数组约束不再退化为 `unknown`。

固定兼容来源仍为 `6ce98a95b75e7efca05cc511f5f773dbf2be08a4`，历史 CI baseline 为 `463c4b238caceb1592bff6c61327c00ab9bac922`，不可变治理 baseline 为 `868c2177f62b6d2cf613bed702686dddcfe6943f`。这些引用没有为消除差异而移动。
