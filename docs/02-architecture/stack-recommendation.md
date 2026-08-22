# 技术栈与架构最终基线

> 本文件是 v2 的技术选型事实源。业务设计以 `docs/06-design/v2-980plus/` 为准；后端服务边界、Gateway、IAM/RBAC、数据 owner、事件和迁移以 [v2 微服务目标架构](./v2-microservices-architecture.md) 与 ADR-0010 为准。旧 `core-api` 的 Java 17/Spring Boot 3 只代表迁移中的兼容实现。

## 1. 最终技术路线

| 层级 | 最终选择 | 适用范围 |
|---|---|---|
| 学习端 | Vue 3 + TypeScript + uni-app | Web、H5、iOS、Android、iPad、微信小程序 |
| 管理后台 | Vue 3 + TypeScript + Vite + Element Plus | 教研、内容、运营、客服、权限和数据后台 |
| 官网 | Nuxt 3 或 uni-app H5 | SEO 官网、品牌内容、测评入口 |
| 新业务后端 | **Java 25 LTS + Spring Boot 4.1.x + Spring Framework 7.x** | 微服务目标架构；版本由统一 BOM/Version Catalog 管理 |
| 迁移兼容后端 | Java 17 + Spring Boot 3 | `services/core-api` 旧模块化单体，只作兼容路由、数据迁移和回滚边界 |
| API Gateway | Spring Cloud Gateway Server WebFlux 5.x | 外部路由、版本、限流、JWT 预校验、request/trace 上下文；不承载业务写入 |
| IAM/RBAC | Spring Security Resource Server + OIDC/OAuth 2.1 + `iam-service` | 用户、租户、设备、会话、角色、权限、RBAC/ABAC 策略和撤销 |
| ORM 与迁移 | MyBatis-Plus + Flyway | MySQL 数据访问与版本迁移 |
| 主数据库 | MySQL 8.x | 关系数据、课程、学习记录、订单、权限 |
| 缓存 | Redis 7.x | 会话、排行榜、锁、打卡、短期任务缓存 |
| 对象存储 | S3 兼容 OSS + CDN | 音频、视频、图片、离线资源 |
| 事件与异步 | Kafka 兼容总线 + Outbox + AsyncAPI | 跨服务事件、通知、内容处理、报表、离线任务、DLQ/回放 |
| Phase 2 AI | Python 3.11 + FastAPI + LiteLLM/LangGraph | AI 编排、结构化反馈、评测和 RAG |
| Phase 2 实时语音 | 声网或腾讯云 TRTC 等商业 RTC | 先商用接入，避免早期自建 RTC 集群 |

## 2. 跨端原则

- 业务页面、状态、路由、领域模型和埋点尽量由 uni-app 复用。
- 使用条件编译处理平台差异，不在同一功能上维护多套完全独立 UI。
- H5/App 使用 Three.js、Rive、Wavesurfer 等增强体验；小程序按能力降级到 2D/静态方案。
- Windows 先使用 Web + PWA；原生壳仅在确有系统能力需求时启用 Tauri 2.0。
- 必须支持 Ultra / High / Medium / Performance 四级画质降级。

## 3. 后端边界

- 新服务按 `api-gateway`、`iam-service`、`learner-service`、`content-service`、`learning-service`、`assessment-service`、`media-service`、`gamification-service`、`social-service`、`commerce-service`、`notification-service`、`analytics-service` 和 `admin-ops-service` 划分；完整 owner 和迁移关系见 v2 微服务目标架构。
- Gateway 是唯一外部业务 API 入口。每个领域服务都必须本地验证 JWT 并执行 PEP，不能依赖前端路由守卫、Gateway 单点鉴权或客户端角色头。
- 每个服务独立拥有 schema、Flyway migration、Redis key namespace、OpenAPI/AsyncAPI 契约和写权限；禁止跨服务 SQL join、跨服务写表、共享 ORM entity 和分布式两阶段提交。
- `core-api` 采用 Strangler Fig 逐域迁移：先由 Gateway/IAM 接入，再按 learner/content/learning/assessment/media/commerce 等依赖切流；没有数据、权限、SLO、观测和回滚证据不得宣称完成拆分。
- Phase 2 AI 编排通过内部 REST/gRPC/事件与领域服务通信，客户端不得直接访问模型供应商；Phase 2 RTC 使用独立 `realtime-voice` 服务。

## 4. 契约与数据规范

- OpenAPI YAML/JSON 是前后端契约的单一事实源。
- Java DTO 与前端 TypeScript 类型由 openapi-generator 生成。
- 数据库使用 MySQL 8.x、utf8mb4、Flyway 迁移；Redis 不承担唯一事实数据。
- Phase 1 不引入向量检索。Phase 2 如需向量检索，独立评估组件并新增 ADR。
- 所有学习事件、成绩、复习状态、权益变更和审计记录可追溯。

## 5. 运行与十年演进规范

- 生产目标为 OCI + Kubernetes + Helm/Kustomize + GitOps；服务模板默认包含 OpenTelemetry、健康探针、优雅停机、SBOM、依赖扫描、限流、超时、重试预算、熔断和可回滚发布。
- 目标消息链路必须支持 Outbox、幂等消费者、顺序/乱序处理、DLQ、重放和人工补偿；事件 schema 只允许兼容演进，破坏性变更新增版本。
- Access Token 短时效并通过 JWKS 验签；Refresh Token 只由 IAM 管理并轮换；密钥由 KMS/Vault 管理，不得进入 Git、镜像、日志或事件。
- Java/Spring/基础设施按统一版本清单升级，先兼容、再切换、后删除；引入新消息总线、服务网格、身份提供方或 RTC 方案必须新增 ADR。

## 6. 选型禁止项

- 不得引入与本基线冲突的前端、后端或数据主线。
- 不得把已 superseded 的 ADR 作为当前技术依据。
- 不得在 Phase 1 提前接入生成式 AI、AI 评分或数字人。
