# 仓库目录地图

> v2 说明：前端业务项目固定为 `mobile`、`learner-web`、`admin-web`、`official-site` 四个；`miniapp-wechat` 只能是迁移/平台资源占位。后端目标服务见 [v2 微服务架构](../02-architecture/v2-microservices-architecture.md)，当前目录存在不代表实现完成。

~~~text
语学星/
├─ apps/                         多端应用
│  ├─ learner-web/               学习 Web
│  ├─ mobile/                    uni-app 移动端原生配置与打包（见 ADR-0004）；含 ios/ 与 android/
│  ├─ official-site/             官网与 SEO
│  └─ admin-web/                 运营/教研/客服后台
├─ services/                     后端运行时
│  ├─ api-gateway/               Java 25 Spring Cloud Gateway（v2 目标）
│  ├─ iam-service/               标准 OIDC IdP 集成、租户、RBAC/ABAC（v2 目标）
│  ├─ audit-service/             安全/管理/导出审计（v2 平台能力）
│  ├─ workflow-service/          Saga/任务/补偿/DLQ（v2 平台能力）
│  ├─ learner-service/           学习者档案与目标（v2 目标）
│  ├─ content-service/           内容/题目规则版本、版权、审核、发布（v2 目标）
│  ├─ learning-service/          学习流、SRS、进度、掌握度投影（v2 目标）
│  ├─ assessment-service/        测评会话、作答、判分、报告快照（v2 目标）
│  ├─ media-service/             媒体授权与处理（v2 目标）
│  ├─ gamification-service/      成长与奖励（v2 目标）
│  ├─ social-service/            社群与低 UGC（v2 目标）
│  ├─ commerce-service/          订单、支付、权益（v2 目标）
│  ├─ notification-service/      触达（v2 目标）
│  ├─ analytics-service/         事件与分析（v2 目标）
│  ├─ admin-ops-service/         后台聚合与审批（v2 目标）
│  ├─ core-api/                  Java 17 迁移兼容单体
│  ├─ ai-orchestrator/           AI 供应商、提示词和安全编排
│  ├─ realtime-voice/            实时语音会话
│  ├─ content-worker/            内容生产与发布任务
│  ├─ notification-worker/       学习提醒任务
│  ├─ analytics-worker/          事件与指标聚合
│  └─ job-runner/                通用异步/定时任务
├─ packages/                     跨端共享包
│  ├─ api-client/ contracts/ domain/
│  ├─ ui-web/ ui-mobile/ design-tokens/
│  ├─ i18n/ content-schema/ ai-prompts/
│  └─ telemetry/ config/
├─ database/                     数据结构、迁移、种子和夹具
├─ content/                      课程、练习、词汇、媒体和评分规则
├─ ai/                           提示词、评测集、策略和实验
├─ analytics/                    事件、指标和看板定义
├─ requirements/                 PRD、MVP、用户故事和验收标准
├─ docs/                         产品、架构、设计、运维和合规
├─ infra/                        本地容器、部署、监控和安全
├─ scripts/                      启动、数据库、内容、发布和 CI 脚本
├─ tests/                        E2E、集成、契约、AI、性能和安全
├─ agent/                        Agent 上下文、工作流、提示词和决策
└─ .github/                      CI、Issue 和 PR 模板
~~~

空目录中的 .gitkeep 是有意保留的未来边界，不代表已经实现对应功能。
