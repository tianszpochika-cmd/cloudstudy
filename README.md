# 语学星：全栈语言学习系统

> **产品名：语学星**（研发工作名 EnglishFlow）｜**公司：深圳云澜深境科技有限公司**
> 面向中国大陆的全栈语言学习平台：以英语为起点，逐步扩展多语种；覆盖成人应试/实用、职场出海，最终在资质允许后进入未成年人/K12 受监管市场。

这是一个多端全站项目骨架，目标不是做一个"只会聊天的 AI"，而是做一个"学习目标 -> 沉浸式练习 -> 实时反馈 -> 间隔复习 -> 闭环复盘"的语言学习系统。

## 产品基础信息

| 项 | 内容 |
| :--- | :--- |
| 产品名称 | 语学星 |
| 公司名称 | 深圳云澜深境科技有限公司 |
| 域名主体 | clyune（已核查无商标、域名与关键字冲突） |
| 需求文档 | `requirements/product-requirements.md`（PRD v3.2，四层基础设施 + 3D 成长系统全量版） |

### 域名矩阵

| 域名 | 用途 |
| :--- | :--- |
| clyune.com | 官网 |
| clyune.cn | 大陆定制官网 |
| clyune.ai | Web 端 AI 专栏 |
| clyune.cloud | 数据服务专栏 |
| study.clyune.com | Web 学习平台（学习者主入口） |
| work.clyune.com | 数据管理平台（教研/运营后台） |
| api.clyune.com | 开放接口服务域名（Core API / OpenAPI 契约） |

## 交付分期（PRD v3.2）

- **Phase 1 市场开拓版（18+、无生成式 AI）**：沉浸式"语言世界"主地图 + Adaptive Home；词汇/短语/句子收藏与 SRS、词根词族、语法知识树、长难句实验室、听力、分级阅读与 Language Clips、口语自练（无 AI 评分）、写作、考试；3D Avatar 与学习奖励箱、Study Room、第四层产品基础设施（通知/权益/订单/客服/隐私中心等 27 项）；VIP + Family Plan 商业化。零 AI 依赖、安全可直接商用。
- **Phase 2 AI 智能增强**：AI Tutor 与长期学习记忆、AI 长难句与弱点图谱、写作助手（CET/考研/SCI）、ASR/TTS 与发音评测、实时角色扮演、数字人、雅思/托福、职场商务与出海沙盒、RAG 知识库、AI 辩论竞技场。
- **Phase 3 受监管扩展**：未成年人账号体系、K12/高中课程、高考体系、教材 RAG、教师/机构生态。
- 终端：uni-app 一套代码编译 Web/H5/iOS/Android/iPad/微信小程序（见 ADR-0004）。
- 三阶段功能迁移总表与成本控制逻辑见 PRD §44–§45；P0/P1/P2 优先级见 PRD §23。

## 当前状态

- 需求文档已升级至 PRD v3.2（用户复核版），为当前唯一需求事实源。
- **Phase 1 UI/UX 设计包已交付（v1.0）**：设计总册 + 20 份分册，见 `docs/06-design/phase-1/`；旧口径设计文档已清理完毕。
- 技术架构已按 v3.2 对齐：MySQL 8.x + Redis（ADR-0006）、3D Avatar 渲染方案、离线同步与视频分发、小程序后置 P1.5。
- 下游文档（`requirements/mvp-scope.md`、`docs/09-roadmap/`）仍为旧口径，同步更新另行安排。
- 公司主体资质、备案与上线预算见 `docs/08-compliance/shenzhen-launch-execution-checklist.md`。

## 技术分层

- apps/：各端产品与后台。
- services/：核心 API（Spring Boot 3）、AI 编排（FastAPI，Phase 2 启用）、语音实时会话、异步任务。
- packages/：跨端共享的类型、契约（OpenAPI 单一事实源）、领域逻辑、设计令牌和埋点。
- database/：数据库结构、迁移、种子和测试夹具。
- content/：课程、对话、练习、词汇和媒体素材。
- ai/：提示词、评测集、策略、实验和模型适配资料（Phase 2 启用）。
- requirements/：需求、用户故事、MVP 范围和验收标准。
- docs/：产品、架构、设计、运营和合规文档。
- infra/：本地开发、部署、监控和安全配置。
- tests/：端到端、集成、契约、AI 评测、性能和安全测试。
- agent/：供编码 Agent 使用的项目上下文、工作流和决策记录。

## 开始开发前

复制 .env.example 为 .env.local；确认数据库、缓存和对象存储方案；注册并备案上述域名（ICP 备案前置）；补充品牌视觉、付费方案和隐私条款。

## 项目状态说明

当前提交是项目基础骨架和产品设计起点，不是已经可上线的成品。空目录中的 .gitkeep 仅用于保留规划好的边界。
