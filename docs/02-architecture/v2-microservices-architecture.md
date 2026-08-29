# v2 目标技术架构与微服务蓝图

> 版本：v2.3（2026-08-29，Phase 1 业务运行设计补齐后）
> 适用范围：`docs/06-design/v2-980plus/` 第二版设计包及其后续开发任务  
> 决策入口：[ADR-0010：Java 25 与微服务/Gateway/IAM 架构](../10-decisions/0010-java25-microservices-gateway-iam.md)  
> 客服/隐私 owner：[ADR-0014：Phase 1 客服与隐私编排事实所有权](../10-decisions/0014-phase1-support-privacy-ownership.md)
> 实施状态：目标架构已确定；自有 IAM、RS256/JWKS、Gateway 安全边界与服务侧 PEP 已形成代码和契约基线，但完整运行与发布证据仍未齐，不得宣称目标服务集群已经完成。现有 `services/core-api` 仍是迁移中的 v1 兼容实现，不代表目标服务已经全部开发完成。

## 1. 这份文档解决什么问题

`v2-980plus` 是下一轮开发唯一的全量业务设计与需求落地基线，解决“做什么、给谁做、在哪个前端项目呈现、如何交互和验收”；本文件解决“由哪些后端服务承载、谁拥有数据、如何鉴权、如何通信、如何运行和如何演进”。两者必须同时满足，才能把设计单元转成新的开发任务。旧 v1 详细设计和 B0–B6 仅保留历史/迁移参考，不能覆盖 v2。

本文件是后端技术架构的唯一目标基线：

- 业务功能继续使用 `FEAT-*`、`PRD-ATOM-*` 和 `V2-980-*`；平台能力使用独立的 `ARCH-*` 编号，不能把 Gateway、RBAC、观测等基础能力伪装成业务功能。
- `V2-EXT-*` 是已登记在 v2 范围内、但仍待细化签收的透明单元；没有独立名称、来源映射、验收和产品/架构/合规签收，不得进入代码任务、接口发布或 Phase 1 默认路由。
- 新服务通过 Gateway 暴露；客户端不得直连领域服务，也不得提交角色、租户或资源归属来扩大权限。
- 微服务采用渐进式拆分。目标是服务自治，不是一次性把当前单体重写成一组空壳服务。

## 2. v2 技术基线

| 层级 | v2 目标选择 | 约束与说明 |
|---|---|---|
| Java 运行时 | **Java 25 LTS** | 新服务统一 Java 25；Java 17 只作为现有 `core-api` 的迁移兼容运行时。升级通过统一 toolchain、容器基础镜像和 CI 矩阵完成。 |
| Java Web | **Spring Boot 4.1.x + Spring Framework 7.x** | 版本由公司级 BOM/Version Catalog 管理；安全补丁和小版本升级不得由单个服务自行漂移。 |
| Gateway | **Spring Cloud Gateway Server WebFlux 5.x** | 通过与 Spring Boot 4.1 匹配的 Spring Cloud release train/BOM 锁定当前受支持 patch；只负责路由、TLS 后的边界策略、JWT 预校验、限流、请求上下文和观测，不承载领域写入和业务规则。 |
| 服务安全 | Spring Security Resource Server + 自有 JWT Bearer | 每个服务都独立通过 IAM JWKS 验证签名 JWT 的 issuer、algorithm、audience、时间窗口、token type 和权限，并执行本地 PEP；Gateway 校验不能替代领域服务校验。 |
| IAM/RBAC | `iam-service` + 账号密码认证 + JWT/JWKS + 版本化策略决策接口 | IAM 校验平台账号密码，直接签发 JWT Access Token，发布公钥并管理 Refresh Token、设备、会话、撤销、用户、租户、角色、权限、同意和策略元数据。RBAC 结合租户、资源所有者、阶段、内容版权和设备状态进行 ABAC 决策。 |
| 服务通信 | 外部 REST/OpenAPI；内部 REST 或 gRPC；异步事件 | 同步调用必须有 timeout、重试预算和熔断；跨域最终一致性优先使用事件，不做共享表联查。 |
| 事件平台 | Kafka 兼容事件总线 + Outbox + AsyncAPI | 只承载跨服务集成事实，不承载 UI 点击、日志、指标或同步 RPC；至少一次投递，按聚合 ID 分区，事件必须有 `eventId`、`traceId`、`schemaVersion`、幂等键和兼容策略；消费者支持重放和死信恢复。 |
| 关系数据 | MySQL 8.x 集群，服务独立 schema/owner | 每个服务只写自己的 schema；跨服务数据通过 API、事件或只读投影获得。Flyway 按服务管理迁移。 |
| 缓存/锁 | Redis 7.x | 只存缓存、短期状态、限流和协调信息，不作为学习、订单、权限或审计的唯一事实源。 |
| 媒体 | S3 兼容对象存储 + CDN | 通过 `media-service` 签发短期授权 URL；原始音频、支付凭证和敏感对象不得进入日志或事件。 |
| AI/实时语音 | Python 3.11+ FastAPI AI 编排；商业 RTC 接入层 | Phase 2 才启用；客户端不能直接访问模型供应商。自建 RTC 或替换供应商需新增 ADR。 |
| 部署 | OCI 镜像 + Kubernetes + Helm/Kustomize + GitOps | 生产环境采用不可变发布、滚动/金丝雀策略；本地开发可以使用 Docker Compose，但不能改变生产服务边界。 |
| 工程质量 | OpenTelemetry、Prometheus、Grafana、日志与 Trace 后端、SBOM、依赖扫描 | 日志、指标、Trace、审计和业务事件要能通过 `requestId/traceId/eventId` 关联。 |

## 3. 目标拓扑

```text
四个前端项目 / 外部客户端
        │ HTTPS / WSS
        ▼
CDN + WAF + 负载均衡 / Kubernetes Gateway API（仅边缘 Ingress/TLS，不做产品授权）
        │
        ▼
services/api-gateway  ───────► 统一路由、版本、限流、上下文、JWT 预校验
        │
        ├── services/iam-service ─────► 账号密码、JWT/JWKS、Refresh 会话、用户、租户、RBAC/ABAC、策略决策
        ├── services/learner-service ─► 目标、档案、Onboarding、学习设置
        ├── services/content-service ─► 内容、版本、版权、审核发布
        ├── services/learning-service ► 课程、SRS、学习进度、复习闭环
        ├── services/assessment-service ► 测评会话、作答、规则评分、报告快照
        ├── services/media-service ───► 媒体元数据、授权 URL、处理任务
        ├── services/gamification-service ► XP、Streak、星系、奖励
        ├── services/social-service ──► 自习室、社群、低 UGC、举报
        ├── services/commerce-service ► 商品、订单、支付回调、权益、对账
        ├── services/notification-service ► 站内信、Push、短信、模板
        ├── services/analytics-service ► 埋点接收、指标、只读分析模型
        └── services/admin-ops-service ► 后台聚合/BFF + 客服工单子域；不复制其他领域事实
        │
        ├── Kafka 兼容事件总线 + Schema/AsyncAPI + DLQ
        ├── MySQL（每服务独立 schema/迁移）
        ├── Redis（按服务命名空间）
        ├── S3/OSS + CDN
        └── OTel Collector → Metrics / Logs / Traces / Audit

Phase 2：ai-orchestrator、realtime-voice、content-safety、evaluation
Phase 3：guardian、institution、curriculum-rights 等受监管域

迁移期间：services/core-api 通过兼容路由作为旧域单体，按 Strangler Fig 逐域退出。S3/CDN 的大媒体下载仅允许使用 `media-service` 签发的短期授权 URL；它不是绕过 `api-gateway` 的业务 API 入口。
```

## 4. 服务边界与数据所有权

### 4.1 平台服务

| 服务 | 主要职责 | 不能做什么 | 首次建设阶段 |
|---|---|---|---|
| `api-gateway` | 外部入口、路由、API 版本、CORS、限流、请求/Trace 上下文、JWT 预校验、黑名单和边界审计 | 不写学习、订单、内容或权限业务事实；不接受客户端角色头 | Platform 0 |
| `iam-service` | 账号密码校验、JWT 签发、JWKS 公钥发布与轮换、不可变 principal、用户/租户/组织、设备、Refresh 会话、同意、角色、权限、策略版本、撤销和审计 | 不拥有课程、订单、学习记录等领域事实；不能接受客户端权限覆盖 | Platform 0 |
| `audit-service`（可先作为平台模块） | 安全审计、管理操作审计、数据导出审计、合规留痕 | 不代替领域事件或业务数据库 | Platform 0/1 |
| `workflow-service`（可先由 job-runner 承载） | Saga、定时任务、补偿、重试、死信和人工恢复 | 不直接改写其他服务数据库 | Platform 0/1 |

### 4.2 Phase 1 业务服务

| 服务 | 领域事实所有权 | v1 `core-api` 迁移来源 |
|---|---|---|
| `learner-service` | 目标、用户学习档案、Onboarding、偏好、学习设置 | `auth`/`user`/Onboarding 相关模块；身份事实迁入 IAM |
| `content-service` | 内容、内容版本、题目/练习定义、答案规则版本、版权、审核、发布/下线 | `content` 与管理内容模块 |
| `learning-service` | 学习计划、词汇/SRS、学习进度、复习调度、`mastery_projection` | `learning`、词汇和复习相关模块 |
| `assessment-service` | 测评会话、作答、草稿/checkpoint、规则判分、模考和报告快照；使用 content 的版本化题目快照 | `assessment` 相关模块 |
| `media-service` | 媒体元数据、转码/切片任务、授权下载、资产版本 | content-worker 与媒体相关模块 |
| `gamification-service` | XP、Streak、段位、星币、Avatar、奖励结算 | `gamification` 模块 |
| `social-service` | 自习室、社群、排行榜投影、低 UGC、举报处理 | `social` 模块 |
| `commerce-service` | SKU、订单、渠道回调、订阅、权益、退款、对账 | `commerce` 模块 |
| `notification-service` | 通知模板、发送记录、用户触达偏好、重试 | notification-worker |
| `analytics-service` | 脱敏事件接收、指标和只读分析模型 | analytics-worker 与 telemetry |
| `admin-ops-service` | 面向 `admin-web` 的聚合查询、审批编排、任务发起、操作审计关联；其 `support` 子域唯一拥有客服工单、消息、assignment、SLA 和 resolution | `admin` 模块；support 之外只能发命令/读取投影，审核、发布、订单、学习等状态仍归对应领域服务 |

允许共享 Kubernetes 集群、节点池、MySQL 集群实例和公共可观测基础设施；但一旦某领域从 `core-api` 抽出，它必须拥有独立 OCI 镜像/进程、schema、数据库凭据、契约、发布流水线和回滚责任。多个目标服务同 Pod/JVM 或共享运行时不能计为“已拆分”；如确有临时共置需求，必须有 ADR、退出日期、容量/故障隔离测试和独立发布的验收证据。部署渐进不等于恢复跨模块直表访问。

### 4.3 跨服务事实切分（不得双写）

| 事实/决策 | 唯一 owner | 其他服务的使用方式 | 明确禁止 |
|---|---|---|---|
| 登录主体、会话、同意、角色、策略版本 | `iam-service`（账号密码校验、JWT 签发和 JWKS 由认证中心承载） | 已验证 JWT、JWKS、版本化策略包或受控 PDP 决策 | 领域服务自行发 Token、前端声称角色/租户 |
| 学习目标、偏好、用户学习档案 | `learner-service` | 通过 API/事件读取必要投影 | IAM 或 admin 直接改学习画像表 |
| 内容、`content_version`、题目/练习定义、答案规则版本、版权 | `content-service` | `assessment-service` 以版本化内部契约取得可审计题目快照；学习端只读已发布版本 | `assessment-service` 维护题库主表，或前端持有答案规则 |
| 测评会话、attempt、草稿/checkpoint、规则评分、报告快照 | `assessment-service` | `learning-service` 消费已提交/已评分事实，`gamification-service` 仅消费可信完成事件 | content/learning/前端改 attempt、重复评分或伪造分数 |
| 计划、SRS、进度、复习队列、`mastery_projection` | `learning-service` | 以 assessment 事件重算/投影；报告可读取自己的视图 | assessment 直接写掌握度，客户端直接改复习状态 |
| 媒体资产、转码、rendition、授权 URL | `media-service` | `content-service` 持有语义关联与版权状态；客户端仅使用短期 URL | 内容服务直接管理对象存储授权，或将原始录音放进事件/日志 |
| XP/星币/奖励账本 | `gamification-service` | 消费带来源、幂等键和版本的可信学习/测评事件 | 客户端直接记账或其他服务修改奖励流水 |
| SKU、订单、支付回调、权益、退款、对账 | `commerce-service` | 其他服务通过权益读取契约/缓存投影进行 Gate | 其他服务自行判断或写入付费权益 |
| 客服工单、消息、assignment、SLA、resolution | `admin-ops-service.support` | 学习端本人和客服后台通过同一 owner 契约读写；notification 只触达，workflow 只升级/恢复 | learner/admin 两套入口写不同表；客服直接改订单、学习或身份事实 |
| 隐私导出请求、状态和 receipt | `learner-service.privacy` | workflow 协调各领域 owner 生成片段，audit 留痕 | learner-service 跨库读取/删除所有领域数据，或把导出原文放入事件 |
| 账号删除请求、冷静期和主体最终状态 | `iam-service` | workflow 编排各领域 owner 匿名化并收集 receipt | IAM 跨库删除领域数据，或只停用登录就宣称删除完成 |
| 后台聚合、工作流、审计 | `admin-ops-service` / `workflow-service` / `audit-service` | 聚合只读投影、发出领域命令、记录不可变审计 | BFF、工作流或审计服务跨域写领域数据库；support 子域之外复制领域事实 |

### 4.4 Phase 2/3 服务

- `ai-orchestrator`：Python 3.11+，负责模型路由、LangGraph/LiteLLM、结构化 Schema、成本和失败降级；学习事实由 `learning-service`/`assessment-service` 持有。
- `realtime-voice`：商业 RTC 的会话、令牌和断线恢复适配；不在客户端保存供应商密钥。
- `content-safety` 与 `evaluation`：AI 输出双审、评测、提示词/模型版本和回放审计。
- `guardian-service`、`institution-service`、`curriculum-rights-service`：Phase 3 才能进入默认路由，必须先通过未成年人、版权和机构合规 Gate。

## 5. Gateway、IAM 与 RBAC/ABAC

### 5.1 请求链路

```text
客户端
  → Gateway：TLS/Origin/限流/requestId/traceId/JWT 预校验/API 版本
  → 服务 PEP：验证 JWT、tenant、subject、scope、resource owner、phase、content rights；使用本地版本化策略包/短时决策缓存
  → IAM/PDP（仅高风险、动态资源策略或安全缓存未命中）：返回 allow/deny + decisionId + obligations
  → 领域服务：校验业务状态、幂等键、数据所有权并写入自己的事实
  → Outbox：提交事务内事件
  → Event Bus：消费、去重、审计、分析、通知和投影
```

### 5.2 权限模型

权限判断的最小输入为：

```text
subjectId + tenantId + roles + permission + action + resourceType + resourceId
+ ownerId + phase + contentRights + deviceTrust + consent + policyVersion
```

硬规则：

1. 默认拒绝；缺少租户、资源所有者、阶段或内容版权信息时不能降级为允许。
2. Gateway 做边界过滤，领域服务必须再次做 PEP 校验；不能只相信 Gateway 或前端路由守卫。
3. 不接受 `X-B5-Role`、`X-Role`、客户端 `tenantId` 或客户端 `ownerId` 作为权限事实。角色和归属只能来自已验证令牌、IAM 和服务自己的资源记录。
4. `403`、`401`、内容未发布、资源不存在和空列表必须有可区分的错误/状态语义；不能把权限拒绝伪装成空态。
5. 角色、权限、策略和授权决策均有版本、审计和撤销记录；高风险后台操作需要二次确认或双人审批。
6. PEP 不能因 PDP、缓存或网络异常而放宽权限：已验证且未过期的本地策略/决策可在定义的短 TTL 内使用；策略版本过期、撤销状态不确定或高风险操作无法确认时一律拒绝并记录可回放原因。

建议的初始角色集合：`learner`、`tenant-admin`、`content-editor`、`reviewer-l1`、`reviewer-l2`、`finance`、`support`、`auditor`、`privacy-operator`、`release-operator`、`platform-admin`。角色只是权限集合，不替代资源所有权、租户和阶段条件。

### 5.3 自有认证中心、授权执行与租户隔离

- `iam-service` 是平台自有认证中心：账号密码只在 IAM 的 TLS 认证接口校验，密码以 Argon2id（不可用时 BCrypt cost≥12）哈希保存；IAM 在 Phase 1 直接签发 RS256 JWT Bearer Access Token、发布 RSA JWKS，并以服务端会话管理轮换/重放检测/撤销 Refresh Token。Web 使用 HttpOnly/Secure/SameSite Cookie，移动端使用 Keychain/Keystore；官网只跳转到统一登录页。服务工作负载使用独立 workload identity。业务租户、角色、ABAC 元数据、同意和审计仍由 `iam-service` 管理。
- 正常请求热路径由服务侧 PEP 验签、资源本地事实和已签名/版本化策略包完成；远程 PDP 仅用于高风险后台操作、动态策略或本地安全缓存未命中。PDP 调用有严格 timeout、熔断、审计和 fail-closed 语义，不能把 IAM 变成所有读请求的单点瓶颈。
- Phase 1 成人产品使用服务端派生的 `platform` tenant，上游客户端不能选择 tenant。Phase 3 多租户扩展采用“共享 schema + 强制 `tenant_id`”起步：每张租户业务表必须包含 `tenant_id`、关键唯一约束/索引包含 `tenant_id`，数据访问层必须由验证后的 `TenantScope` 自动约束并通过跨租户测试。MySQL 不被描述为自带行级安全；对受监管或超大机构的独立数据库/密钥隔离必须另立 ADR。
- 平台管理员的跨租户动作必须显式携带受审计的目标租户与理由，不能借由空 tenant 或超级角色绕过 owner、阶段、版权和隐私规则。

### 5.4 Token 与密钥

- Access Token 必须是短时效、最小 scope 的非对称签名 JWT；Gateway 和每个领域服务均通过 IAM JWKS 验证 `iss`、`sub`、`aud`、`exp`、`iat`、`nbf`、`jti`、`token_type` 和权限声明。目标有效期为 5–15 分钟；Phase 1 算法固定为 RS256，拒绝 ES256、`none`、未登记算法和 HMAC。ES256 只能在新增 ADR、同步更新契约与 JWKS key schema、密钥管理和运行实现并通过验证后扩展。
- Refresh Token 只由 IAM 管理并轮换，检测重放后撤销会话族；Refresh Token 不进入领域服务、URL、日志、事件或前端 Web storage。
- 签名密钥必须由 KMS/Vault 管理，支持双钥并行、JWKS 发布、轮换和回滚；密钥不进入 Git、镜像、事件或普通日志。
- 服务间使用 workload identity 和 mTLS；服务账号、用户身份和后台操作者身份不能混用。

## 6. API、数据与事件契约

1. `packages/contracts/` 继续是 OpenAPI、AsyncAPI、JSON Schema 的源码事实源；Java DTO、客户端类型和校验器必须生成。
2. 外部 API 统一 `/api/v1/...`；内部 REST 使用 `/internal/v1/...` 或 gRPC；事件使用 `domain.action.vN` 和明确的 schema 版本。
3. 写操作要求 `Idempotency-Key`；客户端离线事件使用 `clientEventId`；两者不能互相替代。
4. 每个服务使用自己的 Flyway migration、schema owner、Redis key namespace 和审计边界；禁止跨服务 SQL join、跨服务写表和共享 ORM entity。
5. Outbox 只用于跨服务集成事实；页面埋点、日志、指标和同步 RPC 不得进入领域事件总线。Kafka 不是 RPC、查询总线或分布式事务协调器。
6. 跨服务业务采用 Outbox + 事件 + Saga/补偿；不使用分布式两阶段提交。订单、权益、学习完成等关键状态必须可重放、可对账、可人工恢复。
7. 投递语义为至少一次；生产者按聚合 ID（如 `userId`、`orderId`、`attemptId`）选择分区键，消费者必须支持去重、乱序、重试、DLQ、回放和旧版本兼容。事件 schema 只允许向后兼容演进，破坏性变更必须新增版本。
8. 事件 payload 遵循最小化原则：不传原始音频、支付凭证、Token、答案密钥或不必要的个人信息；分析和审计以脱敏事件 envelope/不可变审计记录读取，不得直连领域数据库。

## 7. 可靠性、观测和运行治理

### 7.1 初始 SLO 基线

以下是进入生产前需要通过运行证据确认的初始目标，不是用来掩盖当前代码尚未具备的能力：

| 能力 | 初始目标 |
|---|---|
| Gateway 可用性 | 月度 99.95% |
| 学习/作答关键写入 | 月度 99.90%；失败可重试且不重复记账 |
| 关键查询 | p95 ≤ 300ms（不含 CDN/媒体下载），p99 需有容量报告 |
| 数据恢复 | Phase 1 目标 RPO ≤ 15 分钟、RTO ≤ 60 分钟；每季度恢复演练 |
| 事件处理 | 有积压阈值、DLQ、重放命令和消费者延迟告警 |
| 审计 | 权限变更、后台高风险操作、导出、支付和删除可按 decisionId/traceId 回放 |

### 7.2 发布与灾备

- Kubernetes readiness/liveness/startup probe、优雅停机、连接排空、超时和限流必须是服务模板默认项。
- 发布采用不可变镜像、SBOM、依赖/CVE 扫描、签名、数据库前向兼容迁移和可回滚配置；先灰度再扩大流量。
- MySQL 使用备份、PITR、跨可用区副本和定期恢复演练；Redis 只承担可重建状态时才允许丢失，事实数据不能依赖 Redis。
- 日志、指标和 Trace 默认脱敏；业务事件、审计事件和运维日志分别保留，不能以普通日志替代审计。

## 8. 仓库与迁移策略

目标仓库结构：

```text
services/
├── api-gateway/
├── iam-service/
├── audit-service/             # Platform 0/1，可先作为平台模块
├── workflow-service/          # Platform 0/1，可先由 job-runner 承载
├── learner-service/
├── content-service/
├── learning-service/
├── assessment-service/
├── media-service/
├── gamification-service/
├── social-service/
├── commerce-service/
├── notification-service/
├── analytics-service/
├── admin-ops-service/
├── ai-orchestrator/          # Phase 2，Python
├── realtime-voice/           # Phase 2
└── core-api/                 # v1 兼容单体，逐域退出
```

迁移采用四步：

1. **M0 基线**：接受 ADR-0010、ADR-0012、ADR-0013 和 ARCH 能力矩阵；锁定自有 JWT profile、密码/会话安全策略、契约、观测、权限决策接口、tenant 查询守卫、端口登记和本地网关入口。
2. **M1 入口先行**：Gateway + IAM/RBAC 先接入旧 `core-api`；前端只改为访问 Gateway，旧直接端口仅保留本地兼容和回滚用途。至少跑通一个拒绝/撤销/跨租户链路，验证 Gateway 不会替代服务侧 PEP。
3. **M2 逐域抽取**：按 `learner → content → learning/assessment → media → commerce → social/gamification` 的依赖顺序抽取。新服务先以只读投影/事件旁路验证，再切换写入，保留回滚窗口；每个被宣称“已抽取”的领域都必须具有独立 OCI 进程、schema、凭据和发布/回滚证据。
4. **M3 退出单体**：达到契约、数据一致性、SLO、权限、回放和回滚证据后，关闭对应 `core-api` 路由；禁止以“服务目录已创建”作为拆分完成标志。

当前 `services/core-api`、Java 17 和旧模块不删除、不假装已经迁移；它们是 v2 的反腐层和回滚边界。任何新业务默认不得继续向 `core-api` 增加跨域功能，除非有迁移 ADR 和明确的兼容原因。

## 9. 十年演进规则

- LTS 运行时和 Spring/Cloud 版本统一升级，每季度检查安全补丁，每个 LTS 至少保留一个兼容窗口；新服务不再回到 Java 17。
- API、事件和数据库迁移遵循“先兼容、再切换、后删除”；外部 API 至少保留一个弃用窗口，事件消费者必须先兼容新旧 schema。
- 服务拆分依据吞吐、故障隔离、数据合规、团队边界和发布频率，而不是按类或页面机械拆分；低流量服务可以共享部署资源但不共享写模型。
- 数据治理包含归档、保留期限、删除请求、审计留存、灾备演练和成本预算；十年运营不能只依赖线上主库。
- 引入新基础设施、替换消息总线、改变身份提供方、引入服务网格或自建 RTC，必须新增 ADR，并提供迁移、回滚、成本和运维责任人。

## 10. 与 v2-980plus 的落地关系

每个 v2 设计单元在进入任务设计前，必须补齐以下映射：

```text
V2-980 / FEAT / PRD-ATOM
  → ACT / JNY / PAGE / RULE / INT / E2E（Phase 1 业务运行设计）
  → ARCH 能力
  → 前端项目与路由
  → Gateway operation / service owner
  → OpenAPI + AsyncAPI + schema
  → 数据 owner + migration
  → RBAC/ABAC + tenant scope + privacy/phase gate
  → success/empty/loading/error/offline/permission/recovery/processing
  → CONTRACT/EVENT/IMPLEMENTATION/EVIDENCE GAP 关闭条件
  → 单测/契约/集成/E2E/运行与回滚证据
```

对应的 `ARCH-*` 清单见 [v2 平台能力矩阵](./v2-platform-capability-matrix.md)，Phase 1 运行语义见 [Phase 1 业务运行设计包](../06-design/v2-980plus/phase1-business-operation/README.md)，执行顺序与验收见 [Phase 1 开发计划重基线](../../requirements/backlog/v2-phase1-rebaseline/README.md)。旧 B/DEV/G 台账保留用于历史追溯和资产候选，不再作为 v2 新任务的拆分或完成依据。
