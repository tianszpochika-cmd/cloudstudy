# Changelog

## 2026-08-19

- 交付分期重排：第一阶段为 K12 中小学生传统型学习 App（无 LLM 依赖，完善美丽为验收项）；AI 相关能力（文字陪练、数字人、知识库 RAG、发音评测、实时语音）统一归入第二阶段分三批交付，新增 AI 功能分期总表与阶段 Gate 条件（roadmap.md）。
- 同步重写 mvp-scope.md（P0 改为传统型 K12 闭环）与 first-30-days.md（K12 首 30 天执行清单）；PRD 新增教材知识库 (RAG) 条目并为通用底层模块标注交付阶段。

- 重大架构切换（方案 B 落地）：基于团队技能结构 Vue3+Java 与商用全端诉求，前后端主线切换为 Vue3 + uni-app + Spring Boot 3，保留 Python FastAPI AI 编排层；AGENTS.md 升级 v3.0，重写主架构/技术栈选型/跨端/沉浸式前端四份文档，口径传导至 PRD、mvp-scope、technical-specs、repository-tree 与各级 README。
- ADR 更新：新增 ADR-0004（uni-app+Spring Boot 主线切换）、ADR-0005（保留 Python AI 层）；ADR-0002/0003 标记 superseded。
- 实时语音策略调整：P1 改为接入商业 RTC AI 对话服务（声网/腾讯云 TRTC），自建 LiveKit 降为降本备选；异步任务改为 RabbitMQ/Redis Streams（Spring 生态）。

- 架构文档终审修复：将 Tauri 主线口径传导至全部下游文档（PRD 终端矩阵、technical-specs、repository-tree、根/子 README）；统一数字人渲染标注 Live2D→Rive；移除 iPad Capacitor 备选表述。
- ADR 归档统一：迁移 ADR-0001 至 docs/10-decisions/，新增 ADR-0003（Core API NestJS 主线，Java 备选）。

- 表现力架构改造：新增 Phaser 3 游戏引擎层（补齐 PRD 四款 K12 小游戏的技术承载），主架构技术栈矩阵补充 Phaser/Framer Motion/Howler.js。
- 统一移动端路线为 Tauri 2.0 主线（复用 Web 端全部视觉资产），新增 ADR-0002，同步修正 immersive-frontend-architecture.md 与 mvp-scope.md 的 RN/120Hz 旧口径。
- 修正小程序端动效方案（Rive WASM 改为 Lottie 小程序版/帧动画），新增 P1 Lip-Sync 口型同步预研方案。

- 统一技术架构文档：修正 system-technical-architecture.md 的 Monorepo 目录树与仓库实际结构对齐（apps/packages/services），统一 Core API 主线口径为 NestJS 模块化单体，同步 Worker 命名（job-runner 替代 eval-worker）。
- 修复 cross-platform-and-performance-adaptive.md 伪代码双单引号语法错误，共享包引用改为 ui-web/ui-mobile/domain。
- 明确 stack-recommendation.md 选型主线：方案 A（NestJS）为主，方案 B（Java/Vue）为备选需 ADR 启用。

- 新增《EnglishFlow 产品全景与经营蓝图》PDF 报告（56 页 A4，覆盖产品概述、受众人群、40+ 功能详解、经营策略与支持保障）。
- 新增生成脚本 scripts/build_product_report.py（HTML 模板 + Edge 无头打印 PDF，可重复执行）。
- 建立 EnglishFlow 多端 monorepo 基础目录。
- 增加产品、需求、架构、AI、内容、数据、运维和合规文档入口。
