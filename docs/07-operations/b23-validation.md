# B23 平台自有 JWT 登录与 IAM 运行验证

> 基线：V2-PHASE1-AUTH-DATA-20260828
> 状态：代码、契约、迁移和 fail-closed 逻辑测试已完成；真实 IAM HTTP、MySQL、Gateway、领域服务和浏览器运行证据待验收。
> 认证边界：平台自有账号密码认证中心；不使用外部登录协议或第三方身份提供方。

## 1. 目标

B23 验证 `iam-service` 是否能够在 TLS 边界校验账号密码，创建服务端 principal、tenant、device 和 session 事实，签发短时 RS256 JWT Access Token，并通过 JWKS 为 Gateway 与每个领域服务提供独立验签所需的公钥。

## 2. 规范化接口

| 方法 | 路径 | 作用 | 认证 |
|---|---|---|---|
| POST | `/api/v1/auth/register` | 创建账号、设备会话并签发 JWT | 公开，限流/幂等 |
| POST | `/api/v1/auth/login` | 校验账号密码并签发 JWT | 公开，限流/失败锁定 |
| POST | `/api/v1/auth/token/refresh` | 轮换不透明 Refresh Token | Cookie 或原生安全存储凭证 |
| POST | `/api/v1/auth/logout` | 撤销当前或全部设备会话 | Bearer JWT |
| POST | `/api/v1/auth/sessions/{sessionId}/revoke` | 撤销指定设备会话 | Bearer JWT |
| GET | `/api/v1/auth/jwks` | 发布当前签名公钥 | 公开，只读 |
| POST | `/api/v1/auth/password-reset/request` | 创建一次性短时重置挑战 | 公开，非枚举/限流 |
| POST | `/api/v1/auth/password-reset/confirm` | 消费重置挑战并更新密码 | 公开，凭证一次性 |
| GET | `/api/v1/iam/principal/me` | 返回服务端主体与会话事实 | Bearer JWT |

Access Token 的 `aud` 固定为 `yuxuexing-api`，至少包含 `iss`、`sub`、`aud`、`exp`、`iat`、`nbf`、`jti`、`token_type=access` 和非空 `scope`，并可包含服务端生成的 `roles`、`permissions`、`tenant_id`、`session_id`。Refresh Token 是随机不透明凭证，只保存摘要和历史摘要。

## 3. 验证矩阵

| 场景 | 预期 |
|---|---|
| 正确账号密码 | `200`，Bearer Access Token、过期时间、session/device 标识返回；Web 设置 HttpOnly Cookie |
| 错误密码 | `401`，通用错误，不泄漏账号存在性；失败计数增加 |
| 连续失败达到阈值 | `423` 或契约定义的锁定错误，等待或密码重置后恢复 |
| Access Token 过期 | 业务 API `401`；客户端最多尝试一次 Refresh，失败回到登录页 |
| Refresh Token 首次使用 | `200`，旧凭证失效，新凭证可用 |
| 旧 Refresh Token 重放 | `401`，整 token family 和关联 session 撤销 |
| 登出/设备撤销 | 当前或指定 session 失效，Cookie 清除，后续访问 `401` |
| 错误 issuer、audience、签名、算法、时间窗口、token type 或 scope | Gateway 与领域服务均 `401` |
| 身份有效但缺少 permission | `403`，不得返回空列表或匿名成功 |
| 客户端提交 role/tenant/owner/permission 头或字段 | 忽略客户端事实，按已验证 JWT 与服务端 owner/tenant 派生 |

## 4. 运行命令

在固定端口配置和测试账号准备后执行：

```text
pnpm ports:check
pnpm contracts:merge
pnpm contracts:generate -- --contracts-only
pnpm contracts:validate
pnpm auth:local:check
node scripts/runtime/b30-runtime-probe.mjs
```

运行证据必须包含脱敏的 status、requestId/traceId、JWKS `kid`/算法摘要、session 状态和数据库摘要，不得包含密码、Access Token、Refresh Token、重置凭证或私钥。

## 5. 当前结论

本机已具备自有 JWT 代码、契约、迁移和逻辑测试证据；完整运行证据仍须在 IAM、Gateway、MySQL、领域服务和前端按固定端口启动后取得。没有真实运行证据前，B23 不能标记为正式运行完成，也不能把静态 PASS 当作认证后业务闭环。
