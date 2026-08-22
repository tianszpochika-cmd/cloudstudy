# ADR-0011：标准 OIDC IdP 接入与 G-IDP 发布 Gate

- **状态**：proposed / G-IDP 未通过
- **日期**：2026-08-22
- **范围**：B8 身份提供方、OIDC/OAuth 2.1、移动端登录、工作负载身份、迁移与回滚
- **前置**：ADR-0010、B7 Gateway/契约/观测底座

## 决策摘要

语学星不自研 OAuth/OIDC 授权服务器、Token 签发器或 JWKS 服务。`iam-service` 只实现产品 IAM 控制面和标准 IdP 适配端口；真实供应商只有在 G-IDP Gate 通过后，才允许写入部署配置并进入默认路由。B8 在 Gate 未通过前只能使用 provider-neutral contract、fake IdP、签名 JWT fixture 和 fail-closed 测试替身。

## G-IDP 通过条件

具体 IdP 必须由产品、架构、安全、合规和运维共同签收，并至少提交以下证据：

1. OIDC Discovery、Authorization Code + PKCE（S256）、state/nonce、redirect URI allow-list 和移动端系统回调验证；不使用隐式流或 Resource Owner Password 流。
2. JWKS 发布、双钥并行轮换、issuer/audience 校验、时钟偏差、密钥回滚和密钥不可进入 Git/镜像/日志的证据。
3. Refresh Token rotation、重放检测、会话撤销、设备踢出、全局 logout、异常会话恢复和审计关联证据。
4. Web、uni-app H5/App/iPad、后台 workload identity 的客户端类型、secret 管理、最小 scope 和环境隔离方案。
5. 可用性、限流、故障降级、数据驻留/合规、供应商退出、迁移双读/回滚和紧急禁用方案。
6. 测试租户、假用户、过期/撤销/重放/JWKS 轮换 fixture，以及不依赖生产账号的 CI 验证方式。

## 实施边界

- `iam-service` owns principal mapping, platform tenant derivation, device/session/consent, product roles/permissions/policy metadata and audit facts; the IdP owns protocol-level authentication and upstream subject assertion.
- Gateway and every domain service must validate the access token independently. Gateway validation is not a substitute for service-side Resource Server and PEP checks.
- `tenantId`、`ownerId`、`role`、`permission` and age are never accepted from client headers or request body as authorization facts.
- Phase 1 is adults-only. Missing, unverifiable or under-18 age evidence fails closed and must not create child/guardian/K12/payment facts.
- When the IdP, JWKS, revocation state or policy version is uncertain, protected requests return explicit 401/403 and an auditable decision; they never fall back to anonymous access or a stale allow.

## 迁移与回滚

1. B8 code phase: provider-neutral adapters, contract, fake IdP and local test profile only; no real issuer in Git.
2. Gate phase: select one approved IdP, configure issuer/audience/JWKS through secret/config management, run contract and security journeys, then enable Resource Server in a non-production environment.
3. Migration phase: support old session read/revoke compatibility only behind an explicit feature flag; issue no new legacy tokens; dual-read only for a bounded window with trace/audit evidence.
4. Rollback phase: disable the new route/config, keep existing sessions fail-closed or explicitly revoked, preserve principal mapping and audit records, and never silently downgrade to unsigned or anonymous authentication.

真实 IdP、生产 JWKS、workload identity、供应商 SLA 和密钥托管在本 ADR 获批前均不是 B8 完成证据。
