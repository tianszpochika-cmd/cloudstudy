# 设计文档总索引

> **dev 分支入口校正（2026-10-06）：设计总索引；本分支执行入口以进度页为准。** 本分支只按[迭代 2（第二轮重设计）当前进度](v2-980plus/redesign/CURRENT-PROGRESS.md)接手；本文业务范围、架构、分期与运行规则继续有效；任务认领与当前验收只按进度页，不将历史状态迁移为 R1 验收。

> **设计基线**：`v2-980plus/` 是下一轮开发唯一的全量业务设计与需求落地基线；`requirements/` 提供来源证据、编号和法规边界。既有 v1 设计包/B0–B6 只作历史与迁移参考，不能覆盖 v2。当前设计面向 Phase 1 18+ 成人/大学生，无生成式 AI；Phase 2/3 设计在对应阶段启动并满足前置条件后新增。后端技术绑定 Java 25 微服务、Gateway、IAM/RBAC，认证会话以 [ADR-0012](../10-decisions/0012-jwt-bearer-access-token-and-session.md) 与 [ADR-0013](../10-decisions/0013-self-owned-jwt-authentication-center.md) 为准，见 [v2 微服务架构](../02-architecture/v2-microservices-architecture.md)。

## 当前可用文档

- design-system.md：全局品牌、视觉和跨端原则。
- immersive-frontend-architecture.md：沉浸式前端、动效和性能降级架构。
- phase-1/：Phase 1 UI/UX 设计包 v1.0（Historical / Superseded，仅迁移参考），包括信息架构、学习地图、词汇、语法、听力、阅读、口语自练、写作、考试、游戏化、商业化、后台、组件和验收清单；当前入口见 `v2-980plus/`。
- phase-2/AI成人学习与AI服务详细设计.md：Phase 2 成人 AI、语音、数字人、RAG 与 AI 社交能力设计。
- phase-2/AI成人学习与实时交互UIUX详细设计.md：Phase 2 AI 页面、实时会话、状态、降级和四端 UI/UX 追溯。
- phase-3/K12未成年人教师机构与合规详细设计.md：Phase 3 K12、未成年人、监护、教师机构和合规设计。
- phase-3/K12未成年人教师机构UIUX与页面状态详细设计.md：Phase 3 K12/家长/教师/机构路由、Gate、页面状态和跨端 UI/UX 追溯。
- phase-1/full-coverage/：Phase 1 原子功能与 UI/UX 追溯补充设计（Historical / Superseded，仅迁移参考）；当前入口见 `v2-980plus/`。
- shared/全局横向设计基线.md：跨阶段 API、数据、状态、权限、审计、性能和四项目边界。
- [v2-980plus/](v2-980plus/README.md)：唯一的 v2 全量设计包，包含统一交互模板、四项目 IA、Phase 1/2/3 域级设计、980 行逐条登记册、追溯矩阵、架构映射和一致性审核；`V2-EXT-*` 属于 v2 范围，但需细化签收后才可实施。
- traceability/：功能总账、PRD 章节归属、原子需求清单、设计登记册、用户故事和冲突签收。

## v2 开发前必读

- 业务设计单元与实现范围：`v2-980plus/`（优先于 v1 设计包）。
- 后端服务/权限/数据/事件：`../02-architecture/v2-microservices-architecture.md` 与 `v2-platform-capability-matrix.md`。
- 任务重基线：`v2-980plus/11-架构映射与任务重基线.md`、ADR-0009/0010/0011/0012。

## 设计阶段边界

- Phase 1：18+，标准语言学习，无生成式 AI、AI 发音评分、AI 数字人和开放式自由聊天。
- Phase 2：成人 AI Tutor、语音评测、数字人、雅思/托福、职场和出海设计。
- Phase 3：完成资质、版权和未成年人保护后，新增 K12/高中设计。

## Agent 阅读规则

所有页面设计必须能追溯到 PRD 章节、用户故事、路由、权限、埋点和验收标准。历史 HTML/PDF 不作为设计事实源。

