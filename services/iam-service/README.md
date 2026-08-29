# iam-service

`iam-service` 是语学星 v2 的自有认证中心和 IAM 领域边界，目标运行时为 Java 25、Spring Boot 4.1.1 和 Spring Framework 7.x。它负责账号密码、平台主体、设备、会话、权限、成人 Gate、同意和审计事实。

## 自有 JWT 认证边界

- `POST /api/v1/auth/register` 创建账号并建立会话。
- `POST /api/v1/auth/login` 校验账号密码并直接签发短时 RS256 JWT Access Token。
- `POST /api/v1/auth/token/refresh` 使用不透明 Refresh Token；每次使用都轮换，旧 Token 重放会撤销整个 Token family 并返回 401。
- `POST /api/v1/auth/logout` 退出当前会话或全部设备；`POST /api/v1/auth/sessions/{sessionId}/revoke` 撤销指定设备会话。
- `GET /api/v1/auth/jwks` 只发布当前公钥和轮换重叠期内的上一把公钥，供 Gateway 和每个领域服务独立验签。
- `POST /api/v1/auth/password-reset/request` 和 `/confirm` 提供不枚举账号的密码重置流程。
- `GET /api/v1/iam/principal/me`、`/permissions`、`/devices`、`/consents` 提供服务端主体、权限和 consent 事实；客户端提交的 role、permission、tenant、owner 字段不具备授权效力。

Access Token 至少包含 `iss`、`sub`、`aud`、`exp`、`iat`、`nbf`、`jti`、`token_type=access`、`scope`，并可包含服务端签发的 `permissions`、`roles`、`tenant_id`、`session_id`。所有业务 API 使用 audience `yuxuexing-api`。服务侧校验 issuer、签名、RS256 算法、audience、时间窗口、token type、scope/permission，默认拒绝；身份缺失或 Token 无效返回 401，身份有效但权限不足返回 403。

## 凭证和密码安全

- 密码只使用 BCrypt 哈希保存，明文不落库、不进入 Token、不进入日志；本地策略要求最小长度 12。
- 登录失败按账号和来源限流；连续失败达到阈值后临时锁定，错误响应不暴露账号是否存在。
- Refresh Token 只保存摘要和轮换历史，支持并发 CAS、重放检测、设备管理、单设备撤销和全设备退出。
- Web Access Token 只在内存中保存；Web Refresh Token 使用 HttpOnly、Secure、SameSite Cookie。移动原生端只允许 Keychain/Keystore 等平台安全存储，安全存储不可用时拒绝建立可恢复会话。

## 密钥边界

本地开发可使用短生命周期的内存 RSA 密钥；生产环境必须由 KMS/Secret Manager 注入当前私钥并执行双钥轮换：发布新 `kid` 时通过 `IAM_JWT_PREVIOUS_PUBLIC_KEYS_JSON` 保留旧公钥，至少覆盖 Access Token TTL + clock skew 后再移除。私钥不得进入 Git、容器镜像、普通配置、转储、trace、指标或普通日志。JWKS 只返回公钥材料，`kid` 用于轮换期间的并行验签。

## 本地运行与验证

服务默认绑定 loopback，固定地址为 `127.0.0.1:18087`：

```powershell
$env:IAM_SERVICE_PORT = "18087"
$env:IAM_SERVER_ADDRESS = "127.0.0.1"
mvn -f services/iam-service/pom.xml -o validate test
mvn -f services/iam-service/pom.xml spring-boot:run
```

探针：`/actuator/health`、`/actuator/health/liveness`、`/actuator/health/readiness`。

推荐同时运行：

```text
node --test tests/b8/iam-service.test.mjs
mvn -f services/iam-service/pom.xml -o test
```

真实 MySQL、密钥托管、生产密钥轮换执行记录、浏览器和原生设备证据仍需在对应运行环境取得；静态检查或内存单测不能替代这些运行证据。
