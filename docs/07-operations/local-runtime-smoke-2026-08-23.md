# 本地真实数据运行态 Smoke 证据（2026-08-23）

## 结论

重启 Docker Desktop 后，本地 Phase 1 运行栈已启动，可用于前端入口、Gateway 边界和基础设施连通性测试。当前不是“完整认证后业务闭环已通过”：Gateway/IAM 的真实 OIDC provider 仍未启用，未伪造账号或令牌；未登录业务请求按默认拒绝返回 401。

## 运行证据

### 基础设施

命令：

```powershell
docker compose -f infra/docker/docker-compose.dev.yml ps
node scripts/check-local-infra.mjs --require-healthy
```

结果：

- MySQL 8.0：healthy，`127.0.0.1:13306`；数据库 `yuxuexing` 已应用 21 个迁移版本，实际表 318 张。
- Redis 7：healthy，`127.0.0.1:16379`；`redis-cli ping` 返回 `PONG`。
- Kafka KRaft：healthy，Apache Kafka 3.9.2，`127.0.0.1:19092`；本地禁止自动建 topic，当前 topic 列表为空符合配置。
- MinIO：healthy，API/Console 为 `127.0.0.1:19000/19001`；`minio-init` 成功创建私有 bucket `yuxuexing-local`。
- RabbitMQ：healthy，AMQP/Management 为 `127.0.0.1:15689/15690`；仅作为 v1 兼容基础设施保留。

### 后端

命令：

```powershell
pnpm services:run -- --all
```

结果：14 个登记服务均启动并通过 readiness：

`api-gateway` 18070、`iam-service` 18087、`learner-service` 18088、`content-service` 18089、`learning-service` 18090、`assessment-service` 18091、`media-service` 18092、`notification-service` 18093、`gamification-service` 18094、`social-service` 18095、`commerce-service` 18096、`admin-ops-service` 18097、`analytics-service` 18098、旧版 `core-api` 18080。

旧版 `core-api` 的健康地址包含 servlet context path：`/api/v1/actuator/health`；运行器已通过 `healthBasePath` 正确处理。

### 前端

四个项目均以固定端口启动并返回 HTTP 200：

- learner-web：<http://127.0.0.1:18180/>
- admin-web：<http://127.0.0.1:18181/>
- official-site：<http://127.0.0.1:18182/>
- Mobile H5：<http://127.0.0.1:18183/>

四端默认 Gateway 地址均为 `http://127.0.0.1:18070/api/v1`，没有指向领域服务直连地址。

### HTTP/API Smoke

- `GET http://127.0.0.1:18070/api/v1/health`：200，返回 core-api 健康 envelope。
- `GET http://127.0.0.1:18070/api/v1/public/commerce/catalog`：200，返回真实 commerce public projection；当前 `plans` 为空，表示数据库尚未导入商品夹具。
- `GET http://127.0.0.1:18070/api/v1/gamification/me/profile`（无令牌）：401，返回结构化 `unauthorized`，证明默认拒绝边界生效。
- `OPTIONS /api/v1/health`，Origin `http://127.0.0.1:18180`：200，返回允许的 CORS origin。

### 浏览器真实服务回归

使用 Codex 内置 Browser，在后端重启后重新打开四个前端并执行页面导航、交互和控制台错误检查；未输入账号、密码、验证码或令牌。

- learner-web `18180`：首页 → “开始学习” → `/login`；登录页正确显示未配置 IdP 的安全状态；“恢复已有会话”进入 `/login?redirect=/home`，没有伪造登录成功；页面控制台 error/warning 为 0。
- admin-web `18181`：管理后台首页与登录入口可加载；点击“通过身份服务登录”没有再出现 404/Whitelabel，前端停留在受控的 `/login?redirect=/dashboard` 边界；同一目标经 Gateway 实际请求返回结构化 `503 idp_unavailable`、`Cache-Control: no-store`。
- official-site `18182`：首页、课程体系、价格方案、下载体验、服务公告、关于我们、合规公示均可导航；课程“入门阶段”筛选按钮可切换 active 状态；各页控制台 error/warning 为 0。由于 canonical public projection 尚未提供，公开内容使用明确的“公开内容暂时不可用”安全 fallback。
- Mobile H5 `18183`：首页可加载；“练习”按权限进入登录页；“课程”进入学习流页；“我的”进入个人页；“世界”进入成长/社交页并展示服务端无数据状态。学习流显示 UI `zh-CN`、内容 `en-US`、主题“跟随系统”和 `High` 画质状态；控制台 error/warning 为 0。

目标登录入口的实际响应复核：

```text
GET /api/v1/auth/oidc/standard-oidc/authorization/start -> 503
Content-Type: application/json
error.code=idp_unavailable
```

本轮为消除浏览器发现的 404，新增 `IamProviderBoundaryController`。它只提供 fail-closed HTTP 接缝，不创建授权事务、不接受 code、不签发 access/refresh token；IAM 真实 OIDC adapter 启用后再替换为协议适配实现。IAM 模块测试 `7/7`、打包和运行态 readiness 均通过。

### 静态/契约复核

- `pnpm db:validate`：21 个迁移与合成 fixture 通过。
- `pnpm contracts:validate`：402 operations、476 OpenAPI schemas、144 events、100 event payload schemas、4 JSON Schemas 通过。
- `pnpm config:check`：Phase 1 安全开关关闭，配置通过。
- `pnpm infra:check`：5 个依赖、7 个固定绑定通过。
- `pnpm redis:validate`：28 个 keyspace 条目、7 个合成样例通过。

## 当前测试边界

- `gateway.security.resource-server-enabled=false`、`iam.real-provider-enabled=false` 是当前安全基线。未配置真实 OIDC issuer/JWKS 时，不能进行登录后真实业务数据写入测试；这是预期的 fail-closed 行为。
- 官网 canonical public projection `/api/v1/public/site/projection` 当前尚未由已启动的 Gateway/领域服务提供，官网会使用已有安全 fallback；这不影响官网入口启动，但会阻塞官网真实内容投影验收。
- commerce public catalog 当前 `plans` 为空，说明本地尚未导入商品 fixture；页面可用性已验证，但价格真实数据仍不能宣称完成。
- Kafka 当前没有 topic，符合本地 `KAFKA_AUTO_CREATE_TOPICS_ENABLE=false`；跨服务事件联调前仍需按契约创建 topic/consumer group。
