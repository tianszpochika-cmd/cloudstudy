# 后端服务

## v2 目标

v2 采用 Java 25 + Spring Boot 4.1 的微服务目标架构，统一入口为 `api-gateway`，身份与权限由 `iam-service` 负责，领域服务按数据 owner 隔离。完整边界、事件、部署和迁移策略见 [v2 微服务目标架构](../docs/02-architecture/v2-microservices-architecture.md)。

目标服务：

- `api-gateway`：Spring Cloud Gateway；路由、版本、限流、JWT 预校验和请求上下文，不写领域事实。
- `iam-service`：provider-neutral OIDC/OAuth 2.1 适配端口、principal/tenant/设备/会话/同意/成人 Gate/审计；RBAC + ABAC 通过服务模板 PEP 约束。真实 IdP、生产 token/JWKS 和运行态 RBAC 仍受 ADR-0011/G-IDP Gate 约束。
- `audit-service`、`workflow-service`：安全/管理审计、Saga/定时任务/补偿/死信和人工恢复；初期可由平台模块或 `job-runner` 承载，但不能跨服务直接写领域表。
- `learner-service`、`content-service`、`learning-service`、`assessment-service`、`media-service`：学习者、内容、学习流、判分和媒体事实。
- `gamification-service`、`social-service`、`commerce-service`：成长、社群、订单/权益/对账事实。
- `notification-service`、`analytics-service`、`admin-ops-service`：触达、脱敏分析和后台聚合/审批。

截至 B11，`learner-service`（18088）、`content-service`（18089）、`learning-service`（18090）、`assessment-service`（18091）、`media-service`（18092）和 `notification-service`（18093）已经具备独立的代码层领域边界、服务迁移基线和 Gateway-facing 契约；`core-api` 仅保留 B2/B3 兼容适配器，其中 B10/B11 读旁路、媒体对象引用对账、渐进切换和回滚状态机只允许写 adapter ledger，不改目标领域事实。这表示可以进入 Java 25/Maven、跨进程、对象存储、数据库和消息总线测试，不表示 v2 微服务运行态已经全部上线。详见 [`media-service/README.md`](media-service/README.md)、[`notification-service/README.md`](notification-service/README.md) 和 [B11 验证交接](../docs/07-operations/b11-validation.md)。

## 迁移期现状

当前仓库的主要可运行后端仍是 `core-api`（Java 17 + Spring Boot 3）及专项 Worker。它们是 v1 兼容实现，不代表上述 v2 目标服务已经完成；旧单体通过 Gateway/IAM 接入后，按 Strangler Fig 逐域迁移。

- `ai-orchestrator`：Phase 2 模型供应商适配、提示词、工具调用、结构化反馈和安全策略。
- `realtime-voice`：Phase 2 实时语音会话、转写、打断和会话事件。
- `content-worker`、`notification-worker`、`analytics-worker`、`job-runner`：迁移期 Worker；长期职责分别并入 media/content、notification、analytics 和 workflow 能力。

服务是否独立部署由吞吐、故障隔离、权限/合规、数据保留和团队 owner 决定；即使初期共享部署资源，也不能共享数据库写模型、ORM entity 或跨服务 SQL。
