# R1-020 逐题作答检查点（顺序 + 版本锁）

日期：2026-10-10。分支：`dev-redesign`。卡：R1-020 / BC-014。Owner：assessment-service。依赖：R1-018 已在工作区。

状态：无答案定级会话可以沿已有 `POST /internal/v1/assessment/placement/sessions/{sessionId}/responses` 逐题交卷。只接受当前题。超前、落后、过期版本、同一版本并发写返回 409，进度停在最后一条成功检查点。同一幂等键、同一题、同一答案回放原回执，不把进度再推进一题。回执丢失时，同一键可以按已入库的响应找回原检查点，仍然不推进。读口返回已接收题序和版本。**不是 ACCEPTED，也不是 IT-2 出站。** 没有 commit，没有 push。`CURRENT-PROGRESS.md` 未改。没有起 content-service，没有占用 18089。

## 行为

网关本来就把 `POST /api/v1/assessment/placement/sessions/{sessionId}/responses` 转到这条内部口，读会话走已有的 `GET /internal/v1/assessment/placement/sessions/{sessionId}`。本卡没有新造第二套提交路径，也没有改 api-gateway。

R1-018 开出的会话密封行只有 `itemId`、`dimension`、`contentVersionId`，没有 `questionType` 和 `answerRules`。这种会话交卷时不调用 `score()`，不读密封下发里的答案，不计算 FULL/ZERO，不写 `p1_placement_result`，不写完成 outbox。答案只按 learner 题面上的 `optionId` 做形状校验。`p1_placement_response.correct` 写入 NULL，表示已接收、尚未判分。`V9__allow_unscored_placement_response.sql` 把该列改成可空。10 题都接收后状态仍是 `IN_PROGRESS`，`current_sequence` 为 11，读口没有 `currentItem`，也没有 `completedResult`。

顺序锁：`itemSequence` 必须等于会话的 `current_sequence`，`expectedStateVersion` 必须等于 `state_version`，`itemId` 必须是当前题。否则 409，不写响应、不写检查点。版本锁是先按 `state_version` 和 `current_sequence` 做条件更新，更新不到行也是 409。后到的写入不会把游标再推一题。

幂等：同一键且请求摘要相同，已有回执则直接返回，不推进。同一键但答案不同是 409。同一键的回执还是空、响应行已经在库里时，按检查点重拼原回执并补上回执，不推进。另一个幂等键即使答案相同，也不当成回放；游标已经过去就是 409。

读口在原有 `stateVersion` 之外返回 `acceptedSequence`（已接收到的题序，未作答为 0）和 `nextSequence`（下一题；11 表示 10 题都已接收）。冲突之后读到的是最后一条成功检查点，不是失败那一次的题号。

带 `questionType` 和 `answerRules` 的旧密封行仍走原来的判分和完成报告。那是本卡之前的路径，R1-018 的无答案开题不会产生这种行。本卡没有把 `answerRule` 或 `correctOption` 加回开题响应。

## 改动文件

本卡修改或新增：

- `services/assessment-service/src/main/java/com/englishflow/assessment/web/P1PlacementJdbcController.java`
- `services/assessment-service/src/test/java/com/englishflow/assessment/web/P1PlacementJdbcControllerFlowTest.java`
- `services/assessment-service/src/test/java/com/englishflow/assessment/web/R1020PlacementCheckpointTest.java`
- `services/assessment-service/src/main/resources/db/migration/V9__allow_unscored_placement_response.sql`
- `evidence/redesign/2026-10-10/R1-020/report.md`

没有修改 `services/api-gateway/**`、`services/content-service/**`、`apps/**`、`evidence/redesign/2026-10-10/R1-019/**`。工作区里 assessment-service 上 R1-018 的其他差量不是本卡改的。

## 验证

没有建库，没有起停服务，没有打 18089。收口是单测。

```text
cd /Users/Admin/Desktop/work/cloudstudy/services/assessment-service && mvn -q -Dtest=R1020PlacementCheckpointTest,R1018PlacementOpenTest,P1PlacementJdbcControllerFlowTest,P1PlacementJdbcControllerSafetyTest,P1PlacementCompletionJdbcTest test
exit 0
R1020PlacementCheckpointTest: Tests run: 4, Failures: 0, Errors: 0
R1018PlacementOpenTest: Tests run: 4, Failures: 0, Errors: 0
P1PlacementJdbcControllerFlowTest: Tests run: 3, Failures: 0, Errors: 0
P1PlacementJdbcControllerSafetyTest: Tests run: 6, Failures: 0, Errors: 0
P1PlacementCompletionJdbcTest: Tests run: 1, Failures: 0, Errors: 0
```

`R1020PlacementCheckpointTest` 覆盖：10 题按序接收且不判分、不写报告；超前、落后、过期版本 409 后读口仍是最后成功检查点；同键同答案回放，同键换答案 409，回执被清空后同键找回且不推进；两个键并发写同一版本只有一个成功，进度停在胜出的那一题。

## 没有 PASS 的部分

- 没有把 V9 打到真实 MySQL。单测的内存 JDBC 允许 `correct` 为 NULL。未迁移的库上，无答案会话的 INSERT 会失败。
- 带答案规则的旧会话在第 10 题仍会判分并写报告。无答案会话不会。判分本身是 R1-021，本卡没有做。
- 读口和回执多了 `acceptedSequence`、`nextSequence`。已发布的 `B10PlacementSession` / `B10PlacementResponseReceipt` 没有这两个字段，契约文件没有改。
- 没有浏览器或真机走查，学习端提交仍可能走 B25 `submit-step`。那不是本卡改的。
- 不是 Luna 独立终审，不是 IT-2 出站，也不是 L2 干净库重放。
