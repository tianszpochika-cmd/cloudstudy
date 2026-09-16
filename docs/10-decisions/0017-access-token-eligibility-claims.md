# ADR-0017：访问令牌签发侧补齐学习资格 claims（`adult_gate` / `consent_state`）

- 状态：已接受（人类负责人全权委托执行，2026-09-16）
- 日期：2026-09-16
- 相关任务：`P1R-M2-002`（IAM 签发）、`P1R-M2-003`（领域 PEP）、`P1R-M4-001~004`（首日链）
- 缺陷：P1-LIVE-001（本地全栈活链路实测发现）
- 合约事实源：`packages/contracts/fragments/b8/b8-auth-iam.openapi.json`（`x-b8-authentication.accessToken.eligibilityClaims`）、`packages/contracts/openapi/v1/openapi.json`
- 关联决策：[ADR-0012](0012-jwt-bearer-access-token-and-session.md)（JWT Access Token）、[ADR-0013](0013-self-owned-jwt-authentication-center.md)（自有认证中心）

## 背景

2026-09-16 本地全栈（Gateway + 16 服务 healthy）活链路 W0 实测 10/11：注册 201、重复注册 409、登录 200 + HttpOnly refresh、3 项同意 200、成人门 `PASSED/ELIGIBLE/SERVER_VERIFIED`、匿名 401 全部通过；**登录后调 `GET /api/v1/learner/profile` 永远 403 `CONSENT_REQUIRED`**（同意后重登、换新 token 亦然）。

根因是签发/消费两侧断裂：

| 事实 | 来源 |
|---|---|
| `JwtTokenService.issue` 只签发 `tenant_id/roles/permissions/session_id/amr`，**从不签发** `consent_state/adult_gate/adult_gate_passed`（解码刚签发的 JWT 实证） | `services/iam-service/.../auth/JwtTokenService.java` |
| learner PEP 只认这几个 claim（`PASSED`/`GRANTED`），缺席即 `UNKNOWN` → `CONSENT_REQUIRED` 拒绝 | `VerifiedLearnerPrincipalFactory.java:64-72`、`LearnerAccessPolicy.java:52-53` |
| learning 有同构硬门；social 只做软记录 | `LearningAccessPolicy.java:49-50`、`SocialJwtAuthenticationConverter.java:32` |
| M2-003 冒烟只验到“合法令牌能过网关”，M4-004 是域内复用验证——此前从没有任何一次活 profile 调用 | 证据链复核 |

即：**消费侧（11 服务）早已实现，签发侧缺失**——与 ADR-0016 解决的“服务令牌无签发方”同构。

## 决策

1. IAM 在**签发时**服务端求值两项事实并写入 access token：`adult_gate`（`PASSED/NOT_EVALUATED/REJECTED`）与 `consent_state`（`GRANTED/UNKNOWN/WITHDRAWN`），复用 `principal/me` 已在用的同一套严格匹配（文档/策略摘要、目的、撤回效应全比对）。
2. 求值失败**使签发本身失败**，绝不签发越权 token；旧重载默认签发显式拒绝值（`NOT_EVALUATED/UNKNOWN`），不静默省略。
3. 时效边界：claim 在签发时刻冻结，随 900s TTL 过期；同意撤回按既有语义撤销会话（`WithdrawalEffect.RESTRICT_ALL_LEARNING_ACCESS` + `revokeSessions=true`），下一次签发重估——旧 token 最多存活一个 TTL 窗口。
4. 领域侧**零改动**：learner/learning/social 的 claim 读取逻辑保持原样（M2-003 已验收的行为）。

## 后果

- 首日链（注册→成人门→同意→画像/定级/计划/今日）首次在活链路上可达；W0 由 10/11 转 11/11（待本轮实测确认）。
- 新增单测 `JwtTokenServiceTest`（3 项：显式携带 / 未知默认拒绝值 / null 省略）；IAM 全套 `100/0/0` 回归通过。
- 风险：签发路径新增两次服务端读（门事实 + 同意求值），登录/注册/刷新延迟微增；control-plane 模式下文档缺席将使签发 fail-closed（与 `principal/me` 的既有 `RESTRICTED` 语义一致）。
