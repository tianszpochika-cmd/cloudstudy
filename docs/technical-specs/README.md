# EnglishFlow 技术规格与架构说明书总览 (Technical Specifications Index)

本文档库为 **EnglishFlow 全栈 AI 英语学习系统** 按照《产品需求规格说明书 (PRD v2.0)》中所有需求点与架构设计要求编写的技术规格文档集合。

---

## 目录导航 (Documentation Map)

| 技术文档分类 | 对应技术文档路径 | 核心覆盖范围与功能点 |
| :--- | :--- | :--- |
| **全景系统架构** | [`docs/02-architecture/system-technical-architecture.md`](../02-architecture/system-technical-architecture.md) | 总体拓扑、WebRTC 实时媒体引擎、AI 编排中心、Monorepo 目录规范、高可用与安全基座。 |
| **Phase 1 技术规格** | [`docs/technical-specs/phase1-k12-primary-junior-specs.md`](./phase1-k12-primary-junior-specs.md) | 48个国际音标 3D 实验室、Phonics 拼读法则树、主流教材逐课同步闭环、卡通数字人实时伴学 (<800ms)、4大趣味游戏引擎、战队天梯周考。 |
| **Phase 2 技术规格** | [`docs/technical-specs/phase2-highschool-college-specs.md`](./phase2-highschool-college-specs.md) | 番茄微课与抗焦虑模式、动态语法图谱与长难句 X 光机、读后续写三阶 AI 升格、中高考听说机考模考、四六级/考研手译本与复试面试、SCI 论文润色、外企 STAR 面试、AI 辩论赛。 |
| **Phase 3 技术规格** | [`docs/technical-specs/phase3-business-abroad-specs.md`](./phase3-business-abroad-specs.md) | 全场景多口音跨国会议模拟、跨境谈判博弈状态机、商务邮件四维语气润色、行业垂直术语库、海外生存8大沙盒、雅思/托福当季换题口语机考与作文批改。 |
| **底层引擎与契约** | [`docs/technical-specs/core-underlying-engines-specs.md`](./core-underlying-engines-specs.md) | 改进版 SuperMemo-2 / FSRS 记忆算法、12000词+800语法点知识图谱、6维能力雷达图、中国大陆双审 AI 合规网关、多端与 OpenAPI 接口契约。 |

---

## 开发与集成指引 (Development Guidelines)
1. **类型契约先行**：所有前端/小程序与后端交互数据模型定义于 `packages/contracts/`，严格与 OpenAPI 规范同步。
2. **AI 输出结构化**：所有 AI 服务交互强制定义 Pydantic / Zod JSON Schema，支持失败自动重试与降级。
3. **性能与时延基准**：实时数字人通话端到端延迟控制在 **<800ms**，长难句 X 光机解析响应时间 **<1.5s**。

