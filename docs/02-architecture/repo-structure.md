# 仓库结构说明

> v2 目标服务和数据 owner 以 [v2 微服务目标架构](./v2-microservices-architecture.md) 为准。目录存在或包含 README 不等于服务已实现。

## apps

平台入口和平台特定 UI。每个应用只负责展示、交互、路由、端能力和轻量状态。

## services

可部署的运行时服务。v2 以 bounded context 划分服务，当前只有部分目录/实现已存在；`core-api` 是迁移中的 v1 兼容单体。

```text
services/
├── api-gateway/              # v2 外部入口，Spring Cloud Gateway
├── iam-service/              # OIDC/OAuth、租户、RBAC/ABAC
├── audit-service/            # 安全/管理/导出审计（初期可为平台模块）
├── workflow-service/         # Saga、定时任务、补偿、DLQ（初期可由 job-runner 承载）
├── learner-service/          # 目标、档案、Onboarding
├── content-service/          # 内容、版权、审核、发布
├── learning-service/         # 学习流、SRS、进度
├── assessment-service/      # 作答、判分、报告
├── media-service/            # 媒体授权和处理
├── gamification-service/    # XP、Streak、奖励
├── social-service/          # 自习室、低 UGC、举报
├── commerce-service/        # 订单、支付、权益
├── notification-service/    # 触达与重试
├── analytics-service/       # 脱敏事件和分析模型
├── admin-ops-service/       # 后台聚合/BFF
├── ai-orchestrator/         # Phase 2 Python
├── realtime-voice/          # Phase 2 商业 RTC
└── core-api/                # Java 17 迁移兼容单体
```

服务之间禁止共享写表、共享 ORM entity 和跨服务 SQL join；公共能力应放入 contracts、领域无关 SDK 或平台模板，不把业务逻辑复制进 `packages/`。

## packages

跨端共享的契约、类型、领域函数、设计令牌和观测 SDK。

## database

数据库 schema、迁移、种子、夹具和数据字典。

## content

课程内容和媒体，包含版本、审核状态和发布流程。

## ai

提示词、评测、策略和实验，不直接替代运行时服务。

## docs 与 requirements

docs 解释为什么和怎么做；requirements 定义要做什么以及如何验收。

## infra、scripts、tests

分别负责环境、自动化和质量保证。生产目标为 OCI + Kubernetes + Helm/Kustomize + GitOps；本地 Docker Compose 只提供兼容开发依赖。
