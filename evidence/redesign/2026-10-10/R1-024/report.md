# R1-024 定级重测（新 session，旧报告保留）

日期：2026-10-10。分支：`dev-redesign`。卡：R1-024 / BC-018。Owner：assessment-service。依赖：R1-022 已在工作区。

状态：已完成并已有报告的无答案定级会话可以重测。重测插入一个新 `sessionId`，题面来自当前无答案密封银行，从第 1 题开始，`acceptedSequence` 为 0。旧会话、旧作答和旧 `reportId` 不改；旧报告仍能读到原来的 `digest`。历史查询同时列出旧报告和新会话。未完成、或已标完成但没有结果行的会话，重测是 409，不插入新会话。**不是 ACCEPTED，也不是 IT-2 出站。** 没有 commit，没有 push。`CURRENT-PROGRESS.md` 未改。没有起服务。没有做计划重排（BC-029）。

## 行为

`POST /internal/v1/assessment/placement/sessions/{sessionId}/retest` 使用已有权限 `assessment.placement.session.create`，并要求 `Idempotency-Key`。请求体必须为空。先核对会话属于当前学习者和租户 `platform`。状态不是 `COMPLETED`，或 `p1_placement_result` 没有该会话的 `report_id`，返回 409，此时不读银行、不写会话。找不到会话是 404。别人的会话是 403。

通过之后才 `resolve` 当前银行。新行走原来的 `insertSession`，状态 `CREATED`，`state_version` 1，`current_sequence` 1。不复制旧进度、旧作答或旧 checkpoint。密封行仍由银行项生成；无答案项不写 `correctOption` 或 `answerRules`。同一幂等键回放同一份新会话视图，不插入第二行。换一把新键可以再开一会话；本卡不把“已有进行中的重测”当成拒绝条件。

重测不更新 `p1_placement_result`，不删除 `p1_placement_response`，不写 `assessment.placement.completed.v1`。旧 `GET /internal/v1/assessment/placement/reports/{reportId}` 仍返回完成时钉住的正文。

`GET /internal/v1/assessment/placement/history` 使用 `assessment.placement.session.read`。只返回当前学习者的会话，按 `started_at`、`session_id` 升序。每条有 `sessionId`、`status`、`acceptedSequence`、`startedAt`、`updatedAt`。有结果行时加上 `reportId`；结果摘要里有 64 位 `digest` 时才加上 `digest`。不复制报告正文，因此历史里没有选项、没有 `correctOption`、没有 `answerRule`。

幂等操作名是 `RETEST`。`V10__allow_placement_retest_idempotency.sql` 把 `p1_placement_idempotency` 的检查从 `CREATE`、`RESPONSE`、`SKIP` 放宽到包含 `RETEST`。不改已有行。

跳过路径写出的旧形状结果也是 `COMPLETED` 且有结果行，因此也能重测。新会话仍从当前银行开。本卡单测没有走跳过。

## 改动文件

本卡修改或新增：

- `services/assessment-service/src/main/java/com/englishflow/assessment/web/P1PlacementJdbcController.java`
- `services/assessment-service/src/main/resources/db/migration/V10__allow_placement_retest_idempotency.sql`
- `services/assessment-service/src/test/java/com/englishflow/assessment/web/R1024PlacementRetestTest.java`
- `services/assessment-service/src/test/java/com/englishflow/assessment/web/P1PlacementJdbcControllerSafetyTest.java`
- `evidence/redesign/2026-10-10/R1-024/report.md`

`P1PlacementJdbcController.java` 里 R1-018 到 R1-022 的差量本来就在工作区。本卡只加了重测、历史和对应的私有方法。安全单测只给这两条新路由补了越权 403 和非法请求 422，并且仍在接触 JDBC 之前拒绝。

没有修改 `apps/**`、`packages/i18n/**`、`services/api-gateway/**`、`services/content-service/**`、`packages/contracts/**`、`evidence/redesign/2026-10-10/R1-027/**`。工作区里这些路径上的其他差量不是本卡改的。

## 验证

没有建库，没有起停服务。单测用内存 H2（MySQL 模式），测完即关。没有留进程。没有对真实 MySQL 执行 V10。

```text
cd services/assessment-service && mvn -Dtest=R1024PlacementRetestTest,R1022PlacementReportTest,R1021PlacementScoreTest,R1020PlacementCheckpointTest,R1018PlacementOpenTest,P1PlacementJdbcControllerFlowTest,P1PlacementCompletionJdbcTest,P1PlacementJdbcControllerSafetyTest test
exit 0
R1024PlacementRetestTest: Tests run: 3, Failures: 0, Errors: 0, Skipped: 0
R1022PlacementReportTest: Tests run: 3, Failures: 0, Errors: 0, Skipped: 0
R1021PlacementScoreTest: Tests run: 5, Failures: 0, Errors: 0, Skipped: 0
R1020PlacementCheckpointTest: Tests run: 4, Failures: 0, Errors: 0, Skipped: 0
R1018PlacementOpenTest: Tests run: 4, Failures: 0, Errors: 0, Skipped: 0
P1PlacementJdbcControllerFlowTest: Tests run: 3, Failures: 0, Errors: 0, Skipped: 0
P1PlacementCompletionJdbcTest: Tests run: 1, Failures: 0, Errors: 0, Skipped: 0
P1PlacementJdbcControllerSafetyTest: Tests run: 6, Failures: 0, Errors: 0, Skipped: 0
Tests run: 29, Failures: 0, Errors: 0, Skipped: 0
```

`R1024PlacementRetestTest` 覆盖：10 题完成后重测得到另一个 `sessionId`，状态 `CREATED`，`acceptedSequence` 0，当前题是新银行的第 1 题；旧作答 10 行不变，旧 `report_json` 和 `digest` 不变；同一幂等键不增加会话；新会话自己不能再重测。未完成（0 题、9 题、标成 `COMPLETED` 但没有结果行）都是 409，会话数不变，银行不被读取。历史里旧条目带原来的 `reportId` 和 `digest`，新条目没有报告，别人的会话不在其中。重测回执、历史和旧报告都不含 `correctOption`。

## 没有 PASS 的部分

- 公网路由和契约没有这两条内部路径。本卡按边界没有改 api-gateway 或 `packages/contracts`。
- V10 没有在真实 MySQL 上跑过。H2 单测表没有那条 CHECK，所以单测不能证明迁移语法。
- 重测和历史都不说明是否影响当前计划，也不进入 BC-029。
- 没有浏览器，没有 Luna 独立终审。不是 IT-2 出站。
