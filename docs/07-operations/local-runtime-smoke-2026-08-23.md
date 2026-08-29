# 本地运行态 Smoke 记录（自有 JWT 基线）

> 本记录已按 2026-08-29 的认证基线重写。历史外部登录运行结果不再作为当前系统、脚本或验收证据。

## 当前运行边界

本地运行态使用固定 loopback 端口：Gateway `18070`、Core API `18080`、IAM `18087`、领域服务 `18088–18098`，四端前端 `18180–18183`。启动前必须执行 `pnpm ports:check`；端口冲突时停止占用进程并报告，不自动换端口。

IAM 是唯一账号密码认证中心，直接签发短时 RS256 JWT。Gateway 与每个领域服务独立从 IAM `GET /api/v1/auth/jwks` 获取公钥并校验 issuer、signature、algorithm、audience、时间窗口、`token_type=access` 和权限声明。认证中心不可用、JWKS 不可用或策略事实不可用时必须 fail closed。

## 公开与受保护路径

- 公开：健康检查、登录、注册、刷新、JWKS、密码重置请求/确认和官网公开投影。
- 受保护：学习、内容、测评、学习计划、通知、成长、社群、商业化和后台接口。
- 缺少凭据或 JWT 无效返回 401；身份有效但权限不足返回 403；不能以空列表或匿名成功伪装。
- role、permission、tenant、owner 请求头或请求体不是权威输入；权限和资源 owner 由服务端 JWT/数据库事实推导。

## 四端安全边界

- learner-web/admin-web：Access Token 只保存在内存；Refresh Token 使用 HttpOnly、Secure、SameSite Cookie，不写入 Web Storage。
- Mobile H5：沿用 Cookie 会话；原生 App 只使用 Keychain/Keystore，安全存储不可用时拒绝持久化 Refresh Token。
- official-site：仅提供公开页面和受控 `/login` 深链，不持有业务 Token。

## 当前验证结果

- 已通过：契约 merge/generate/validate、自有 JWT 静态边界、IAM/Gateway claims 与负向验证、四端 typecheck/build 边界。
- 待实测：Docker/MySQL/Kafka/Redis 全栈启动、真实账号密码 HTTP 闭环、Refresh Token 轮换重放、设备撤销、浏览器登录后页面和原生安全存储。
- 禁止把历史 readiness、匿名 401、固定 Token 或旧运行记录写成认证后业务闭环通过。

## 执行命令

```text
pnpm ports:check
pnpm contracts:merge
pnpm contracts:generate -- --contracts-only
pnpm contracts:validate
pnpm services:run -- --all --timeout-ms 90000
```

浏览器验收从 `http://127.0.0.1:18180/login` 开始。测试账号密码必须由操作者手动输入，不能自动读取、代填或记录；需同时保存截图、Console、HTTP 状态、Cookie/存储检查和数据库写回证据。
