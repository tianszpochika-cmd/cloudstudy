# R1-021 规则判分（FULL 或 ZERO）

日期：2026-10-10。分支：`dev-redesign`。卡：R1-021 / BC-015。Owner：assessment-service。依赖：R1-020 已在工作区。

状态：无答案定级会话只给 R1-020 已接收的当前题判分。结果只有 `FULL` 或 `ZERO`，回执带一句固定解释。乱序仍是 409，不判分。答案只留在 `content_placement_item.answer_rule_json`。密封下发和开题响应仍然没有 `answerRule`、`correctOption`。**不是 ACCEPTED，也不是 IT-2 出站。** 没有 commit，没有 push。`CURRENT-PROGRESS.md` 未改。没有起 content-service，没有占用 18089。最终定级报告是 R1-022，本卡没有写。

## 行为

判分口在 content-service：`POST /internal/v1/content/placement-bank/score`。请求体只有 `itemId` 和 `selectedOptionId`。响应 `data` 只有 `itemId`、`outcome`、`explanation`。比较是 `String.equals`，不 trim、不折叠大小写、不模糊匹配。选项等于该题 `correctOption` 才是 FULL，否则 ZERO。解释是固定两句，不含正确选项文本：

- FULL：`Selected option equals the stored answer rule.`
- ZERO：`Selected option does not equal the stored answer rule.`

该口先校验调用方。未认证是 401。`token_type` 不是 `service`、`service_id` 对不上 subject、或权限里没有 `content:answer-rules:read`，是 403。learner 的 access token 即使带了该权限也进不了判分。JWT 解码器现在接受 `access` 或 `service`；其他内容口仍走原来的 learner 读权限，判分控制器自己拒绝 access token。题不存在、未发布或版权不允许学习是 404。库存的 `correctOption` 对不上任一 `optionId` 是 503，不编造答案。

assessment-service 用 `HttpPlacementRuleScorePort` 调这个口。只带配置的服务令牌，不转发 learner JWT。基址默认 `http://127.0.0.1:18089`，令牌来自 `ASSESSMENT_PLACEMENT_SCORE_SERVICE_TOKEN`，默认空。空令牌在发 HTTP 之前 503。非 200、响应体含 `correctOption`、敏感键、`itemId` 对不上、或解释不是上面两句，都是 503，原因里不回显对方正文，也不发明结果。

交卷仍走 R1-020 的 `POST /internal/v1/assessment/placement/sessions/{sessionId}/responses`。顺序、版本、`itemId` 先检查；409 不调用判分口、不写响应。通过之后，无答案当前题才判分。多个 `selectedOptionId` 在本地记 ZERO，不把第一个 id 送去判成 FULL。`p1_placement_response.correct` 写入 true 或 false。回执可以有 `outcome=FULL|ZERO` 和那句解释，序列化不含 `correctOption`，也不含标准答案。状态留在 `IN_PROGRESS`。10 题判完也不写 `p1_placement_result`，不写完成 outbox。同一幂等键回放原回执，不再判一次。回执丢失时，有判分口的会话按已存的 `correct` 重拼同一句解释；`correct` 仍是 NULL 的旧行不补判。

带 `questionType` 和 `answerRules` 的旧密封行仍走原来的 `RuleScoringEngine`。四参构造器把判分口留空，R1-020 的无答案接收测试还走那条缝。Spring 运行时用五参构造器，判分口 bean 始终存在。空令牌不会静默收成未判分，无答案交卷会 503，检查点不写。

`GET /internal/v1/content/placement-bank/sealed` 和 plan-items 的响应形状没有改。`BankPracticeRuleProvider` 没有改。

## 改动文件

本卡修改或新增：

- `services/content-service/src/main/java/com/englishflow/content/web/PlacementBankSealedController.java`
- `services/content-service/src/main/java/com/englishflow/content/web/ContentHttpPrincipals.java`
- `services/content-service/src/main/java/com/englishflow/content/security/ContentSecurityConfiguration.java`
- `services/content-service/src/test/java/com/englishflow/content/web/PlacementBankScoreJdbcTest.java`
- `services/content-service/src/test/java/com/englishflow/content/security/ContentJwtDecoderNegativeTest.java`
- `services/assessment-service/src/main/java/com/englishflow/assessment/port/PlacementRuleScorePort.java`
- `services/assessment-service/src/main/java/com/englishflow/assessment/adapter/content/HttpPlacementRuleScorePort.java`
- `services/assessment-service/src/main/java/com/englishflow/assessment/web/P1PlacementJdbcController.java`
- `services/assessment-service/src/main/java/com/englishflow/assessment/config/AssessmentPersistenceConfiguration.java`
- `services/assessment-service/src/main/java/com/englishflow/assessment/adapter/content/HttpPlacementBankPort.java`（仅注释：开题适配器不读答案）
- `services/assessment-service/src/main/resources/application.yml`
- `services/assessment-service/src/test/java/com/englishflow/assessment/web/R1021PlacementScoreTest.java`
- `services/assessment-service/src/test/java/com/englishflow/assessment/adapter/content/HttpPlacementRuleScorePortTest.java`
- `evidence/redesign/2026-10-10/R1-021/report.md`

没有修改 `apps/**`、`packages/i18n/**`、`services/api-gateway/**`、`packages/contracts/**`、`evidence/redesign/2026-10-10/R1-027/**`。工作区里这些路径上的其他差量不是本卡改的。

## 验证

没有建库，没有起停服务，没有打 18089。判分口单测用内存 H2。HTTP 适配器单测用 `127.0.0.1:0` 的临时 `HttpServer`，测完即停。没有留进程。

```text
cd services/assessment-service && mvn -q -Dtest=R1021PlacementScoreTest,R1020PlacementCheckpointTest,HttpPlacementRuleScorePortTest,R1018PlacementOpenTest,P1PlacementJdbcControllerFlowTest test
exit 0
R1021PlacementScoreTest: Tests run: 5, Failures: 0, Errors: 0, Skipped: 0
R1020PlacementCheckpointTest: Tests run: 4, Failures: 0, Errors: 0, Skipped: 0
HttpPlacementRuleScorePortTest: Tests run: 3, Failures: 0, Errors: 0, Skipped: 0
R1018PlacementOpenTest: Tests run: 4, Failures: 0, Errors: 0, Skipped: 0
P1PlacementJdbcControllerFlowTest: Tests run: 3, Failures: 0, Errors: 0, Skipped: 0

cd services/assessment-service && mvn -q -Dtest=P1PlacementJdbcControllerSafetyTest,P1PlacementCompletionJdbcTest,P1PlacementSourcePortTest test
exit 0
P1PlacementJdbcControllerSafetyTest: Tests run: 6, Failures: 0, Errors: 0, Skipped: 0
P1PlacementCompletionJdbcTest: Tests run: 1, Failures: 0, Errors: 0, Skipped: 0
P1PlacementSourcePortTest: Tests run: 2, Failures: 0, Errors: 0, Skipped: 0

cd services/content-service && mvn -q -Dtest=PlacementBankScoreJdbcTest,PlacementBankSealedJdbcTest,ContentJwtDecoderNegativeTest,ContentLearnerEligibilityTest test
exit 0
PlacementBankScoreJdbcTest: Tests run: 5, Failures: 0, Errors: 0, Skipped: 0
PlacementBankSealedJdbcTest: Tests run: 6, Failures: 0, Errors: 0, Skipped: 0
ContentJwtDecoderNegativeTest: Tests run: 8, Failures: 0, Errors: 0, Skipped: 0
ContentLearnerEligibilityTest: Tests run: 3, Failures: 0, Errors: 0, Skipped: 0
```

`R1021PlacementScoreTest` 覆盖：当前题答对 FULL、答错 ZERO、回执和外层 JSON 不含 `correctOption`、超前题序和错误 `itemId` 为 409 且判分口调用次数为 0。另覆盖大小写和空白被现有选项键 422 且不判分、两个选项本地 ZERO、缺答案 503 且不写检查点。`PlacementBankScoreJdbcTest` 覆盖库存 `equals`：`"a"` 为 FULL，`"A"`、`"a "`、`" a"` 为 ZERO；服务令牌以外 401/403；密封 JSON 仍无答案。

## 没有 PASS 的部分

- 已发布契约仍写着 “Scoring read is left to R1-021.”。`B10PlacementResponseReceipt` 仍是 `additionalProperties: false`，没有 `outcome`、`explanation`。内部操作基线仍是 66。新判分口故意没有写进 `packages/contracts`，也没有改 api-client 或网关。
- 服务令牌是配置项，不是 IAM 现场签发的令牌，仓库里没有提交密钥。令牌为空时无答案交卷 503，不假装未判分通过。
- 四参构造器仍是 R1-020 测试缝，`correct` 保持 NULL。运行时不走这条缝。已经入库且 `correct` 为 NULL 的行不补判。
- 无答案会话判完 10 题仍是 `IN_PROGRESS`，没有 `reportId` 和 digest。那是 R1-022。
- 学习端没有改回执展示。`apps/**` 在本卡禁改范围内。
- `BankPracticeRuleProvider` 仍从练习侧读取 `answerRule.correctOption`。密封定级下发没有把答案加回去。
- 没有真实 MySQL，没有浏览器，没有 Luna 独立终审，不是 IT-2 出站。
