# ADR-0013：自有 JWT 认证中心

- **状态**：accepted / 当前正式登录基线
- **日期**：2026-08-28
- **范围**：账号密码、JWT 签发、JWKS、刷新/撤销、设备会话、四端登录边界

## 背景与决策

语学星不使用 OIDC、OAuth 2.1、Keycloak 或第三方身份提供方作为正式登录方案。`services/iam-service` 是唯一认证中心：在 TLS 登录接口校验账号密码，生成服务端 principal/tenant/role/permission 事实，签发短时非对称 JWT Access Token，并发布当前公钥 JWKS。认证协议只采用项目自有的 JSON API，不保留授权码、PKCE、state、nonce 或回调流程。

统一接口如下：

| 方法 | 路径 | 作用 |
|---|---|---|
| POST | `/api/v1/auth/register` | 创建账号；权限事实由服务端生成 |
| POST | `/api/v1/auth/login` | 校验账号密码、创建设备会话、签发 Access/Refresh |
| POST | `/api/v1/auth/token/refresh` | 校验并轮换 Refresh Token |
| POST | `/api/v1/auth/logout` | 撤销当前会话并清理 Web Cookie |
| POST | `/api/v1/auth/sessions/{sessionId}/revoke` | 撤销指定设备会话 |
| GET | `/api/v1/auth/jwks` | 公开验签公钥；发布新 `kid` 时保留旧公钥完成双钥并行轮换 |
| POST | `/api/v1/auth/password-reset/request` | 创建限流的一次性重置流程 |
| POST | `/api/v1/auth/password-reset/confirm` | 消费重置凭证并撤销旧会话 |

## 安全约束

1. Access Token 默认 5–15 分钟，使用 RS256 或 ES256；JWT 必须有 `iss/sub/aud/exp/iat/nbf/jti/token_type/scope`，`aud=yuxuexing-api`。
2. Gateway 与每一个领域服务独立通过 `jwk-set-uri` 获取 JWKS，并 fail closed 校验 issuer、签名、算法、audience、时间、token type、scope/permission；Gateway 验证不能替代服务侧 PEP。轮换时先发布新私钥/`kid`，通过 `IAM_JWT_PREVIOUS_PUBLIC_KEYS_JSON` 发布旧公钥重叠窗口，窗口至少覆盖 Access Token TTL + clock skew 后再下线旧公钥。
3. 密码使用 Argon2id；运行时不支持时使用 BCrypt cost≥12。登录限流、连续失败锁定、账号恢复、密码重置、设备管理和审计必须落库。
4. Refresh Token 为高熵不透明值，只保存摘要和轮换历史；重放、撤销、过期和设备失效一律拒绝，并撤销 token family。
5. 生产私钥只可由 KMS/secret manager 注入，不能进入 Git、镜像、普通配置、日志、URL、事件、埋点或错误响应。
6. 客户端提交的 role、roles、permission、permissions、tenant、tenantId、owner、ownerId、subject 等字段和请求头永远不是授权事实。

## 四端

learner-web、admin-web、mobile 使用同一认证中心和 audience，但分别维护 UI 与设备边界。Web Access Token 只存在内存，Refresh Token 使用 HttpOnly/Secure/SameSite Cookie；移动端只能使用 Keychain/Keystore 等安全存储；official-site 只跳转到 allow-list 登录 URL，不保存业务 Token。普通用户访问管理员资源为 403，未认证、错误/过期/伪造 Token 为 401。
