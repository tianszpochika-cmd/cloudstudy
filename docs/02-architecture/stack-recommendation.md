# EnglishFlow 推荐技术栈与架构组合选型 (Tech Stack Specifications)

针对 EnglishFlow 全栈 AI 英语学习系统（涵盖高并发业务、实时语音对话、AI 编排、多端跨平台），项目主线采用 **"Vue3 + uni-app 全端 + Java/Spring Boot 3 + Python AI 编排"** 组合（决策见 ADR-0004/0005），选择依据是**团队现有技能（Vue3 + Java）与商用落地速度优先**。

---

## 方案 A（当前项目主线）：Vue3 + uni-app 全端 + Java (Spring Boot 3) + Python AI 编排

**核心优势**：与团队技能完全匹配；uni-app 一套代码编译 Web/H5/iOS/Android/iPad/小程序，商用分发路径最成熟；Java 生态在国内商用场景（支付、对账、权限）组件最全。

| 层次/端 | 核心技术栈 | 对应框架 / 库 | 关键用途说明 |
| :--- | :--- | :--- | :--- |
| **全端学习客户端** | Vue 3 + TypeScript + **uni-app** | Pinia + uni-ui | 一套代码编译：PC Web、H5、iOS/iPad App（Xcode 打包上架）、Android App、微信小程序；条件编译处理分端差异。 |
| **官网与落地页** | uni-app H5 或 Nuxt 3 (SSR) | — | SEO 与免费测评转化入口。 |
| **管理与教研后台** | Vue 3 + Vite + TypeScript | Element Plus | 教研题库录入、教材分发、Prompt 版本灰度与合规审核看板。 |
| **核心业务后端 (Core API)** | Java 17+ | Spring Boot 3 + MyBatis-Plus + Spring Security | 模块化单体 DDD：统一账户鉴权、课程体系、答题评分、订单支付、记忆曲线调度。 |
| **AI 算法与编排中心** | Python 3.11+ | FastAPI + LangGraph + LiteLLM | 独立服务与 Core API 通过 REST/gRPC 通信；提示词版本管理、多模型网关路由（Qwen/DeepSeek/GLM）、结构化输出校验、安全风控。 |
| **实时对话服务 (P1)** | 商业 RTC AI 对话服务 | 声网 / 腾讯云 TRTC（Java SDK） | 低延迟语音对讲、Barge-in、流式 ASR/TTS；免自建 WebRTC 集群。自建 LiveKit 为后续降本备选，启用需新增 ADR。 |
| **数据库与缓存** | MySQL 8.x + Redis 7.x（PRD §1.1，见 ADR-0006） | MyBatis-Plus + Flyway | 关系型持久化、排行榜 ZSet、打卡 BitMap；向量检索 Phase 2 按需另选组件（另记 ADR）。 |
| **异步任务与消息流** | RabbitMQ 或 Redis Streams | Spring AMQP / Spring Data Redis | 削峰填谷、AI 离线真题批改、长篇写作精修、定时通知推送。 |
| **特效与游戏** | Three.js + Rive + Vue Flow/AntV G6 + Phaser 3（备选） | — | 3D Avatar 与口腔（web-view）、数字人、语法树、游戏化小游戏，均受四级画质开关管控。 |

---

## 方案 B（备选路线）：全栈 TypeScript/Node + React 矩阵

若未来团队技能结构转向 TypeScript 全栈，可按以下组合平替（原 v2.x 架构即为该路线）：

| 层次/端 | 核心技术栈 | 关键用途说明 |
| :--- | :--- | :--- |
| **前端与多端矩阵** | React 18+ / Next.js + Tauri 2.0 + Taro | PC Web 沉浸端、桌面/移动壳、小程序编译。 |
| **核心业务后端 (Core API)** | TypeScript / Node.js (NestJS) | 模块化单体 DDD，与前端共享 TS 契约。 |
| **AI 编排与大模型服务** | Python 3.11+ (FastAPI + LangGraph) | 与主线一致。 |
| **实时通信服务** | LiveKit 自建 + Silero-VAD | 自建 WebRTC 集群，运维成本较高。 |
| **数据与缓存** | PostgreSQL + Redis + Prisma | 备选路线自持选型，与主线（MySQL）不同。 |

---

## 总结推荐选型结论

> **项目主线口径**：采用方案 A（Vue3 + uni-app + Spring Boot 3 + Python AI 编排），决策见 ADR-0004（前后端主线切换）与 ADR-0005（保留 Python AI 层）。方案 B 仅作为团队技能结构变化后的备选路线。

1. **核心业务层**：主线为 **Java 17+ (Spring Boot 3)**；Node.js (NestJS) 为备选路线。
2. **AI 与算法层**：必须采用 **Python (FastAPI + LangGraph)**，这是当前大模型与语音评测的最佳生态，作为独立服务存在。
3. **多端前端**：**uni-app (Vue 3)** 一套代码输出 Web/H5/App/iPad/小程序，这是"一套代码商用全端"的最成熟路径。
4. **实时语音对话**：P1 采用 **商业 RTC AI 对话服务（声网/腾讯云 TRTC）**，自建 LiveKit 仅作为降本备选。
