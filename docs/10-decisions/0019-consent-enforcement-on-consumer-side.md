# ADR-0019：同意撤回的消费侧执行与学习域同意门（P1-LIVE-009）

- 状态：已接受（人类负责人全权委托执行，2026-09-16）
- 日期：2026-09-16
- 相关任务：`P1R-M2-003`（领域 PEP）、`P1R-M4-003`（同意与撤回）、`P1R-M5-014`（学习闭环）
- 缺陷：P1-LIVE-009（本地全栈活链路 W0b/W2 实测发现，两项）
- 合约事实源：`packages/contracts/fragments/b8/b8-auth-iam.openapi.json`（`consent_state` 语义不变，本次无契约变更）
- 关联决策：[ADR-0017](0017-access-token-eligibility-claims.md)（签发侧 claims）

## 背景

签发侧补齐后，活链路反向证明了两处消费侧缺陷（均为"撤回/门前不断开"的同一物种）：

| # | 现象（活实测） | 根因 |
|---|---|---|
| 1 | `ADULT_LEARNING` 撤回（200）后**重新登录**，新 token 照样调通 `GET /learner/profile`（200） | `VerifiedLearnerPrincipalFactory` 把 `adult_gate=PASSED` 或运算进 GRANTED。门是粘性年龄事实，同意是可撤回的——或运算使撤回永远拦不住 |
| 2 | 门前用户（无成人门、无同意）`POST /learning/srs/reviews` **200 写入成功**，而 learner 侧同等调用正确 403 | `LearningHttpPrincipals.require()`（B25/B3/V2 三端共用 funnel）只验租户/角色/权限非空，从不求值 `consent_state`；门前 token 恰好满足这三项 |

## 决策

1. learner 工厂：GRANTED 只认显式 `consent_state=GRANTED`；删掉 `adult_gate=PASSED` 与 `adult_gate_passed` 两个或分支（后者 IAM 从不签发，是死分支）。`WITHDRAWN`/`UNKNOWN` 保持拒绝。
2. learning funnel 单点加门：`LearningHttpPrincipals.require()` 要求 `consent_state=GRANTED`，否则 403。B25/B3/V2 同收敛，无需逐端改。
3. 不动的：签发侧（已实证签出 UNKNOWN）、social（本来就没有或分支）、B25 的角色/租户检查。

## 后果

- 撤回后新签发 token 调 learner profile → 403（活验证）；门前 SRS 写 → 403（待重启后复验）。
- `LearningHttpPrincipalsTest` 5 项（含新增未授权三态）；learner 49/0/0、learning 142/0/0。
- 已知 TTL 行为（非缺陷）：撤回前已签发的 token 在 900s 内仍放行，这是签发时刻冻结语义，W0b 显式断言并记录。
