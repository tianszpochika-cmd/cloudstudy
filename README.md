# 语学星：全栈语言学习系统

产品名：**语学星**
研发代号：**EnglishFlow**
运营主体：**深圳云澜深境科技有限公司**

面向中国大陆成人、大学生及进阶用户的多端全栈语言学习平台。基于 **Vue 3 四项目矩阵 + Java 25 LTS 微服务后端 + Gateway/IAM/RBAC + MySQL** 构建，兼顾跨端学习体验、权限安全和十年运维演进。

---

## 当前分支：迭代 2（第二轮重设计）

`dev` 的唯一当前进度入口是[迭代 2 当前进度](docs/06-design/v2-980plus/redesign/CURRENT-PROGRESS.md)，接手先读[根交接](CURRENT-HANDOFF.md)与[R1 执行计划](docs/06-design/v2-980plus/redesign/dev-plan-R1.md)。该计划包含 IT-1～IT-7；其中 IT-2 是定级站，不能与本轮迭代名称或产品 Phase 2 混用。最近可确认工作点、未发布全量卡墙、验收缺口和接手顺序只在进度页维护。

在迭代目录也可从[迭代 2 索引](requirements/iterations/iteration-02-redesign.md)进入同一计划。旧 P1R、B/DEV/G、PAGE-P1 台账和九月交接保留为历史/复用证据，不构成本分支任务队列。不要用旧完成率、原型覆盖或环境就绪推断本轮业务完成。

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

### 历史批次与验收记录

旧 B0–B6 职责和 P1R 完整度、四端 PAGE-P1 判定及九月测试顺序见[历史交接归档](CURRENT-HANDOFF-ARCHIVE-2026-09-28.md)与[历史任务索引](requirements/backlog/README.md)。记录保留当时的提交和验收范围，不再作为本分支当前进度展示。

Phase 1 不启用生成式 AI；规则化学习及平台能力仍按本轮 R1 卡计划和服务 owner 边界实现。

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
- **Node.js / pnpm**：`20.19.5` / `10.19.0`（版本锁定见 `config/toolchain-baseline.json`）
- **Java**：`OpenJDK 25 LTS`（旧 `core-api` 兼容 `17`）
- **Python**：`3.11+` (Phase 2 运行)
- **MySQL**：`8.0+`
- **Redis**：`7.0+`

### 启动说明（v2 全栈）

> 固定端口唯一事实源：`config/local-ports.json`；启动前先跑 `pnpm ports:check`。端口被占用时停止占用进程，不得自动改用其他端口。

1. **安装前端依赖并检查工具**：`pnpm install --frozen-lockfile`、`pnpm p1r:toolchain:check`
2. **检查固定端口**：`pnpm ports:check`
3. **启动本地基础设施**（MySQL/Redis/MinIO/Kafka）：`pnpm infra:up`，随后等待健康并复核私有桶。MinIO 从固定官方源码构建，Redis 空卷初始化保留既有 ACL。
4. **在服务关闭时准备数据库/ACL/topics**：`pnpm b28:owner-schemas`、`pnpm db:prepare:iam`、`pnpm redis:acl`、`pnpm p1r:kafka:topics -- --apply`。IAM 完整迁移由 Flyway 执行；首次 V13 必须确认旧写入已排空。
   **构建并启动 15 个 v2 服务**（Gateway 18070、workflow 18071、IAM 18087、11 个领域服务 18088–18098、audit 18099）：
   - 首次或代码变更后：停服务再执行 `pnpm services:build -- --all`
   - 正常启动：`pnpm services:run -- --all --timeout-ms 120000`（逐服务 readiness 检查）。首次 V13 迁移确认方法见完整指南。
   - `core-api` 仅在显式 `--include-legacy` 或单独选择时运行；另需 RabbitMQ，不属于默认 v2 栈。
5. **启动学员 Web 端**：`cd apps/learner-web && pnpm dev`，地址为 `http://127.0.0.1:18180`
6. **启动管理后台**：`cd apps/admin-web && pnpm dev`，地址为 `http://127.0.0.1:18181`
7. **启动官网**：`cd apps/official-site && pnpm dev`，地址为 `http://127.0.0.1:18182`
8. **启动移动端 H5**：`cd apps/mobile && pnpm dev:h5`，地址为 `http://127.0.0.1:18183`

补充：

- 本地种子/拟真数据：先明确设置 `LOCAL_TEST_SUBJECT` 为一个已注册、活跃且以 `@local.invalid` 结尾的合成账号 principal ID，再运行 `pnpm db:seed:local-real-all`（基础）；`pnpm db:seed:large-vocab`（词表）、`pnpm db:check:bulk-100x`（全库数据量门禁）。该基础种子只写入指定合成账号，不能向所有活跃学习者批量播种奖励或权益。
- 改后端源码后先停服务，执行 `pnpm services:build -- --service <service-id>` 再启动，避免运行中覆盖 JAR。
- v2 微服务只走 Gateway 入口（18070）访问业务 API；`core-api`（18080）仅为 v1 迁移兼容与回滚边界。

端口规则见 `docs/02-architecture/local-development-port-allocation.md`。端口被占用时停止占用进程，不得自动改用其他端口。

完整步骤、原生 SDK 检查、迁移失败处理与测试命令见 [本地开发指南](docs/07-operations/local-development.md)。本机验证可用 `pnpm local:smoke`；当前运行就绪与尚未通过的 P1R 门禁分别记录在 [2026-10-06 验证记录](docs/07-operations/local-environment-verification-2026-10-06.md)，不能据健康检查宣称全量业务验收。
