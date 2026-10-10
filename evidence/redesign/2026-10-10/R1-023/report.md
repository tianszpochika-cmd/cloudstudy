# R1-023 跳过定级（SKIPPED 基线）

日期：2026-10-10。分支：`dev-redesign`。卡：R1-023 / BC-017。Owner：assessment-service。依赖：R1-018 已在工作区。

状态：跳过只留下一条 `SKIPPED` 基线，来源是 `USER_SKIP`。它不是测出来的等级，没有 `FULL`/`ZERO`，没有 R1-022 那种 `reportId` 和 `digest`，也没有分数。同一幂等键再跳一次，还是这一条，不插第二行。已经有完成报告的会话，跳过不会改它的 `digest`、作答或报告。**不是 ACCEPTED，也不是 IT-2 出站。** 没有 commit，没有 push。`CURRENT-PROGRESS.md` 未改。没有起服务。没有新造 DEC-03 的数据契约。

## 行为

没有新路径。网关原来就把 `POST /api/v1/assessment/placement/skip` 转到 `/internal/v1/assessment/placement/skip`，本卡没有改网关。评估服务里这条内部口在 `B25AssessmentJdbcController`。跳过现在只插入一条 `status=SKIPPED` 的会话，`answers_json` 里写 `baselineSource=USER_SKIP`。可选的 `fastTrackLevel` 仍映射成 `requestedStartingLevel`，`authority` 是 `USER_SELECTED_NON_AUTHORITATIVE`。不再插入 `b25_assessment_report`，不写 `report_id`，不写分数。同一幂等键回放这一条基线。请求里如果点名一个已经 `COMPLETED` 的 B25 会话，返回 409，该会话的作答和报告原样留下。

已有的 `POST /internal/v1/assessment/placement/baselines/skip` 也不再走 `freezeResult`。无 `sessionId` 时新开一条 `SKIPPED` 会话，`baseline_json` 记下同一份基线，不写 `p1_placement_result`，不写 `assessment.placement.completed.v1`。带本会话的 `sessionId` 时，进行中的会话改成 `SKIPPED`，已有作答行不动；之后再交卷是 409。该会话已经 `COMPLETED` 或已经有结果行时，在读银行和写库之前返回 409，`report_json` 和 `digest` 不变。同一幂等键回放已存基线，不新建会话。

基线字段是 `sessionId`、`status=SKIPPED`、`resultKind=SKIPPED`、`baselineSource=USER_SKIP`、`confidence=UNVERIFIED`，外加可选的非权威起点。没有 `reportId`、`digest`、`aggregateScore`、`referenceLevel`、`FULL`、`ZERO`。读会话在 `SKIPPED` 时带出来源，不带 `completedResult`。这不是测得报告，也没有交给计划生成。DEC-03 还没批，BC-023 在那之前仍只接受正式报告。本卡没有改 OpenAPI，没有新事件。

`V11__placement_skip_baseline.sql` 把 `p1_placement_session.status` 的检查放宽到包含 `SKIPPED`，并加上可空的 `baseline_json`。没有对真实 MySQL 执行。

密封下发、开题响应和报告都没有加回 `correctOption`。

## 改动文件

本卡修改或新增：

- `services/assessment-service/src/main/java/com/englishflow/assessment/web/B25AssessmentJdbcController.java`
- `services/assessment-service/src/main/java/com/englishflow/assessment/web/P1PlacementJdbcController.java`
- `services/assessment-service/src/main/resources/db/migration/V11__placement_skip_baseline.sql`
- `services/assessment-service/src/test/java/com/englishflow/assessment/web/P1PlacementJdbcControllerFlowTest.java`
- `services/assessment-service/src/test/java/com/englishflow/assessment/web/R1023PlacementSkipTest.java`
- `evidence/redesign/2026-10-10/R1-023/report.md`

没有修改 `apps/**`、`packages/i18n/**`、`services/api-gateway/**`、`services/content-service/**`、`evidence/redesign/2026-10-10/R1-028/**`、`evidence/redesign/2026-10-10/R1-024/**`、`packages/contracts/**`。工作区里这些路径上的其他差量不是本卡改的。

## 验证

没有建库，没有起停服务。单测用内存 H2（MySQL 模式），测完即关。没有留进程。没有对真实 MySQL 执行 V11。

```text
cd services/assessment-service && mvn -q -Dtest=R1023PlacementSkipTest,R1022PlacementReportTest,R1021PlacementScoreTest,R1020PlacementCheckpointTest,R1018PlacementOpenTest,P1PlacementJdbcControllerFlowTest,P1PlacementCompletionJdbcTest,P1PlacementJdbcControllerSafetyTest,B25SkippedPlacementSafetyTest,R1024PlacementRetestTest test
exit 0
R1023PlacementSkipTest: Tests run: 4, Failures: 0, Errors: 0, Skipped: 0
R1022PlacementReportTest: Tests run: 3, Failures: 0, Errors: 0, Skipped: 0
R1021PlacementScoreTest: Tests run: 5, Failures: 0, Errors: 0, Skipped: 0
R1020PlacementCheckpointTest: Tests run: 4, Failures: 0, Errors: 0, Skipped: 0
R1018PlacementOpenTest: Tests run: 4, Failures: 0, Errors: 0, Skipped: 0
P1PlacementJdbcControllerFlowTest: Tests run: 3, Failures: 0, Errors: 0, Skipped: 0
P1PlacementCompletionJdbcTest: Tests run: 1, Failures: 0, Errors: 0, Skipped: 0
P1PlacementJdbcControllerSafetyTest: Tests run: 6, Failures: 0, Errors: 0, Skipped: 0
B25SkippedPlacementSafetyTest: Tests run: 1, Failures: 0, Errors: 0, Skipped: 0
R1024PlacementRetestTest: Tests run: 3, Failures: 0, Errors: 0, Skipped: 0
```

```text
cd services/assessment-service && mvn -q -Dtest=AssessmentJdbcAuthorizationBoundaryTest test
exit 0
AssessmentJdbcAuthorizationBoundaryTest: Tests run: 3, Failures: 0, Errors: 0, Skipped: 0
```

`R1023PlacementSkipTest` 覆盖：跳过后状态是 `SKIPPED`，结果表行数为 0，回执没有 `reportId`、`digest`、`FULL`、`ZERO`；同一幂等键再跳，会话数仍是 1。进行中的会话跳过后，已接收的两行作答还在，再交下一题是 409，仍然没有报告。十题完成后再跳过该会话是 409，库存 `report_json` 和 `digest` 不变；接着打网关那条 B25 跳过口，也不改这份 `digest`。B25 跳过本身不插报告；点名一个已完成的 B25 会话是 409，原作答和原报告还在。

## 没有 PASS 的部分

- 学习端现有跳过仍提交 `{ fastTrackLevel }` 到 `POST /api/v1/assessment/placement/skip`。这条口现在写的是 B25 上的 `SKIPPED` 基线，不会把已经开出的 P1 会话改成 `SKIPPED`。要跳过某一条 P1 会话，调用方得把 `sessionId` 送到已有的 `/baselines/skip`。已发布的请求体没有 `sessionId`，契约文件没有改。
- 没有把这条基线交给 BC-023。DEC-03 未批，本卡不新造计划输入契约，也不发完成事件冒充报告。
- 已经落过 `report_id` 的旧 B25 跳过行，读报告仍走原来的报告视图。新跳过不再插这种行。
- 没有把 V11 打到真实 MySQL。未迁移的库上，P1 的 `SKIPPED` 会被状态检查拒绝，`baseline_json` 更新也会失败。
- 没有浏览器，没有 Luna 独立终审。不是 IT-2 出站。
