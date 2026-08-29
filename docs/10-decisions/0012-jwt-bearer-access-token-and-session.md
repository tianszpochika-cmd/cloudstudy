# ADR-0012：JWT Bearer Access Token 与四端会话基线

- **状态**：accepted / 由 ADR-0013 补充签发与认证中心边界
- **日期**：2026-08-28
- **范围**：JWT profile、四端会话存储、API 验证和异常交互
- **关联**：[ADR-0013](0013-self-owned-jwt-authentication-center.md)

## 决策

JWT 是 API Access Token 格式。认证中心校验账号密码并直接签发短时非对称 JWT；所有业务 API 的 `aud` 固定为 `yuxuexing-api`。Gateway 和每个领域服务必须独立通过 IAM JWKS 验证签名、issuer、算法、audience、时间窗口、token type 和 scope/permission，再执行本地 PEP。

Access Token 至少包含：`iss`、`sub`、`aud`、`exp`、`iat`、`nbf`、`jti`、`token_type=access`、`scope`。需要授权时增加由 IAM 事实生成的 `permissions`、`roles`、`tenant_id`、`session_id`；客户端请求头和请求体不能覆盖这些声明。只允许登记的 RS256/ES256，拒绝 `none`、HMAC、错误 key id、错误 issuer/audience 和过期 Token。

Refresh Token 是不可用于业务 API 的高熵不透明会话凭证。每次刷新都轮换并使旧值失效；旧值再次出现即视为重放，撤销整个 token family、设备会话并记录审计事实。登出、设备撤销、密码重置和管理员强制下线都必须立即撤销服务端会话。

## 四端存储

| 端 | Access Token | Refresh Token |
|---|---|---|
| learner-web / admin-web | 仅内存 | HttpOnly + Secure + SameSite Cookie，不进入 Web storage |
| mobile H5 | 仅内存 | 使用移动安全会话适配器；不可把凭证写入普通 storage |
| iOS / Android / iPad | 仅内存 | Keychain/Keystore；安全存储不可用时登录失败 |
| official-site | 不建立业务会话 | 不保存；只跳转到 allow-list 的统一登录页 |

认证失败返回 401；身份已确认但缺少资源权限返回 403。页面刷新、后台恢复和 401 只触发一次受控刷新，刷新失败回到登录页；业务页面不得解析 JWT、拼接角色或读取 URL Token。
