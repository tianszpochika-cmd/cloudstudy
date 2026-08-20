# 需求中心

这里是项目的唯一需求入口。所有开发任务必须以以下文档为准，不以聊天记录、历史 PDF 或旧技术方案为准。

## 需求事实源

- product-requirements.md：完整 PRD，定义产品阶段、边界和功能。
- mvp-scope.md：Phase 1 可执行范围与优先级。
- user-stories.md：按 Phase 1/2/3 划分的用户故事。
- acceptance-criteria.md：可测试验收标准。
- backlog/：后续拆分任务。
- iterations/：迭代记录。

## 当前产品基线

- 产品：语学星，研发代号 EnglishFlow。
- Phase 1：18+ 成人/大学生，标准语言学习，无生成式 AI。
- Phase 2：18+ 成人 AI 学习、口语评测、数字人、职场与留学。
- Phase 3：满足资质、版权和未成年人合规后扩展 K12/高中。

## 开发约束

最终技术路线见 AGENTS.md、docs/02-architecture/stack-recommendation.md 和 docs/10-decisions/0004-stack-switch-uniapp-springboot.md：

Vue 3 + TypeScript + uni-app + Spring Boot 3 + MySQL 8.x + Redis 7.x

AI 仅在 Phase 2 通过 Python FastAPI 独立服务启用。历史技术方案、历史 PDF 和被标记为 superseded 的 ADR 不属于当前实现依据。

