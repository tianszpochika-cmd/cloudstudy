# v2 B7+ 代码重塑与交互测试任务基线

> 基线 ID：`V2-CODE-BASELINE-20260822`  
> 状态：任务设计基线已重设；上方各任务表的“初始状态”保留为设计快照，不能替代当前执行状态。当前 B0–B14 代码层验证已完成，B2 保留 3 个外部集成 TODO；B15 已完成代码/静态预检，B16 已完成代码与静态回归但真实运行态被环境阻塞，B17 已完成代码、静态门禁与合成旅程回归但真实跨进程运行态被环境阻塞，B18 已完成代码/静态联调骨架与四端构建但真实 API/浏览器/设备运行态被环境阻塞，B19 已完成代码/静态系统测试基础但真实 API/E2E/浏览器/设备/专项 QA 运行态被环境阻塞，B20 已完成代码/静态 Gate 基础但真实安全/隐私/内容/支付/灾备运行态被环境、资质或证据阻塞，B21 已完成代码/静态发布 Gate 基础但真实 staging/RC/观测/回滚/Go-No-Go 运行态被环境或证据阻塞，B22 已完成代码/静态上线 Gate 基础但真实生产切换、迁移、观察期和 Phase 1 验收运行态被环境或证据阻塞。Phase 2/3 已移出当前批次，改以 `F2/F3` 未来 Gate 任务保留。最新交接证据见 [`test-phase-handoff-2026-08-22.md`](../../docs/07-operations/test-phase-handoff-2026-08-22.md)。
> 唯一业务来源：[v2-980plus 设计包](../../docs/06-design/v2-980plus/README.md)；唯一目标架构来源：[v2 微服务架构](../../docs/02-architecture/v2-microservices-architecture.md) 与 [`ARCH-*` 能力矩阵](../../docs/02-architecture/v2-platform-capability-matrix.md)。  
> 旧资产来源：B0–B6 的代码、契约、迁移、夹具和验证记录只作为迁移输入与行为回归样本，**不**继承旧 `DEV-*` 的完成状态、服务边界或 Java 17 单体实现。  
> 当前执行范围：在 B0–B14 代码基线之上，只推进 Phase 1 成人产品到上线所需的运行态、基础设施、联调、测试、发布和上线验证；不启用 Phase 2 AI、Phase 3 K12，也不把未来阶段合规签字混入当前完成度。
> 后续真实运行与实机验收从 B23 继续，任务定义见 [`v2-B23plus-Phase1-真实运行与实机测试任务基线.md`](./v2-B23plus-Phase1-真实运行与实机测试任务基线.md)；B23–B27 不新增 Phase 2/3 业务。

---

## 1. 目标、边界与完成口径

目标是在已经存在的 B0–B6 代码资产之上，完成从 Java 17 `core-api` 兼容单体到 v2 Java 25 微服务目标架构的**渐进重塑**，并把四个前端项目迁移到统一 Gateway、契约、权限、页面状态、国际化和主题 Token 模型：

- `apps/mobile`：uni-app 学习端，承载移动 H5、iOS、Android、iPad 与后续微信小程序条件编译；
- `apps/learner-web`：PC Web、平板浏览器和 PWA 学习工作台；
- `apps/admin-web`：教研、审核、运营、商业化和客服后台；
- `apps/official-site`：Nuxt/Vue 公开品牌、课程、价格、下载、SEO 和合规站点；不承载登录后的学习业务、同步或消息。

### 1.1 代码层完成（本基线允许标记）

每个 B7+ 任务至少具备：

1. 已细化签收的 `FEAT-*` / `PRD-ATOM-*` / `V2-980-*` 或独立 `ARCH-*` 引用；
2. 契约先行：OpenAPI、AsyncAPI 或 JSON Schema 与生成客户端同步；
3. 独立服务/前端源代码、迁移或兼容适配代码，且不跨 owner 直写；
4. 单元、契约、逻辑集成测试，以及受影响界面的组件或浏览器交互测试；
5. 八态中的相关状态至少覆盖 success、loading、empty、error、permission、recovery；涉及离线/媒体/长任务时还覆盖 offline、processing；
6. 静态安全约束：服务侧 PEP、`TenantScope`、幂等、敏感字段和 Phase Gate 的自动化断言。
7. 涉及 UI 的任务必须复用 `packages/i18n` 与 `packages/design-tokens`，验证 UI locale 与 `contentLocale` 分离、缺失翻译 fallback、主题持久化和颜色之外的状态表达；不得在业务页面新增品牌/状态色硬编码。

### 1.2 本基线明确不允许的误报

- 不因目录、README、Mock、测试替身或同一 Pod/JVM 而宣称领域服务已抽取；
- 不因前端隐藏开关而绕过成人年龄、版权、支付、AI 或 K12 Gate；
- 不将 B0–B6 中的共享表、`core-api` DTO、客户端角色头或内存 Repository 当成 v2 的目标实现；
- 不把 310 个 `V2-EXT-*` 占位单元拆成代码任务；它们必须先完成产品、架构、合规细化签收；
- 不把 `F2/F3` 的冻结任务提前放入当前 Phase 1 的默认路由、菜单、官网营销、数据库迁移或埋点注册。

### 1.3 任务编号与状态

任务格式为 `V2-B<批次>-<域>-<序号>`，例如 `V2-B8-IAM-001`。平台任务可只引用 `ARCH-*`；领域任务必须同时绑定业务来源和 `ARCH-*`。本文件中每行的“初始状态”即 B7+ 的初始状态事实，后续认领、证据和阻塞更新在该行追加，不能回写旧 `DEV-*` 状态表。

---

## 2. B0–B6 可复用资产与迁移规则

| 旧批次 | 可复用的代码层资产 | v2 使用方式 | 禁止继承 |
|---|---|---|---|
| B0/B1 | pnpm monorepo、固定端口、OpenAPI/事件生成、Flyway、Core API 身份/Onboarding、内容种子、learner-web/mobile 壳 | 作为契约命名、测试夹具、页面交互和迁移适配的输入 | Java 17 运行时、自研 Token Server/密码直登协议、`core-api` 作为新领域 owner |
| B2 | SRS、练习、判分、掌握度规则与 B2 夹具 | 提取纯规则，分别迁入 `learning-service` 与 `assessment-service`；内容定义迁入 `content-service` | 将题目、attempt、SRS 放入同一 schema 或由前端决定分数 |
| B3 | 语法/写作、听说读、离线 cursor、媒体 hash、四档性能降级 | 保留交互状态机和安全失败用例，改接 v2 内容、媒体、学习和测评服务 | `core-api` 跨域 JDBC、原始音频/答案进入事件或日志 |
| B4 | 游戏、社群、低 UGC、离线包与通知状态机 | 迁入 `gamification-service`、`social-service`、`notification-service` 并消费可信事件 | 客户端积分入账、未受控自由 UGC、把 REST ticket 当作真实实时运行证据 |
| B5 | 商业化、CMS 双审、Admin 页面、风控、客服和审计逻辑 | 迁入 `commerce-service`、`content-service`、`admin-ops-service`；复用 fail-closed 规则测试 | BFF 持有订单/内容事实、自研 SSO、真实支付已上线的暗示 |
| B6 | 响应式、无障碍、PWA、质量 Gate、性能策略、E2E 场景骨架 | 作为四项目交互测试和质量门禁的共同基线 | 将静态 Gate 当作真实设备/备份/生产发布证据 |

现有 `services/*-worker`、`ai-orchestrator`、`realtime-voice` 等目录只视为候选代码资产；只有满足 v2 独立进程、schema、凭据、契约、发布/回滚责任后，才可称为目标服务。

---

## 3. 批次依赖与并行原则

```mermaid
flowchart LR
  B7[B7 Platform 0 + 官网基础] --> B8[B8 Gateway / IAM / 成人 Gate]
  B7 --> B9[B9 Learner + Content + 官网数据]
  B8 --> B9
  B9 --> B10[B10 Learning + Assessment]
  B10 --> B11[B11 Media + 多模态 + 离线]
  B10 --> B12[B12 游戏 / 社群 / 通知]
  B9 --> B13[B13 商业化 / Admin / 官网转化]
  B11 --> B14[B14 Phase 1 收敛与 Strangler 退出]
  B12 --> B14
  B13 --> B14
  B14 --> B15[B15 运行环境与基础设施]
  B15 --> B16[B16 Gateway / IAM / RBAC 运行态]
  B16 --> B17[B17 领域服务与事件运行态]
  B17 --> B18[B18 四端真实联调]
  B18 --> B19[B19 系统测试与设备矩阵]
  B19 --> B20[B20 安全 / 隐私 / 灾备 Gate]
  B20 --> B21[B21 预发布与 RC]
  B21 --> B22[B22 生产上线与观察期]
```

- B7 的官网静态骨架可与 Platform 0 服务模板并行；B9 的官网公开数据投影必须等待 B7 契约/Gateway 基座。
- B11、B12、B13 在 B10 的可信学习事件和 B8 的服务侧 PEP 可用后可以并行，但不得共享写模型。
- B15–B18 是 Phase 1 运行态主链；B19–B21 以测试和发布 Gate 为主，B22 只有在 RC Gate 通过后才能执行生产切换。
- `F2` 仅在 `G-P2` 通过后解冻；`F3` 仅在 `G-P3` 通过后解冻。未来任务的存在不代表当前 Phase 1 授权开发或上线。

---

## 4. B7 — Platform 0、v2 契约、国际化/主题与官网基础（7 项）

**批次目标**：建立 Java 25/Spring Boot 4.1 服务开发骨架、Gateway 兼容入口、数据/事件测试底座、四前端国际化/主题基础和 `apps/official-site` 的真实源代码骨架。  
**主要引用**：`ARCH-PLAT-001`、`ARCH-API-001`、`ARCH-DEP-001`、`ARCH-DATA-001`、`ARCH-OBS-001`、`ARCH-REL-001`；v2 01/02/07。  
**初始状态**：待开始。

| 任务 ID | 代码目标 | 服务/前端宿主 | 逻辑与交互测试 | 依赖 | 初始状态 |
|---|---|---|---|---|---|
| V2-B7-PLAT-001 | 建立 Java 25、Spring Boot 4.1、统一 BOM、服务模板、健康探针、配置与本地固定端口约束；冻结四前端构建边界，并将 `apps/miniapp-wechat` 收敛为 `apps/mobile` 的条件编译兼容壳，禁止保留独立业务路由或 API 层；模板不复用 `core-api` 运行时 | `services/*` 模板、前端 workspace | 模板启动、配置拒绝、健康/readiness、版本兼容、端口冲突及独立小程序业务入口扫描测试 | 无 | 待开始 |
| V2-B7-API-002 | 将 v2 OpenAPI/AsyncAPI/JSON Schema 分层、生成、兼容 diff 和四端 API client 迁移机制落入代码 | `packages/contracts`、四前端共享 SDK | schema 破坏性变更、生成类型、错误 envelope、Idempotency-Key/trace 传播测试 | 001 | 待开始 |
| V2-B7-GW-003 | 新建 `api-gateway` 的无业务写入路由骨架，提供 `/api/v1`、CORS、限流、requestId/traceId 与 `core-api` 兼容路由 | `services/api-gateway` | 路由匹配、限流、CORS、直连拒绝、兼容回退与错误映射测试 | 001/002 | 待开始 |
| V2-B7-DATA-004 | 建立服务 schema/Flyway、`TenantScope`、Outbox、幂等、Redis namespace 与测试 fixture 基础库 | 服务模板、`database/` | 复合 tenant 约束、越权查询、重复写入、Outbox 去重/重放、迁移顺序测试 | 001/002 | 待开始 |
| V2-B7-OBS-005 | 建立 OTel、结构化审计、超时/重试预算、错误分类和浏览器测试替身 | Gateway、服务模板、四前端 | 一次模拟请求 trace 连通、敏感字段脱敏、超时/恢复状态和错误 UI 测试 | 003/004 | 待开始 |
| V2-B7-OFS-006 | 从空壳构建官网 Nuxt 源码：首页、课程、价格、下载、关于、合规页、SEO/robots/sitemap/结构化数据、公开状态组件 | `apps/official-site` | SSR/SSG 构建、元数据、断链、移动/桌面导航、加载/空/错误/下载禁用交互测试；不接入登录学习业务 | 002/007 | 待开始 |
| V2-B7-FE-007 | 建立 `packages/i18n` 与扩展 `packages/design-tokens`：UI locale 与 `contentLocale` 分离、`zh-CN` 默认/受控 fallback/格式化/伪本地化检查；原子与语义 Token、亮色/暗色/跟随系统/高对比主题，以及 Nuxt SSR、Vue Web、uni-app、Element Plus 适配层 | `packages/i18n`、`packages/design-tokens`、四前端 | locale key 缺失、插值/日期数字格式、UI 与内容语言分离、主题切换与持久化、Nuxt 无闪烁 hydration、色彩对比/非颜色状态、四端适配编译与交互测试 | 001 | 待开始 |

**批次退出条件**：四前端都能通过生成客户端访问 Gateway 测试替身和共享国际化/主题适配层；官网有可构建的源页面而非 `.nuxt/.output` 产物；不要求真实 IAM、Kubernetes 或生产 CDN。

### B7 执行记录（2026-08-22）

本节追加代码层执行状态，不改写上表的“初始状态”事实。7 项任务均已完成代码实现并通过对应逻辑/静态/构建验证，可进入测试阶段；运行态和 Gate 仍按验收标准处理。

| 任务 | 执行状态 | 主要证据 | 未覆盖项 |
|---|---|---|---|
| `V2-B7-PLAT-001` | 代码完成 | `services/service-template/`、`services/api-gateway/pom.xml`、`config/local-ports.json` | 当前环境 Java 24、无 Maven，Java 25 构建待专用工具链 |
| `V2-B7-API-002` | 代码完成 | `packages/contracts/schemas/v1/`、`scripts/contracts/compatibility-diff.mjs`、`packages/api-client/src/gateway-test-double.ts`、`tests/b7/gateway-client.test.mjs` | 真实四端 Gateway 运行态待测试 |
| `V2-B7-GW-003` | 代码完成 | `services/api-gateway/src/`、`tests/b7/gateway-platform.test.mjs`；legacy 兼容仅 GET/HEAD，默认 deny，local profile 只读放行 | JWT/JWKS、服务侧 PEP/RBAC 属于 B8；真实 Gateway 运行态待测试 |
| `V2-B7-DATA-004` | 代码完成 | `database/mysql/migrations/V0001–V0004`、Redis keyspace、`tests/b7/data-observability.test.mjs` | 真实 MySQL/Redis/Kafka 故障注入待测试 |
| `V2-B7-OBS-005` | 代码完成 | `packages/telemetry/`、服务模板 OTel 配置、数据观测测试 | OTel collector/跨进程 trace 运行态待测试 |
| `V2-B7-OFS-006` | 代码完成 | `apps/official-site/`、`tests/b7/official-site.test.mjs` | 真实 CDN/公开数据投影由 B9/部署阶段完成 |
| `V2-B7-FE-007` | 代码完成 | `packages/i18n/`、`packages/design-tokens/`、四端 `v2-foundation` 适配入口、i18n/theme 测试 | 浏览器 hydration、真机主题/locale 回归待测试 |

完整交接证据见 [`docs/07-operations/b7-validation.md`](../../docs/07-operations/b7-validation.md)。

---

## 5. B8 — Gateway、IAM 与成人安全入口（7 项）

**批次目标**：将所有登录后业务调用收敛到 Gateway + 平台 IAM 签发的 JWT Bearer + 服务侧 PEP；账号密码认证和 Token 签发只由 iam-service 负责。
**主要引用**：ONB/USR/INF 的已细化单元；`ARCH-GW-001`、`ARCH-IAM-001/002`、`ARCH-SEC-001`、`ARCH-OBS-001`。  
**前置 Gate**：`G-IAM-JWT`（自有 JWT profile、JWKS、公钥轮换、移动端安全存储、workload identity 和迁移回滚方案）必须先通过；未通过时仅可完成接口和测试替身，不能宣告真实认证链路完成。

| 任务 ID | 代码目标 | 服务/前端宿主 | 逻辑与交互测试 | 依赖 | 初始状态 |
|---|---|---|---|---|---|
| V2-B8-IAM-001 | 建设平台自有账号密码 JWT 认证中心，实施 RS256 Access Token/JWKS、刷新/撤销、工作负载身份适配 | `iam-service`、Gateway | 登录、密码错误/锁定、JWT issuer/audience/算法/过期、JWKS 轮换、刷新重放、撤销与失效会话测试 | G-IAM-JWT、B7 | 待开始（G-IAM-JWT） |
| V2-B8-IAM-002 | 建立不可变 principal 映射、服务端派生 `platform` tenant、设备、会话、同意和审计事实 | `iam-service` | tenant/subject 不可由客户端覆盖、会话隔离、同意版本和设备踢出测试 | 001/004 | 待开始 |
| V2-B8-IAM-003 | 实施 RBAC+ABAC、资源 owner/phase/rights/consent 判定、服务侧 PEP 与本地策略包/短期缓存 | IAM SDK、各服务模板 | allow/deny 矩阵、客户端角色头拒绝、PDP/撤销/策略版本故障 fail-closed 测试 | 001/002 | 待开始 |
| V2-B8-GW-004 | 将 Gateway 路由升级为认证、限流、审计边界，并将旧 `core-api` 入口包入反腐适配 | Gateway、`core-api` adapter | 未认证、过期、403、租户错配、原端口直连拒绝与回滚路由测试 | 001/003 | 待开始 |
| V2-B8-USR-005 | 实施 Phase 1 成人年龄 Gate、注册/恢复/隐私最小化和明确拒绝语义；不创建儿童、家长、监护或未成年人支付事实 | IAM、learner 适配层 | 年龄拒绝、伪造字段、重复注册、恢复页、审计留痕和无客户端绕过测试 | 002/003 | 待开始 |
| V2-B8-FE-006 | mobile、learner-web、admin-web 的登录、刷新、登出、权限页和会话恢复接入 Gateway；官网仅提供公开登录入口跳转，并复用 B7 的 locale/theme 适配 | 四前端 | 路由守卫、401/403、撤销后回到登录、深链恢复、无权后台菜单、官网不持有业务会话、不同 locale/theme 下权限文案测试 | 001–005/B7-FE-007 | 待开始 |
| V2-B8-TEST-007 | 建立认证安全旅程测试包与行为兼容夹具转换 | 服务/四前端测试 | 浏览器模拟：账号密码登录→成人 Gate→授权访问→刷新/登出→恢复；契约/组件/逻辑集成全链路 | 001–006 | 待开始 |

### B8 执行记录（2026-08-22，代码层）

本轮按“代码开发完成后进入测试阶段”的目标执行。7 项任务均已落地代码/契约/静态逻辑测试切片，但不把 G-IAM-JWT、自有 JWT/JWKS、Java 25/Maven 运行态、跨进程安全旅程或真机验收误报为完成。

| 任务 | 代码层证据 | 本轮结果 | 后续 Gate |
|---|---|---|---|
| `V2-B8-IAM-001` | `services/iam-service`、B8 JWT contract、`tests/b8/iam-service.test.mjs` | account/password login、RS256 Access Token/JWKS、refresh/revoke/replay、workload seam | G-IAM-JWT、真实 JWKS rotation、Java 25/Maven |
| `V2-B8-IAM-002` | V0016、principal/device/session/consent/adult/audit domain | platform tenant、immutable mapping、hash-only session secret、成人拒绝边界 | durable adapter、审计回放、删除/恢复运行态 |
| `V2-B8-IAM-003` | `services/service-template`、PEP/PolicyCache/LocalPolicyEvaluator、`tests/b8/service-template-security.test.mjs` | RBAC+ABAC、owner/phase/rights/consent、撤销/策略/PDP 异常 fail-closed | 复制到领域服务、PDP/跨租户故障注入 |
| `V2-B8-GW-004` | `services/api-gateway`、18087 端口登记、Gateway B8 tests | IAM canonical/legacy route、Resource Server Gate、伪造头清理、401/403 审计 | G-IAM-JWT 后启用、真实限流/直连/回滚 |
| `V2-B8-USR-005` | IAM adult Gate domain、V0016、B8 contracts | 成人 Gate 和 child/guardian/K12/minor-payment 禁止事实边界 | 注册/恢复/隐私 HTTP 与真实年龄证明 |
| `V2-B8-FE-006` | 四端 session/auth 适配器、路由守卫、B8 frontend test、四端 build | Gateway 登录/刷新/登出/权限/恢复代码切片；官网只做公开入口 | 浏览器/App/iPad/小程序/弱网 |
| `V2-B8-TEST-007` | `tests/b8/*.test.mjs` | 28/28 B8 静态契约、迁移、Gateway、IAM、PEP、前端 canonical 路径边界测试 | 完整浏览器/跨进程/真机旅程 |

交接文档：[B8 验证交接](../../docs/07-operations/b8-validation.md)；认证中心决策：[ADR-0013](../../docs/10-decisions/0013-self-owned-jwt-authentication-center.md)。

---

## 6. B9 — Learner、Content 与官网公开数据（7 项）

**批次目标**：抽取学习者档案和内容供应链，完成 Onboarding/Home 迁移，并让官网安全消费公开课程、价格、下载和合规投影。  
**主要引用**：v2 03 的 ONB、v2 04 的 USR/ADM/INF；`ARCH-DATA-001`、`ARCH-API-001`、`ARCH-EVT-001`、`ARCH-SVC-001`。

| 任务 ID | 代码目标 | 服务/前端宿主 | 逻辑与交互测试 | 依赖 | 初始状态 |
|---|---|---|---|---|---|
| V2-B9-LRN-001 | 建立 `learner-service`：学习档案、目标、偏好、首日投影与服务 own schema；对旧用户资料做只读影子适配 | learner-service | tenant/owner、目标校验、偏好恢复、幂等更新和旧读模型一致性测试 | B8/B7 | 待开始 |
| V2-B9-CNT-002 | 建立 `content-service`：课程/词条/语法/题目定义、版本、版权、草稿/双审/发布/下线事实 | content-service | 草稿不可读、版权缺失拒绝、版本回滚、答案规则不下发、发布 Outbox 测试 | B7/B8 | 待开始 |
| V2-B9-CNT-003 | 建立学习端公开内容读投影和缓存失效，禁止前端或 Admin BFF 直写内容事实 | content-service、Gateway | 版本 pin、下线恢复、缓存失效、公开/登录后字段过滤测试 | 002 | 待开始 |
| V2-B9-ADM-004 | 将内容编辑/审核 UI 改为命令至 `content-service`，Admin 仅聚合、发命令与关联审计 | admin-web、admin-ops adapter | 角色隔离、双审不可自批、冲突编辑、草稿/发布/回滚状态交互测试 | B8/002 | 待开始 |
| V2-B9-ONB-005 | 将移动端和 learner-web 的目标、测评入口、今日任务/Home 深链迁到 learner/content read model，并接入共享 locale/theme | mobile、learner-web | 表单、加载、空任务、内容下线、恢复、无权和跨端续学；locale fallback、主题恢复及 UI/content language 分离交互测试 | 001–003/B7-FE-007 | 待开始 |
| V2-B9-OFS-006 | 官网接入只读公开投影：课程目录、价格展示、下载渠道、版本公告、合规声明；无登录学习 API | official-site、公开 Gateway route | SSR 缓存/降级、公开字段白名单、价格未发布、下载不可用、SEO 页面状态测试 | B7-006/003 | 待开始 |
| V2-B9-TEST-007 | 建立 Onboarding→公开内容→登录学习的契约和浏览器交互回归 | 相关服务/三端 | 成人用户进入、未发布内容拒绝、官网→登录→Home 深链恢复、审计/trace 关联测试 | 001–006 | 待开始 |

### B9 执行记录（2026-08-22，代码层）

本轮按“代码层完成后进入测试阶段”执行。7 项任务均已落地代码/契约/前端接入/逻辑测试切片；初始状态列保留为计划快照，以下记录是本轮实际交付，不把 Java 25/Maven、真实 Gateway、MySQL/Kafka/IAM JWT、浏览器或真机运行态误报为完成。

| 任务 | 代码层证据 | 本轮结果 | 测试阶段后续 |
|---|---|---|---|
| `V2-B9-LRN-001` | `services/learner-service`、服务 Flyway V1、`javac --release 24` | profile/goal/preferences/first-day、旧 shadow 只读、tenant/owner、幂等/Outbox | Java 25/Maven、MySQL、跨进程 PEP 和 shadow 对账 |
| `V2-B9-CNT-002` | `services/content-service`、ContentDomainSmoke、内容状态机/投影 policy | 定义/版本/版权/双审/发布/回滚、答案规则隔离、Outbox/cache port | Spring Boot/controller、durable repository、Kafka/DLQ 和故障注入 |
| `V2-B9-CNT-003` | B9 OpenAPI/event、V0017、Gateway 相对路径、公开投影 BFF | version pin、公开/学习者字段过滤、content epoch/cache fallback | 跨进程缓存失效、下线恢复和字段回放 |
| `V2-B9-ADM-004` | `apps/admin-web/src/api/content-service-command-adapter.ts`、B9 admin command/list contract、AdminContentView | 单一 command endpoint、状态版本、双审节点和冲突恢复交互边界 | admin-ops 聚合、真实 RBAC/ABAC、浏览器命令旅程 |
| `V2-B9-ONB-005` | learner-web/mobile B9 API/store/page 接入、共享 i18n/design-token | onboarding、测评、home、today、任务幂等、空/下线/无权/恢复状态 | Gateway session、弱网/离线、浏览器/App/iPad/小程序和无障碍 |
| `V2-B9-OFS-006` | official-site public projection composable/server BFF、canonical public route、SSR build | 首页/课程/价格/下载/公告/合规只读投影、stale fallback、download-disabled | 真实 Gateway/CDN/SEO 和线上公开字段回放 |
| `V2-B9-TEST-007` | `tests/b9/*.test.mjs`、B1–B9 回归、契约/迁移/端口/构建记录 | B9 6/6；B8 28/28；四端构建和共享包 typecheck 通过 | 完整官网→登录→Onboarding→Home 浏览器/跨进程/设备链路 |

交接文档：[B9 验证交接](../../docs/07-operations/b9-validation.md)。

---

## 7. B10 — Learning、Assessment 与规则化学习闭环（8 项）

**批次目标**：切开内容定义、作答判分和学习/SRS 事实，重建 Phase 1 规则化学习闭环。  
**主要引用**：v2 03 的 VOC/GRM/RDG/WRT/ASM 已细化单元；`ARCH-DATA-001`、`ARCH-EVT-001`、`ARCH-REL-001`、`ARCH-IAM-002`。

| 任务 ID | 代码目标 | 服务/前端宿主 | 逻辑与交互测试 | 依赖 | 初始状态 |
|---|---|---|---|---|---|
| V2-B10-LRN-001 | 建立 `learning-service`：计划、SRS、进度、复习队列、掌握度投影与唯一学习 schema | learning-service | SM-2/规则回放、时区、非法状态迁移、幂等复习、tenant/owner 测试 | B9 | 待开始 |
| V2-B10-ASM-002 | 建立 `assessment-service`：会话、attempt、checkpoint、规则评分、错因和报告快照 | assessment-service | 服务端权威判分、断点恢复、答案不泄露、重复提交、超时、报告重放测试 | B9/001 | 待开始 |
| V2-B10-CNT-003 | 从 `content-service` 提供题目、答案规则和内容版本快照；assessment 不维护题库主表 | content/assessment contract | 版本锁定、题目下线、规则兼容、答案规则权限与契约测试 | B9-002 | 待开始 |
| V2-B10-EVT-004 | 实现 `attempt.submitted → assessed → learning projection` 的 Outbox、去重、补偿和回放 | assessment/learning | 至少一次、乱序、重复消息、DLQ、回放、失败恢复和 Saga 测试 | 001–003 | 待开始 |
| V2-B10-FE-005 | 迁移词汇/SRS、阅读、基础练习、错题和报告的移动/Web 交互 | mobile、learner-web | 卡片不重复推进、题型错误/恢复、空队列、内容失效、离线恢复与可访问性交互测试 | 001–004 | 待开始 |
| V2-B10-FE-006 | 迁移语法树、长难句、仿写、病句改错和规则写作反馈；不引入 AI 评分 | mobile、learner-web | 拖拽/键盘操作、保存/恢复、规则反馈、答案保护、Performance 降级测试 | 002–004 | 待开始 |
| V2-B10-MIG-007 | 建立 B2/B3 行为夹具到目标服务的读旁路、对账和渐进切换代码 | content/learning/assessment、core-api adapter | 同输入旧/新规则比对、只读影子、可回退路由、无跨服务直表访问扫描 | 001–004 | 待开始 |
| V2-B10-TEST-008 | 建立“目标→练习→反馈→复习→报告”的逻辑/交互测试包 | 相关服务/两学习端 | 单元、契约、组件、浏览器模拟全链路；覆盖八态与 trace/event 关联 | 001–007 | 待开始 |

### B10 执行记录（2026-08-22，代码层）

本轮按“代码层完成后进入测试阶段”执行。8 项任务均已形成代码、契约、迁移、兼容适配或学习端交互测试切片；初始状态列保留为计划快照。当前机器使用 Java 24 且无 Maven，以下记录不把 Java 25/Spring Boot 运行态、真实 Gateway、MySQL/Kafka/IAM JWT、浏览器或设备验收误报为完成。

| 任务 | 代码层证据 | 本轮结果 | 测试阶段后续 |
|---|---|---|---|
| `V2-B10-LRN-001` | `services/learning-service`、独立 Java 25 POM、`LearningDomainSmoke` | 计划/任务/进度、SM-2/SRS、时区、复习队列、mastery projection、幂等和 tenant/owner 默认拒绝 | Java 25/Maven、Spring HTTP、MySQL durable adapter、跨进程 PEP 和 DST/故障注入 |
| `V2-B10-ASM-002` | `services/assessment-service`、独立 Java 25 POM、`AssessmentDomainSmoke` | session/attempt/checkpoint、服务端规则判分、超时自动提交、错因/报告快照、答案保护和幂等 | Java 25/Maven、controller、MySQL/Flyway、真实恢复/重复提交/超时和权限运行态 |
| `V2-B10-CNT-003` | B10 content snapshot/assessment OpenAPI、`ContentSnapshotPort`、B10 fixture | 内容版本 pin、题目/规则通过 content owner 只读端口进入 assessment，客户端和事件不持有答案规则 | content-service 跨进程快照、下线/版本失效、权限与规则兼容回放 |
| `V2-B10-EVT-004` | B10 AsyncAPI 事件、V0018 outbox/dedupe/DLQ/Saga 表、内存 outbox | `attempt.submitted → assessed → mastery.projected`、重复投递、补偿、回放和安全事件 envelope 已具备代码/契约边界 | Kafka/Outbox worker、乱序/断点/DLQ 人工恢复、跨服务 trace 和至少一次运行态 |
| `V2-B10-FE-005` | learner-web/mobile B10 API、store、词汇/SRS/阅读/练习/错题/报告页面 | Gateway 相对路径、幂等写、离线队列、空/失效/无权/恢复、UI locale/contentLocale 和主题/性能边界 | 浏览器/App/iPad/小程序交互、弱网、无障碍和真实会话恢复 |
| `V2-B10-FE-006` | learner-web/mobile grammar/X-ray/paraphrase/error-correction/rule-writing 组件与页面 | 键盘/拖拽、草稿/断点、规则化反馈、答案保护和四级 Performance 降级入口 | 浏览器组件回放、触控/键盘可达性、真实内容版本和设备画质验收 |
| `V2-B10-MIG-007` | `core-api` B10 compatibility adapter、B10 compatibility OpenAPI、V0018 `cmp_b10_*` ledger、fixture | B2/B3 只读 shadow、对账状态、配置版本、渐进 route、回滚状态机；回滚明确不改领域事实 | Java 17/Maven 集成、legacy/target 双读源、真实对账、Gateway 切换和故障回退 |
| `V2-B10-TEST-008` | `tests/b10/*.test.mjs`、两端 B10 静态测试、两个服务 smoke、兼容 adapter smoke | 目标→练习→反馈→复习→报告的代码级边界、事件安全、迁移可重放和交互恢复证据已建立 | 浏览器/跨进程/数据库/Kafka/IAM JWT/设备全链路测试 |

交接文档：[B10 验证交接](../../docs/07-operations/b10-validation.md)。

---

## 8. B11 — Media、多模态训练、离线与通知（7 项）

**批次目标**：将媒体资产、播放/录音权限、离线同步和多模态交互移到可独立演进的边界；保持 Phase 1 无 AI 评分。  
**主要引用**：v2 03 的 LST/RDG/SPK/WRT，v2 04 的 INF；`ARCH-DATA-001`、`ARCH-EVT-001`、`ARCH-REL-001`、`ARCH-OBS-001`。

| 任务 ID | 代码目标 | 服务/前端宿主 | 逻辑与交互测试 | 依赖 | 初始状态 |
|---|---|---|---|---|---|
| V2-B11-MED-001 | 建立 `media-service`：媒体元数据、版权引用、校验和、转码状态、短期签名 URL 与 manifest | media-service | 授权/撤权、Range、过期 URL、checksum、转码失败、无媒体降级测试 | B9/B8 | 待开始 |
| V2-B11-INF-002 | 将通知偏好、离线 change、cursor、冲突和恢复迁入 `notification-service`/工作流边界 | notification/workflow、learning adapter | clientEventId 去重、版本向量、空间不足、通知偏好、重复消费和恢复测试 | B8/B10 | 待开始 |
| V2-B11-FE-003 | 迁移精听、听写、倍速、A-B、Language Clips、分级阅读的服务端状态和页面交互 | mobile、learner-web | 媒体加载/失败、位置保存、字幕/题目同步、权限拒绝、断网和恢复测试 | 001/002 | 待开始 |
| V2-B11-FE-004 | 迁移音标、跟读、Shadowing、录音自评与规则化口语/写作媒介流程；不产生 AI 分数 | mobile、learner-web | 录音权限、hash 生命周期、失败提示、提交幂等、无 AI 评分断言测试 | 001/002/B10 | 待开始 |
| V2-B11-PERF-005 | 将 Ultra/High/Medium/Performance 策略接入真实 v2 页面组件，提供 3D/波形/动效 2D 降级 | 四端共享性能包、学习端 | 低档关闭重资源、减少动效、内存/离线降档、可手动关闭动效交互测试 | 003/004 | 待开始 |
| V2-B11-MIG-006 | 为 B3 媒体/离线资产建立只读兼容、对象引用迁移和撤回路径 | media/notification/core-api adapter | 旧 manifest 对账、未授权资产不可读、迁移失败回退、无原始音频入事件测试 | 001–004 | 待开始 |
| V2-B11-TEST-007 | 建立媒体、离线与多模态交互模拟测试包 | 相关服务/学习端 | 录音/播放/断网/恢复/画质降级的组件与浏览器交互测试；不要求真机或真实 S3 | 001–006 | 待开始 |

### B11 执行记录（2026-08-22，代码层）

本节追加本轮执行结果，不改写上表的“初始状态”事实。7 项任务均已完成代码层切片并具备逻辑/静态/构建证据，可进入测试阶段；Java 25/Spring Boot 运行态、真实 Gateway/IAM JWT、MySQL/Kafka、对象存储、浏览器和真机联调仍按测试阶段处理。

| 任务 | 代码层证据 | 本轮结果 | 测试阶段后续 |
|---|---|---|---|
| `V2-B11-MED-001` | `services/media-service`、MediaDomainSmoke、B11 媒体契约和 V0019 | 元数据/版权引用/checksum/size、转码/rendition、manifest、Range、短时授权、过期/撤销、默认拒绝 | Java 25/Maven/Spring HTTP、MySQL、S3/CDN/KMS、真实权限和跨进程事件 |
| `V2-B11-INF-002` | `services/notification-service`、NotificationServiceSmoke、NotificationWorkflowSmoke | 通知偏好/消息/投递重试/DLQ、clientEventId 去重、cursor/向量冲突、空间不足和人工恢复 seam | 推送供应商、Kafka/Workflow durable worker、数据库和真实设备弱网 |
| `V2-B11-FE-003` | learner-web/mobile B11 listening/reading 页面、store、Gateway API | 精听、字幕/时间轴、倍速、A-B、Language Clips、听写、阅读进度/题目、离线/授权失败状态 | 浏览器点击回放、真实 Gateway/媒体、iPad/小程序条件编译和无障碍 |
| `V2-B11-FE-004` | learner-web/mobile B11 speaking、录音安全适配器和规则自评 | 麦克风权限、SHA-256 生命周期、本地加密恢复、重录/自评/Shadowing；Phase 1 明确无 AI 评分 | 浏览器麦克风、App Keychain/Keystore、真实媒体授权和设备恢复 |
| `V2-B11-PERF-005` | `packages/performance`、四级媒体策略和 B11 页面降级入口 | Ultra/High/Medium/Performance、离线存储压力降档、手动关闭动效、波形/3D/动效静态降级 | 真机内存/帧率/存储压力、视觉回归和无障碍对比度 |
| `V2-B11-MIG-006` | `B11MediaOfflineCompatibilityAdapter`、V0019 `cmp_b11_*`、兼容 API/事件 | 旧 manifest 对账、授权失败不可读、对象引用 hash 迁移、失败 fallback、撤回和 `domainFactsUntouched` | core-api 双读/target 运行态、持久化 adapter ledger、真实回滚演练 |
| `V2-B11-TEST-007` | `tests/b11`、learner-web/mobile B11 边界测试、三类纯 Java smoke | 契约/迁移/前端/服务边界已形成可重复验证包 | 浏览器/跨进程/设备/基础设施集成矩阵 |

完整交接证据见 [`docs/07-operations/b11-validation.md`](../../docs/07-operations/b11-validation.md)。

---

## 9. B12 — 游戏化、社群与可信通知消费（7 项）

**批次目标**：将成长、低 UGC 社群和通知从客户端/单体逻辑迁为可信学习事件的消费者，保持权益与审计边界。  
**主要引用**：v2 04 的 GAM/SOC/INF；`ARCH-EVT-001`、`ARCH-IAM-002`、`ARCH-REL-001`、`ARCH-SEC-001`。

| 任务 ID | 代码目标 | 服务/前端宿主 | 逻辑与交互测试 | 依赖 | 初始状态 |
|---|---|---|---|---|---|
| V2-B12-GAM-001 | 建立 `gamification-service`，只消费可信学习事件，拥有 XP、等级、Streak、奖励账本与赛季事实 | gamification-service | 事件去重、账本守恒、时区、重复奖励、关闭旗标不阻断学习测试 | B10/B8 | 代码层完成，待运行态测试 |
| V2-B12-SOC-002 | 建立 `social-service` 的自习室、排行榜、可见性、受控低 UGC、举报与治理边界 | social-service | tenant/owner、房间恢复、无自由文本、举报幂等、权限拒绝与状态机测试 | B8/B10 | 代码层完成，待运行态测试 |
| V2-B12-INF-003 | 建立可信事件到通知/工作流的消费、偏好过滤、重试和人工恢复代码 | notification/workflow | 事件去重、延迟、DLQ、偏好拒收、恢复通知和审计测试 | B11/B10 | 代码层完成，待运行态测试 |
| V2-B12-FE-004 | 迁移成长世界、游戏、Avatar/奖励箱的移动/Web 状态与低画质交互 | mobile、learner-web | 服务端结算、暂停/恢复、重复点击、Performance 可玩、奖励概率披露测试 | 001 | 代码层完成，待浏览器/设备测试 |
| V2-B12-FE-005 | 迁移自习室、排行榜、打气互动、通知中心和举报交互；前端不产生社群事实 | mobile、learner-web、admin-web | 入房/离房、断线、空房、权限、举报/处理、无自由文本输入测试 | 002/003 | 代码层完成，待浏览器/设备测试 |
| V2-B12-MIG-006 | 建立 B4 游戏/社群/通知旧事实的影子读、事件回放与切换适配 | gamification/social/notification、core-api adapter | 旧新结果对账、重复事件、回滚、无客户端积分写入扫描 | 001–003 | 代码层完成，待双读/回滚演练 |
| V2-B12-TEST-007 | 建立成长与社群跨服务逻辑/交互测试包 | 相关服务/三端 | 学习完成→成长→通知→社群可见性的回放；覆盖权限、恢复和异常态 | 001–006 | 代码层完成，基础逻辑测试通过 |

### B12 执行记录（2026-08-22，代码层）

本轮按“契约/迁移 → 服务边界 → 前端交互 → 兼容适配 → 逻辑验证”完成 B12 的代码层切片。`gamification-service`、`social-service`、`notification-service` 均建立独立服务边界；旧 `core-api` 仅新增只读/可回滚的 B12 兼容反腐层，不承接新的成长、社群或通知领域写入。移动端、learner-web、admin-web 已接入奖励概率披露、社群排行榜/预设举报、通知偏好、治理和恢复状态，并继续复用共享 i18n、主题 Token、Gateway 相对路径和服务端事实。

| 任务 | 代码层证据 | 当前验收结论 |
|---|---|---|
| `V2-B12-GAM-001` | `services/gamification-service`；可信事件、账本/等级/Streak/奖励/赛季、幂等与 Feature Flag | Java 依赖无关冒烟通过；Maven/Java 25/Spring HTTP 留待测试环境复验 |
| `V2-B12-SOC-002` | `services/social-service`；房间席位租约、断线恢复、可见性、预设互动、排行榜、举报和默认拒绝 | 子 Agent 报告 Java 25 Maven/HTTP smoke 通过；主工作站需在 Maven/JDK 25 环境复验 |
| `V2-B12-INF-003` | `services/notification-service`；可信事件 allowlist、偏好过滤、延迟重试、DLQ、人工恢复、审计 | B11/B12/Workflow pure-Java smoke 通过；真实 Kafka/Workflow/推送供应商留待测试 |
| `V2-B12-FE-004` | learner-web/mobile B12 奖励箱、概率披露、成长世界入口、加载/空/离线/权限/恢复状态 | 两端 B12 静态交互边界、learner-web 类型检查、mobile H5/App/微信小程序构建通过；浏览器和真机矩阵留待后续验证 |
| `V2-B12-FE-005` | learner-web/mobile 社群扩展、预设举报、通知偏好；admin-web 治理/恢复页、权限和幂等命令 | learner-web/mobile/admin-web B12 边界测试和 admin-web 构建通过；浏览器/设备联调留待测试 |
| `V2-B12-MIG-006` | `B12CompatibilityAdapter`、V0020 `cmp_b12_*`，影子 hash、事件回放去重、TARGET/FALLBACK 回滚、禁止客户端成长事实 | Java 17 兼容冒烟通过；未执行真实双读、持久化和回滚演练 |
| `V2-B12-TEST-007` | `tests/b12` 7 项契约/迁移/兼容/跨服务逻辑测试 | 7/7 通过；不替代跨进程、基础设施、浏览器和真机验收 |

完整交接证据见 [`docs/07-operations/b12-validation.md`](../../docs/07-operations/b12-validation.md)。

---

## 10. B13 — 商业化、运营后台与官网转化边界（8 项）

**批次目标**：抽取订单/权益/对账、运营命令与只读分析；官网只展示公开价格并安全地移交到登录/结算，不承担订单事实。  
**主要引用**：v2 04 的 COM/ADM/INF；`ARCH-IAM-002`、`ARCH-DATA-001`、`ARCH-EVT-001`、`ARCH-DR-001`、`ARCH-SEC-001`。

| 任务 ID | 代码目标 | 服务/前端宿主 | 逻辑与交互测试 | 依赖 | 初始状态 |
|---|---|---|---|---|---|
| V2-B13-COM-001 | 建立 `commerce-service`：SKU、价格快照、订单、权益、激活码、退款和对账 own schema | commerce-service | 金额快照、权益幂等、激活码一次性、退款补偿、tenant/owner 测试 | B8/B7 | 待开始 |
| V2-B13-COM-002 | 建立支付 provider port、回调验证、默认关闭 Gate 和状态恢复；不接入或宣称真实渠道上线 | commerce-service | 签名失败、重复回调、金额不符、支付关闭、恢复/取消状态交互测试 | 001 | 待开始 |
| V2-B13-ADM-003 | 建立 `admin-ops-service` 的命令编排、只读投影、审批/风控/工单/审计关联；不复制领域事实 | admin-ops-service、admin-web | 二次确认、越权拒绝、命令幂等、审计不可变、跨域双写扫描测试 | B8/B9/B13-001 | 待开始 |
| V2-B13-ANL-004 | 建立 `analytics-service`/worker 的脱敏事件消费、指标投影和可重算边界 | analytics service/worker、admin-web | 事件重放、口径版本、脱敏、指标回算与空数据/错误态测试 | B10/B12/B13-001 | 待开始 |
| V2-B13-SUP-005 | 建立客服工单、附件引用、SLA、脱敏视图和领域命令转发边界 | admin-ops、notification、admin-web | 附件权限、脱敏、SLA 状态、无关用户拒绝、恢复/审计测试 | B8/B11 | 待开始 |
| V2-B13-OFS-006 | 官网价格、权益说明、下载和活动页消费公开只读投影；登录/结算只做安全跳转，不写订单 | official-site、Gateway | 未发布价格、维护中、地区/资格提示、UTM 保留、登录回跳、无订单 API 调用测试 | B9-OFS-006/001 | 待开始 |
| V2-B13-FE-007 | 迁移学习端结算/权益和后台商业/风控/对账/客服交互 | mobile、learner-web、admin-web | 价格变化、权益恢复、支付关闭、权限、审批/工单状态交互测试 | 001–005 | 待开始 |
| V2-B13-TEST-008 | 建立商业化与运营的逻辑/交互测试包 | 相关服务/四端 | 官网→登录→结算意图→权益投影→后台审计的模拟回放；不触发真实支付 | 001–007 | 待开始 |

### B13 执行记录（2026-08-22，代码层）

本轮按“契约/迁移 → 服务边界 → Gateway → 四端交互 → 逻辑验证”完成 B13 代码层切片。支付真实渠道保持 Gate 关闭；官网只消费公开投影并安全跳转；admin-ops 只读聚合并转发命令，不复制 commerce、content 或 learner 领域事实。以下为本轮执行结果，不把 Java 25/Maven、真实支付、自有 JWT、Kafka、MySQL、浏览器或设备运行态误报为已验收。

| 任务 | 代码层证据 | 当前验收结论 |
|---|---|---|
| `V2-B13-COM-001` | `services/commerce-service`：SKU 版本、价格快照、订单、权益、激活码、退款、对账、tenant/owner PEP、Audit/Outbox seam；V0021 `com_b13_*` | 纯 Java smoke 通过；持久化 adapter、真实 HTTP/数据库留待测试阶段 |
| `V2-B13-COM-002` | Provider port、sandbox HMAC 验签、金额/币种/订单绑定、重复回调、恢复/取消和 `PaymentGate` 默认关闭；服务侧 JWT/workload callback 边界 | 纯 Java smoke 通过；真实微信/支付宝/Apple provider 不在本轮启用 |
| `V2-B13-ADM-003` | `services/admin-ops-service`：投影查询、权限/租户隔离、作者与操作者分离、审批二次确认、命令幂等、不可变审计；admin-web B13 订单/工单/指标页 | Pure Java smoke 通过；真实 JWT、领域命令 adapter 和持久化留待测试阶段 |
| `V2-B13-ANL-004` | `services/analytics-service`：B10/B12/B13 显式事件 allowlist、PII/支付/音频/答案字段拒绝、dedupe、指标投影、回放重算和写入幂等键 | B13 analytics smoke 通过；Kafka/worker durable 运行态留待测试阶段 |
| `V2-B13-SUP-005` | admin-ops 支持工单、SLA、脱敏视图、MediaObjectRef 附件引用权限和通知命令 seam | admin-ops smoke 覆盖附件、SLA、越权、恢复和审计；真实 media/notification 联调留待测试阶段 |
| `V2-B13-OFS-006` | `apps/official-site` 价格/权益/活动公开投影、状态降级、UTM 保留、自有登录/结算受控跳转；不创建订单、不调用支付写接口 | 官网子进程报告 5/5 B13、8/8 B7，Nuxt SSR build 通过；真实 Gateway/CDN/JWT 登录留待测试阶段 |
| `V2-B13-FE-007` | learner-web/mobile 迁移 `/commerce` Gateway canonical 路径和 `payment-intents`；admin-web 接入订单/工单/指标只读投影和审批命令；继续共享 i18n/design-token | learner-web、admin-web build 与 mobile H5 build 通过；浏览器、App/小程序/真机矩阵留待测试阶段 |
| `V2-B13-TEST-008` | `tests/b13` 契约、事件、V0021、三端 commerce 边界、官网只读、安全、服务幂等/脱敏/默认拒绝测试 | 12/12 通过；不替代跨进程、基础设施、支付和浏览器验收 |

本轮统一接线：Gateway B13 路由与 `18096/18097/18098` 固定端口已登记；OpenAPI/AsyncAPI 已合并为 canonical；V0021 已进入 migration manifest；`config:check` 与 `ports:check` 通过。

完整交接证据见 [`docs/07-operations/b13-validation.md`](../../docs/07-operations/b13-validation.md)。

---

## 11. B14 — Phase 1 收敛、Strangler 退出与代码级全链路回归（6 项）

**批次目标**：在代码层关闭 Phase 1 的跨服务所有权、兼容路由和前端入口缺口，为后续运行态验收准备可回放的迁移/回滚代码。  
**主要引用**：v2 03/04/07 的 Phase 1/CROSS 已细化单元；`ARCH-SVC-001`、`ARCH-LCM-001`、`ARCH-REL-001`、`ARCH-OBS-001`、`ARCH-DR-001`。

| 任务 ID | 代码目标 | 服务/前端宿主 | 逻辑与交互测试 | 依赖 | 初始状态 |
|---|---|---|---|---|---|
| V2-B14-MIG-001 | 为 learner/content/learning/assessment/media/gamification/social/commerce 建立逐域数据迁移、只读影子和对账代码 | 目标服务、core-api adapter | 行数/版本/汇总对账、重复迁移、失败补偿、回退读路径测试 | B9–B13 | 待开始 |
| V2-B14-GW-002 | 逐域切换 Gateway 路由与兼容弃用窗口，保留可配置回滚但禁止新增 `core-api` 跨域写入 | Gateway、core-api adapter | 路由切换、旧客户端兼容、弃用警告、回滚、直连拒绝测试 | 001/B8 | 待开始 |
| V2-B14-SEC-003 | 执行服务 owner、schema 权限、PEP、TenantScope、秘密和事件 payload 的静态/集成扫描 | 全服务/CI | 跨服务 SQL、共享 entity、客户端 role/tenant、PII 事件、fail-closed 回归测试 | 001/002 | 待开始 |
| V2-B14-CROSS-004 | 收敛 Outbox、消费者去重、Saga/补偿、DLQ/replay 和 API/事件/数据库兼容窗口代码 | 平台与所有领域服务 | 断点/重复/乱序/失败重试、旧 schema、补偿和人工恢复逻辑测试 | B10–B13 | 待开始 |
| V2-B14-FE-005 | 统一四前端的 Gateway base URL、深链返回、八态文案、Feature/Phase Gate、locale/theme 和官网公开边界 | mobile、learner-web、admin-web、official-site | 四项目路由/返回、Loading/Empty/Error/Permission/Recovery、locale/theme 切换/恢复、无颜色单独传达状态、官网无登录业务状态测试 | B8–B13/B7-FE-007 | 待开始 |
| V2-B14-TEST-006 | 建立 Phase 1 代码级回归包和迁移证据索引 | 全仓测试 | 目标→学习→媒体→成长/社群→权益→后台/官网的 mock/容器化逻辑回放；不代替真实基础设施或真机验收 | 001–005 | 待开始 |

**B14 后状态**：允许宣称“Phase 1 v2 代码层重塑完成并可进入运行/设备测试准备”；仍不得宣称生产迁移、支付上线、真实媒体/RTC、备份恢复或服务抽取运行态已完成。

### B14 执行记录（2026-08-22，代码层）

本轮按“迁移兼容 → Gateway 收敛 → 安全边界 → 可靠性 → 四端入口 → 全链路回归”完成 B14 代码层开发。以下证据只覆盖逻辑/静态/构建验证，不把 Java 25/Spring Boot 运行态、真实数据库/消息总线、生产迁移或浏览器/设备验收误报为完成。

| 任务 | 代码层证据 | 当前验收结论 |
|---|---|---|
| `V2-B14-MIG-001` | `services/core-api/src/main/java/com/englishflow/modules/b14/B14MigrationCompatibilityAdapter.java`：8 域批次、版本/行数/摘要对账、shadow 状态、重复迁移、失败补偿、fallback read、TenantScope 和客户端事实拒绝 | Java 17 目标纯 Java smoke 通过；真实 MySQL/目标服务/生产迁移留待测试阶段 |
| `V2-B14-GW-002` | `services/api-gateway` B14 route matrix、8 个目标服务 URL、TARGET/SHADOW/LEGACY/FALLBACK 配置、兼容 GET/HEAD 和 `Deprecation`/`Sunset`、authority header 清理 | B14 Gateway 静态测试通过；Java 25/Maven、真实跨进程路由和网络直连策略留待测试阶段 |
| `V2-B14-SEC-003` | `scripts/security/verify-b14-boundaries.mjs`：服务 owner/schema/PEP/TenantScope、SQL/秘密、客户端 authority、事件 payload 和默认拒绝扫描 | 12 服务、551 源文件、13 事件片段扫描通过；CI 镜像/JWKS/数据库权限/KMS 留待测试阶段 |
| `V2-B14-CROSS-004` | `services/service-template/src/main/java/com/englishflow/platform/template/reliability/B14ReliabilityLedger.java`：规范化、去重、乱序、重试、DLQ、replay、幂等、Saga 补偿/人工恢复 | `-Xlint:all -Werror` 与纯 Java smoke 通过；Kafka/Outbox durable adapter 和 worker 留待测试阶段 |
| `V2-B14-FE-005` | 四端 platform foundation：Gateway base URL、safe deep-link、8 UI states、server-only Feature/Phase Gate、UI/content locale、theme 恢复；官网仅公开投影 | learner-web/admin-web/official-site、mobile H5/App/微信小程序构建通过；浏览器/PWA/真机/iPad/无障碍矩阵留待测试阶段 |
| `V2-B14-TEST-006` | `tests/b14` 迁移/可靠性/strangler/安全/Phase 1 synthetic chain 回归包及 `docs/07-operations/b14-validation.md` 证据索引 | B14 6/6，B12 7/7，B13 12/12；容器化跨进程旅程和真实基础设施不在代码层完成定义内 |

统一回归：契约校验通过（402 operations、476 schemas、144 events），兼容性 diff 为 0 breaking，21 个数据库迁移、固定端口、运行配置和 v2 任务基线检查全部通过。

完整交接证据见 [`docs/07-operations/b14-validation.md`](../../docs/07-operations/b14-validation.md)。

---

## 12. B15 — Phase 1 运行环境与基础设施（6 项）

**批次目标**：把 B7–B14 的代码骨架变成可重复启动、可观测、可迁移和可回滚的 Phase 1 测试运行态。真实生产凭证不进入仓库，所有夹具使用合成或脱敏数据。
**主要引用**：`ARCH-PLAT-001`、`ARCH-DEP-001`、`ARCH-DATA-001`、`ARCH-OBS-001`、`ARCH-REL-001`。

| 任务 ID | 代码/运行目标 | 服务/基础设施宿主 | 逻辑与运行态测试 | 依赖 | 初始状态 |
|---|---|---|---|---|---|
| V2-B15-ENV-001 | 锁定 Java 25、Maven、Spring BOM、容器 JRE、版本清单和 CI 构建矩阵 | `services/*`、`.github`、版本清单 | 版本漂移、构建可重复、JDK/依赖拒绝和 SBOM 生成测试 | B14 | 待开始 |
| V2-B15-INF-002 | 建立本地 Docker Compose/测试容器编排：MySQL、Redis、Kafka 兼容总线、MinIO 和观测依赖 | `infra/`、`config/`、Docker | 健康检查、固定端口、凭证注入、网络隔离、重启恢复和无 Docker 明确失败测试 | 001 | 待开始 |
| V2-B15-RUN-003 | 让 Gateway、IAM、目标服务和兼容 Core API 以独立进程启动并提供 health/readiness/优雅停机 | `services/*`、启动脚本 | 进程隔离、端口冲突、readiness、优雅停机和直连边界测试 | 001/002 | 待开始 |
| V2-B15-DATA-004 | 执行每服务独立 schema/Flyway、Redis namespace、合成 fixture、迁移锁和回滚影子验证 | `database/`、各服务 | 空库迁移、重复迁移、失败恢复、TenantScope、脱敏 fixture 和回滚测试 | 002/003 | 待开始 |
| V2-B15-OBS-005 | 接通 requestId/traceId、OTel、结构化日志、指标、审计和本地故障诊断 | Gateway、服务模板、Collector | trace 贯通、敏感字段脱敏、日志关联、指标缺失和审计落盘测试 | 003 | 待开始 |
| V2-B15-TEST-006 | 建立一键 bootstrap、环境预检和 Phase 1 运行态 smoke evidence 包 | `scripts/`、`tests/runtime` | 全栈启动、健康矩阵、迁移/Redis/Kafka/对象存储 smoke 和清理恢复测试 | 001–005 | 待开始 |

### B15 执行记录（2026-08-22）

上表“初始状态”是任务设计快照；本节记录本次实际执行结果。B15 当前为“代码与静态预检完成、真实运行态阻塞”，不能标记为 B15 全部完成。

| 任务 | 本次结果 | 已验证证据 | 未完成边界 |
|---|---|---|---|
| `V2-B15-ENV-001` | 代码/静态完成；运行时阻塞 | `config/toolchain-baseline.json`、14 个 v2 POM 的 Java 25/Spring Boot 4.1.1/Enforcer 静态检查通过 | 本机 Java 24、Maven unavailable；Java 25/Maven 构建与 SBOM 未执行 |
| `V2-B15-INF-002` | 编排与固定端口静态完成 | Kafka KRaft、MySQL、Redis、MinIO、RabbitMQ 兼容依赖；5 个依赖、7 个固定绑定静态检查通过 | Docker 未安装/未启动；健康检查、重启恢复、网络隔离未取得运行证据 |
| `V2-B15-RUN-003` | 启动清单与独立进程运行器代码完成 | `config/v2-runtime-services.json` 验证 14 个服务；`services:run` 强制 Java 25、固定端口和 health/readiness，并在失败时停止已启动子进程 | Java 服务未启动；端口冲突、优雅停机和跨进程 readiness 未取得运行证据 |
| `V2-B15-DATA-004` | 迁移/夹具静态完成 | 21 个仓库迁移、合成 fixture、配置和破坏性清理防护检查通过 | 未连接真实 MySQL；每服务 schema/Flyway、迁移锁、失败恢复和回滚影子未验证 |
| `V2-B15-OBS-005` | 基线代码与静态检查完成 | service-template 已具备 requestId/traceId、OTel、Actuator 探针、优雅停机和 MDC 关联基线 | Collector、跨服务 trace、指标/审计落盘和故障诊断需 B16/B17 运行态验证 |
| `V2-B15-TEST-006` | 静态 smoke 包完成；运行 smoke 阻塞 | `pnpm test:b15` 5/5、`pnpm b15:static` 通过；`b15-bootstrap` 默认拒绝伪造运行时 | 需 Java 25、Maven 和 Docker 后重跑真实 bootstrap/健康矩阵 |

完整证据与阻塞说明见 [`docs/07-operations/b15-validation.md`](../../docs/07-operations/b15-validation.md)。

---

## 13. B16 — Phase 1 Gateway、自有 JWT Bearer 与 IAM/RBAC 运行态（6 项）

**批次目标**：把 B8 的权限代码切片接入平台自有 IAM JWT 和跨进程链路；Phase 1 只允许 18+ 成人与大学生，默认拒绝，不能创建 K12 主体事实。
**主要引用**：`ARCH-GW-001`、`ARCH-IAM-001`、`ARCH-IAM-002`、`ARCH-SEC-001`。

| 任务 ID | 代码/运行目标 | 服务/基础设施宿主 | 逻辑与运行态测试 | 依赖 | 初始状态 |
|---|---|---|---|---|---|
| V2-B16-GW-001 | 启动真实 Gateway `/api/v1` 路由、CORS、限流、requestId/traceId、错误 envelope 和直连阻断 | `services/api-gateway` | 路由、限流、Origin、超时、错误映射、直连拒绝和兼容回退测试 | B15 | 待开始 |
| V2-B16-AUTH-002 | 建设平台自有账号密码 JWT：JWT/JWKS、refresh rotation、会话撤销和密钥轮换 | `services/iam-service`、IAM JWT | 账号密码、JWT issuer/audience/算法/过期、JWKS 缓存、刷新重放、撤销、轮换和认证中心不可用 fail-closed 测试 | 001 | 待开始 |
| V2-B16-IAM-003 | 建立 principal、platform tenant、设备、会话、成人年龄 Gate、同意和审计事实的真实持久化 | `iam-service`、IAM schema | 重复登录、设备撤销、年龄缺失/未满 18、租户派生、注销和审计回放测试 | 002/B15-DATA-004 | 待开始 |
| V2-B16-PEP-004 | 在 Gateway 与所有领域服务启用 Resource Server、RBAC+ABAC PEP、策略版本和安全缓存 | Gateway、服务模板、目标服务 | owner/phase/tenant/content-rights、401/403、过期策略和 PDP 不确定时拒绝测试 | 003 | 待开始 |
| V2-B16-MTL-005 | 建立服务间 workload identity、mTLS/凭证边界、密钥轮换和伪造 authority 清理 | 服务间网络、Vault/KMS 测试替身 | 客户端角色头、tenant/owner 伪造、服务账号混用、证书过期和最小权限测试 | 004 | 待开始 |
| V2-B16-TEST-006 | 建立 Gateway→IAM→PEP 的端到端权限回归包和 G-IAM-JWT 运行证据 | `tests/b16`、四端 auth seam | 登录/刷新/登出、权限拒绝、深链、跨租户、撤销和故障恢复浏览器/API 测试 | 001–005 | 待开始 |

### B16 执行记录（2026-08-23）

本节记录本次实际开发，不覆盖上表的“初始状态”设计快照。B16 的 Gateway、自有 JWT Bearer/IAM、服务侧 PEP、workload identity 边界和静态回归入口已经整合完成；真实跨进程登录、刷新、注销、撤销、跨租户拒绝和故障恢复仍必须在 Java 25、Docker/等价基础设施以及 IAM 测试账号就绪后取得运行证据，不能用静态通过替代。

| 任务 | 当前状态 | 已交付 | 尚未取得的证据 |
|---|---|---|---|
| `V2-B16-GW-001` | 代码/静态完成；运行阻塞 | B16 Gateway 安全清单、固定端口、CORS/真实固定窗口限流/关联 ID/错误 envelope/伪造 authority 清理 | 真实 Gateway 路由、限流窗口、Origin、超时、直连阻断和兼容回退运行结果 |
| `V2-B16-AUTH-002` | 代码/逻辑测试完成；IAM 运行阻塞 | 自有账号密码、RS256 JWT profile、JWKS 时效与轮换、refresh/session/revocation 测试替身 | IAM 测试账号登录、JWT/JWKS 缓存/轮换、刷新重放、认证中心故障 fail-closed 运行结果 |
| `V2-B16-IAM-003` | 领域端口/逻辑完成；持久化运行阻塞 | principal/tenant/device/session/adult Gate/consent/audit 的服务边界与 Phase 1 18+ 约束 | 真实 IAM schema 持久化、重复登录、设备撤销、注销和审计回放结果 |
| `V2-B16-PEP-004` | 代码/静态完成；运行阻塞 | Gateway 与 11 个领域服务 Resource Server/PEP、RBAC+ABAC、策略版本和默认拒绝边界 | 所有领域服务的 401/403、owner/phase/tenant/content-rights、过期策略和 PDP 不确定拒绝运行结果 |
| `V2-B16-MTL-005` | 代码/静态完成；平台证书阻塞 | workload identity、mTLS/凭证边界、伪造 authority 清理和最小权限安全约束 | 证书过期、凭证轮换、服务账号混用和跨进程最小权限运行结果 |
| `V2-B16-TEST-006` | 静态回归完成；E2E 阻塞 | `test:b16` 6/6、`b16:static`、Java 纯 IAM 编译和运行前置条件清单 | 浏览器/API E2E、四端深链、跨租户、撤销和故障恢复 evidence |

---

## 14. B17 — Phase 1 领域服务、数据与事件运行态（6 项）

**批次目标**：完成领域服务的独立进程、独立 schema、真实 API/事件适配和关键学习闭环回放，不再以目录或纯 Java smoke 代替运行证据。
**主要引用**：`ARCH-SVC-001`、`ARCH-DATA-001`、`ARCH-EVT-001`、`ARCH-REL-001`。

| 任务 ID | 代码/运行目标 | 服务/基础设施宿主 | 逻辑与运行态测试 | 依赖 | 初始状态 |
|---|---|---|---|---|---|
| V2-B17-SVC-001 | 将 learner/content/learning/assessment/media/gamification/social/commerce/notification/analytics/admin-ops 按 owner 独立启动、注册和发布 | `services/*`、部署清单 | 独立进程/schema/凭据、健康探针、服务发现、故障隔离和回滚测试 | B15/B16 | 待开始 |
| V2-B17-READ-002 | 打通 learner→content→learning 的课程、目标、内容版本、版权和今日任务读链路 | learner/content/learning、Gateway | 版本一致、版权撤回、空数据、权限、缓存失效和旧 Core API shadow 对账测试 | 001 | 待开始 |
| V2-B17-WRITE-003 | 打通练习提交→assessment 判分→learning 掌握度/SRS 投影的关键写链路 | learning/assessment/content | 幂等提交、重复点击、断点恢复、错因、D+1/D+7 和唯一 owner 测试 | 002 | 待开始 |
| V2-B17-EVT-004 | 让 Outbox、Kafka 兼容总线、消费者去重/重试/DLQ/replay/Saga 在真实测试运行态工作 | 各服务、workflow、Kafka | 至少一次投递、乱序、重复、毒消息、补偿、回放和人工恢复测试 | 003 | 待开始 |
| V2-B17-PLT-005 | 接通 media/notification/offline、gamification/social、commerce/admin/analytics 的跨域只读投影与命令边界 | B11–B13 目标服务、四端 | 媒体授权、离线 cursor、可信奖励、订单权益、工单/指标脱敏和跨域写入拒绝测试 | 004 | 待开始 |
| V2-B17-TEST-006 | 建立跨服务合成旅程、迁移 shadow/rollback 和事件对账 evidence 包 | `tests/integration`、workflow | 目标读链、关键写链、失败补偿、旧新对账、回滚和审计 trace 回放测试 | 001–005 | 待开始 |

### B17 执行记录（2026-08-23）

本节记录本次实际开发，不覆盖上表的“初始状态”设计快照。B17 已完成独立服务清单与 schema/凭据/端口边界、跨服务读写链路端口、平台投影边界、Outbox/事件去重重试/DLQ/replay/Saga 代码切片和合成旅程回归。真实 11 个 Java 25 服务、Gateway、MySQL、Kafka、IAM JWT 和跨进程 E2E 仍受本机 Java 24、Maven/Docker 不可用及测试账号未注入阻塞，不能以静态或 pure-Java smoke 代替运行证据。

| 任务 ID | 当前状态 | 已交付证据 | 运行态剩余 |
|---|---|---|---|
| `V2-B17-SVC-001` | 代码/静态完成；真实启动阻塞 | `config/b17-runtime-services.json` 声明 11 个独立服务、schema、凭据、固定端口、readiness、依赖和回滚 owner；manifest validator 通过 | Java 25/Maven、数据库、服务发现、独立进程健康/故障隔离/回滚 |
| `V2-B17-READ-002` | 代码/合成回归完成；跨进程阻塞 | learner→content→learning 读链验证 owner、content version、rights、cache invalidation、empty/denied/recovery | Gateway/真实服务/旧 Core API shadow 对账 |
| `V2-B17-WRITE-003` | 代码/合成回归完成；跨进程阻塞 | assessment 服务端判分、幂等提交、重复事件去重、mastery projection 和补偿边界 | MySQL 持久化、断点恢复、D+1/D+7、真实 assessment→learning |
| `V2-B17-EVT-004` | 代码/静态完成；Kafka 运行阻塞 | bounded Outbox、顺序/去重、有限重试、DLQ/replay、Saga compensation pure-Java smoke 通过 | Kafka 至少一次投递、毒消息、回放、人工恢复 |
| `V2-B17-PLT-005` | 边界代码/静态完成；适配器运行阻塞 | 7 个平台域的 fact owner、投影消费者、trusted event allowlist、禁止跨域写入矩阵 | media/notification/offline、growth/social、commerce/admin/analytics 真实投影/命令 |
| `V2-B17-TEST-006` | 静态/合成 evidence 完成；真实 E2E 阻塞 | `test:b17` 17/17、`b17:static`、合成旅程 JSON、契约/端口/DoD/任务门禁通过 | 跨服务 trace、迁移 shadow/rollback、Kafka/数据库对账 |

### B18 执行记录（2026-08-23）

B18 已完成四端代码层联调骨架、真实 Gateway 客户端边界、恢复状态、权限确认、公开公告投影和合成账号矩阵。learner-web 的 /learn 与 /courses 已移除占位页并接入 learner/content read model、复习队列和日报告；mobile 学习流接入复习队列与幂等完成命令；admin-web 新增最小权限保护的客服工单工作台、二次确认、脱敏投影和幂等命令；official-site 新增公开公告页并纳入 SSR/预渲染；四端继续共享 UI locale/contentLocale、主题 Token 和性能边界。B18 只覆盖 Phase 1，不注册 AI、实时 AI 或 K12 默认入口。协作子进程按要求使用 gpt-5.6-luna / max 完成审查分工，但未产生可直接合并的文件，主 Agent 已完成整合与验收。

| 任务 ID | 当前状态 | 已取得证据 | 尚未取得的运行态证据 |
|---|---|---|---|
| `V2-B18-LRN-001` | 代码/静态完成；真实 API/浏览器阻塞 | 学习闭环页、课程页、路由守卫沿用、contentLocale、幂等复习/任务命令、恢复/权限/离线状态；learner-web typecheck/build 通过 | Gateway + IAM JWT 测试账号、真实 learner/content/learning/assessment、浏览器深链/登出/八态 |
| `V2-B18-MOB-002` | 代码/静态完成；App/小程序/设备阻塞 | uni-app H5 build、secure storage 既有边界、移动复习队列/幂等命令、离线错误状态 | App/微信条件编译、真机媒体权限、后台恢复、四级画质和弱网 |
| `V2-B18-ADM-003` | 代码/静态完成；真实 admin-ops 阻塞 | /support 权限守卫、最小权限、二次确认、脱敏字段、幂等命令、admin-web build | IAM JWT 最小权限账号、审批/重复命令/审计落盘和真实恢复任务 |
| `V2-B18-OFS-004` | 代码/静态完成；公开投影运行阻塞 | 公告页、课程/价格/下载/合规公开投影、受控深链、SSR/预渲染 9 个页面入口 | Gateway public projection、断链/下载禁用/缓存恢复的浏览器证据 |
| `V2-B18-DSN-005` | 代码/静态完成；视觉/设备阻塞 | 四端 i18n/theme 静态门禁、亮暗/系统/高对比、fallback/伪本地化、Token 适配；四端构建通过 | hydration 无闪烁、实际对比度、低配降级、浏览器/真机视觉检查 |
| `V2-B18-TEST-006` | 合成矩阵/静态回归完成；真实联调阻塞 | tests/b18 7/7、四端固定 origin/合成账号矩阵、无凭证/无客户端权限事实、B18 bootstrap 静态门禁 | Playwright/浏览器、真实 API 账号矩阵、H5/App/小程序和恢复交互证据 |

---

## 15. B18 — 四端真实 API 联调与功能闭环（6 项）

**批次目标**：让四个前端通过 Gateway 使用真实测试服务完成 Phase 1 核心流程；不添加 Phase 2/3 菜单、路由或营销入口。
**主要引用**：v2 01/03/04/07、`ARCH-API-001`、`ARCH-IAM-002`、`ARCH-OBS-001`。

| 任务 ID | 代码/交互目标 | 前端宿主 | 逻辑与交互测试 | 依赖 | 初始状态 |
|---|---|---|---|---|---|
| V2-B18-LRN-001 | learner-web 接通登录、Onboarding、测评、Home、课程、练习、SRS、报告和恢复状态 | `apps/learner-web` | 真实 API、路由守卫、八态、幂等、刷新/登出、深链和错误恢复测试 | B16/B17 | 待开始 |
| V2-B18-MOB-002 | mobile H5/App/微信小程序条件编译接通认证、学习、媒体、离线和性能降级 | `apps/mobile` | H5/App/小程序条件编译、secure storage、断网恢复、媒体权限和四级画质测试 | 001 | 待开始 |
| V2-B18-ADM-003 | admin-web 接通内容审核、运营、订单、客服、权限、审计和恢复工作台 | `apps/admin-web`、admin-ops | 最小权限、二次确认、脱敏、审批、重复命令和错误/恢复测试 | B16/B17 | 待开始 |
| V2-B18-OFS-004 | official-site 接通公开内容/价格/下载/公告/合规投影和受控深链 | `apps/official-site` | SSR/SSG、SEO、公开/登录边界、投影降级、断链和下载禁用测试 | B17 | 待开始 |
| V2-B18-DSN-005 | 统一四端 i18n、UI/content locale、亮暗系统高对比主题、Token、非颜色状态和性能引擎 | `packages/i18n`、`packages/design-tokens`、四端 | fallback、伪本地化、持久化、hydration 无闪烁、对比度和低配降级测试 | 001–004 | 待开始 |
| V2-B18-TEST-006 | 建立四端真实 API 组件/浏览器联调回归包和合成账号矩阵 | 四端、`tests/frontend` | 首日路径、学习闭环、后台审批、官网公开路径、权限深链和恢复交互测试 | 001–005 | 待开始 |

---

## 16. B19 — 系统测试、浏览器、设备与性能（6 项）

**批次目标**：完成从契约到真实测试运行态的系统级验证，形成可审计的缺陷、覆盖率和设备证据；这一批次是上线前的质量主体。
**主要引用**：`ARCH-REL-001`、`ARCH-OBS-001`、`ARCH-SEC-001`；`requirements/acceptance-criteria.md` K/L。

| 任务 ID | 测试目标 | 测试宿主 | 必须验证 | 依赖 | 初始状态 |
|---|---|---|---|---|---|
| V2-B19-API-001 | 执行 OpenAPI/AsyncAPI/JSON Schema、生成客户端和兼容性回归 | contracts、Gateway、服务 | 0 breaking、错误 envelope、版本、幂等键、trace 传播和事件 schema 测试 | B17/B18 | 待开始 |
| V2-B19-E2E-002 | 执行跨服务端到端学习旅程与数据/事件对账 | 真实测试环境、Kafka、MySQL | 登录→目标→学习→提交→判分→复习→报告→通知全链路及失败补偿测试 | 001 | 待开始 |
| V2-B19-BRW-003 | 执行四端浏览器矩阵、八态、公开/登录、权限、键盘和响应式测试 | Playwright/Chromium、四端 | Chrome/Edge/Safari 兼容、路由、表单、深链、空/错误/恢复和 Console 零错误测试 | B18 | 待开始 |
| V2-B19-DEV-004 | 执行 H5、iOS、Android、iPad、PWA、微信小程序的设备与权限测试 | 真机/模拟器/设备云 | 安装、升级、secure storage、媒体权限、横竖屏、后台恢复和系统返回键测试 | 003 | 待开始 |
| V2-B19-QA-005 | 执行弱网、离线、性能、可访问性、国际化和主题专项测试 | 网络代理、性能工具、读屏 | 2G/3G/断网、LCP/交互响应、四级画质、键盘/读屏、对比度、fallback 和状态非颜色表达测试 | 003/004 | 待开始 |
| V2-B19-TEST-006 | 建立缺陷分级、回归选择、证据索引和测试报告自动生成 | `tests/`, CI、报告仓库 | P0/P1 清零、P2 有处置、失败可复现、证据链接完整和回归门禁测试 | 001–005 | 待开始 |

---

### B19 执行记录（2026-08-23）

B19 已完成代码层系统测试基础：契约/生成客户端回归、合成学习闭环、浏览器与设备矩阵、弱网/性能/无障碍/i18n/theme 质量门禁、缺陷分级/回归选择/证据索引和报告 Schema。三组协作子进程均按要求使用 `gpt-5.6-luna / max`，主线已审查并整合；真实 Gateway、IAM JWT、Kafka、MySQL、浏览器、真机、读屏和性能工具仍保持 runtime blocked，不以静态 fixture 冒充运行通过。

| 任务 ID | 当前状态 | 已取得证据 | 尚未取得的运行态证据 |
|---|---|---|---|
| `V2-B19-API-001` | 代码/静态完成；真实契约运行阻塞 | `b19-api-contract.test.mjs`、402 operations、476 schemas、144 events、5 generated files、0 breaking、错误 envelope、幂等键和 trace/schema 校验 | Gateway/真实服务契约请求、跨版本兼容和真实 trace |
| `V2-B19-E2E-002` | 合成 E2E 完成；跨服务运行阻塞 | 登录→目标→学习→提交→判分→复习→报告→通知、幂等重放、失败补偿、事件回放、对账和客户端 authority 拒绝 | IAM JWT/Gateway/MySQL/Kafka/11 服务真实链路、Outbox/DLQ/回放 |
| `V2-B19-BRW-003` | 代码/静态矩阵完成；浏览器运行阻塞 | 4 应用、4 browser runtime、8 状态、18 场景、固定 origin、权限/键盘/响应式和 no-fake-pass evidence contract；浏览器矩阵 validator 通过 | Playwright Chromium/Edge/WebKit、原生 Safari、Console/页面错误和深链证据 |
| `V2-B19-DEV-004` | 代码/静态矩阵完成；设备运行阻塞 | 9 device profiles 覆盖 H5/iOS/Android/iPad/PWA/微信小程序、secure storage、媒体权限、横竖屏、后台恢复、返回键 | 真机/模拟器/设备云安装升级、媒体权限和后台恢复 |
| `V2-B19-QA-005` | 代码/静态质量门禁完成；专项运行阻塞 | 10 quality gates、24 evidence index、11 runtime pending；弱网、离线、LCP/INP、四级画质、读屏、对比度、i18n/theme、状态 fallback | 网络代理、Lighthouse/性能、真机画质、读屏/对比度和视觉证据 |
| `V2-B19-TEST-006` | 代码/静态证据门禁完成；真实报告阻塞 | P0/P1/P2 policy、回归选择、证据索引、报告 JSON Schema、`test:b19` 23/23、`b19:static` 通过 | CI/浏览器/设备真实回归、缺陷报告自动生成和完整 artifact 索引 |

---

## 17. B20 — 安全、隐私、内容、支付与灾备 Gate（6 项）

**批次目标**：完成 Phase 1 上线前的安全、隐私、内容版权、商业化和恢复能力验收；真实支付仍必须以渠道资质和 sandbox 证据为前提。
**主要引用**：`ARCH-SEC-001`、`ARCH-DR-001`、`ARCH-REL-001`、`ARCH-IAM-002`。

| 任务 ID | Gate 目标 | 宿主 | 必须验证 | 依赖 | 初始状态 |
|---|---|---|---|---|---|
| V2-B20-SEC-001 | 完成 SAST、依赖/镜像扫描、秘密扫描、SBOM、KMS/Vault 和最小权限审计 | CI、镜像仓库、运行环境 | 高危漏洞、泄露凭证、供应链、容器用户、网络和权限边界测试 | B19 | 待开始 |
| V2-B20-PRI-002 | 完成隐私告知、同意、账号注销/导出、留存删除、脱敏和审计回放 | IAM、learner、admin-ops | 访问/撤回/删除/导出、超范围字段、后台越权和审计完整性测试 | 001/B16 | 待开始 |
| V2-B20-CNT-003 | 完成 Phase 1 内容来源、版权、双审、发布/下线/回滚和官方公示验收 | content、admin-ops、official-site | 草稿隔离、版权缺失拒绝、双人审批、撤回传播和版本恢复测试 | B17/B18 | 待开始 |
| V2-B20-COM-004 | 完成权益、激活码、支付 sandbox、回调验签、退款、对账和默认关闭 Gate | commerce、admin-web、渠道 sandbox | 重放/伪造回调、金额绑定、退款降级、支付失败和无资质拒绝测试 | B17/B18 | 待开始 |
| V2-B20-DR-005 | 完成备份/PITR、RPO/RTO、恢复演练、故障注入、SLO、告警和应急 Runbook | MySQL、Redis、Kafka、对象存储、OTel | 数据恢复、消息重放、服务降级、人工接管和恢复后对账测试 | B15/B17/B19 | 待开始 |
| V2-B20-TEST-006 | 汇总安全、隐私、版权、支付和灾备证据，形成上线阻断清单 | CI、审计、发布工作台 | Gate 缺项阻断、双人复核、风险接受记录和可回滚结论测试 | 001–005 | 待开始 |

### B20 执行记录（2026-08-23）

B20 已完成代码与静态 Gate 基础，三组协作子进程均按要求使用 `gpt-5.6-luna / max`；真实安全扫描、隐私主体请求、内容版权审核、支付 sandbox、备份恢复和发布复核仍保持 runtime blocked，不以 synthetic fixture 或静态 validator 冒充上线证据。

| 任务 ID | 当前状态 | 已取得证据 | 尚未取得的运行态证据 |
|---|---|---|---|
| `V2-B20-SEC-001` | 代码/静态完成；真实安全运行阻塞 | `config/b20-security-gates.json`、10 个静态检查、SAST/依赖/镜像/秘密/SBOM/KMS/Vault/最小权限/mTLS/签名边界、`test:b20` 安全 7/7 | CI 扫描、镜像仓库、KMS/Vault、Kubernetes、mTLS 和签名 artifact |
| `V2-B20-PRI-002` | 代码/静态完成；真实隐私运行阻塞 | `config/b20-privacy-content-gates.json`、7 个静态检查、告知/同意/撤回/导出/注销/留存/脱敏/审计回放规则、测试 6/6 | 隔离主体请求、删除/法律保留、越权拒绝和审计完整性回放 |
| `V2-B20-CNT-003` | 代码/静态完成；真实内容运行阻塞 | 版权来源、草稿隔离、双人审批、发布/下线/回滚及 official-site 只读投影规则、测试 6/6 | 真实授权、双人审核、撤回传播、版本恢复和官网投影 |
| `V2-B20-COM-004` | 代码/静态完成；支付 sandbox 运行阻塞 | sandbox-only/默认关闭、回调验签、金额绑定、重放、退款、对账和权益边界，测试 8/8 | 渠道资质、sandbox 回调、伪造/重放/退款和对账 artifact；live provider 禁止 |
| `V2-B20-DR-005` | 代码/静态完成；灾备运行阻塞 | MySQL/Redis/Kafka/对象存储备份、PITR/RPO/RTO、故障注入、SLO/告警、Runbook、人工接管和恢复对账规则 | 隔离恢复演练、实际 RPO/RTO、消息重放、对象校验和恢复后对账 |
| `V2-B20-TEST-006` | 代码/静态证据汇总完成；发布 Gate 阻塞 | 7 个 quality gates、22 个 evidence index、15 个运行证据 pending、双人复核/风险接受/回滚报告 Schema、`test:b20` 总计 22/22 | artifact 哈希、双人复核、风险接受和 rollback drill 结论 |

统一静态验证：`pnpm b20:static`、`pnpm tasks:v2:check`、契约校验/生成/兼容均通过。`pnpm b20:bootstrap --require-runtime` 按设计失败并保留 Java 24、Maven/Docker、B16/B19 依赖和 B20 外部证据变量阻塞。完整记录见 [`docs/07-operations/b20-validation.md`](../../docs/07-operations/b20-validation.md)。

---

## 18. B21 — 预发布、发布候选与 Go/No-Go（6 项）

**批次目标**：建立与生产等价的 staging、发布候选版本和正式 Go/No-Go 机制，不能用开发环境 HTTP 200 代替发布证据。
**主要引用**：`ARCH-DEP-001`、`ARCH-REL-001`、`ARCH-OBS-001`、`ARCH-DR-001`。

| 任务 ID | 发布目标 | 宿主 | 必须验证 | 依赖 | 初始状态 |
|---|---|---|---|---|---|
| V2-B21-DEP-001 | 建立 OCI/Kubernetes/Helm 或 Kustomize/GitOps 的 staging 与 production 发布清单 | `deploy/`、CI/CD、镜像仓库 | 配置分层、secret 注入、探针、滚动/蓝绿、回滚和不可变镜像测试 | B20 | 待开始 |
| V2-B21-STG-002 | 建立 production-like staging，执行全量迁移、脱敏数据装载和依赖连通 | staging 基础设施 | 空库部署、升级、降级、网络策略、数据迁移和依赖故障测试 | 001 | 待开始 |
| V2-B21-OBS-003 | 建立 SLO、错误预算、告警路由、值班责任、Dashboard 和事故演练 | OTel、监控、告警、Runbook | 告警触发、trace 定位、静默失效、升级链路和审计测试 | 002 | 待开始 |
| V2-B21-RC-004 | 构建不可变 RC，执行全量契约、E2E、设备、性能和安全回归 | CI/CD、staging、四端 | 版本签名、构建物一致、回归零阻断、性能基线和回滚点测试 | 002/003 | 待开始 |
| V2-B21-GATE-005 | 召开产品/架构/安全/数据/运营 Go/No-Go，登记已知风险与回滚负责人 | 发布工作台、审计 | 缺项阻断、风险接受、双人审批、变更窗口和回滚演练测试 | 004 | 待开始 |
| V2-B21-TEST-006 | 生成 RC 证据包、发布清单、测试报告和签字索引 | `docs/07-operations`、CI | 证据完整性、版本/环境绑定、报告可复现和发布门禁测试 | 001–005 | 待开始 |

---

### B21 执行记录（2026-08-23）

B21 已完成代码与静态发布 Gate 基础，三个协作子进程均按要求使用 `gpt-5.6-luna / max`；真实 staging、不可变 RC、OTel/SLO/告警、回滚演练和五角色 Go/No-Go 仍保持 runtime blocked，不以部署模板、HTTP 200、synthetic fixture 或静态 validator 冒充发布证据。

| 任务 ID | 当前状态 | 已取得证据 | 尚未取得的运行态证据 |
|---|---|---|---|
| `V2-B21-DEP-001` | 代码/静态完成；集群/registry 运行阻塞 | OCI digest、cosign/SBOM、Kubernetes/Kustomize/Helm/GitOps、ExternalSecret、探针、滚动/蓝绿/回滚和 NetworkPolicy 模板；部署 validator 13/13 静态检查 | 真实 registry 签名、SBOM、secret 注入、staging/prod rollout/rollback 和集群审计 |
| `V2-B21-STG-002` | 代码/静态完成；staging 运行阻塞 | production-like 差异声明、脱敏夹具、空库/升级/降级迁移计划和依赖故障矩阵；运行检查保持 pending | 空库部署、迁移/回滚、网络策略、依赖故障隔离和恢复报告 |
| `V2-B21-OBS-003` | 代码/静态完成；观测运行阻塞 | OTel/SLO/错误预算/告警/值班/Dashboard/事故演练/静默审计规则；静态 6/6、运行 6 项 pending | 真实 trace/metric/log、告警触发、静默审计、升级链路和事故演练 |
| `V2-B21-RC-004` | 代码/静态完成；RC 回归运行阻塞 | 不可变 RC、版本签名、构建物一致性、回归选择和回滚点规则；默认 `NO-GO` | 固定 RC 的契约/E2E/浏览器/设备/性能/安全回归、签名和 rollback point |
| `V2-B21-GATE-005` | 代码/静态完成；Go/No-Go 阻塞 | 五角色独立决策、B20 前置、风险接受、变更窗口、双人审批、回滚 owner 和 closed report schema | B20 接受、真实角色签字、风险复核、变更窗口、回滚演练和审计记录 |
| `V2-B21-TEST-006` | 代码/静态证据基础完成；真实报告阻塞 | RC evidence index、哈希/版本/环境绑定、可复现报告、`test:b21` 26/26、`b21:static` 通过 | 真实 artifact、签名索引、环境绑定和完整复现报告 |

统一静态验证：`pnpm test:b21` 26/26、`pnpm b21:static`、契约校验/生成/兼容、固定端口、运行配置和 `pnpm tasks:v2:check` 均通过。`pnpm b21:bootstrap --require-runtime` 必须先通过 B20 runtime prerequisite；当前按设计保留阻塞，不创建集群、不发布镜像、不切换流量、不批准 Go。完整记录见 [`docs/07-operations/b21-validation.md`](../../docs/07-operations/b21-validation.md)。

---

## 19. B22 — Phase 1 生产上线与观察期（4 项）

**批次目标**：在 B21 Go/No-Go 通过后执行小流量上线、生产验证、观察期和 Phase 1 收口；任何 P0/P1 或数据安全问题都必须触发停止扩量/回滚。
**主要引用**：`ARCH-REL-001`、`ARCH-OBS-001`、`ARCH-DR-001`。

| 任务 ID | 上线目标 | 宿主 | 必须验证 | 依赖 | 初始状态 |
|---|---|---|---|---|---|
| V2-B22-REL-001 | 执行生产环境小流量/金丝雀发布、功能开关、四端版本发布和受控扩量 | Kubernetes/GitOps、四端发布渠道 | 发布前检查、健康/业务 smoke、流量扩量、停止扩量和自动/人工回滚测试 | B21 | 待开始 |
| V2-B22-DATA-002 | 执行生产迁移、数据/事件对账、旧路由兼容窗口和迁移后回滚验证 | MySQL、Kafka、Gateway、core-api | 迁移锁、行数/摘要、重复执行、旧新结果一致和恢复点测试 | 001 | 待开始 |
| V2-B22-OPS-003 | 完成上线观察期、SLO/错误预算、客服/应急值班、事故复盘和遗留问题收口 | OTel、工单、Runbook、运营后台 | 真实告警、故障升级、用户反馈、回滚决策和审计留痕测试 | 001/002 | 待开始 |
| V2-B22-TEST-004 | 生成 Phase 1 上线验收报告并正式关闭/转入维护的 P1 Gate | 全系统、证据仓库 | 生产 smoke、关键旅程、监控、备份、权限、隐私和发布证据完整性测试 | 001–003 | 待开始 |

---

### B22 执行记录（2026-08-23）

B22 已完成代码与静态上线/观察期 Gate 基础，三个协作子进程均按要求使用 `gpt-5.6-luna / max`；真实 B21 接受、生产小流量、迁移对账、观察期和 Phase 1 验收仍保持 runtime blocked，不以部署模板、静态 fixture 或开发环境 HTTP 200 冒充生产证据。

| 任务 ID | 当前状态 | 已取得证据 | 尚未取得的运行态证据 |
|---|---|---|---|
| `V2-B22-REL-001` | 代码/静态完成；生产切换阻塞 | 1%/5%/25%/50%/100% 金丝雀、Feature Flag、四端版本绑定、不可变镜像/签名/SBOM、health/critical smoke、停止扩量、自动/人工回滚；定向测试 9/9 | B21 Go/No-Go、生产前 smoke、真实切流/观察、回滚和审计 artifact |
| `V2-B22-DATA-002` | 代码/静态完成；迁移运行阻塞 | 15 个服务/平台 owner、migration lock、空库/升级/降级/失败恢复、行数/摘要/schema/version、Outbox/Kafka 对账、幂等、read-shadow、兼容窗口和 closed report；测试 16/16 | MySQL/Kafka 真实迁移、旧新结果一致、restore/compensation 和回滚 evidence |
| `V2-B22-OPS-003` | 代码/静态完成；观察期运行阻塞 | 24h/7d 观察、OTel/SLO/error budget、告警/值班/客服、事故复盘、P0/P1、风险 owner/expiry 和审计规则；静态 6/6 | 真实生产指标、告警升级、用户反馈、事故与遗留风险收口 |
| `V2-B22-TEST-004` | 代码/静态验收基础完成；Phase 1 关闭阻塞 | 报告 Schema、关键旅程 smoke、安全/隐私/备份/发布证据绑定、维护 owner、P1 Gate；定向测试 10/10 | 真实上线报告、artifact 哈希/版本/环境绑定、独立复核和维护交接签字 |

统一静态验证：`pnpm test:b22` 35/35、`pnpm b22:static`、契约校验/生成/兼容、固定端口、运行配置和 `pnpm tasks:v2:check` 均通过。`pnpm b22:bootstrap --require-runtime` 必须先通过 B21 runtime prerequisite；当前按设计保留阻塞，不切换生产流量、不执行真实迁移、不关闭 Phase 1。完整记录见 [`docs/07-operations/b22-validation.md`](../../docs/07-operations/b22-validation.md)。

### B23+ 后续 Phase 1 真实运行与实机测试

B23–B27 共 32 项后续任务已单独建立并重新按用户目标排序：B23 负责平台自有 IAM 账号密码登录、JWT Bearer/JWKS 与服务侧权限，B24 负责 H5/Web 全局登录门禁和登录后交互，B25 负责本地 MySQL 真实数据与学习闭环，B26 负责 Kafka/Outbox、跨服务和浏览器/H5 正式测试，B27 负责真机、专项质量、staging/RC/Go-No-Go/测试交接。B23–B25 是正式测试前的开发前置，B26 是正式测试主体，B27 是测试收口与上线门禁；它们是 B15–B22 运行态验收的延续，不改变 B0–B22 的历史执行记录。

---

## 20. Future Phase 2/3 — 非当前批次的 Gate 冻结任务

以下任务不属于当前 Phase 1 的 B15–B22，不计入 Phase 1 完成度，不进入当前默认路由、菜单、官网营销、数据库迁移或埋点注册。任务编号使用 `F2/F3`，避免与 Phase 1 上线批次混淆。

### F2 — Phase 2 成人 AI（`G-P2` 后解冻）

**解冻条件 `G-P2`**：成人 Phase 1 数据、内容审核、隐私、成本、模型/供应商、实时语音、Schema、安全与灰度 Gate 已由产品/架构/合规签收。

| 任务 ID | 目标 | 主要宿主 | 初始状态 |
|---|---|---|---|
| V2-F2-AI-001 | 结构化 AI 输入/输出、prompt_version、模型路由、超时和安全降级 | `ai-orchestrator` | 冻结 |
| V2-F2-SAFE-002 | 内容安全、评测、成本配额、审计和人工复放 | `content-safety`、`evaluation` | 冻结 |
| V2-F2-RAG-003 | 版权/权限约束的 RAG、来源引用和知识访问 | AI/content adapter | 冻结 |
| V2-F2-RTC-004 | 商业 RTC、Barge-in、断线/降级和媒体权限 | `realtime-voice`、media | 冻结 |
| V2-F2-FE-005 | AI 页面、流式增量渲染、成本/安全/失败提示 | mobile、learner-web、admin-web | 冻结 |
| V2-F2-TEST-006 | AI Schema、安全、成本和交互回归 | 相关服务/前端 | 冻结 |

### F3 — Phase 3 K12、监护与机构（`G-P3` 后解冻）

**解冻条件 `G-P3`**：未成年人保护、地区/主体资质、教材/媒体版权、监护同意、防沉迷、数据隔离、运营与应急流程完成专项合规签收。

| 任务 ID | 目标 | 主要宿主 | 初始状态 |
|---|---|---|---|
| V2-F3-GRD-001 | 未成年人主体、监护同意、年龄/地区 Gate、监护关系和审计 | guardian-service、IAM | 冻结 |
| V2-F3-ORG-002 | 机构、教师、班级、TenantScope 和组织授权 | institution-service | 冻结 |
| V2-F3-RGT-003 | 教材/课程版权、地区和内容版本许可 | curriculum-rights-service | 冻结 |
| V2-F3-FE-004 | 学生、监护人、教师/机构受控 UI、防沉迷和隐私交互 | mobile、learner-web、admin-web | 冻结 |
| V2-F3-ADM-005 | K12 合规审核、应急、投诉、数据请求和公示 | admin-ops、official-site | 冻结 |
| V2-F3-TEST-006 | K12 合规、租户、版权、监护和交互回归 | 相关服务/四端 | 冻结 |

---

## 21. 统一逻辑与交互测试要求

所有 B7–B22 任务以及 B23+ 后续任务至少选择并实现下列测试层；F2/F3 只有解冻后才适用同一标准：

| 层级 | 必须验证 | 不在本轮替代的证据 |
|---|---|---|
| 单元/规则 | 状态机、算法、权限判定、幂等、TenantScope、异常/补偿 | 真实多实例事务、真实供应商行为 |
| 契约 | OpenAPI/AsyncAPI/Schema 兼容、生成客户端、错误/版本语义 | 生产网关/供应商连通 |
| 服务逻辑集成 | 以容器或测试替身验证 owner、Outbox、重放、迁移读影子 | 真实 Kubernetes、Kafka、KMS、对象存储演练 |
| 组件/浏览器交互 | 八态、表单、深链、键盘、路由守卫、恢复、响应式、公开/登录边界 | 真机、读屏、商店审核、真实弱网 |
| 国际化/主题 | locale 与 `contentLocale` 分离、fallback/格式化、伪本地化、亮/暗/系统/高对比主题、持久化、SSR 无闪烁和非颜色状态表达 | 本地化人工审校、真实读屏与设备显示校准 |
| 回归 | B0–B6 行为夹具与 v2 目标服务结果比对 | 以旧单体行为覆盖 v2 架构错误 |

所有测试数据只使用合成主体、媒体引用和脱敏夹具；不得提交真实手机号、支付凭证、录音、供应商密钥或生产审计数据。

---

## 22. 任务认领、迁移与后续更新

1. 先认领最小任务行，再建立该任务的 `Source Ref / Arch Ref / Contract Ref / Service Owner / Data Owner / Client Host / Evidence` 卡片。
2. B7–B14 的“代码开发完成”只能说明本基线第 1.1 节已满足；B15–B22 必须继续取得运行态、真实设备、发布和上线证据，才能宣告 Phase 1 完成。
3. 发现 v2 需求缺独立名称、来源或验收时，登记为 `V2-EXT-*` 细化请求；不得以 B0–B6 或本文件自行补造需求。
4. 每次切换 `core-api` 兼容路由前，必须先实现读影子、对账、回滚开关和契约弃用窗口；无这些代码证据不得关闭旧路由。
5. B7–B22 的历史进度由本文件维护；B23+ 的进度、owner、证据和阻塞由 [`v2-B23plus-Phase1-真实运行与实机测试任务基线.md`](./v2-B23plus-Phase1-真实运行与实机测试任务基线.md) 维护；F2/F3 只在对应 Gate 通过后解冻；旧 `Agent开发状态总报表.md` 继续保留旧 B0–B6 历史，不回写新任务状态。

---

## 23. B0–B22 当前执行状态与 B23+ 规划（2026-08-23 更新）

本节是对上方“初始状态”快照的补充，不修改任务设计时的原始状态。完整命令、构建日志、启动地址、浏览器烟测和环境限制见 [`docs/07-operations/test-phase-handoff-2026-08-22.md`](../../docs/07-operations/test-phase-handoff-2026-08-22.md)。

| 范围 | 当前状态 | 证据与剩余边界 |
|---|---|---|
| B0 | 代码基线与全局门禁通过 | DoD、契约、配置、端口和任务基线检查通过；真实基础设施运行态待验收 |
| B1–B6 | 代码/逻辑层通过 | B1 7/7、B2 14 pass + 3 TODO、B3 17/17、B4 6/6、B5 4/4、B6 4/4；外部服务、浏览器扩展、真机和弱网仍待测试 |
| B7–B14 | 代码/逻辑层通过 | B7 28/28、B8 28/28、B9 6/6、B10 7/7、B11 4/4、B12 7/7、B13 12/12、B14 6/6；契约重新生成且兼容性 0 breaking |
| B15 | 代码与静态预检完成，真实运行态阻塞 | `test:b15` 5/5、`b15:static` 通过；Java 25/Maven 已配置，Docker Desktop 后端未就绪，真实基础设施和 Java 服务尚未启动；详见 `b15-validation.md` |
| B16 | 代码与静态回归完成，真实运行态阻塞 | `test:b16` 6/6、`b16:static` 通过；Java 25/Maven 已配置，自有 IAM JWT、Docker、IAM 持久化、mTLS 和跨进程权限 evidence 未取得；详见 `b16-validation.md` |
| B17 | 代码、静态门禁与合成回归完成，真实运行态阻塞 | `test:b17` 17/17、`b17:static`、11 服务 runtime manifest、读写链和事件可靠性边界通过；Docker/Kafka/IAM JWT/跨进程 evidence 未取得，详见 `b17-validation.md` |
| B18 | 代码/静态联调完成，真实运行态阻塞 | `test:b18` 7/7、`b18:static`、四端构建和固定 origin/账号矩阵通过；详见 `b18-validation.md` |
| B19 | 代码/静态系统测试基础完成，真实运行态阻塞 | `test:b19` 23/23、`b19:static`、契约生成/兼容、浏览器设备矩阵和质量门禁通过；详见 `b19-validation.md` |
| B20 | 代码与静态 Gate 基础完成，真实运行态阻塞 | `test:b20` 22/22、`b20:static`、安全/隐私/内容/支付/灾备 validator 通过；运行 evidence、支付资质和恢复演练仍待取得，详见 `b20-validation.md` |
| B21 | 代码与静态发布 Gate 基础完成，真实运行态阻塞 | `test:b21` 26/26、`b21:static`；部署/staging 13/13 静态、OBS/RC 6/6 静态、GATE/TEST 9/9 静态，真实 staging/RC/观测/回滚/Go-No-Go evidence 未取得，详见 `b21-validation.md` |
| B22 | 代码与静态上线 Gate 基础完成，真实运行态阻塞 | `test:b22` 35/35、`b22:static`；REL 8/8、DATA 9/9、OPS/TEST 6/6 静态，生产切换/迁移/观察期/验收 evidence 未取得，详见 `b22-validation.md` |
| 四个前端 | 已构建并完成开发服务烟测 | learner-web 18180、admin-web 18181、official-site 18182、mobile H5 18183 均 HTTP 200；页面浏览器烟测通过，移动 H5 空白页已修复 |
| B23–B27 | 任务重设完成，尚未执行真实验收 | 共 32 项后续任务；B23 认证、B24 H5/Web 登录门禁、B25 本地真实数据、B26 Kafka/Outbox 与浏览器/H5 正式测试、B27 真机/专项质量/RC/交接均待开始；详见 B23+ 基线 |
| 后端与基础设施 | 已取得本地运行 smoke，认证后闭环未完成 | Docker、MySQL、Redis、Kafka、MinIO 和后端服务 readiness 已有本地证据；自有 IAM JWT/JWKS、认证后 MySQL 业务写链、Kafka 业务 Topic/消费者和跨服务对账仍待 B23–B26 |
| Phase 1 当前结论 | B15–B22 代码/静态基础已完成，B23–B27 已规划；真实运行态与发布 Gate 阻塞，尚未上线 | 不能宣称全系统后端、真实基础设施、浏览器实机、真机、支付 sandbox、媒体、灾备、staging、RC、Go/No-Go、生产切换、迁移对账、观察期或 Phase 1 验收已完成 |

---

## 23.1 B23–B27 重设后的当前解释

上方 B0–B22 状态表保留历史快照；截至 2026-08-23，B23–B27 已按用户目标重新排序为“认证 → H5/Web 登录门禁 → 本地真实数据 → Kafka/Outbox 与浏览器/H5 正式测试 → 真机/RC/交接”，共 32 项且 0/32 项执行完成。B23–B25 完成并通过注册登录、登录门禁和 MySQL 真实读写 smoke 后，才进入 B26 正式测试；B27 是测试收口和上线交接。

## 24. Phase 1 上线完成 Gate

只有同时满足以下条件，才能把 Phase 1 状态从“测试中/候选发布”改为“已上线”：

1. **B15–B18 全部完成**：Java 25/Maven/Docker 或等价 CI 运行环境、Gateway/IAM/RBAC、目标服务独立进程、MySQL/Redis/Kafka/对象存储、Outbox、关键读写链路和四端真实 API 联调均有证据。
2. **B19–B22 运行 Gate 全部完成**：契约/集成/E2E 基础、安全/隐私/内容/支付 sandbox、备份恢复、staging、不可变 RC、SLO/告警、回滚、迁移对账和上线方案均有真实证据；支付默认开关只有在资质批准后才能打开。
3. **B23–B25 全部完成**：自有 IAM JWT Bearer 账号密码注册登录、H5/Web 全局登录门禁、成人 Gate、本地 MySQL 内容/学习/练习/测评/SRS/报告真实读写和刷新/重启/幂等证据齐全。
4. **B26–B27 全部完成**：Kafka/Outbox 跨服务闭环、浏览器/H5 正式测试、缺陷回归、iOS/Android/iPad/PWA/小程序真机、专项质量、RC、Go/No-Go、测试报告和维护交接齐全。

Phase 2/3 的 `G-P2`、`G-P3` 不属于 Phase 1 上线 Gate，也不能用 Phase 1 的完成替代。
