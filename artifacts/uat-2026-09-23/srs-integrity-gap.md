# SRS 可信性复核（2026-09-23）

状态：**BLOCKED**。本次修复关闭了可由客户端自报 `quality=5` 或 `PASS` 直接推进复习阶段、到期时间和旧日报的运行写路径；没有完成可信的 SRS 业务闭环。

## 本次证据与修复

- `B25LearningJdbcController` 的 `/srs/reviews`、`/srs/reviews:sync`、`/review-queue/{queueItemId}/complete` 原先都调用 `recordReview`：客户端质量或 PASS/FAIL 被直接转换成 `b25_learning_review` 与 `b25_learning_srs_state`，既没有 assessment outcome，也没有完整发布内容 pin、`clientSeq`、payload hash、到期时间与版本检查。与学习规则 §6.1、§6.4、§6.5 冲突。
- 三个入口现对已授权成人学习者统一返回 `409 UNTRUSTED_REVIEW_EVIDENCE`，缺写权限返回 403；没有数据库写入。旧批次标记 `RECOVERY_REQUIRED` 且不返回可结算卡，旧队列项标记 `completable=false`；移动端不再提交 `PASS`，两端不再把旧批次展示成可结算复习。
- 旧 `b25_learning_review` 和 `b25_learning_srs_state` 数据原样保留，没有迁移或删除；状态/概览显式标记 `UNVERIFIED_LEGACY_REVIEW`。旧日/周报告仍可读，但客户端自报来源的复习数、正确率、遗忘率、掌握增量和弱点均为 `null`/空，状态 `PARTIAL`，页面简短提示未核验。
- 契约片段已补上运行证据门说明。当前 canonical `B10CompleteReviewRequest` 原本已经要求测评尝试、完整内容 pin、序号、哈希和基础版本，本次没有弱化其结构。

## 验证

- `B25ReviewEvidenceGateTest` 覆盖三类写请求零 JDBC 操作、权限优先、旧批次与报告不晋升为可信成绩；学习服务全套 **156 tests，0 failures，0 errors，3 skipped**。
- 学习 Web 与移动端 `typecheck` 通过；相关 diff `git diff --check` 通过。
- 契约片段 JSON 解析通过。全仓 `contracts validate` 因现存 `/api/v1/iam/account-deletions` 缺 `x-idempotency` 失败，与本次 SRS 片段无关。

## 剩余业务链

`assessment-service` 的同一学习者、题目、规则版本与客观 outcome，`content-service` 的已发布权利与 content pin，需要通过受保护事实进入 `learning-service` 的唯一 transition/receipt ledger。其后才能按 `SM2_Q03_V1` 验证错答质量上限、早复习 409、离线乱序/重复、时区/DST、跨设备冲突和报告水位。当前没有这些运行证据，`PAGE-P1-SRS` 不应判 PASS。

`V2LearningController.today/first-day` 与后台只读投影仍能读取历史 `b25_learning_srs_state`。这些数据只能用作待迁移线索，不能据此宣称真实掌握或已完成复习；本次未改写历史行或跨域读模型。
