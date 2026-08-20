# 技术规格与架构文档索引

> 当前唯一技术基线：Vue 3 + TypeScript + uni-app + Spring Boot 3 + MySQL 8.x + Redis 7.x。所有技术规格必须引用该基线，不引入与基线冲突的替代主线。

## 技术文档入口

| 文档 | 作用 |
|---|---|
| docs/02-architecture/stack-recommendation.md | 最终技术栈、边界与禁止项 |
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

- Vue 3 + uni-app 学习端和 Vue 3 管理后台。
- Spring Boot 3 模块化单体、MySQL 8.x、Redis 7.x、OSS/CDN。
- 规则化测评、SRS、题目评分、错题复习、报告和游戏化。
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
4. docs/02-architecture/stack-recommendation.md
5. docs/02-architecture/system-technical-architecture.md
6. 对应模块设计文档和 OpenAPI 契约
7. docs/10-decisions/README.md 与相关 ADR
