# EnglishFlow 推荐技术栈与架构组合选型 (Tech Stack Specifications)

针对 EnglishFlow 全栈 AI 英语学习系统（涵盖高并发业务、实时音视频 WebRTC、AI Agent 编排、多端跨平台），我们推荐 **“现代主流组合（TypeScript/Node.js + Python + React/Vue）”** 或 **“企业级双引擎组合（Java/Spring Boot + Python + Vue/React）”**。

---

## 方案 A（当前项目原生推荐）：全栈 TypeScript/Node + Python AI 编排 + React/Taro

**核心优势**：前后端全链路 TypeScript 强类型共享（通过 `packages/contracts` 实现 0 冗余联调），AI 算法与实时语音模块无缝接入。

| 层次/端 | 核心技术栈 | 对应框架 / 库 | 关键用途说明 |
| :--- | :--- | :--- | :--- |
| **微信小程序端** | TypeScript + Taro / Uni-App | Vue 3 或 React | 跨端编译为微信小程序，承载每日打卡、单词连线、轻量口语与战队排行榜。 |
| **PC Web 学习端** | React + Next.js (SSR) + TypeScript | Tailwind CSS + Lucide Icons + Three.js | 承载沉浸式长难句 X 光机、3D 音标实验室、高考/考研真题模考及大屏交互。 |
| **移动端 App (iOS/Android)** | React Native (Expo) + WebRTC | React Native WebRTC + Reanimated | 承载卡通数字人伴学实时通话、高保真机考录音与离线课件下载。 |
| **管理与教研后台** | React + Vite + TypeScript | Ant Design / Shadcn UI | 教研题库录入、教材分发、Prompt 版本灰度与合规审核看板。 |
| **核心业务后端 (Core API)** | TypeScript / Node.js | NestJS (模块化单体 DDD 架构) | 统一账户鉴权、课程体系、答题评分、订单支付、记忆曲线调度。 |
| **AI 算法与编排中心** | Python 3.11+ | FastAPI + LangChain / LangGraph + LiteLLM | 提示词版本管理、大模型网关路由（Qwen/DeepSeek/GLM）、结构化输出校验。 |
| **实时媒体与语音服务器** | Go / C++ + WebRTC | LiveKit / Mediasoup + Silero-VAD | 低延迟语音对讲（<800ms）、服务端打断（Barge-in）、流式 TTS 与 Lip-Sync 口型下发。 |
| **数据库与持久化** | PostgreSQL 16 + Redis 7.x | Prisma / TypeORM + pgvector | 强关系型业务数据存储、向量语义检索、排行榜与打卡 BitMap 缓存。 |
| **异步任务与消息流** | BullMQ / Redis Streams | BullMQ | 削峰填谷、AI 离线真题批改、长篇写作精修、定时通知推送。 |

---

## 方案 B（经典企业级组合）：Java (Spring Boot 3) + Python AI + Vue 3 / Uni-App

若团队主力技术栈为 Java 与 Vue，可无缝平替如下：

| 层次/端 | 核心技术栈 | 对应框架 / 库 | 关键用途说明 |
| :--- | :--- | :--- | :--- |
| **前端与多端矩阵** | Vue 3 + TypeScript + Vite | Uni-App (小程序/App) + Element Plus (后台) | 统一使用 Vue 3 生态，Uni-app 一套代码输出微信小程序与 App。 |
| **PC 学习端 Web** | Vue 3 + Nuxt.js (SSR) + Pinia | Tailwind CSS + Three.js | 高性能 SEO 与 PC 端沉浸式答题学习界面。 |
| **核心业务后端 (Core API)** | Java 17 / 21 + Spring Boot 3.x | Spring Cloud / Spring Security + MyBatis-Plus | 严谨的权限控制、分布式事务、教材题库管理与高并发订单/用户体系。 |
| **AI 编排与大模型服务** | Python 3.11+ | FastAPI + LangChain | 作为微服务与 Java Core API 通过 gRPC / REST 通信，负责 LLM 与语音算法。 |
| **实时通信服务** | Java Netty / LiveKit | Spring WebSocket / LiveKit SFU | WebSocket 实时答题 PK 与 WebRTC 音视频对讲。 |
| **数据与缓存** | MySQL 8.0 / PostgreSQL + Redis | MyBatis-Plus + Redisson | 关系型数据持久化与分布式锁。 |

---

## 总结推荐选型结论

1. **核心业务层**：**Node.js (NestJS)** 或 **Java (Spring Boot 3)** 均可胜任。
2. **AI 与算法层**：必须采用 **Python (FastAPI + LangGraph)**，这是当前大模型与语音评测的最佳生态。
3. **多端前端**：
   - 小程序/App 跨端：**Uni-App (Vue 3)** 或 **Taro (React/Vue)**；
   - PC 沉浸端：**Next.js (React)** 或 **Nuxt.js (Vue 3)**；
   - 3D 口腔可视化：**Three.js**。
4. **实时语音对讲**：**LiveKit (WebRTC)** 搭配服务端 **Silero-VAD** 与流式 ASR/TTS。

