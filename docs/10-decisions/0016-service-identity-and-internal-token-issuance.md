# ADR-0016：服务身份与内部令牌签发

- 状态：已接受
- 日期：2026-09-14
- 相关任务：`P1R-M2-006`（Gateway 脱敏 envelope 经 canonical ingest 持久化、回放和故障恢复）、`P1R-M2-007`（配置/密钥分发）
- 合约事实源：`packages/contracts/openapi/iam-service.yaml`、`config/p1r-m2-requirement-owners.v1.json`
- 关联决策：[ADR-0010](0010-java25-microservices-gateway-iam.md)（Java 25 微服务与 Gateway/IAM）、[ADR-0012](0012-jwt-bearer-access-token-and-session.md)（JWT Access Token）、[ADR-0013](0013-self-owned-jwt-authentication-center.md)（自有认证中心）、[AGENTS.md](../../AGENTS.md)

## 背景

`P1R-M2-006` 要求 Gateway 的脱敏安全审计 envelope **经 canonical ingest 持久化**，并可回放与故障恢复。实现侧已经完成：

- `HttpSecurityAuditSink` 把 `SecurityAuditRecord` 投递到 audit-service 的 `/internal/v1/audit/events`，在请求线程之外、失败不使请求失败、失败与关闭期丢弃均计数；
- `scripts/runtime/verify-gateway-audit-ingest.mjs` 端到端探针，八个断言。

探针实测（2026-09-14）八项中**两项通过、六项失败**：网关确实拒绝了未认证请求（HTTP 401）并返回了供关联的 `requestId`，但 audit schema 中**没有任何事实落库**。

原因不在投递，而在**凭据**：

| 事实 | 来源 |
|---|---|
| audit-service 的 `/internal/v1/audit/**` 要求**已认证 JWT**，并校验 issuer 与 audience | `AuditSecurityConfiguration` |
| iam-service **没有**任何服务令牌或 client-credentials 端点 | IAM 端点清单 |
| `TOKEN_TYPE_service` 这个 authority **只出现在安全配置里**（`IamSecurityConfiguration` 的 `/internal/v1/**` 规则），**没有任何地方签发它** | 全仓检索 |
| `AGENTS.md` §2.2：`iam-service` 是唯一 Token 签发方，领域服务、Gateway 和客户端均**不得自行签发** | `AGENTS.md` |

也就是说：**接受侧已经存在，签发侧不存在**。按 §3.5"引入新基础设施或改变服务边界必须新增 ADR"，本决策必须记录，而不得由实现者静默补上一个自签路径。

## 决策

**由 IAM 签发短时服务令牌，内部调用方以服务客户端凭据换取。**

1. `iam-service` 新增 `POST /internal/v1/iam/service-token`：
   - 请求：`clientId` + `clientSecret`（**由 secret manager / 环境注入，不入 Git**）；
   - 响应：RS256 JWT，`token_type: service`、`sub: svc:<serviceId>`、`aud` 与用户令牌相同、`permissions` 为该服务**被授予的最小集合**（例如 `api-gateway` 为 `audit.ingest`）、**TTL 5 分钟**、**不发 refresh**。
2. IAM 的 `TOKEN_TYPE_service` 授权规则由此**获得签发方**，内部端点的既有要求不变。
3. 调用方（首个为 Gateway）：
   - 缓存令牌至接近过期，`401/403` 时**重新获取一次**；
   - 仍失败则**计数并放弃本次投递**，**绝不影响被观察的请求**；
   - 令牌**只存内存**，不落盘、不入日志。
4. **每一次签发都写审计事实**（谁、何时、为哪个服务、授予哪些权限）。

## 被否决的选项

| 选项 | 否决理由 |
|---|---|
| Gateway 自行签发 | **直接违反** `AGENTS.md` §2.2"`iam-service` 是唯一 Token 签发方" |
| 服务间静态共享密钥头 | 无法表达**最小权限**（`audit.ingest`）与**可撤销**，泄露即长期有效 |
| 服务间 mTLS | 需要证书分发、轮换与吊销基础设施，超出 Phase 1 范围与运维能力；可在 Phase 2 重新评估 |

## 后果

- **正面**：`P1R-M2-006` 的最后一项退出证据可被端到端验证（探针由 6 项失败转为 8 项通过）；服务身份成为后续所有服务间调用的**统一机制**，而不必每个调用各造一套；保持"唯一签发方"约束不破。
- **代价**：新增一个**凭据分发**需求，由 `P1R-M2-007`（配置/密钥）承接；密钥轮换与撤销流程需在该任务中落地。
- **风险**：服务令牌是**长期凭据的短时化**，其安全性取决于 `clientSecret` 的分发与轮换。若 `P1R-M2-007` 未落实轮换，本决策的价值将退化为"静态密钥 + 过期时间"。**这一点被明确登记为 M2-007 的退出条件之一。**
- **不做的事**：本 ADR **不**改变用户认证路径；**不**引入 OIDC/OAuth、Keycloak 或任何第三方身份提供方（`AGENTS.md` §2.2 明确禁止）；**不**允许领域服务签发令牌。
