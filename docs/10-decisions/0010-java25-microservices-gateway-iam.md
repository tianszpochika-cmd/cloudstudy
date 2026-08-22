# ADR-0010：Java 25 LTS 与 Gateway/IAM/RBAC 微服务目标架构

- **状态**：accepted
- **日期**：2026-08-22
- **范围**：后端运行时、服务边界、入口安全、权限、数据和部署治理
- **取代**：ADR-0001 中“模块化单体作为后端主线”的部分、ADR-0004 中“Java 17 + Spring Boot 3 作为新服务主线”的部分
- **保留**：ADR-0004 的 Vue 3 + uni-app 前端边界、ADR-0005 的 Python AI 编排方向、ADR-0006 的 MySQL/Redis 数据主线、ADR-0007/0008 的阶段与四项目治理

## 背景

当前仓库的后端实现主要集中在 `services/core-api`，运行时是 Java 17 + Spring Boot 3 模块化单体。v2 设计要求长期支撑多端学习、教研审核、商业化、客服、AI、K12 和机构能力，仅依赖单一核心 API 会使权限、发布、故障隔离、数据 owner 和十年升级边界越来越模糊。现有的“API 网关/鉴权负载层”也只是设计图中的逻辑概念，缺少明确的 Gateway、IAM 和服务侧 RBAC/ABAC 责任。

## 决策

### 1. 运行时与框架

- 新建或迁移的 Java 服务统一使用 **Java 25 LTS**。
- Java Web 目标为 **Spring Boot 4.1.x + Spring Framework 7.x**，Spring Cloud 使用匹配的 release train；所有版本通过统一 BOM/Version Catalog 锁定。
- `services/core-api` 在迁移完成前继续使用 Java 17/Spring Boot 3，不进行一次性大爆炸升级；新代码不得把 Java 17 作为 v2 新服务默认运行时。

### 2. 入口与身份

- 新增 `services/api-gateway`，使用 Spring Cloud Gateway Server WebFlux，负责外部路由、API 版本、TLS 边界策略、限流、CORS、request/trace 上下文、JWT 预校验和边界审计。
- 新增 `services/iam-service`，作为产品 IAM 控制面，负责标准 OIDC/OAuth 2.1 IdP 集成、不可变 principal 映射、用户、租户、组织、设备、会话、同意、Token 撤销/轮换、角色、权限和策略元数据；不得自行实现 OIDC 协议或 Token 服务器。
- Gateway 不承载领域业务写入；任何领域服务都必须使用 Spring Security Resource Server 验证令牌并执行服务侧 PEP。

### 3. RBAC 与 ABAC

- 权限采用 RBAC 基础集合 + ABAC 上下文：`subject、tenant、role、permission、action、resource、owner、phase、contentRights、deviceTrust、consent、policyVersion`。
- `iam-service` 拥有角色/权限/策略控制面，并对外提供版本化决策接口；正常请求由服务 PEP 的 JWT 验签、资源本地事实和版本化策略包/短时安全缓存完成。远程 PDP 仅用于高风险操作、动态策略或安全缓存未命中；超时、策略版本过期、撤销状态不确定时 fail closed，不得成为所有读请求的同步单点依赖。
- 默认拒绝；禁止使用客户端提交的 `X-B5-Role`、角色头、租户 ID 或 owner ID 作为授权事实。权限拒绝必须明确返回 401/403，不得伪装为空数据。
- 权限变更、策略发布、决策关联和后台高风险操作进入审计链；密钥由 KMS/Vault 管理并支持轮换。
- Phase 1 使用服务端派生的 `platform` tenant；Phase 3 多租户以共享 schema + 强制 `tenant_id`、复合唯一/索引和验证后 `TenantScope` 查询守卫起步。MySQL 不被误称为自带行级安全；独立数据库/密钥隔离需要另立 ADR。跨租户拒绝测试是 IAM/数据任务的强制证据。

### 4. 微服务与数据

- 目标服务包括 `api-gateway`、`iam-service`、`audit-service`、`workflow-service`、`learner-service`、`content-service`、`learning-service`、`assessment-service`、`media-service`、`gamification-service`、`social-service`、`commerce-service`、`notification-service`、`analytics-service` 和 `admin-ops-service`；AI/RTC/K12 服务按阶段启用。`audit-service`/`workflow-service` 初期可由平台模块或 `job-runner` 承载，但不能跨服务直接写领域表。
- 每个服务拥有自己的 schema、迁移、Redis 命名空间、OpenAPI/事件契约和写权限；禁止跨服务写表、共享 ORM entity 和跨服务 SQL join。
- 内容与题目/答案规则版本归 `content-service`；attempt/checkpoint/判分/报告快照归 `assessment-service`；计划/SRS/进度/掌握度投影归 `learning-service`。后台 BFF/工作流/审计只能聚合、发命令或留痕，不能成为领域事实 owner。
- 事件采用 Kafka 兼容总线 + Outbox + AsyncAPI，只发布跨服务集成事实；采用至少一次投递、聚合 ID 分区、幂等消费者、Saga、补偿和可回放机制，避免分布式两阶段提交。Kafka 不作为 RPC、查询总线或事务协调器。

### 5. 运行与迁移

- 生产目标为 OCI + Kubernetes + Helm/Kustomize + GitOps；OpenTelemetry、指标、日志、Trace、审计、SBOM、依赖扫描和镜像签名属于服务模板的默认能力。
- 迁移顺序为：Platform 0 基线 → Gateway/IAM 接入旧 `core-api` → 逐域旁路/切流 → 验证 SLO、数据、权限和回滚 → 关闭旧路由。
- 本地端口仍以 `config/local-ports.json` 为唯一事实源；Gateway 真正进入开发前必须先登记固定端口、启动脚本、环境变量、Docker 映射和 CHANGELOG，不能临时自动选端口。
- 可共享 Kubernetes 集群、节点池、MySQL 集群和可观测基础设施；但任何已抽取目标服务必须有独立 OCI 进程、schema、凭据、发布和回滚责任。多个目标服务共用 Pod/JVM 不算完成拆分，例外必须有 ADR、退出日期与故障隔离证据。

## 不在本 ADR 中决定的事项

- 具体云厂商、Kafka 发行版、KMS/Vault 部署方式、标准 OIDC IdP 和服务网格实现；选择时需补充容量、成本、合规、运维责任和迁移/回滚证据。
- 自建 LiveKit、替换商业 RTC、引入向量数据库或改变 K12 受监管边界；这些仍需独立 ADR 和对应阶段 Gate。

## 代价

微服务会增加部署、观测、契约兼容和数据一致性成本，因此不要求在第一天把所有领域都抽取出 `core-api`。但一个领域一旦被声明为目标服务，就必须满足独立进程、数据 owner 和发布/回滚边界；否则仍属于单体迁移期，而不是“已完成微服务拆分”。
