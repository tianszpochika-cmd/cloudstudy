# 系统架构总览

> v2 技术目标以 [v2 微服务目标架构](./v2-microservices-architecture.md) 为准。本文中的 `core-api` 仅表示迁移期兼容单体，不表示 v2 已完成微服务拆分。

## 设计原则

- Phase 1 先完成 18+ 成人的规则化学习闭环，不以 AI 或多端数量替代学习质量。
- 多端共享领域模型、OpenAPI 契约、设计令牌和埋点，不强制共享所有 UI。
- 核心学习、权益和内容数据进入 MySQL；媒体进入对象存储；Redis 不作为唯一事实源。
- 生成式 AI 和实时语音均为 Phase 2 独立能力，不影响 Phase 1 可用性。
- 异步任务可重试、可观测、可取消，并且具备幂等键、Outbox、DLQ 和回放路径。
- Gateway、IAM/RBAC、服务侧 PEP、数据 owner、事件和观测是所有业务域共同的 v2 平台边界。

## 逻辑拓扑

客户端层：四个冻结项目——`apps/mobile`、`apps/learner-web`、`apps/admin-web`、`apps/official-site`；小程序只作为 `apps/mobile` 的条件编译输出。

接入层：CDN/WAF、负载均衡、Kubernetes Gateway API 和 `services/api-gateway`；负责鉴权预校验、API 版本、速率限制和 requestId/traceId。

平台层：`services/iam-service` 是平台自有认证中心，校验账号密码、签发短时非对称 JWT Bearer Access Token、发布 JWKS，并承载用户/租户/会话、Refresh Token 轮换/撤销和 RBAC/ABAC 策略；每个业务服务继续独立验签并执行服务侧 PEP。

业务层：learner、content、learning、assessment、media、gamification、social、commerce、notification、analytics 和 admin-ops 服务；`core-api` 只作为迁移期兼容路由。

任务层：Kafka 兼容事件总线、Outbox、Workflow/Saga、内容处理、通知、分析和通用异步任务。

数据层：MySQL、Redis、对象存储、CDN 和分析仓库。

Phase 2 智能层：FastAPI AI 编排、商业 RTC、评测和内容安全服务；Phase 3 再增加监护、机构和教材版权服务。

## 运行策略

Phase 1 的业务能力按微服务边界设计，但采用渐进式部署：先建设 Gateway/IAM/RBAC/观测/契约平台，再把 `core-api` 接入作为兼容后端，按领域逐步抽取。AI、实时语音和向量检索不在 Phase 1 启动。

## 关键请求流

### 今日学习

客户端 -> Gateway -> IAM/PEP -> learner/learning service -> 读取用户目标和课程进度 -> 规则生成今日任务 -> Outbox/事件 -> 返回任务链。

### 练习与复习

客户端 -> Gateway -> assessment/learning service -> 校验内容版本和权限 -> 规则评分 -> 写入服务自有事实 -> Outbox -> SRS/报告/通知消费者。

### Phase 2 AI 反馈

客户端 -> Gateway -> assessment/learning service 保存原始答案 -> AI 编排读取受限课程上下文 -> 返回结构化反馈 -> 领域服务写入反馈和复习项。该链路不在 Phase 1 启用。
