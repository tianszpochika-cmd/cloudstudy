# B30 平台自有 JWT 登录与权限真实闭环验证

> 基线：V2-PHASE1-LOCAL-REAL-E2E-20260828
> 状态：自有 IAM 的自动化与服务逻辑测试已完成；真实 API、数据库、Gateway、领域服务和 Browser MCP 认证后旅程待重新验收。
> 旧的其他认证运行记录不属于本基线，不能作为当前通过证据。

## 1. 当前认证架构

- `iam-service` 在 `/api/v1/auth/login` 和 `/api/v1/auth/register` 校验账号密码，并直接签发短时 RS256 JWT Access Token。
- `GET /api/v1/auth/jwks` 发布当前公钥；Gateway 和每个领域服务独立通过 JWKS 校验 issuer、签名、算法、audience、时间窗口、`token_type=access` 和 scope/permission。
- Access Token 的统一 audience 为 `yuxuexing-api`；必要权限事实由 IAM 服务端生成，客户端角色、tenant、owner 和 permission 头/字段无效。
- Web Access Token 只存在内存；Web Refresh Token 通过 HttpOnly、Secure、SameSite Cookie；原生移动端只允许 Keychain/Keystore 等安全存储。
- Refresh Token 为不透明随机凭证，每次刷新轮换；旧凭证重放会撤销 token family、session 和相关 Access Token jti。登出、设备撤销和密码重置都能撤销会话。

## 2. B30 验证范围

| 编号 | 场景 | 预期证据 |
|---|---|---|
| AUTH-001 | 账号密码注册/登录 | `200`、JWT claims、session/device、密码哈希摘要；无敏感值 |
| AUTH-002 | 密码错误与失败锁定 | `401`、锁定响应、限流与审计记录 |
| AUTH-003 | JWKS 与公钥轮换 | `kid`、RS256 公钥、旧/新 key overlap 和服务独立验签 |
| AUTH-004 | Access 过期刷新 | 业务请求 `401`、一次刷新、旧 Access 不再接受、新 Access 可用 |
| AUTH-005 | Refresh 轮换与重放 | 首次成功、旧凭证 `401`、整 family 撤销 |
| AUTH-006 | Logout/设备撤销 | 当前设备或全部设备撤销，后续请求 `401` |
| AUTH-007 | JWT 负向边界 | issuer/aud/signature/algorithm/expired/token type/scope 错误均拒绝 |
| AUTH-008 | PEP 权限 | 普通用户访问管理员接口 `403`；伪造 authority 头无效 |
| AUTH-009 | 四端安全边界 | Web 无 Token storage；移动端无普通 storage Refresh fallback；官网无业务 Token |

## 3. 自动化入口

```text
pnpm auth:local:check
node scripts/runtime/b30-runtime-probe.mjs
node scripts/runtime/b30-lifecycle-runtime.mjs
```

探针只能输出状态、计数和脱敏摘要；不得输出密码、Access Token、Refresh Token、重置凭证、Cookie 值或私钥。运行失败时必须报告 `BLOCKED` 和缺失的外部前置条件，不能以静态结果代替运行通过。

## 4. Browser MCP 验收要求

在 `http://127.0.0.1:18180/login` 手动输入合成测试账号密码后，逐项记录：登录成功、受保护页面、刷新、`401` 恢复、普通用户访问管理员页面的 `403`、退出、重新登录、响应式、Loading/Empty/Error 和 Console 错误。Agent 不读取或代填密码，不从 URL、localStorage 或 sessionStorage 注入凭证。

## 5. 当前结论

B30 的代码、契约、静态安全边界和自有 JWT 逻辑测试已完成；新的真实认证后 API/DB/Browser MCP 运行证据尚未取得。因此 B30、B34、B35、B36 均不能因为历史记录而标记为完整通过。
