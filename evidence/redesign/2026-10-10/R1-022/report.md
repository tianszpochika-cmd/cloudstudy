# R1-022 报告快照（reportId + digest 钉死）

日期：2026-10-10。分支：`dev-redesign`。卡：R1-022 / BC-016。Owner：assessment-service。依赖：R1-021 已在工作区。

状态：无答案定级会话在第 10 道判分成功后生成一份不可变报告。报告钉住 `reportId`、`digest`、10 道 `FULL`/`ZERO` 序列、银行 `snapshotId` 和 `snapshotHash`。`digest` 由这四项事实的 JSON 做 SHA-256。再次读取报告正文和摘要都是同一份已存内容。同一道第 10 题再交一次，返回这份报告，不插入第二行。报告和完成回执没有 `correctOption`、`answerRule`。**不是 ACCEPTED，也不是 IT-2 出站。** 没有 commit，没有 push。`CURRENT-PROGRESS.md` 未改。没有起服务。没有做跳过（R1-023），没有做重测（R1-024）。

## 行为

生成只发生在 R1-021 的无答案会话上，而且只在第 10 道 `POST /internal/v1/assessment/placement/sessions/{sessionId}/responses` 成功之后。不满 10 道已接收作答不写 `p1_placement_result`。乱序仍是 409，不判分，也不写报告。没有判分口的 R1-020 会话判完 10 题仍是 `IN_PROGRESS`，`correct` 仍是 NULL，不生成报告。

`digest` 是下面这个对象的紧凑 JSON 的小写 SHA-256，键顺序固定：

- `reportId`
- `outcomes`：`[{sequence, outcome}]`，sequence 为 1 到 10，outcome 只有 `FULL` 或 `ZERO`
- `snapshotId`
- `snapshotHash`

后两项来自开题时钉住的银行 content pin，完成时不再读银行。摘要另存，不参与 digest 计算。摘要字段是 `reportId`、`digest`、`itemCount`、`fullCount`、`zeroCount`、`snapshotId`、`snapshotHash`。正文把同一份摘要嵌在 `summary` 里。`result_json` 存摘要，`report_json` 存正文。`GET /internal/v1/assessment/placement/reports/{reportId}` 原样读出正文。会话读口在 `COMPLETED` 时把摘要放在 `completedResult`。两次读取与库里的字符串一致。

没有修改已生成报告的写口。报告路由仍只有 GET。结果表只有插入，没有更新语句。同一会话的唯一键挡住第二行；插入冲突时返回已有正文。同一幂等键回放第 10 题回执。换一把新键、正文仍是那一道第 10 题时，也返回已有报告，不再判分，不新建报告。换了选项的完成请求是 409，库里的 `report_json` 不变。

第 10 题回执带这份报告和摘要，也仍带 R1-021 的当题 `outcome` 和固定解释。解释是那两句英文，不含正确选项文本，也不含键名 `correctOption` 或 `answerRule`。报告正文没有解释、没有选项、没有题干。

带 `questionType` 和 `answerRules` 的旧密封行仍走原来的 `freezeScoredPlacement`。跳过仍走原来的 `freezeResult`。这两条不是本卡的报告形状，本卡没有改它们。

## 改动文件

本卡修改或新增：

- `services/assessment-service/src/main/java/com/englishflow/assessment/web/P1PlacementJdbcController.java`
- `services/assessment-service/src/test/java/com/englishflow/assessment/web/R1022PlacementReportTest.java`
- `evidence/redesign/2026-10-10/R1-022/report.md`

没有修改 `apps/**`、`packages/i18n/**`、`services/api-gateway/**`、`packages/contracts/**`、`evidence/redesign/2026-10-10/R1-027/**`。工作区里这些路径上的其他差量不是本卡改的。密封下发字段没有改。

## 验证

没有建库，没有起停服务。单测用内存 H2（MySQL 模式），测完即关。没有留进程。

```text
cd services/assessment-service && mvn -q -Dtest=R1022PlacementReportTest,R1021PlacementScoreTest,R1020PlacementCheckpointTest,R1018PlacementOpenTest,P1PlacementJdbcControllerFlowTest,P1PlacementCompletionJdbcTest,P1PlacementJdbcControllerSafetyTest test
exit 0
R1022PlacementReportTest: Tests run: 3, Failures: 0, Errors: 0, Skipped: 0
R1021PlacementScoreTest: Tests run: 5, Failures: 0, Errors: 0, Skipped: 0
R1020PlacementCheckpointTest: Tests run: 4, Failures: 0, Errors: 0, Skipped: 0
R1018PlacementOpenTest: Tests run: 4, Failures: 0, Errors: 0, Skipped: 0
P1PlacementJdbcControllerFlowTest: Tests run: 3, Failures: 0, Errors: 0, Skipped: 0
P1PlacementCompletionJdbcTest: Tests run: 1, Failures: 0, Errors: 0, Skipped: 0
P1PlacementJdbcControllerSafetyTest: Tests run: 6, Failures: 0, Errors: 0, Skipped: 0
```

`R1022PlacementReportTest` 覆盖：9 题和超前题序没有报告；10 题有稳定 `reportId` 和 `digest`，digest 能用上述四项事实重算；第二次读报告和会话摘要与库存字符串相同；同一第 10 题再交（原键或新键）不增加结果行，digest 不变；换选项为 409 且正文不变；报告 JSON 不含 `correctOption`、`answerRule` 和选项文案 `Alpha`。

## 没有 PASS 的部分

- 已发布的 `B10PlacementReport` 仍是旧结果形状，要求 `answerRulePin` 和 `reportDigest`。本卡的无答案报告用 `digest` 和 outcome 序列，故意没有写进 `packages/contracts`，也没有改 api-client 或网关。
- 无答案报告不写 `assessment.placement.completed.v1`。该事件载荷要求 answer-rule pin，放进去就会把 `answerRule` 带出报告边界。下游计划仍等这条旧事件。带答案规则的旧完成路径仍会写它。
- 会话读口仍带 R1-018 的 `answerRulePin`。无答案会话里这个 pin 只有 `completionRuleVersion`。报告正文和完成回执不带这个键。
- 第 10 题回执仍有 R1-021 的固定解释句，句中有英文 “answer rule”，没有正确选项，也没有键名 `answerRule`。
- 没有真实 MySQL，没有浏览器，没有 Luna 独立终审。不是 IT-2 出站。
