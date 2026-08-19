
const fs = require('fs');
const content = `# EnglishFlow Agent 工作与架构开发规则 (AGENTS.md)

> **版本**：v2.1 (全平台统一与高性能自适应开发就绪版)  
> **面向对象**：所有参与 EnglishFlow 研发的 AI Agent 与全栈工程师。

---

## 1. 产品与业务使命

把本仓库维护成一个面向全年龄段（K12 中小学启蒙、高中/大学升学突破、职场与出海实战）的中国大陆全场景 AI 自适应英语学习平台，而不是临时演示项目。所有实现都要服务于**“学习目标 -> 练习 -> 实时反馈 -> 复习 -> 闭环复盘”**。

---

## 2. 核心技术栈与架构选型约束 (Tech Stack Boundaries)

所有 Agent 在编写、重构或引入第三方依赖时，必须严格遵守以下技术栈边界，**严禁私自引入冲突框架**：

### 2.1 前端与全平台跨端矩阵
- **统一核心框架**：`React 18+ / Next.js (SSR)` + `TypeScript` + `Tailwind CSS`。
- **全平台跨端体系**：**一套核心代码（Monorepo 85%+ 复用）**。
  - **PC Web**：`Next.js` (全功能沉浸式学习)；
  - **Windows 桌面端 & iPadOS / 平板**：统一采用 **`Tauri 2.0`**（Rust 原生轻量外壳，<15MB 包体，30MB 内存占用，严禁引入臃肿的 Electron）；
  - **移动手机 App (iOS/Android)**：`Tauri 2.0` 或 `React Native (Expo)`；
  - **微信小程序**：基于 `Taro` 或 `Uni-App (Vue3)` 编译层同构适配。
- **动效与 3D 渲染引擎标准**：
  - **3D 口腔发音解剖**：`React Three Fiber (R3F)` + `Three.js` + `Draco` 压缩；
  - **AI 数字人伴学骨骼与状态机**：必须优先使用 **`Rive Runtime`**（严禁无节制使用大体积 Lottie）；
  - **长难句 X 光机 & 知识图谱**：`React Flow (Pro)` / `AntV G6` (WebGL 硬件加速模式)；
  - **音频精听与波形**：`Wavesurfer.js` + `Web Audio API (AudioWorklet)`。
- **设备算力自适应与画质降级**：
  - 必须对接 `AdaptivePerformanceEngine`，支持 **Ultra / High / Medium / Performance** 四级画质；
  - 低配设备必须能降级为 2.5D SVG 或 2D 静态切片，严禁出现低配机卡死或无法关闭动效的情况。

### 2.2 后端与实时通信架构
- **业务核心 (Core API)**：`TypeScript / Node.js (NestJS)` 模块化单体 (Modular Monolith) 或 `Java 17+ (Spring Boot 3)`。
- **实时语音与媒体通信**：必须基于 **`LiveKit (WebRTC)`** + 服务端 `Silero-VAD`（实现 <800ms 低延迟双向对讲与打断 Barge-in，严禁使用粗糙的 HTTP 轮询）。
- **AI 智能编排中心**：必须采用 **`Python 3.11+ (FastAPI + LangGraph / LiteLLM)`**。
- **持久化与数据存储**：`PostgreSQL 16 (支持 pgvector)` + `Redis 7.x Cluster` + S3 兼容对象存储。

---

## 3. 开发规范与架构边界约定 (Architecture Guardrails)

1. **类型与 API 契约先行 (Contract-First)**：
   - 任何前后端接口变动，必须先在 `packages/contracts/` 定义 TypeScript / Zod Schema 与 OpenAPI 文档，严禁在客户端代码中手写未经校验的裸 `any` 类型。
2. **AI 输出结构化与安全合规 (AI Safety & Schema Enforcement)**：
   - 所有 AI 功能必须有明确的 `prompt_version`、输入/输出 Pydantic/Zod Schema、超时降级与重试机制。
   - 所有学习评测结论必须在数据库留痕，具备可解释性与可回放审计能力。
   - 严格遵守中国大陆双审合规过滤机制（前置敏感拦截 + 后置合规核验）。
3. **分层渲染与性能守则 (Performance Guardrails)**：
   - AI 流式 Token 渲染（打字机）必须采用增量虚拟切片渲染，禁止触发全局 DOM 重排 (Layout Thrashing)。
   - 复杂动效和粒子效果必须受全局性能状态机控制，随时响应降级指令。
4. **隐私与代码安全**：
   - 严禁将真实用户隐私、音频原始数据、API Key 或生产凭证提交至 Git 仓库。

---

## 4. 功能完成定义 (Definition of Done - DoD)

一个功能只有在以下条件都满足时才算真正完成：
1. 需求与用例已对齐（`requirements/` 和 `docs/`）。
2. API 契约、数据库迁移与跨端类型已同步（`packages/contracts/`）。
3. 单元测试/集成测试已覆盖；关键链路具备端到端测试。
4. 移动端/iPad/Windows 跨端响应式布局与四级画质降级测试通过。
5. AI 功能具备结构化 Schema 验证与失败降级策略。
6. 文档、变更日志（CHANGELOG.md）与本地运行说明已同步更新。

---

## 5. Agent 标准作业流程 (SOP)

1. **审题与范围界定**：阅读相关 `requirements/` 和 `docs/`，明确改动影响范围并列出简要执行计划。
2. **建立边界与契约**：先写类型、数据表迁移和接口 Schema，再写业务实现。
3. **小步迭代与验证**：编写小步代码，运行最小验证（测试/语法检查），严禁一次性大面积破坏性修改。
4. **架构决策透明化**：遇到架构冲突或新增关键技术选型时，新增 ADR 至 `docs/10-decisions/`，不得静默变更约定。
5. **规范交付**：交付时清晰说明修改的模块、验证结果以及未完成或后续待办事项。
`;

fs.writeFileSync('./AGENTS.md', content, 'utf8');

