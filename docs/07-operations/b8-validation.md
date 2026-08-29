# B8 认证与权限代码层验证交接

> 当前基线：平台自有 IAM 账号密码认证中心 + 短时 RS256 JWT Access Token。
> 本记录中的代码层结果不等同于生产部署、真机或完整跨进程运行态验收。

## 当前结论

B8 的认证边界已经按自有 JWT 方案重写：IAM 负责账号密码校验、密码哈希、失败锁定、签发 JWT、刷新轮换、设备会话和撤销；Gateway 与每个领域服务独立通过 JWKS 验证 issuer、签名、算法、audience、时间窗口、token type 和权限声明。四端不再依赖外部登录页，官网只生成受控的统一登录入口且不持有业务 Token。

历史外部登录实现及其运行证据已经废止，不属于当前方案、默认路由或验收依据。完整的数据库运行、密钥注入、浏览器登录后旅程、真机安全存储和跨服务权限矩阵仍需在对应环境完成验收。

## 任务交付状态

| 任务 | 当前实现 | 待验收项 |
|---|---|---|
| `V2-B8-IAM-001` | IAM `/api/v1/auth/register`、`/login`、`/token/refresh`、`/logout`、`/jwks` 及密码重置契约；RS256、统一 `yuxuexing-api` audience、必要 claims 和短时 Access Token | 生产 KMS/密钥轮换、限流、邮件或短信重置投递、跨进程 HTTP 回放 |
| `V2-B8-IAM-002` | 服务端生成 principal、`platform` tenant、device、session、refresh token digest/history、consent、adult gate 和 audit 事实；客户端 authority 字段全部无效 | Durable JDBC 重启回放、设备列表与踢出、审计检索和数据恢复 |
| `V2-B8-IAM-003` | IAM claims 到 `PERM_`、`ROLE_`、`SCOPE_` 的转换；PEP 默认拒绝，资源 owner/tenant/phase/rights/consent 由服务端事实决定 | 各领域服务策略发布、撤销和跨租户故障注入 |
| `V2-B8-GW-004` | Gateway 18070→IAM 18087 路由、公开认证入口、JWT 预校验、JWKS、401/403 和客户端 authority 清理 | 真实限流、直连阻断、密钥轮换与回滚演练 |
| `V2-B8-USR-005` | Phase 1 成人 Gate、账号注册/登录/恢复、服务端租户和 owner 派生；不接受请求头或请求体中的 role/tenant/owner/permission 覆盖 | 年龄证明、删除/恢复、审计回放和异常锁定运行态 |
| `V2-B8-FE-006` | learner-web、admin-web、mobile 使用统一账号密码登录页；Web Access Token 只在内存，Refresh Token 使用 HttpOnly Cookie；移动端只允许 Keychain/Keystore；official-site 不保存业务 Token | 浏览器登录后页面、响应式/无障碍、原生安全存储和弱网验证 |
| `V2-B8-TEST-007` | 静态测试覆盖契约、迁移、JWT claims、JWKS、401/403、伪造 authority、刷新重放和四端会话边界 | 完整浏览器、跨进程、真机和故障注入旅程 |

## 关键安全事实

- Access Token 必须包含 `iss`、`sub`、`aud`、`exp`、`iat`、`nbf`、`jti`、`token_type=access`、`scope`，并按需包含 IAM 服务端生成的 `roles`、`permissions`、`tenant_id`、`session_id`。
- JWKS 从 IAM `GET /api/v1/auth/jwks` 发布；生产私钥只允许由 KMS/Vault/受控 Secret 注入 IAM 签发进程，不能进入 Git、镜像层、前端、普通日志或错误响应。
- Refresh Token 只保存 digest 与轮换历史；复用旧值会撤销整个 token family，并记录 `auth.session.replay_detected.v1`。
- 401 表示缺少或无效的认证凭据；403 表示身份有效但缺少所需权限。二者不能伪装为空列表或匿名成功。
- 注册、登录、刷新、登出和撤销都必须带 request/trace 关联；密码使用 BCrypt work factor 12，失败次数达到阈值后短时锁定，登录响应不得枚举账号是否存在。

## 已执行验证

| 命令 | 结果 |
|---|---|
| `pnpm test:b8` | 代码层静态套件通过；当前工作区需以最新运行输出为准 |
| `pnpm contracts:merge` | 通过，生成 canonical OpenAPI/事件目录 |
| `pnpm contracts:validate` | 通过，校验自有 JWT、RS256、JWKS、TLS、密码哈希和禁止客户端 authority |
| `pnpm contracts:generate` | 通过，contracts 与 api-client 生成文件同步 |
| IAM/Gateway Maven tests | 已覆盖 JWT claims、issuer/audience、签名/算法、会话轮换和客户端 authority 拒绝 |

## 后续运行入口

先执行 `pnpm ports:check`，再启动 IAM 18087、Gateway 18070 和领域服务 18088–18098。运行验收必须使用真实账号密码登录，手动输入测试密码，检查 Access Token 过期刷新、Refresh Token 重放拒绝、Logout/设备撤销、错误 issuer/audience/signature/algorithm 拒绝以及普通用户访问管理员接口的 403。不得用固定 Token、请求头角色或旧外部登录页面代替这些证据。
