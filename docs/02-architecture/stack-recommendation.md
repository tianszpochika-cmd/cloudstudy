# 技术栈与架构最终基线

> 本文件是当前项目的技术选型事实源。除非新增 ADR 明确变更，否则所有 Agent 必须遵循本文件。

## 1. 最终技术路线

| 层级 | 最终选择 | 适用范围 |
|---|---|---|
| 学习端 | Vue 3 + TypeScript + uni-app | Web、H5、iOS、Android、iPad、微信小程序 |
| 管理后台 | Vue 3 + TypeScript + Vite + Element Plus | 教研、内容、运营、客服、权限和数据后台 |
| 官网 | Nuxt 3 或 uni-app H5 | SEO 官网、品牌内容、测评入口 |
| 核心业务后端 | Java 17+ + Spring Boot 3 | 模块化单体，账号、课程、学习、权益、订单、客服 |
| ORM 与迁移 | MyBatis-Plus + Flyway | MySQL 数据访问与版本迁移 |
| 主数据库 | MySQL 8.x | 关系数据、课程、学习记录、订单、权限 |
| 缓存 | Redis 7.x | 会话、排行榜、锁、打卡、短期任务缓存 |
| 对象存储 | S3 兼容 OSS + CDN | 音频、视频、图片、离线资源 |
| 异步任务 | RabbitMQ 或 Redis Streams | 通知、内容处理、报表、离线任务 |
| Phase 2 AI | Python 3.11 + FastAPI + LiteLLM/LangGraph | AI 编排、结构化反馈、评测和 RAG |
| Phase 2 实时语音 | 声网或腾讯云 TRTC 等商业 RTC | 先商用接入，避免早期自建 RTC 集群 |

## 2. 跨端原则

- 业务页面、状态、路由、领域模型和埋点尽量由 uni-app 复用。
- 使用条件编译处理平台差异，不在同一功能上维护多套完全独立 UI。
- H5/App 使用 Three.js、Rive、Wavesurfer 等增强体验；小程序按能力降级到 2D/静态方案。
- Windows 先使用 Web + PWA；原生壳仅在确有系统能力需求时启用 Tauri 2.0。
- 必须支持 Ultra / High / Medium / Performance 四级画质降级。

## 3. 后端边界

- Spring Boot 3 作为唯一 Core API 主线，采用模块化单体，不在 Phase 1 拆分微服务。
- 模块建议：identity、learner、content、practice、review、gamification、membership、order、notification、support、privacy、analytics。
- Phase 2 AI 编排通过内部 REST/gRPC 与 Core API 通信，客户端不得直接访问模型供应商。
- 实时语音服务与 Core API 分离，先接商业 RTC；自建 LiveKit 必须另行新增 ADR。

## 4. 契约与数据规范

- OpenAPI YAML/JSON 是前后端契约的单一事实源。
- Java DTO 与前端 TypeScript 类型由 openapi-generator 生成。
- 数据库使用 MySQL 8.x、utf8mb4、Flyway 迁移；Redis 不承担唯一事实数据。
- Phase 1 不引入向量检索。Phase 2 如需向量检索，独立评估组件并新增 ADR。
- 所有学习事件、成绩、复习状态、权益变更和审计记录可追溯。

## 5. 选型禁止项

- 不得引入与本基线冲突的前端、后端或数据主线。
- 不得把已 superseded 的 ADR 作为当前技术依据。
- 不得在 Phase 1 提前接入生成式 AI、AI 评分或数字人。
