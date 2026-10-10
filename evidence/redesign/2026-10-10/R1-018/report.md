# R1-018 定级开题（10 道密封题干）

日期：2026-10-10。分支：`dev-redesign`。卡：R1-018 / BC-013。Owner 表面：learner-web / mobile。依赖：R1-017 已在工作区。

状态：学习门不过或题不足 10 道时不建会话；过门且题库给出 10 道无答案题干时可以开题。创建响应带 10 道 `stem` + `options`，序列化结果不含标准答案和解析。Web 与 Mobile 新开题改为 `POST /api/v1/assessment/placement/sessions`，已有会话读取走 `GET /api/v1/assessment/placement/sessions/{sessionId}`。**不是 ACCEPTED，也不是 IT-2 出站。** 没有 commit，没有 push。`CURRENT-PROGRESS.md` 未改。没有浏览器走查。没有改 content-service，没有占用 R1-026 的内容服务进程。

## 行为

网关本来就把 `POST /api/v1/assessment/placement/sessions` 转到 `/internal/v1/assessment/placement/sessions`。评估服务里已有 `P1PlacementJdbcController`，不是本卡新造的控制器。本卡补的是开题前的失败不落库，以及下发 10 道无答案题干。

创建前先读已验证 JWT。`adult_gate` 不是 `PASSED`，或 `consent_state` 不是 `GRANTED`，返回 403。这时不读题库，不写 `p1_placement_session`。权限不够同样 403，也不写。

题目只来自 `P1PlacementSourcePort`。`HttpPlacementBankPort` 请求 `GET /internal/v1/content/placement-bank/sealed`，只消费 R1-025 已上线的无答案 `data`：`bankCode`、`contentVersionId`、`contentEpoch`、`snapshotId`、`snapshotHash`、`contentStateVersion`、`items`。每题只要 `itemId`、`itemCode`、`itemType`、`dimension`、`displayOrder`、`stem`、`options`、`contentVersionId`。不再读取 `answerRule.correctOption`，也不再要求银行级 `answerRuleSetVersion`、`answerRuleVersion`、`ruleDigest`，不读表内 `answer_rule_json`，不编造 `correctOption`。这些字段缺失不再让开题 503。题不是 10 道，或题面上出现答案材料，仍然失败且不建会话。

开题记下银行级 `contentVersionId`、`contentEpoch`、`snapshotId`、`snapshotHash`。没有答案规则时，`answerRulePin` 只保留完成规则常量 `completionRuleVersion=P1_PLACEMENT_V1`，不含规则集版本、规则版本或规则摘要。计分快照留空，密封行不写 `answerRules`。判分留给 R1-021；现在对这种会话交卷会因没有规则而失败关闭，不在本卡补判分。

成功响应在契约原有的 `currentItem` 之外增加 `items`，共 10 条。每条有 `stem` 和 `options`。投影会丢掉 `explanation`、`correctAnswer`、`answer_rule`、`correctOption`。创建 HTTP 状态仍是契约里的 201，不是 503。

学习端网关基址已是 `/api/v1`，所以客户端路径是 `/assessment/placement/sessions`。新开题是空 body 的 POST，带 `Idempotency-Key`。没有 `asess_` 会话号时不调用 B25 `GET/POST /assessment/placement/start`，本地记为空，再走新开题。已有 `asess_` 会话用新的 GET 读回。作答仍走原来的 `/assessment/placement/submit-step`，跳过仍走 `/assessment/placement/skip`；那是 R1-020 / R1-023，本卡没有改。因此新会话的逐题提交没有在本卡证明。

真实运行时开题失败不回落到本地 10 题。`VITE_RUNTIME_MODE=preview` 的旧本地题库还在，只给预览，不作为新开题口。`b1.beginAssessment` 不再先造 `local-` 会话。

## 改动文件

本卡修改或新增：

- `services/assessment-service/src/main/java/com/englishflow/assessment/adapter/content/HttpPlacementBankPort.java`
- `services/assessment-service/src/main/java/com/englishflow/assessment/port/P1PlacementSourcePort.java`
- `services/assessment-service/src/main/java/com/englishflow/assessment/web/P1PlacementJdbcController.java`
- `services/assessment-service/src/test/java/com/englishflow/assessment/adapter/content/HttpPlacementBankPortTest.java`
- `services/assessment-service/src/test/java/com/englishflow/assessment/web/R1018PlacementOpenTest.java`
- `apps/learner-web/src/api/learner-content.ts`
- `apps/learner-web/src/api/b1.ts`
- `apps/learner-web/src/stores/learner-content.ts`
- `apps/learner-web/src/stores/b1.ts`
- `apps/learner-web/tests/placement-score-units.test.mjs`
- `apps/mobile/src/api/learner-content.ts`
- `apps/mobile/src/stores/learner-content.ts`
- `apps/mobile/tests/placement-score-units.test.mjs`
- `evidence/redesign/2026-10-10/R1-018/report.md`

没有修改 `services/content-service/**`、`evidence/redesign/2026-10-10/R1-025/**`、`evidence/redesign/2026-10-10/IT-1-exit/**`、注册页、登录页、重置页、向导选步和三条必要同意文案。工作区里那些路径上的其他差量不是本卡改的。

## 验证

没有建 `r1_018_*` 库，没有起停服务，没有 down/prune，没有动 qida 容器。退回后的收口只用真实 JSON 形状的单测，没有再起 content-service，也没有占用 18089。和正在跑的 placement-bank 实库联调仍未完成。

```text
cd /Users/Admin/Desktop/work/cloudstudy/services/assessment-service && mvn -q -Dtest=R1018PlacementOpenTest,HttpPlacementBankPortTest,P1PlacementSourcePortTest,P1PlacementJdbcControllerFlowTest,P1PlacementJdbcControllerSafetyTest test
exit 0
R1018PlacementOpenTest: Tests run: 4, Failures: 0, Errors: 0
HttpPlacementBankPortTest: Tests run: 6, Failures: 0, Errors: 0
P1PlacementSourcePortTest: Tests run: 2, Failures: 0, Errors: 0
P1PlacementJdbcControllerFlowTest: Tests run: 3, Failures: 0, Errors: 0
P1PlacementJdbcControllerSafetyTest: Tests run: 6, Failures: 0, Errors: 0
```

`HttpPlacementBankPortTest` 的成功报文只有上述真实字段，成功路径不再塞 `answerRule`。银行题面上再带 `answerRule.correctOption` 时解析失败，不会进 learner 题干。`R1018PlacementOpenTest` 覆盖：成人门或必要同意不够时 403 且不写库、不读题库；9 道题 503 且不写库；成功响应 10 题且序列化不含答案字段；无答案银行开题后密封行不含 `correctOption` / `answerRule`。

```text
cd /Users/Admin/Desktop/work/cloudstudy/apps/learner-web && node --test tests/placement-score-units.test.mjs tests/c04-assessment-chain.test.mjs tests/onboarding-resume.test.mjs
exit 0
tests 13, pass 13, fail 0
```

```text
cd /Users/Admin/Desktop/work/cloudstudy/apps/mobile && node --test tests/placement-score-units.test.mjs tests/onboarding-resume-step.test.mjs tests/mobile-learning-account-scope.test.mjs
exit 0
tests 21, pass 21, fail 0
```

Web 与 Mobile 的开题测试断言 POST `/assessment/placement/sessions`、空 body，以及题干解析后没有答案字段。源码里学习端不再出现 `/assessment/placement/start`。

## 没有 PASS 的部分

- 与 content-service placement-bank 的实库联调仍未完成。本轮按真实无答案 JSON 收口，没有打 18089。不能把「已经连上正在跑的内容服务」写成已验证。
- `BankPracticeRuleProvider` 仍从同一密封口读 `answerRule.correctOption` 给 B10 练习判分。那不是开题口。真实下发没有这些字段时，练习规则解析会空，留给 R1-021，本卡没有改它，也没有编造答案。
- 没有浏览器或真机走查，页面可见的 10 道题没有 PASS。
- 新会话的提交和跳过仍走 B25 写口，不在本卡范围，不能当成定级环可用。
- `items` 不在已发布的 `B10PlacementSession` schema 里（该 schema `additionalProperties: false`，只有 `currentItem`）。运行时响应多了这 10 道无答案题干。契约文件没有改。
- 不是 Luna 独立终审，不是 IT-2 出站，也不是 L2 干净库重放。
