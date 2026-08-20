# 语学星：全栈语言学习系统

产品名：**语学星**
研发代号：**EnglishFlow**
运营主体：**深圳云澜深境科技有限公司**

面向中国大陆成人、大学生及进阶用户的多端全栈语言学习平台。基于 **Vue 3 前端多端矩阵 + Spring Boot 3 模块化核心后端 + MySQL** 构建，兼顾极致跨端学习体验与合规演进。

---

## 唯一事实源基线

- **需求事实源**：`requirements/product-requirements.md` (三阶段全量 PRD)
- **首发范围与边界**：`requirements/mvp-scope.md`
- **技术与架构约束**：`AGENTS.md` 与 `docs/02-architecture/`
- **UI/UX 设计规范**：`docs/06-design/` 与 `packages/design-tokens/`
- **文档治理规则**：`docs/00-vision/document-governance.md`

---

## 三阶段产品演进

| 阶段 | 用户与业务边界 | 核心功能与技术实现 | 阶段合规与准入要求 |
|---|---|---|---|
| **Phase 1<br>(基座版)** | **18+ 成人 / 大学生**<br>标准语言学习产品 | 词汇、语法、长难句、听力、阅读、口语自练、写作、模考与 SM-2 复习流；沉浸交互与星球体系。<br>**技术**：Vue 3 (Web/H5/App) + Spring Boot 3 + MySQL 8.x + Redis 7.x (无生成式 AI)。 | 企业主体、ICP 备案、网安备案、教育 App 备案、应用商店合规。 |
| **Phase 2<br>(AI 增强版)** | **18+ 职场 / 留学 / 出海**<br>AI 导师伴学与实战 | AI 学习导师、流式发音评测、作文智能批改、低延迟 RTC 实时语音对话、数字人伴学、雅思/托福。<br>**技术**：新增 Python 3.11 FastAPI (LiteLLM/LangGraph) + 商业 RTC。 | 生成式 AI 应用登记、深度合成算法备案、AI 内容双审过滤与标识。 |
| **Phase 3<br>(受监管扩展)** | **未成年人 / K12 中小学**<br>教材同步与家校生态 | 人教/外研/牛津等多版本教材知识图谱同步、音标基础、防沉迷家长锁、班级自习室与联考。<br>**技术**：多教材版本树 RAG + 家长监护鉴权系统。 | 取得出版物经营许可、校外培训专项合规、未成年人保护专项。 |

---

## 全栈架构与项目工程矩阵

### 1. 前端工程矩阵 (`apps/`) —— 全面基于 Vue 3

| 项目目录 | 定位与核心场景 | 技术选型 | 交付形态 |
|---|---|---|---|
| **`apps/official-site`** | **官方网站**：品牌门面、课程体系、会员价格对比、下载引导、合规公示 | Vue 3 + Nuxt 3 (SSR/SSG) + TailwindCSS | PC/移动端 Web |
| **`apps/learner-web`** | **学员端 Web/H5**：免安装响应式平台，PC 宽屏工作台与手机 H5 沉浸自适应 | Vue 3 + Vite + Pinia + Web Audio API | 浏览器 (PC/Mobile) |
| **`apps/admin-web`** | **管理中台**：教研录入、题库管理、学员档案、订阅交易、合规审计 | Vue 3 + Vite + Element Plus | 桌面管理端 |
| **`apps/mobile`** | **主 App 跨端工程**：全功能移动端、原生后台音频、微信/Apple 支付、推送 | Vue 3 + uni-app (TypeScript) | iOS / Android / 小程序 |

### 2. 后端服务矩阵 (`services/`) —— 模块化单体 + 专项 Worker + 独立 AI 编排

| 服务目录 | 定位与架构 | 核心职责 |
|---|---|---|
| **`services/core-api`** | **Java 17 + Spring Boot 3**<br>(Modular Monolith 模块化单体) | 统一核心业务：8 大业务域严格隔离（`auth`、`user`、`content`、`learning`、`assessment`、`gamification`、`social`、`commerce`、`admin`）。 |
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
- **Java**：`OpenJDK 17+`
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
8. **启动后端核心**：`cd services/core-api && mvn spring-boot:run`，地址为 `http://127.0.0.1:18080/api/v1`

端口规则见 `docs/02-architecture/local-development-port-allocation.md`。端口被占用时停止占用进程，不得自动改用其他端口。
