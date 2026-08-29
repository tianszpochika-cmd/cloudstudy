# v2 Java service template

这是 Platform 0 的可复制独立 Maven 服务模板，目标运行时是 Java 25 LTS、Spring Boot 4.1.1 和 Spring Framework 7.x。Spring Boot parent/BOM 统一管理 Spring Framework 及其传递依赖版本；复制服务时不要把依赖版本散落到业务模块中。

## 模板边界

- 只提供 Web、Actuator、Validation、OpenTelemetry/OTLP、配置绑定和请求上下文基础设施。
- 不提供领域业务控制器、领域事件、数据库连接、Redis 客户端、共享 ORM entity 或跨服务写入适配器。
- 复制后，每个服务必须继续只写自己的 schema，并使用自己的迁移、凭据和 Redis key namespace；跨域数据只能通过契约、API、事件或只读投影获取。
- `data/` 提供 `TenantScope`、`IdempotencyKey`、`OutboxEvent` 和 `RedisNamespace` 的最小边界类型；它们只约束安全/幂等/事件 envelope，不替代服务自己的 Flyway、Repository、Outbox dispatcher 或 Redis 客户端。
- POM 锁定 Flyway core + MySQL 支持包作为迁移基线。复制服务时，迁移必须放在该服务自己的 `db/migration`、schema 和凭据边界内；不得把根 `database/` 或其他服务的表当作共享写入目标。
- 服务 owner、schema、Redis namespace 和端口是必填模板占位，不由模板推断，也不修改仓库根目录的 `config/local-ports.json`。使用者应先登记端口，再通过环境变量或配置注入。

## B8 服务侧安全骨架

模板包含可复制到 `learner-service`、`content-service` 等 v2 服务的 Resource Server/PEP 基础；它们独立验证 IAM 签发的 JWT，不承载登录页或账号密码：

- `security.resource-server.enabled` 默认是 `true`。关闭时 `/actuator/**` 仅用于探针，其他请求由 Spring Security 默认拒绝；模板没有测试替身、静态 token 或“本地管理员”认证成功路径。
- 复制服务必须显式提供 `SERVICE_SECURITY_ISSUER_URI`、`SERVICE_SECURITY_JWK_SET_URI` 和 `SERVICE_SECURITY_AUDIENCE`，两者缺一都会阻止启动。Spring Resource Server 负责签名、issuer、audience、算法、过期和 token type 等 JWT 验证；`VerifiedPrincipal` 只从已验证的 `Jwt` 构建，不能从请求头或请求体构建。
- `TenantScope.platform(subject)` 是服务端派生的唯一 Phase 1 tenant。`X-Role`、`X-B5-Role`、`X-Tenant-Id`、`X-Owner-Id` 以及 `tenantId`/`ownerId` 请求参数会被边界过滤器拒绝，PEP 也会拒绝显式传入的客户端安全事实。
- `PolicyCache` 只接受已验证的策略快照并按短 TTL 与 `PolicyVersion` 过期时间判断新鲜度。新鲜本地策略走 `LocalPolicyEvaluator`；缓存缺失/过期或动态高风险请求转入 `PdpPort`。PDP 超时、异常、撤销不确定、策略版本过期或任何 tenant/owner/phase/content-rights/consent 缺失都 deny。
- `Decision` 的 ID 由已验证 subject、token `jti`/摘要、资源事实、策略版本、结果和评估时间做 SHA-256 派生；调用方不能提交或覆盖 decision ID。401 只表示没有可验证身份，403/error envelope 表示身份已建立但授权被拒绝。

复制服务时必须把资源 tenant/owner/phase/content rights/consent 从服务拥有的事实或可信 IAM/PDP 结果装配到 `AuthorizationContext`，不能从客户端字段回填；不得在模板中加入领域 controller、entity、repository、跨服务 SQL 或跨服务写表。

## B8 Gate 与运行态边界

本骨架对应 `V2-B8-IAM-003` 的代码与纯规则测试证据。自有 JWT 认证中心、JWKS 轮换/撤销、Gateway→PEP→领域事实→Outbox→审计全链路、跨租户运行态、PDP 故障注入和生产密钥/容量验证仍需在运行 Gate 中取得证据；Java 25/Maven 不可用时不能把静态测试结果描述成构建成功。

## 必填配置

`src/main/resources/application.yml` 对以下 `service.*` 属性进行严格绑定。缺失、空值、格式错误或未知的 `service.*` 属性都会使应用启动失败：

| 配置 | 环境变量 | 约束 |
|---|---|---|
| `service.name` | `SERVICE_NAME` | 小写服务名；用于 Spring application name |
| `service.owner` | `SERVICE_OWNER` | 领域/平台服务 owner 标识 |
| `service.schema` | `SERVICE_SCHEMA` | 该服务独占的数据库 schema 标识 |
| `service.redis-namespace` | `SERVICE_REDIS_NAMESPACE` | 该服务独占的 Redis key 前缀 |
| `service.port` | `SERVICE_PORT` | 已登记的固定 HTTP 端口，1–65535 |

也可以使用 `--service.name=...` 等 Spring 配置覆盖项；`SERVICE_PORT` 和 `service.port` 最终绑定到 `server.port`。默认绑定地址是 `127.0.0.1`，容器环境如需变更应显式设置 `SERVER_ADDRESS`。

示例（端口值仅作占位，不能替代端口登记）：

```powershell
$env:SERVICE_NAME = "learner-service"
$env:SERVICE_OWNER = "learner-service"
$env:SERVICE_SCHEMA = "learner_service"
$env:SERVICE_REDIS_NAMESPACE = "learner"
$env:SERVICE_PORT = "<registered-port>"
mvn spring-boot:run
```

## 运行探针与优雅关闭

Actuator 只暴露 `health` 和 `info`：

- `/actuator/health`：总体健康状态
- `/actuator/health/liveness`：进程存活探针
- `/actuator/health/readiness`：是否已进入可接流量状态

`server.shutdown=graceful` 和 `spring.lifecycle.timeout-per-shutdown-phase` 已预置。业务服务新增外部依赖时，应为其健康检查和 readiness 语义增加服务内适配，而不是跨服务探测数据库或共享表。

## requestId / traceId

`RequestContextFilter` 在请求入口建立最小上下文：

- 优先保留经过格式校验的 `X-Request-Id`，否则生成新的 request ID；
- 优先使用当前 Micrometer/OTel span 的 trace ID，其次接受经过格式校验的 `X-Trace-Id`，否则生成新的 trace ID；
- 将两个 ID 放入响应头和 MDC，并在请求结束时恢复/清理 ThreadLocal 与 MDC，避免线程池复用造成串请求。

真正的分布式 trace 传播由 Spring Boot 的 W3C tracing/OTLP 自动配置和官方 HTTP client builder 负责；客户端不得把 trace/request ID 当作身份、tenant 或 owner 事实。

## OpenTelemetry

模板使用 Boot 4.1 的 `spring-boot-starter-opentelemetry`。可通过 `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` 或 `OTEL_EXPORTER_OTLP_ENDPOINT` 配置 collector，也可设置 `OTEL_TRACING_EXPORT_ENABLED=false` 关闭本地导出。生产环境应由部署平台注入 collector、采样率和资源属性，不要提交密钥或真实隐私。

## 验证

使用 Java 25 和可访问依赖缓存的 Maven：

```text
mvn -o validate test
```

Node 静态安全门禁：

```text
node --test ../../tests/b8/service-template-security.test.mjs
```

当前目录不是根 Maven reactor；模板可以独立复制、独立构建。将服务接入仓库的统一构建流水线时，需保留 Java 25、Boot 4.1.x/Spring 7.x 的版本锁定和独立发布边界。
