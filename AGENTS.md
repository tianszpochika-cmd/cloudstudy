# 语学星 Agent 工作与架构开发规则 (AGENTS.md)

> **版本**：v4.4 (v2-980plus 全量需求 + Java 25 + 微服务/Gateway/IAM/RBAC + B7/B8 代码重塑基线)
> **面向对象**：所有参与语学星研发的 AI Agent 与全栈工程师。

## 1. 产品与业务使命

把本仓库维护成中国大陆多端语言学习平台，而不是临时演示项目。Phase 1 只面向18岁以上成人与大学生，采用规则化学习闭环；AI 能力仅在 Phase 2 启用；未成年人/K12 仅在 Phase 3 完成专项合规后开放。所有实现都要服务于“学习目标 -> 练习 -> 反馈 -> 复习 -> 闭环复盘”。

---

## 2. 核心技术栈与架构选型约束 (Tech Stack Boundaries)

本文件与 [v2-980plus 设计包](docs/06-design/v2-980plus/README.md)、[v2 微服务目标架构](docs/02-architecture/v2-microservices-architecture.md)、[平台能力矩阵](docs/02-architecture/v2-platform-capability-matrix.md)、[B7+ 代码任务基线](requirements/backlog/v2-B7plus-代码重塑与交互测试任务基线.md) 和 ADR-0009/0010/0012/0013 一起构成当前基线。`v2-980plus/` 是新一轮开发唯一的全量业务设计与需求落地基线；v1 详细设计、B0–B6 和 `core-api` 只保留历史/迁移语义，不能覆盖 v2。v2 设计单元描述业务，`ARCH-*` 描述平台能力；两者在任务设计时必须建立映射。

所有 Agent 在编写、重构或引入第三方依赖时，必须严格遵守以下技术栈边界，**严禁私自引入冲突框架**：

### 2.1 前端与全平台跨端矩阵
- **统一核心框架**：`Vue 3 + TypeScript`；学习端跨端主体采用 **`uni-app (Vue3)`**，管理后台采用 `Vue 3 + Element Plus`。
- **前端应用项目冻结为四个**：平台目标是编译/运行形态，不再为 H5、iPad 或微信小程序分别建立业务项目。
  - **`apps/mobile`**：唯一的 uni-app 学习端项目，统一承载移动 H5、iOS App、Android App 和 iPad；微信小程序作为后续条件编译目标从本项目输出；
  - **`apps/learner-web`**：独立的学习 Web 项目，负责 PC Web、平板浏览器和 PWA 工作区；不重复承载 `apps/mobile` 的移动 H5 业务页面；
  - **`apps/admin-web`**：独立的教研、审核、运营、商业化和客服后台，使用 Vue 3 + Element Plus；不复用学习者端导航和业务页面；
  - **`apps/official-site`**：独立的官网项目，负责品牌、课程介绍、价格、下载、SEO 和合规公示；不承载登录后的学习业务。
- **共享原则**：四个项目共享契约、API 客户端、领域规则、设计 Token、埋点和国际化资源；UI 组件按平台分别实现。Monorepo 的高复用目标针对领域与基础能力，不要求跨 Web/uni-app 直接复用 DOM 或页面。
- **国际化边界**：`packages/i18n` 是 UI 文案、格式化、locale 注册与 fallback 的唯一共享入口；UI `locale` 必须与内容/学习语言 `contentLocale` 分离，不能由页面硬编码或以内容语言覆盖 UI 语言。默认中文 UI、后续语种资源、缺失 key fallback、数字/日期/复数格式化和伪本地化检查必须在前端平台任务中统一实现。
- **主题与设计 Token**：`packages/design-tokens` 必须输出原子 Token 与语义 Token（颜色、字体、间距、圆角、阴影、动效、断点、焦点态）；至少支持亮色、暗色、跟随系统和高对比模式。Web/Nuxt、uni-app 和 Element Plus 只消费适配后的变量，不得在业务页面新增品牌/状态色硬编码；颜色不能成为状态表达的唯一信号。
- **桌面端策略**：Windows 优先使用 `apps/learner-web` 的 Web/PWA；如确需原生壳可用 **`Tauri 2.0`**（严禁引入 Electron）。
- **微信小程序策略**：通过 `apps/mobile` 的 uni-app 条件编译输出；`apps/miniapp-wechat` 不作为独立业务项目，不得形成第二套页面、状态或 API 适配层。
- **动效与 3D 渲染引擎标准**：
  - **3D 口腔发音解剖**：`Three.js`（H5/App 端 web-view 承载 + Draco 压缩，小程序端降级为 2D 帧动画）；
  - **AI 数字人伴学骨骼与状态机**：优先使用 **`Rive Runtime`**（H5/App web-view；严禁无节制使用大体积 Lottie）；
  - **长难句 X 光机 & 知识图谱**：`Vue Flow` / `AntV G6`（框架无关，WebGL 硬件加速模式）；
  - **音频精听与波形**：`Wavesurfer.js` + `Web Audio API`；
  - **页面动效**：uni-app 内置动画 / CSS 动画 / `@vueuse/motion`。
- **设备算力自适应与画质降级**：
  - 必须对接 `AdaptivePerformanceEngine`，支持 **Ultra / High / Medium / Performance** 四级画质；
  - 低配设备必须能降级为 2.5D SVG 或 2D 静态切片，严禁出现低配机卡死或无法关闭动效的情况。

### 2.2 后端与实时通信架构
- **新服务主线**：`Java 25 LTS + Spring Boot 4.1.x + Spring Framework 7.x`；Spring Cloud 使用匹配的 release train，并由统一 BOM/Version Catalog 锁定版本。
- **旧实现兼容**：`services/core-api` 当前仍是 Java 17 + Spring Boot 3 模块化单体，只作为 v1 迁移兼容和回滚边界；不得把它描述为 v2 微服务已经完成。
- **API Gateway**：必须建设 `services/api-gateway`（Spring Cloud Gateway Server WebFlux），负责外部路由、`/api/v1` 版本、CORS、限流、requestId/traceId、JWT 预校验和边界审计；Gateway 不承载领域业务写入。
- **IAM/RBAC/ABAC**：必须建设 `services/iam-service` 作为平台自有认证中心，使用账号密码校验并在 Phase 1 固定签发短时 RS256 JWT Access Token、发布 RSA JWKS，管理 Refresh Token 轮换/重放检测/撤销、principal、用户、租户、设备、会话、角色、权限、策略和撤销事实。ES256 只能在新增 ADR、同步更新契约与 JWKS key schema、密钥管理和运行实现并通过验证后扩展。Phase 1 的 `/api/v1/auth/register` 是仅面向 18 岁以上成人的公开注册入口，成人 Gate 必须由服务端判定后才能开放学习能力；账号密码只能直接提交至 IAM 的 TLS 认证入口，领域服务不得接收、转发或校验密码，客户端不得保存或代替 IAM 处理密码；`iam-service` 是唯一 Token 签发方，领域服务、Gateway 和客户端均不得自行签发。RBAC 结合资源所有者、阶段、内容版权、设备和同意状态决策；默认拒绝。禁止引入 OIDC/OAuth、Keycloak 或第三方身份提供方作为正式登录方案。
- **服务侧鉴权**：每个领域服务必须使用 Spring Security Resource Server 验证令牌并执行 PEP；正常热路径使用已验证 JWT、资源本地事实和版本化策略包/短时安全缓存，高风险/动态策略或安全缓存未命中才调用 PDP。PDP、撤销或策略版本异常必须 fail closed。严禁信任 `X-B5-Role`、`X-Role` 或客户端提交的 tenant/owner 字段。Gateway 鉴权不能替代服务侧鉴权。
- **目标领域服务**：`learner-service`、`content-service`、`learning-service`、`assessment-service`、`media-service`、`gamification-service`、`social-service`、`commerce-service`、`notification-service`、`analytics-service`、`admin-ops-service`，边界和数据 owner 见 v2 微服务架构。
- **平台服务**：`audit-service`（安全/管理/导出审计）和 `workflow-service`（Saga、定时任务、补偿、DLQ、人工恢复）；初期可由平台模块或 `job-runner` 承载，但不能跨服务直接写领域表。
- **数据与事件**：MySQL 8.x 按服务独立 schema/写权限，Redis 7.x 不作为唯一事实源或事件平台；v2 只使用 Kafka 兼容事件总线 + Outbox + AsyncAPI 发布跨服务集成事实，按聚合 ID 分区、至少一次投递、幂等消费、Saga 和补偿。RabbitMQ 仅保留给 `services/core-api` 的 v1 历史兼容，Redis Streams 不得作为 v2 事件事实源。禁止共享表写入、Kafka RPC/事务协调和分布式两阶段提交。
- **部署与观测**：目标为 OCI + Kubernetes + Helm/Kustomize + GitOps；服务模板默认包含 OpenTelemetry、健康探针、优雅停机、SBOM、依赖扫描和可回滚发布。共享集群可行；已抽取服务必须独立进程、schema、凭据和发布/回滚责任。
- **实时语音与媒体通信**：Phase 2 优先商业 RTC（声网/腾讯云 TRTC）和独立 `realtime-voice` 服务，实现低延迟双向对讲与 Barge-in；严禁 HTTP 轮询。自建 LiveKit 需新增 ADR。
- **AI 智能编排中心**：Phase 2 使用 `Python 3.11+ (FastAPI + LangGraph / LiteLLM)` 独立服务，通过 REST/gRPC/事件与领域服务通信，客户端不得直连模型供应商。
- **阶段边界**：Phase 1 不启用生成式 AI、K12 和实时 AI；Phase 2/3 服务可以提前做隔离设计，但没有 Gate 不得进入默认路由。

认证中心安全边界：生产私钥只能由 secret manager/KMS 注入，不能进入 Git、容器镜像、普通配置或日志；密码使用 Argon2id（不可用时 BCrypt cost 12 以上）单向哈希，登录限流、失败锁定、密码重置、设备会话和审计必须落地。Web Access Token 只保存在内存，Refresh Token 使用 HttpOnly/Secure/SameSite Cookie；移动端只能使用 Keychain/Keystore 等系统安全存储，禁止普通 storage fallback；官网不保存业务 Token。

---

### 2.3 本地服务固定端口

- 本地端口唯一事实源为 config/local-ports.json，说明见 docs/02-architecture/local-development-port-allocation.md。
- 当前兼容运行时的 Core API 固定 18080；Gateway 固定 18070；IAM Service 固定 18087；Learner Web 固定 18180；Admin Web 固定 18181；Official Site 固定 18182；Mobile H5 固定 18183。新增 Gateway/服务仍必须先登记固定端口，不能自行选端口。
- MySQL 宿主机固定 13306；Redis 固定 16379；MinIO API/Console 固定 19000/19001；RabbitMQ AMQP/Management 的 15689/15690 仅为 v1 兼容端口，v2 Kafka 事件平台进入开发前必须单独登记固定端口。
- 所有本地 HTTP 服务默认绑定 127.0.0.1。端口冲突时必须停止占用进程并报告，严禁自动递增、随机改端口或复用常见默认端口。
- 前端启动脚本必须使用固定端口检查和 strictPort；启动全栈前先运行 pnpm ports:check。
- 新增或变更服务端口时，必须同步 config/local-ports.json、.env.example、启动脚本、Docker 映射、端口说明和 CHANGELOG。

---

## 3. 开发规范与架构边界约定 (Architecture Guardrails)

1. **类型与 API 契约先行 (Contract-First)**：
   - 任何前后端接口变动，必须先在 `packages/contracts/` 定义 OpenAPI 文档（YAML/JSON 单一事实源），Java 端 DTO 与前端 TS 类型均由 `openapi-generator` 生成，严禁在客户端代码中手写未经校验的裸 `any` 类型。
   - 外部 API 统一经 Gateway；内部 REST 使用 `/internal/v1` 或 gRPC；事件使用 AsyncAPI/JSON Schema 和兼容版本。
2. **服务边界与数据所有权**：
   - 每个服务拥有自己的 schema、Flyway migration、Redis key namespace、OpenAPI/事件契约和写权限；禁止跨服务 SQL join、跨服务写表和共享 ORM entity。
   - `content-service` 拥有内容/题目/答案规则版本，`assessment-service` 拥有 attempt/checkpoint/判分/报告，`learning-service` 拥有计划/SRS/进度/掌握度投影；BFF、workflow 和 audit 不得跨域双写。
   - `services/core-api` 只作为迁移中的反腐层；新增业务默认不得继续向其中增加跨域功能。
3. **身份与权限**：
   - `/api/v1/auth/register`（仅 18 岁以上成人公开注册）、`/api/v1/auth/login`、`/api/v1/auth/token/refresh`、`/api/v1/auth/logout`、`/api/v1/auth/sessions/{sessionId}/revoke`、`/api/v1/auth/password-reset/*` 和 `/api/v1/auth/jwks` 是认证中心的唯一公开/会话入口；只有 IAM 可以签发 Token，默认拒绝；权限判断至少包含 subject、tenant、role、permission、resource、action、owner、phase 和 content rights。
   - Gateway 和领域服务都必须鉴权；401/403 不能伪装为空列表；任何客户端角色头都无效。
   - Phase 1 tenant 由服务端派生；Phase 3 共享 schema 必须强制 `tenant_id`、`TenantScope` 和跨租户测试，MySQL 不得被声称为自动行级隔离。
4. **可靠性与事件**：
   - 写请求必须具备幂等键；事件必须有 eventId/traceId/schemaVersion，消费者必须去重、可重试、可进 DLQ、可回放。
   - 不使用分布式两阶段提交；跨服务一致性通过 Saga、补偿和对账实现。
5. **版本与迁移**：
   - Java、Spring、依赖、容器和基础设施由统一版本清单管理；先兼容、再切换、后删除。引入新基础设施或改变服务边界必须新增 ADR。
6. **AI 输出结构化与安全合规 (AI Safety & Schema Enforcement)**：
   - 所有 AI 功能必须有明确的 `prompt_version`、输入/输出 Pydantic/Zod Schema、超时降级与重试机制。
   - 所有学习评测结论必须在数据库留痕，具备可解释性与可回放审计能力。
   - 严格遵守中国大陆双审合规过滤机制（前置敏感拦截 + 后置合规核验）。
7. **分层渲染与性能守则 (Performance Guardrails)**：
   - AI 流式 Token 渲染（打字机）必须采用增量虚拟切片渲染，禁止触发全局 DOM 重排 (Layout Thrashing)。
   - 复杂动效和粒子效果必须受全局性能状态机控制，随时响应降级指令。
8. **隐私与代码安全**：
   - 严禁将真实用户隐私、音频原始数据、API Key 或生产凭证提交至 Git 仓库。

---

## 4. 功能完成定义 (Definition of Done - DoD)

一个功能只有在以下条件都满足时才算真正完成：
1. 需求与用例已对齐（`requirements/` 和 `docs/`）。
2. API 契约、数据库迁移与跨端类型已同步（`packages/contracts/`）。
3. 单元测试/集成测试已覆盖；关键链路具备端到端测试。
4. 移动端/iPad/Windows 跨端响应式布局、国际化 fallback/格式化、主题切换/持久化、色彩对比与四级画质降级测试通过。
5. AI 功能具备结构化 Schema 验证与失败降级策略。
6. Gateway 路由、服务 owner、数据 schema、RBAC/ABAC、事件和观测边界已有契约与运行证据；不能只凭目录或静态代码声称完成。
7. 文档、变更日志（CHANGELOG.md）与本地运行说明已同步更新。

---

## 5. Agent 标准作业流程 (SOP)

1. **审题与范围界定**：阅读相关 `requirements/` 和 `docs/`，明确改动影响范围并列出简要执行计划。
2. **建立边界与契约**：先写类型、数据表迁移和接口 Schema，再写业务实现。
3. **小步迭代与验证**：编写小步代码，运行最小验证（测试/语法检查），严禁一次性大面积破坏性修改。
4. **架构决策透明化**：遇到架构冲突或新增关键技术选型时，新增 ADR 至 `docs/10-decisions/`，不得静默变更约定。
5. **规范交付**：交付时清晰说明修改的模块、验证结果以及未完成或后续待办事项。
