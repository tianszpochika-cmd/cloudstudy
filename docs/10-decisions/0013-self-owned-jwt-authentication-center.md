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

1. Access Token 默认 5–15 分钟，Phase 1 固定使用 RS256；JWT 必须有 `iss/sub/aud/exp/iat/nbf/jti/token_type/scope`，`aud=yuxuexing-api`。ES256 只能在新增 ADR、同步更新契约与 JWKS key schema、密钥管理和运行实现并通过验证后扩展。
2. Gateway 与每一个领域服务独立通过 `jwk-set-uri` 获取 JWKS，并 fail closed 校验 issuer、签名、算法、audience、时间、token type、scope/permission；Gateway 验证不能替代服务侧 PEP。轮换时先发布新私钥/`kid`，通过 `IAM_JWT_PREVIOUS_PUBLIC_KEYS_JSON` 发布旧公钥重叠窗口，窗口至少覆盖 Access Token TTL + clock skew 后再下线旧公钥。
3. 密码使用 Argon2id；运行时不支持时使用 BCrypt cost≥12。登录限流、连续失败锁定、账号恢复、密码重置、设备管理和审计必须落库。
4. Refresh Token 为高熵不透明值，只保存摘要和轮换历史；重放、撤销、过期和设备失效一律拒绝，并撤销 token family。
5. 生产私钥只可由 KMS/secret manager 注入，不能进入 Git、镜像、普通配置、日志、URL、事件、埋点或错误响应。
6. 客户端提交的 role、roles、permission、permissions、tenant、tenantId、owner、ownerId、subject 等字段和请求头永远不是授权事实。

## 四端与认证传输（P1R-M1-002）

learner-web、admin-web、mobile 使用同一认证中心和 audience，但分别维护 UI 与设备边界。普通用户访问管理员资源为 403，未认证、错误/过期/伪造 Token 为 401。认证成功响应必须使用 canonical envelope，且 `data.authTransport` 是生成客户端用于静态收窄的 discriminator；不得再用一个带可选 `refreshToken` 的混合响应代表所有端。

| 运行形态 | `X-Auth-Transport` | Access Token | Refresh Token 输入与响应 | 持久化边界 |
|---|---|---|---|---|
| learner-web、admin-web、移动 H5，以及其他浏览器运行形态 | `WEB_COOKIE`（省略 header 时的兼容默认值） | 仅内存；不进入 URL、Web storage、日志、埋点或事件 | 注册、登录、刷新成功时仅通过 `Set-Cookie` 返回 `yuxuexing_refresh`；JSON `data` 永不含 `refreshToken`。刷新请求只携带该 HttpOnly Cookie，JSON body 不得含 `refreshToken`。 | Cookie 必须为 `HttpOnly; Secure; SameSite=Lax; Path=/api/v1/auth`。 |
| iOS、Android、原生 iPad 运行形态 | `NATIVE_SECURE_STORAGE`（必须显式选择） | 短时、瞬态使用；不得写入普通 storage | 注册、登录、刷新成功的 JSON `data.refreshToken` 必须存在；刷新请求 body 必须显式提交该值；不得发出 Web Refresh Cookie。 | Refresh Token 只可写入 Keychain/Keystore；禁止 localStorage、sessionStorage、uni-app 普通 storage 及任何明文 fallback。 |
| official-site | 不建立业务会话 | 不保存 | 仅产生 allow-list 的公开登录/下载 deep link；不接收或保存业务 Token | 不承载登录后的学习业务。 |

`X-Auth-Transport` 只选择凭据传输方式，不是授权事实，不能建立或覆盖 principal、tenant、role、permission、owner、scope 或设备信任。服务端必须将其与申报的设备类型和可信客户端上下文交叉校验；选择与运行形态不一致时 fail closed。注册、登录和刷新保留相同公开端点，但请求与响应的 Web/Native variant 必须通过该选择与 `data.authTransport` 明确区分。

Refresh Token 每次使用均轮换并保存摘要/历史；同一幂等键可返回原轮换结果，其他 key 的旧值复用或重放必须返回 401、审计关联，并撤销对应 token family 及关联 session。登出撤销当前 session/token family（`allDevices=true` 时撤销该 principal 的全部 session/token family）；显式会话撤销至少撤销目标 session 的 family；密码重置成功撤销所有既有 session/token family。对当前 Web 会话，登出、密码重置和适用的会话撤销必须以同名、同 Path 的 `Set-Cookie` 清除 `yuxuexing_refresh`（`Max-Age=0` 且过去的 `Expires`）；原生端不发 Cookie，客户端只从 Keychain/Keystore 删除相应凭据。

完整 CORS、CSRF、Origin/Referer 与跨站凭据策略由 P1R-M1-004 定义。本 ADR 仅冻结 Refresh Token 的传输和会话终止语义，不能据此放宽 Gateway 的跨域或请求来源校验。
