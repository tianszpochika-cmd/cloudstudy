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
- **文档治理规则**：[`docs/00-vision/document-governance.md`](docs/00-vision/document-governance.md)
- **文档树总入口**：[`docs/README.md`](docs/README.md)（12 个顶层目录定位与按任务阅读路径）
- **文档健康检查**：`pnpm docs:audit`（死链 / 孤儿文档 / 缺索引目录，只读）

---

## 三阶段产品演进

| 阶段 | 用户与业务边界 | 核心功能与技术实现 | 阶段合规与准入要求 |
|---|---|---|---|
| **Phase 1<br>(基座版)** | **18+ 成人 / 大学生**<br>标准语言学习产品 | 词汇、语法、长难句、听力、阅读、口语自练、写作、模考与**版本化改进型 SM-2**复习流；每日计划固定为 5/15/30/45 分钟，音频支持保音高的 0.5x~2.0x。游戏化 P0 仅交付“拼句小火车”，P1 经验收后最多扩展至四款。<br>**技术**：Vue 3 四项目 + Java 25 微服务/Gateway/IAM/RBAC + MySQL 8.x + Redis 7.x (无生成式 AI)；现有 Java 17 `core-api` 仅作迁移兼容。 | 企业主体、ICP 备案、网安备案、教育 App 备案、应用商店合规。 |
| **Phase 2<br>(AI 增强版)** | **18+ 职场 / 留学 / 出海**<br>AI 导师伴学与实战 | AI 学习导师、流式发音评测、作文智能批改、低延迟 RTC 实时语音对话、数字人伴学、雅思/托福。<br>**技术**：新增 Python 3.11 FastAPI (LiteLLM/LangGraph) + 商业 RTC。 | 生成式 AI 应用登记、深度合成算法备案、AI 内容双审过滤与标识。 |
| **Phase 3<br>(受监管扩展)** | **未成年人 / K12 中小学**<br>教材同步与家校生态 | 在取得有效授权且处于授权范围内时，接入多版本教材知识图谱同步、音标基础、防沉迷家长锁、班级自习室与联考。<br>**技术**：多教材版本树 RAG + 家长监护鉴权系统。 | 取得出版物经营许可、校外培训专项合规、未成年人保护专项。 |

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
| **B4** | P0“拼句小火车”、成长与奖励、社群/自习室、用户服务和相关学习事件；P1 经验收后再扩展游戏，累计不超过四款 |
| **B5** | SKU、订单、权益、激活码、渠道适配/验签沙盒、教研 CMS、运营中台、客服、审计和合规运营能力；真实支付与自动续费默认关闭 |
| **B6** | 跨端发布、响应式与性能验收、关键路径 E2E、可靠性、观测和发布门禁 |

批次任务数量、负责人、状态、依赖和解除条件的唯一事实源是 [`requirements/backlog/Agent开发状态总报表.md`](requirements/backlog/Agent开发状态总报表.md)，README 不重复维护易变的任务数字。**注意：B0–B6 已是历史批次（只保留现状审计与迁移语义）；当前 Phase 1 的唯一执行入口与状态事实源是 [`requirements/backlog/v2-phase1-rebaseline/02-编号任务台账.md`](requirements/backlog/v2-phase1-rebaseline/02-编号任务台账.md)（`P1R-*` 共 108 项），跨会话交接入口是根目录 [`CURRENT-HANDOFF.md`](CURRENT-HANDOFF.md)。**

### Phase 1 状态解释

**2026-09-26 四端测试接手**：[当前接手报告](artifacts/uat-2026-09-26/README.md)汇总本机当前源码的运行与浏览器证据、9 月 25 日私有容器的历史边界、已知首页 503 和阅读/技能 Gateway 路由断路，以及接手测试顺序。[56 项 PAGE-P1 台账](artifacts/uat-2026-09-23/coverage-ledger.md)最近完整判定为 **PASS 0 / PARTIAL 29 / BLOCKED 27 / NOT_TESTED 0**；整页业务验收完成 **0/56**，检查覆盖 **56/56**。此口径与下方 2026-09-20 的 P1R 开发任务审计不同，均不能替代发布验收。

**2026-09-21 官网正式实现**：已按用户批准的提案 06 更新 `apps/official-site`，本地访问 `http://127.0.0.1:18182/`。包含深浅色、手机导航、空间/角色墙/拼句、学习内容与免费入口；详见[实现日志与本地验证](docs/06-design/v2-980plus/official-site-experience-proposal-2026-09-21/implementation/README.md)。未部署公网，不改变 P1R 验收状态。

**2026-09-21 官网重设计（此前原型轮次）**：[官网体验提案 06](docs/06-design/v2-980plus/official-site-experience-proposal-2026-09-21/README.md)沿用移动稿深紫双主题，以初期免费和第一阶段具体学习功能为内容，覆盖十四类官网页面、移动导航、搜索筛选与开始入口，并补充规则拼句、2D/立体个人空间、角色墙和可暂停动效。包含可点击原型、手机/电脑截图、内容依据和正式重构承接；当前不替换生产官网或修改免费权益规则。

**2026-09-20 UI/UX 与设计规模交付**：[本轮工作索引](docs/06-design/v2-980plus/mobile-experience-proposal-2026-09-20/DELIVERY-2026-09-20.md)包含提案 04 移动端十页深紫双主题原型、截图、简化路径与后端承接清单，以及以提案 03 深度为基准的四端页面/交互工作量估算。当前为待评审设计提案，未替换正式应用，也不代表新的产品验收。

**2026-09-20 完整度审计**：任务台账为 **81/108 ACCEPTED（75%）+ 27 DEV_DONE**；该比例不是上线完成度。当前源码契约检查存在失败，补偿执行、口语网关、跨服务导出/匿名化等仍有具名缺口，完整运行与发布 Gate 尚未闭合。检查结果、范围和后续顺序见[完整度梳理日志](requirements/backlog/v2-phase1-rebaseline/execution/COMPLETENESS-AUDIT-2026-09-20.md)，恢复工作先读[当前交接](CURRENT-HANDOFF.md)。本次文档同步不改变任务验收状态。

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
| **`services/iam-service`** | **Java 25 + Spring Boot 4.1**<br>(身份与权限服务) | 自有账号密码登录、Phase 1 短时 RS256 JWT、RSA JWKS、公钥轮换、用户/租户/设备/会话、RBAC + ABAC 策略和 Token 撤销；ES256 仅可在后续 ADR、契约、密钥 schema 与实现同步后扩展。 |
| **目标领域服务集群** | **Java 25 + Spring Boot 4.1**<br>(目标领域微服务) | 按 learner/content/learning/assessment/media/gamification/social/commerce/notification/analytics/admin-ops 划分事实和数据 owner。 |
| **`services/core-api`** | **Java 17 + Spring Boot 3**<br>(迁移兼容单体) | v1 旧实现和回滚边界；通过 Gateway 逐域迁移，当前代码存在不代表 v2 微服务/RBAC 已完成。 |
| **`services/ai-orchestrator`** | **Python 3.11 + FastAPI**<br>(Phase 2 独立 AI 编排) | 大模型统一接入 (LiteLLM)、AI 伴学导师智能体 (LangGraph)、发音/语法流式评测、RAG 向量检索。 |
| **`services/realtime-voice`** | **RTC 语音信令接入层** (Phase 2) | 商业 RTC (声网/TRTC) 低延迟双向对讲与打断 (Barge-in) 信令处理。 |
| **`services/content-worker`** | **内容与媒体处理 Worker** | 音频切片、波形特征提取、3D 模型 Draco 压缩、题库批量索引。 |
| **`services/job-runner`** | **异步调度与任务引擎** | 每日学习流重算、版本化改进型 SM-2 复习调度、统计数据定期归档。 |
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

### 启动说明（v2 全栈）

> 固定端口唯一事实源：`config/local-ports.json`；启动前先跑 `pnpm ports:check`。端口被占用时停止占用进程，不得自动改用其他端口。

1. **安装前端依赖**：`pnpm install`
2. **检查固定端口**：`pnpm ports:check`
3. **启动本地基础设施**（MySQL/Redis/MinIO/Kafka/RabbitMQ 一键）：`docker compose -f infra/docker/docker-compose.dev.yml up -d`
4. **构建并启动 v2 后端全栈**（16 个服务：Gateway 18070、workflow 18071、core-api 18080、IAM 18087、11 个领域服务 18088–18098、audit 18099）：
   - 首次或代码变更后：`pnpm services:build`
   - 启动：`pnpm services:run -- --all`（自带逐服务 readiness 健康检查）
5. **启动学员 Web 端**：`cd apps/learner-web && pnpm dev`，地址为 `http://127.0.0.1:18180`
6. **启动管理后台**：`cd apps/admin-web && pnpm dev`，地址为 `http://127.0.0.1:18181`
7. **启动官网**：`cd apps/official-site && pnpm dev`，地址为 `http://127.0.0.1:18182`
8. **启动移动端 H5**：`cd apps/mobile && pnpm dev:h5`，地址为 `http://127.0.0.1:18183`

补充：

- 本地种子/拟真数据：先明确设置 `LOCAL_TEST_SUBJECT` 为一个已注册、活跃且以 `@local.invalid` 结尾的合成账号 principal ID，再运行 `pnpm db:seed:local-real-all`（基础）；`pnpm db:seed:large-vocab`（词表）、`pnpm db:check:bulk-100x`（全库数据量门禁）。该基础种子只写入指定合成账号，不能向所有活跃学习者批量播种奖励或权益。
- 后端 jar 必须比源码新；改了 `services/**` Java 代码后需要重新 `pnpm services:build` 对应服务再启动。
- v2 微服务只走 Gateway 入口（18070）访问业务 API；`core-api`（18080）仅为 v1 迁移兼容与回滚边界。

端口规则见 `docs/02-architecture/local-development-port-allocation.md`。端口被占用时停止占用进程，不得自动改用其他端口。
