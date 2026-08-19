# 语学星技术规格与架构说明书总览 (Technical Specifications Index)

> ⚠️ **待重建**：需求已升级为 [PRD v3.2（四层基础设施 + 3D 成长系统全量版）](../../requirements/product-requirements.md)。基于旧分期口径（K12 小学初中 / 高中大学 / 商务出海）的三份阶段技术规格书已移除，将按 v3.2 的三阶段边界（18+ 市场开拓版 / AI 智能增强 / 未成年人 K12 受监管扩展）重建。

---

## 目录导航 (Documentation Map)

| 技术文档分类 | 对应技术文档路径 | 核心覆盖范围与功能点 |
| :--- | :--- | :--- |
| **全景系统架构** | [`docs/02-architecture/system-technical-architecture.md`](../02-architecture/system-technical-architecture.md) | 总体拓扑、实时媒体引擎、AI 编排中心、Monorepo 目录规范、高可用与安全基座。 |
| **底层引擎与契约** | [`docs/technical-specs/core-underlying-engines-specs.md`](./core-underlying-engines-specs.md) | 记忆算法（SuperMemo-2 / FSRS）、词汇与语法知识图谱、能力雷达图、中国大陆双审合规网关、多端与 OpenAPI 接口契约。 |
| **Phase 1 技术规格** | 待按 PRD v3.2 §2–§23 重建 | 市场开拓版（18+、无生成式 AI）：语言世界主地图、词汇/语法/听力/阅读/口语/写作/考试、3D Avatar 与学习奖励箱、第四层产品基础设施。 |
| **Phase 2 技术规格** | 待按 PRD v3.2 §24–§37 重建 | AI 智能增强：AI Tutor、长难句与语法 AI、写作、ASR/TTS 与发音评测、数字人、雅思/托福、RAG 知识库。 |
| **Phase 3 技术规格** | 待按 PRD v3.2 §38–§43 重建 | 未成年人/K12 受监管扩展：未成年人账号体系、K12 课程、高考体系、教材 RAG、教师/机构生态。 |

---

## 开发与集成指引 (Development Guidelines)
1. **类型契约先行**：所有前端/小程序与后端交互数据模型定义于 `packages/contracts/`，严格与 OpenAPI 规范同步。
2. **AI 输出结构化**：所有 AI 服务交互强制定义 Pydantic / Zod JSON Schema，支持失败自动重试与降级（Phase 2 适用）。
3. **阶段红线**：Phase 1 不含任何生成式 AI 依赖；AI 能力的技术规格在 Phase 2 前置条件（PRD §23.1）满足后启用。
