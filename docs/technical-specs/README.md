# 技术规格与架构文档索引

> 当前 v2 技术基线：四个前端项目分别是 `apps/mobile`（唯一 uni-app 学习端）、`apps/learner-web`（PC/平板/PWA 学习 Web）、`apps/admin-web`（Element Plus 管理后台）和 `apps/official-site`（公开官网）；后端采用 Java 25 LTS/Spring Boot 4.1 微服务 + Gateway/IAM/RBAC + MySQL 8.x/Redis 7.x。现有 `core-api` 的 Java 17/Spring Boot 3 仅是迁移兼容实现。

> `modules/01~08` 是旧详细设计的迁移与审计参考，不是新任务、契约或实现的事实源；与当前基线冲突时，以 `AGENTS.md`、ADR-0007/0008/0010/0013 和 v2 设计包为准。

## 技术文档入口

| 文档 | 作用 |
|---|---|
| docs/02-architecture/stack-recommendation.md | 最终技术栈、边界与禁止项 |
| docs/02-architecture/v2-microservices-architecture.md | Gateway、IAM/RBAC、服务边界、数据/事件、运维和迁移 |
| docs/02-architecture/v2-platform-capability-matrix.md | `ARCH-*` 平台能力、依赖、owner 和验收证据 |
| docs/02-architecture/system-technical-architecture.md | 系统分层、服务边界、关键链路 |
| docs/02-architecture/system-overview.md | 架构总览与阶段能力 |
| docs/02-architecture/cross-platform-and-performance-adaptive.md | uni-app 跨端和四级性能降级 |
| docs/02-architecture/data-flow.md | 学习、同步、媒体和事件数据流 |
| docs/02-architecture/avatar-3d-rendering-pipeline.md | 3D Avatar 与平台降级方案 |
| docs/02-architecture/repo-structure.md | 仓库目录与模块边界 |
| docs/technical-specs/core-underlying-engines-specs.md | SRS、内容模型、契约和通用底层规范 |
| docs/05-api/openapi/README.md | OpenAPI 契约入口 |
| docs/10-decisions/README.md | 当前有效 ADR |

## 阶段技术边界

### Phase 1

- 四个冻结项目：`apps/mobile`、`apps/learner-web`、`apps/admin-web`、`apps/official-site`；小程序仅由 `apps/mobile` 条件编译输出。
- Java 25 + Spring Boot 4.1 微服务目标、Gateway/IAM/RBAC、MySQL 8.x、Redis 7.x、OSS/CDN；旧 `core-api` 作为迁移兼容后端。
- 规则化测评、版本化改进型 SM-2、题目评分、错题复习、报告；游戏化 P0 仅“拼句小火车”。
- 不接入生成式 AI、AI 发音评分、AI 数字人、开放式 AI 聊天。

### Phase 2

- 保留 Phase 1 主线，新增 Python FastAPI AI 编排服务。
- 按顺序接入结构化文字反馈、RAG、发音评测、作文批改、实时语音和数字人。
- 所有 AI 能力需经过 schema、安全、成本、评测和备案闸门。

### Phase 3

- 在资质、版权和未成年人保护完成后，扩展 K12/高中和机构能力。
- 不允许通过 Phase 3 预留文档反向改变 Phase 1 的用户边界。

## Agent 阅读顺序

1. AGENTS.md
2. requirements/product-requirements.md
3. requirements/mvp-scope.md
4. docs/06-design/v2-980plus/README.md
5. docs/02-architecture/v2-microservices-architecture.md
6. docs/02-architecture/stack-recommendation.md
7. docs/02-architecture/system-technical-architecture.md
8. 对应模块设计文档和 OpenAPI/AsyncAPI 契约
9. docs/10-decisions/README.md 与相关 ADR
