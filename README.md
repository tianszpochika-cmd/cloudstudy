# 语学星：全栈语言学习系统

产品名：**语学星**
研发代号：**EnglishFlow**
运营主体：**深圳云澜深境科技有限公司**

面向中国大陆成人、大学生及进阶用户的多端全栈语言学习平台。基于 **Vue 3 四项目矩阵 + Java 25 LTS 微服务后端 + Gateway/IAM/RBAC + MySQL** 构建，兼顾跨端学习体验、权限安全和十年运维演进。

---

## 唯一事实源基线

- **需求事实源**：`requirements/product-requirements.md` (三阶段全量 PRD)
- **首发范围与边界**：`requirements/mvp-scope.md`
- **技术与架构约束**：`AGENTS.md` 与 `docs/02-architecture/`
- **v2 后端目标架构**：[`docs/02-architecture/v2-microservices-architecture.md`](docs/02-architecture/v2-microservices-architecture.md)
- **v2 平台能力矩阵**：[`docs/02-architecture/v2-platform-capability-matrix.md`](docs/02-architecture/v2-platform-capability-matrix.md)
- **UI/UX 设计规范**：`docs/06-design/` 与 `packages/design-tokens/`
- **PRD 全量设计追溯**：[`docs/06-design/traceability/README.md`](docs/06-design/traceability/README.md)（原子需求、设计登记、用户故事、验收与冲突）
- **980+ 全量设计 v2**：[`docs/06-design/v2-980plus/README.md`](docs/06-design/v2-980plus/README.md)（980 个设计单元、逐条交互/状态/契约/验收登记）
- **文档治理规则**：`docs/00-vision/document-governance.md`

---

## 三阶段产品演进

| 阶段 | 用户与业务边界 | 核心功能与技术实现 | 阶段合规与准入要求 |
|---|---|---|---|
| **Phase 1<br>(基座版)** | **18+ 成人 / 大学生**<br>标准语言学习产品 | 词汇、语法、长难句、听力、阅读、口语自练、写作、模考与 SM-2 复习流；沉浸交互与星球体系。<br>**技术**：Vue 3 四项目 + Java 25 微服务/Gateway/IAM/RBAC + MySQL 8.x + Redis 7.x (无生成式 AI)；现有 Java 17 `core-api` 仅作迁移兼容。 | 企业主体、ICP 备案、网安备案、教育 App 备案、应用商店合规。 |
| **Phase 2<br>(AI 增强版)** | **18+ 职场 / 留学 / 出海**<br>AI 导师伴学与实战 | AI 学习导师、流式发音评测、作文智能批改、低延迟 RTC 实时语音对话、数字人伴学、雅思/托福。<br>**技术**：新增 Python 3.11 FastAPI (LiteLLM/LangGraph) + 商业 RTC。 | 生成式 AI 应用登记、深度合成算法备案、AI 内容双审过滤与标识。 |
| **Phase 3<br>(受监管扩展)** | **未成年人 / K12 中小学**<br>教材同步与家校生态 | 人教/外研/牛津等多版本教材知识图谱同步、音标基础、防沉迷家长锁、班级自习室与联考。<br>**技术**：多教材版本树 RAG + 家长监护鉴权系统。 | 取得出版物经营许可、校外培训专项合规、未成年人保护专项。 |

---

## Phase 1 研发组织口径：宽基线设计

Phase 1 **有意设计为覆盖面较大的首发基座**，不是只做一条最短演示链路的狭义 MVP。首发阶段需要同时建立成人/大学生语言学习产品的核心闭环、内容供应链、数据与合规基础、跨端客户端、运营支撑和发布验收能力，从而让后续迭代建立在同一套平台基座上。

因此，Phase 1 的任务较多是预期设计，不代表范围失控。历史 B0–B6 是 v1 技术基线下的研发批次，继续用于现状审计；v2 之后的新任务将按 v2 设计单元与 `ARCH-*` 平台能力重新生成，不把旧批次状态直接当作微服务/Gateway/RBAC 完成证据。Phase 1 的目标仍然明确：

```text
学习目标 → 练习 → 规则化反馈 → 复习 → 闭环复盘
```

### Phase 1 批次职责

| 批次 | 主要职责 |
|---|---|
| **B0** | 工程基线、文档治理、契约与数据基础、固定端口、安全和测试底座 |
| **B1** | 身份、用户隐私、目标与 Onboarding、首日学习链、内容供应链和种子内容 |
| **B2** | 词汇与 SRS、做题中心、规则化测评、掌握度、报告和通知基础 |
| **B3** | 语法、写作、听力、阅读、口语自练、录音自评、离线同步和全模态学习闭环 |
| **B4** | 游戏化星系、成长与奖励、社群/自习室、用户服务和相关学习事件 |
| **B5** | 商业化收单与权益、教研 CMS、运营中台、客服、审计和合规运营能力 |
| **B6** | 跨端发布、响应式与性能验收、关键路径 E2E、可靠性、观测和发布门禁 |

批次任务数量、负责人、状态、依赖和解除条件的唯一事实源是 [`requirements/backlog/Agent开发状态总报表.md`](requirements/backlog/Agent开发状态总报表.md)，README 不重复维护易变的任务数字。

### Phase 1 状态解释

- **未开始**：任务尚未进入执行，不代表对应领域从产品规划中删除。
- **进行中**：正在实现或补齐契约、迁移、客户端、测试等交付组成部分。
- **待验收**：通常表示代码和静态证据已经形成，但仍需运行态、跨端、基础设施或合规证据；不等同于“没有开发”。
- **已完成**：满足任务自身的 Definition of Done，并由统筹验收确认。

Phase 1 不启用生成式 AI；AI 导师、生成式评测、RTC AI 对话和数字人伴学属于 Phase 2。Phase 1 可以先建设规则化学习、非 AI 的多模态练习、性能降级和平台接口，为后续能力保留稳定的契约与扩展边界。

---

## 全栈架构与项目工程矩阵

### 1. 前端工程矩阵 (`apps/`) —— 全面基于 Vue 3

> **前端项目冻结（ADR-0008）**：前端只维护四个独立业务项目。移动 H5、iOS、Android、iPad 和后续微信小程序都是 `apps/mobile` 的平台输出；PC Web / 平板浏览器是 `apps/learner-web` 的 Web 输出，不再为这些平台另建项目。

| 项目目录 | 定位与核心场景 | 技术选型 | 交付形态 |
|---|---|---|---|
| **`apps/official-site`** | **官方网站**：品牌门面、课程体系、会员价格对比、下载引导、合规公示 | Vue 3 + Nuxt 3 (SSR/SSG) + TailwindCSS | PC/移动端 Web |
| **`apps/learner-web`** | **学员端 Web**：PC 宽屏工作台、平板浏览器和 PWA；不重复承载移动 H5 业务页面 | Vue 3 + Vite + Pinia + Web Audio API | 浏览器 (PC/Tablet) / PWA |
| **`apps/admin-web`** | **管理中台**：教研录入、题库管理、学员档案、订阅交易、合规审计 | Vue 3 + Vite + Element Plus | 桌面管理端 |
| **`apps/mobile`** | **唯一的 uni-app 学习端**：移动 H5、原生 App、iPad 和后续微信小程序共用业务实现 | Vue 3 + uni-app (TypeScript) | Mobile H5 / iOS / Android / iPad / WeChat (P1.5) |

`apps/miniapp-wechat` 仅保留迁移说明或平台资源占位，不是第五个业务项目；不得在其中形成第二套页面、状态管理或 API 客户端。

### 2. 后端服务矩阵 (`services/`) —— Gateway + IAM/RBAC + 领域微服务 + 独立 AI 编排

| 服务目录 | 定位与架构 | 核心职责 |
|---|---|---|
| **`services/api-gateway`** | **Java 25 + Spring Cloud Gateway**<br>(v2 外部入口) | 路由、API 版本、CORS、限流、JWT 预校验、requestId/traceId；不写领域事实。 |
| **`services/iam-service`** | **Java 25 + Spring Boot 4.1**<br>(身份与权限服务) | 自有账号密码登录、短时 RS256/ES256 JWT、JWKS、公钥轮换、用户/租户/设备/会话、RBAC + ABAC 策略和 Token 撤销。 |
| **目标领域服务集群** | **Java 25 + Spring Boot 4.1**<br>(目标领域微服务) | 按 learner/content/learning/assessment/media/gamification/social/commerce/notification/analytics/admin-ops 划分事实和数据 owner。 |
| **`services/core-api`** | **Java 17 + Spring Boot 3**<br>(迁移兼容单体) | v1 旧实现和回滚边界；通过 Gateway 逐域迁移，当前代码存在不代表 v2 微服务/RBAC 已完成。 |
| **`services/ai-orchestrator`** | **Python 3.11 + FastAPI**<br>(Phase 2 独立 AI 编排) | 大模型统一接入 (LiteLLM)、AI 伴学导师智能体 (LangGraph)、发音/语法流式评测、RAG 向量检索。 |
| **`services/realtime-voice`** | **RTC 语音信令接入层** (Phase 2) | 商业 RTC (声网/TRTC) 低延迟双向对讲与打断 (Barge-in) 信令处理。 |
| **`services/content-worker`** | **内容与媒体处理 Worker** | 音频切片、波形特征提取、3D 模型 Draco 压缩、题库批量索引。 |
| **`services/job-runner`** | **异步调度与任务引擎** | 每日学习流重算、艾宾浩斯复习队列分发、统计数据定期归档。 |
| **`services/notification-worker`** | **消息与触达服务** | 学习打卡 Push 推送、短信验证码、站内通知信。 |

### 3. 共享与基础设施 (`packages/` & `database/`)

- **`packages/contracts/`**：OpenAPI 接口契约定义（前后端单一事实源）。
- **`packages/api-client/`**：基于 OpenAPI 自动生成的 TypeScript 请求客户端。
- **`packages/design-tokens/`**：语学星品牌橙色系主题、排版、阴影与动画令牌。
- **`packages/content-schema/`**：题型结构与校验规则定义 (Zod / JSON Schema)。
- **`database/mysql/`**：MySQL 8.x 数据库表设计与 Flyway 增量迁移脚本。
- **`database/redis/`**：Redis 缓存键前缀、分布式锁与排行榜结构。

---

## 本地开发快速上手

### 环境要求
- **Node.js**：`>= 18.18.0` (推荐 pnpm)
- **Java**：`OpenJDK 25 LTS`（旧 `core-api` 兼容 `17`）
- **Python**：`3.11+` (Phase 2 运行)
- **MySQL**：`8.0+`
- **Redis**：`7.0+`

### 启动说明
1. **安装前端依赖**：`pnpm install`
2. **检查固定端口**：`pnpm ports:check`
3. **启动本地 MySQL、Redis、MinIO**：`docker compose -f infra/docker/docker-compose.dev.yml up -d`
4. **启动学员 Web 端**：`cd apps/learner-web && pnpm dev`，地址为 `http://127.0.0.1:18180`
5. **启动管理后台**：`cd apps/admin-web && pnpm dev`，地址为 `http://127.0.0.1:18181`
6. **启动官网**：`cd apps/official-site && pnpm dev`，地址为 `http://127.0.0.1:18182`
7. **启动移动端 H5**：`cd apps/mobile && pnpm dev:h5`，地址为 `http://127.0.0.1:18183`
8. **启动迁移期后端兼容入口**：`cd services/core-api && mvn spring-boot:run`，地址为 `http://127.0.0.1:18080/api/v1`。v2 Gateway/新服务的启动命令和固定端口必须在对应任务完成契约与端口登记后补充。

端口规则见 `docs/02-architecture/local-development-port-allocation.md`。端口被占用时停止占用进程，不得自动改用其他端口。
