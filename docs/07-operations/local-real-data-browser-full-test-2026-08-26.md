# 本地真实数据与浏览器验收记录（自有 JWT 基线）

> 本记录以 2026-08-28 自有 JWT 认证基线为准。此前依赖外部登录服务的记录已经废止，不得作为当前验收证据。

## 目标与端口

本轮验证 IAM 账号密码登录、Gateway 与领域服务的独立 JWT 校验、真实 MySQL/Redis/Kafka 读写以及四端浏览器边界。固定入口：Gateway `18070`、IAM `18087`、learner-web `18180`、admin-web `18181`、official-site `18182`、Mobile H5 `18183`。

## 当前认证契约

- 注册：`POST /api/v1/auth/register`
- 登录：`POST /api/v1/auth/login`
- 刷新：`POST /api/v1/auth/token/refresh`；Web 使用 HttpOnly + Secure + SameSite Cookie，移动原生端只使用 Keychain/Keystore
- 登出：`POST /api/v1/auth/logout`
- 单设备撤销：`POST /api/v1/auth/sessions/{sessionId}/revoke`
- 公钥：`GET /api/v1/auth/jwks`
- Access Token audience：`yuxuexing-api`

IAM 直接签发短时 RS256 JWT。Access Token 至少包含 `iss`、`sub`、`aud`、`exp`、`iat`、`nbf`、`jti`、`token_type=access`、`scope`，权限与角色由 IAM 服务端事实生成。所有业务服务都独立校验 issuer、签名、算法、audience、时间窗口、token type 和权限。

## 安全边界

- learner-web、admin-web 的 Access Token 只在内存；Refresh Token 不写入 localStorage/sessionStorage。
- Mobile H5 使用 Cookie；原生端没有安全存储能力时拒绝保存 Refresh Token，不回退普通 storage。
- official-site 只跳转到统一登录页，永不保存业务 Token。
- 请求头或请求体中的 role、permission、tenant、owner 一律不是权威来源；普通学习者访问管理员接口必须得到 403。
- 认证缺失或 JWT 无效返回 401；身份有效但权限不足返回 403；不能伪装为空列表或匿名成功。
- 密码不写入文档、日志、Git 或截图。生产 JWT 私钥只能由 KMS/Vault/受控 Secret 注入 IAM，不能进入 Git、镜像或普通日志。

## 验收矩阵

| 场景 | 期望结果 | 当前状态 |
|---|---|---|
| `/login` 页面 | 显示自有账号密码表单，不发生外部页面跳转 | 待本地浏览器复核 |
| 正确账号密码 | IAM 返回短时 Access Token 和轮换 Refresh 会话 | 静态/单测通过，HTTP 待复核 |
| 错误密码与连续失败 | 统一错误语义，达到阈值后账号短时锁定 | IAM 单测通过，HTTP 待复核 |
| Access Token 过期 | 静默刷新；刷新失败回到登录页 | 前端代码已接入，浏览器待复核 |
| Refresh Token 重放 | 拒绝请求并撤销 token family | IAM 单测/契约通过，HTTP 待复核 |
| Logout/设备撤销 | 当前会话失效，后续受保护请求返回 401 | 代码/契约通过，HTTP 待复核 |
| 错误 issuer/audience/signature/algorithm | Gateway 与领域服务均返回 401 | Gateway 单测通过，跨服务待复核 |
| 普通用户访问管理员接口 | 返回 403，菜单与页面也不越权 | B35 静态边界通过，浏览器待复核 |
| 伪造 authority 请求头 | 不改变 subject、tenant、owner、role、permission | B35 静态边界通过，HTTP 待复核 |
| official-site | 仅公开内容和受控登录深链，不出现业务 Token | 代码边界已通过，浏览器待复核 |

## 已取得的代码层证据

- B8/B30/B35 静态契约覆盖自有 JWT、JWKS、claims、刷新重放、撤销、401/403 和客户端 authority 拒绝。
- IAM Maven 测试覆盖 claims、密码错误锁定、Refresh Token 轮换/重放和客户端 authority 拒绝。
- Gateway Maven 测试覆盖 issuer、audience、过期、签名和算法拒绝。
- 四端已移除登录跳转、授权回调和 URL Token；learner-web/admin-web/mobile typecheck/build 边界已同步。

## 本地执行顺序

```text
pnpm ports:check
pnpm contracts:merge
pnpm contracts:generate -- --contracts-only
pnpm contracts:validate
pnpm services:run -- --all --timeout-ms 90000
```

浏览器验证必须在 `http://127.0.0.1:18180/login` 手动输入测试账号密码，逐项记录页面截图、HTTP 状态、Console、Cookie/存储边界和数据库写回。Agent 不代填密码，不读取密码，不用固定 Token 或历史运行器替代真实登录后的页面证据。
