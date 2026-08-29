# ADR-0011：外部身份提供方方案废止

- **状态**：superseded（2026-08-28；正式登录方案改为 ADR-0013）
- **范围**：历史登录方案、迁移记录和审计索引

## 决策

外部身份提供方、托管登录页和授权回调不再是语学星的正式登录方案。仓库中的旧讨论只保留为迁移审计线索，不得被实现、配置、测试或默认路由引用；不得重新引入第三方身份服务、外部授权码流程或旧运行时。

当前唯一有效的认证决策见 [ADR-0013：自有 JWT 认证中心](0013-self-owned-jwt-authentication-center.md)。它要求 `iam-service` 在 TLS 接口校验平台账号密码，直接签发非对称 JWT Access Token，发布 JWKS，并负责 Refresh Token、设备、会话、撤销和密码重置。

## 迁移边界

- 旧路径、旧配置和旧测试不得作为默认登录入口；若短期保留兼容名称，必须标记 `historical-compatibility`，不得签发旧 Token。
- Gateway 和每个领域服务必须直接配置 IAM 的 JWKS URI，不得使用发现文档或外部 issuer 适配。
- 生产私钥由 KMS/secret manager 注入，不能进 Git、镜像、日志或测试快照。
