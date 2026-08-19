# Changelog

## 2026-08-19

- 第一阶段功能扩充四项：①打卡补签卡（断签 3 天内补签前一日，星星兑换/VIP 每月赠 2 张）；②词根词缀专题课（100+ 词根，讲解卡片+派生词族+快测，与词条助记联动）；③错题本仅查看不导出（不提供导出/下载/打印/复制接口，内容防复制）；④分享海报（打卡/周报/成绩三类，canvas 生成含品牌水印与邀请码）。游戏矩阵扩充为**六类**：首发 4 款（拼句火车、单词消消乐、单词保卫战、拼图解谜）+ 预留 2 款（语法射击、词义捕手），统一题目抽取/限局/结算写回复习队列规则。同步更新：PRD §2.1/§2.7/§2.9、mvp-scope P0、roadmap、phase-1 设计文档（03/08/09/10/README，VIP 权益矩阵增补签卡行）。

- 第一阶段设计文档全量重建（docs/06-design/phase-1/ 共 12 份）：按新需求（标准语言学习、无 AI 完全商用）重写总览与 11 个模块设计（账号入学/首页任务/单词/语法与句子拆分/口语音标/作文/考试/复习错题/游戏化排行/VIP 商业化/管理后台），每份均含功能设计与交互设计两部分，并标注第二阶段 AI 预留槽位。

- 新增用户基础与商业化体系章节（PRD §6，原 §6 接口规范顺延为 §7）：账号注册登录（手机验证码/微信/账号合并/注销/监护人模式）、用户信息与隐私合规（PIPL 最小收集/双协议）、VIP 权益矩阵（免费+VIP 双层、月/季/年卡、到期降级保留数据）、激活码变现冷启动、支付与自动续费合规、使用数据边界；mvp-scope P0 新增对应清单，roadmap 第一阶段同步。

- 第一阶段目标重定义：由 K12 教材同步改为**标准多语言学习软件（无 AI 完全商用版）**——因 K12 教材逐课同步需商业许可，第一阶段改为涵盖所有主流学习功能（单词、排行榜、句子拆分、考试与四六级、语法、口语、作文、趣味学习）+ 额外游戏性，零生成式 AI 依赖、无需算法备案；K12 教材同步改为“待商业许可”暂缓项，排行榜回归范围（原“暂缓”列表移除）。涉及：PRD §1.2/§2 重写、mvp-scope 重写、roadmap/first-30-days/README 同步。docs/06-design/phase-1/ 已建文档基于旧 K12 口径，标记待重建。

- 产品基础信息落定：产品正式名称定为**语学星**（研发工作名 EnglishFlow 保留），公司主体深圳云澜深境科技有限公司，域名主体 clyune（无商标/域名/关键字冲突）；域名矩阵写入 README、PRD §0、设计系统品牌基础与主架构 §6 部署章节（clyune.com/.cn 官网、clyune.ai、clyune.cloud、study/work/api.clyune.com），README 同步刷新为 K12 第一阶段口径。

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
