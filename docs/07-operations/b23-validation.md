# B23 本地标准 OIDC IdP 最小运行验证

本记录覆盖 B23 的代码、契约、数据库、Gateway/IAM fail-closed 运行烟测和本地测试 IdP 配置。B23 的真实 OIDC 注册、授权码回调、JWKS、principal/session 写入和有效 JWT 业务访问仍未通过运行 Gate，因此本记录不把 B23 标记为已完成。

## 固定配置

- IdP：官方 Keycloak 容器 `quay.io/keycloak/keycloak:26.7.1`。
- 宿主机绑定：`127.0.0.1:18099 -> keycloak:8080`；`18099` 已登记在 `config/local-ports.json`，不得改为默认 `8080`、随机端口或自动递增端口。
- Realm：`yuxuexing-local`。
- Issuer：`http://127.0.0.1:18099/realms/yuxuexing-local`。
- 客户端：learner-web、admin-web、Mobile H5、`englishflow://` 原生回调，全部是 public client + authorization code + PKCE S256。
- 自助注册：开启；邮件验证关闭，仅为本地合成账号测试。成人 Gate、principal/session 持久化和产品权限仍由后续 IAM 任务负责。

## 代码交付范围（2026-08-24）

- `iam-service`：标准 OIDC discovery、authorization code + PKCE S256、state/nonce、JWKS 签名/issuer/audience/过期校验、refresh rotation、RFC7009 revoke 适配端口；JDBC principal/session/authorization transaction/audit adapter；未配置 provider 或 persistence 时 fail closed。
- `api-gateway`：Resource Server/JWKS 验证开关、issuer/audience 校验、受保护路由默认拒绝、CORS、401/403、request/trace ID 和客户端 authority header 清理。
- 契约：重新合并并生成 OpenAPI、AsyncAPI 与 TypeScript 客户端；契约验证通过。
- 数据库：新增 `V0022__create_iam_oidc_runtime_b23.sql`，包括 OIDC authorization transaction 和 IAM session provider reference/rotation 字段。
- 本地 IdP：Keycloak realm 导入文件使用固定的 loopback realm/client/redirect/audience 值，避免 Keycloak 不会替换 realm JSON 环境变量导致的启动后配置失效。

## 已取得的验证证据

在仓库根目录执行，结果如下：

| 验证 | 结果 |
|---|---|
| `pnpm test:b23` | 4/4 通过 |
| `pnpm contracts:generate` | 5 个生成文件完成 |
| `pnpm contracts:validate` | 403 operations、477 schemas、147 events 通过 |
| `pnpm db:validate` | 22 个迁移与合成 fixture 通过 |
| `node scripts/check-local-infra.mjs --static-only` | 6 个依赖、8 个固定绑定通过 |
| `mvn -q test`（`services/iam-service`） | 通过 |
| `mvn -q test`（`services/api-gateway`） | 通过 |
| IAM `/actuator/health` | HTTP 200，`UP` |
| Gateway `/actuator/health` | HTTP 200，`UP` |
| Gateway 未认证 `/api/v1/iam/principal/me` | HTTP 401，结构化 unauthorized |
| IAM 未认证 `/api/v1/iam/principal/me` | HTTP 403，默认拒绝 |
| IAM 未配置 provider 的授权入口 | HTTP 503，`oidc_provider_not_configured` |
| `docker compose ... config --quiet` | 通过 |

## 当前阻塞与未完成 Gate

`node scripts/runtime/local-oidc-idp.mjs check` 的静态检查通过，但运行检查因 `127.0.0.1:18099` 没有 Keycloak 容器而失败。此前执行 `node scripts/runtime/local-oidc-idp.mjs up` 时，Docker 无法从 `quay.io/keycloak/keycloak:26.7.1` 拉取镜像；本机镜像缓存中没有 Keycloak。该外部网络/镜像前置阻塞了以下证据：

1. 注册页面和真实用户注册；
2. authorization code 回调、PKCE、nonce 和真实 token exchange；
3. 真实 JWKS 签名验证、有效 JWT 访问 `/api/v1/iam/principal/me`；
4. MySQL principal/session/consent 真实写入后的回放；
5. refresh rotation、撤销、过期、JWKS rotation 和完整 CORS 负例。

因此当前结论是：B23 代码层和 fail-closed 边界已完成，B23 运行验收仍为“待验收”；不能据此进入 B24，也不能宣告进入正式浏览器/H5 测试。恢复 Docker registry 访问或提供已批准的等价标准 OIDC IdP 后，重新执行本文件“最小验证”和 B23 完成门槛即可继续。

## 最小验证

在仓库根目录执行：

```powershell
Copy-Item .env.example .env
# 编辑未提交的 .env，至少替换 OIDC_BOOTSTRAP_ADMIN_PASSWORD
node scripts/check-fixed-ports.mjs --registry-only
node scripts/check-local-infra.mjs --static-only
node scripts/runtime/local-oidc-idp.mjs up
node scripts/runtime/local-oidc-idp.mjs check
```

`check` 必须验证 discovery issuer、authorization endpoint、token endpoint、userinfo、logout 和 JWKS；JWKS 至少包含一个带 `kid` 的签名密钥。浏览器访问以下地址可确认本地 realm 登录/注册入口：

```text
http://127.0.0.1:18099/realms/yuxuexing-local/account
```

Keycloak 通过 `check` 后，才在启动 IAM/Gateway 的同一 PowerShell 会话中显式打开真实验证开关；默认值必须保持 `false`，不能用“有 Bearer 头”代替验证：

```powershell
$env:IAM_REAL_PROVIDER_ENABLED = 'true'
$env:IAM_OIDC_ENABLED = 'true'
$env:IAM_PERSISTENCE_ENABLED = 'true'
$env:GATEWAY_RESOURCE_SERVER_ENABLED = 'true'
$env:GATEWAY_JWT_PREVALIDATION_ENABLED = 'true'
$env:OIDC_ISSUER_URI = 'http://127.0.0.1:18099/realms/yuxuexing-local'
$env:OIDC_AUDIENCE = 'yuxuexing-api'
```

启用真实模式后必须重启 IAM 和 Gateway，并重新执行健康、注册、回调、有效 JWT、撤销和 401/403 回放；不能只修改正在运行进程外的 `.env` 就把 B23 标记为通过。

在登录页选择注册，使用一次性合成账号完成注册，然后使用对应 client 的精确回调地址验证 redirect allowlist。不要把注册密码、管理员密码、authorization code、token 或 JWKS 私钥写入 Git、日志或截图。

停止并保留本地 IdP 数据：

```powershell
node scripts/runtime/local-oidc-idp.mjs status
node scripts/runtime/local-oidc-idp.mjs down
```

查看启动失败原因：

```powershell
node scripts/runtime/local-oidc-idp.mjs logs
```

只有明确需要重新导入 realm 配置时，才在确认不会删除其他本地事实后执行：

```powershell
docker compose -f infra/docker/docker-compose.dev.yml stop keycloak
docker volume rm yuxuexing-keycloak
node scripts/runtime/local-oidc-idp.mjs up
```

该清理会删除本地 Keycloak 测试用户和会话，不会删除 MySQL、Redis、Kafka、MinIO 或 RabbitMQ 卷。

## B23 边界与阻塞

本地 IdP 只承载标准 OIDC 协议层：注册、授权码、PKCE、JWKS、refresh rotation 和回调 client allowlist；仓库没有新增 Token Server、JWT 签发器或 JWKS 服务。Gateway → IAM 回调交换、服务侧 JWT/JWKS/PEP、MySQL IAM 事实和撤销/轮换已具备代码与 fail-closed 验证，但必须在 Keycloak 可运行后补齐真实运行证据。
