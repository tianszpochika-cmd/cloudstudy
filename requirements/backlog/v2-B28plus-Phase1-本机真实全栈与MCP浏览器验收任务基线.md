# v2 B28–B36 Phase 1 本机真实全栈与 MCP 浏览器验收任务基线

> 基线 ID：V2-PHASE1-LOCAL-REAL-E2E-20260824  
> 状态：B28、B29 已完成；B30–B33 的自动化运行/构建收口已完成，但自有 JWT 认证后的 Browser MCP 全旅程尚未闭合；B34–B36 处于测试收口中。B28–B36 共 9 章、45 项任务，按章节顺序执行
> 当前目标：在本机完成“注册/登录 → 前后端真实交互 → MySQL 持久化读写 → Kafka/Redis 联动 → Codex Browser MCP 真浏览器回归 → 缺陷收口”  
> 非当前目标：iOS/Android 原生包、iPad 原生、微信小程序、远程真机、production-like staging、RC、生产发布、真实支付、Phase 2 AI 和 Phase 3 K12

## 1. 与 B23–B27 的关系

B23–B27 已建立认证、前端登录门禁、本地数据、Kafka/Outbox、浏览器矩阵和真机/发布门禁的代码与静态基础，但主要运行 Gate 仍未关闭。B28–B36 不重复设计业务，也不把旧静态结果改写成运行完成；它们只负责把当前用户要求的本机真实链路逐项接通、验证和修复。

现有 B27 编号和静态结果保留用于审计。其中 iOS/Android/iPad、微信小程序、远程真机、staging、RC 和生产交接运行项改为“当前本地里程碑暂缓”，以后恢复时仍使用原 B27 Gate。Mobile H5、Web 安全/性能/无障碍和证据契约可作为 B28–B36 的输入，但不能替代真浏览器运行证据。

## 2. 本机真实数据的唯一解释

本计划中的“真实”指运行链路和事实来源真实，不要求使用生产用户或真实个人隐私数据：

1. 页面动态数据必须经 `Browser → Frontend → Gateway → Domain Service → MySQL owner schema` 读取或写入；
2. 课程、题目、商品和测试账号可以是合成测试数据，但必须持久化到本地 MySQL，并通过正式 API 返回；
3. 禁止用组件常量、静态 JSON、Mock Server、内存 Repository、localStorage、固定 Token 或前端 fallback 冒充业务成功；
4. Redis 只能作为缓存、锁或可重建投影，Kafka 只能传播跨服务事实，MinIO 保存本地测试媒体；它们都不能替代 MySQL 领域事实；
5. 每次写操作至少能以 `requestId/traceId + principalId + owner schema/table/row + eventId（适用时）` 对账；
6. 测试只使用合成账号和合成内容，不把密码、Token、真实手机号、真实音频或其他隐私写入仓库和证据包。

## 3. 本机目标运行范围

### 3.1 后端进程

必须按 `config/v2-runtime-services.json` 启动并验证 14 个进程：

- `api-gateway`、`iam-service`；
- `learner-service`、`content-service`、`learning-service`、`assessment-service`、`media-service`；
- `notification-service`、`gamification-service`、`social-service`、`commerce-service`；
- `admin-ops-service`、`analytics-service`；
- `core-api` 仅作为已登记的 legacy compatibility 进程，不能成为新增业务事实 owner。

### 3.2 本地基础设施

必须真实运行 MySQL、Redis、Kafka、MinIO 和平台自有 IAM JWT issuer/JWKS。RabbitMQ 只为旧兼容路由需要时运行，不得替代 Kafka 主线。所有服务使用固定端口、loopback 绑定和本地专用凭据。

### 3.3 前端范围

- `apps/learner-web`：完整 PC Web 学习旅程；
- `apps/mobile` 的 H5 构建：完整移动浏览器学习旅程；
- `apps/admin-web`：本地内容/运营管理和发布后可见性；
- `apps/official-site`：公开页面、课程投影和登录深链；
- 微信/iOS/Android/iPad 原生目标暂缓，不作为 B28–B36 的阻断项。

## 4. 批次总览与依赖

| 批次 | 类型 | 目标 | 依赖 | 完成后允许进入 |
|---|---|---|---|---|
| B28 | 开发/环境 | 本地工具链、基础设施、迁移和一键启动 | B27 静态基础 | B29 |
| B29 | 开发/运行 | 14 个后端进程真实启动、持久化和观测 | B28 | B30 |
| B30 | 开发/联调 | 自有账号密码 JWT Bearer、JWT/JWKS、IAM/RBAC 闭环 | B29 | B31（认证后的 MCP 旅程仍需收口） |
| B31 | 开发/数据 | 本地 MySQL 内容与用户事实、API→DB→API | B30 | B32（认证后的用户写链仍需浏览器核对） |
| B32 | 开发/业务 | 学习、练习、测评、SRS、报告、Kafka/Redis 闭环 | B31 | B33（领域 API/DB 已通过，页面旅程待回归） |
| B33 | 开发/前端 | 四个前端与真实 API 接通并修复交互 | B32 | B34 正式本地测试（运行切片已通过） |
| B34 | 测试 | Codex Browser MCP 真浏览器功能验收 | B33 | B35（核心认证旅程已通过，剩余全量页面回归） |
| B35 | 测试/修复 | 重启、异常、一致性、权限和缺陷回归 | B34 | B36（自动化回归通过，浏览器认证负例待收口） |
| B36 | 验收/交接 | 本机全栈测试结论与可重复运行交接 | B35 | 本地目标完成（当前为 NO-PASS） |

按用户逐章执行的方式，默认严格执行 `B28 → B29 → ... → B36`。章节内可以并行处理互不冲突的服务或前端切片，但下游章节不得以静态结果跳过上游运行 Gate。

## 5. B28 — 本地工具链、基础设施和可重复启动（5 项）

**状态：已完成（2026-08-24）；运行证据：`evidence/b28/b28-runtime-20260824121425.json`。**

| 任务 ID | 目标 | 必须交付/验证 | 状态 |
|---|---|---|---|
| V2-B28-ENV-001 | 固化本地工具链 | Java 25、Maven、Node/pnpm、Docker/Compose 的版本检查和缺失即失败；不再以 Java 17/24 构建 v2 主线 | 已完成 |
| V2-B28-INF-002 | 启动真实基础设施 | MySQL/Redis/Kafka/MinIO/IAM JWT 在固定端口 healthy；RabbitMQ 仅按兼容需要启用 | 已完成 |
| V2-B28-DB-003 | 验证空库迁移与 owner | 各服务 schema、Flyway 顺序、独立账号/写权限、重复迁移、失败恢复和禁止跨服务写表 | 已完成 |
| V2-B28-CFG-004 | 建立 `local-real` 运行配置 | 自有 JWT issuer/JWKS profile、数据库、Redis、Kafka、MinIO、CORS、Gateway 路由和前端 origin 一致；secret 不进仓库；禁止 mock/fallback 开关 | 已完成 |
| V2-B28-RUN-005 | 提供可重复启停入口 | 新增/修复一键 preflight、启动、readiness、停止和证据摘要；连续两次冷启动结果一致 | 已完成 |

### B28 完成 Gate

- 不能只通过 `--static-only`；必须有容器健康、端口、迁移和重启证据；
- 清理运行进程后可以依照文档重新启动，不依赖随机端口或人工修改源码；
- 不删除用户现有本地数据；需要重置时必须使用独立测试 schema/volume 并明确授权。

## 6. B29 — 全部后端服务真实运行与持久化收口（5 项）

**状态：已完成（2026-08-24）；运行证据：`evidence/b29/b29-runtime-20260824125527.json`；静态 256 项、运行 8 项、B29 测试 7/7 通过。**

| 任务 ID | 目标 | 必须交付/验证 | 状态 |
|---|---|---|---|
| V2-B29-SVC-001 | 构建 14 个后端进程 | Java 25/Spring Boot 4 主线服务和 legacy `core-api` 兼容进程全部构建；版本、产物和启动参数可追溯 | 已完成 |
| V2-B29-SVC-002 | 独立启动与 Gateway 路由 | 每个服务独立 PID/JVM、固定端口、readiness；外部业务只经 Gateway，服务直连不作为前端路径 | 已完成 |
| V2-B29-PERSIST-003 | 禁止本地真实 profile 使用内存事实 | 当前 Phase 1 业务事实服务使用 MySQL；尚未承载本机业务事实的媒体、成长、社交、商业、运营和分析进程在 `local-real` 下明确 fail-closed，不注入内存/Mock/静态 fallback；启动和证据均验证该边界 | 已完成 |
| V2-B29-OBS-004 | 接通观测与错误边界 | requestId/traceId、结构化日志、健康/readiness、超时、优雅停机；服务异常不得返回匿名假数据 | 已完成 |
| V2-B29-SMOKE-005 | 执行服务运行 smoke | 14 个进程、Gateway 路由、owner schema 连接、启动/停止/重启和兼容路由均有实际响应与日志证据 | 已完成 |

### B29 完成 Gate

- 14 个登记进程均处于预期状态；如果某服务不是当前业务路径，也必须健康或在契约中明确为关闭且不被路由；
- 任何受保护 API 在无认证时返回 401/403，不返回空列表或静态成功；
- 服务重启后 MySQL 事实仍可读取。

本章运行收口证据包含：14 个独立 Java 25 PID、14 个固定 loopback 端口、readiness/liveness、Gateway 未认证 401 与 requestId/traceId、11 个 owner schema 读回、core-api 兼容边界，以及六个当前非业务事实服务的 fail-closed 运行标记。`local-real` 的 fail-closed 进程只能保持健康和不被前端路由，不能被解释为这些领域功能已经完成；它们的业务实现仍由后续 B31–B33 按真实数据目标逐项关闭。

## 7. B30 — 自有账号密码 JWT Bearer 登录与权限真实闭环（5 项）

**状态：自有 IAM 自动化/服务逻辑收口已完成；新的 Browser MCP 认证旅程尚未重新取得运行证据。历史外部登录证据不计入当前验收。**

| 任务 ID | 目标 | 必须交付/验证 | 状态 |
|---|---|---|---|
| V2-B30-AUTH-001 | 启动并固化平台自有 JWT profile | IAM 账号密码接口、RS256、issuer/audience/JWKS、claims、Refresh Token 轮换和密码策略可运行 | 代码/静态完成，运行待验收 |
| V2-B30-AUTH-002 | 用 MCP 浏览器完成 JWT Bearer 注册与登录 | 从干净会话打开统一登录页、注册合成账号、账号密码登录、获得 JWT Bearer 会话、returnTo；不注入固定 Token | 新认证旅程待执行 |
| V2-B30-IAM-003 | 持久化 IAM 本地事实 | principal、tenant、device、session、refresh token 摘要/历史、consent/adult gate、role/policy/audit 写入 IAM owner schema | 代码/迁移完成，运行待验收 |
| V2-B30-SEC-004 | 验证 Gateway 与服务侧 PEP | issuer/audience/JWKS/过期、RBAC+ABAC、owner/tenant 服务端派生、伪造角色头拒绝、默认拒绝 | 已完成：Gateway/API 负例与服务 PEP 通过；Browser 认证负例转 B35 |
| V2-B30-LIFE-005 | 验证 JWT 会话生命周期 | refresh rotation、登出、设备撤销、错误密码/锁定、过期 JWT、JWKS/认证中心不可用和重启恢复均有浏览器/API/DB 证据 | 逻辑测试完成，真实 API/Browser 证据待验收 |

### B30 完成 Gate

- Codex Browser MCP 可以从登录页真实注册并登录；
- 有效会话能访问 `/api/v1/iam/principal/me`，无效会话被拒绝；
- 浏览器行为、Gateway/服务日志和 IAM MySQL 行使用同一 runId/traceId 对账。

## 8. B31 — 本地 MySQL 内容、用户与管理写链（5 项）

**状态：内容发布与读取 API→MySQL→API 运行切片已完成；Web/H5 核心认证写链和课程读取已补齐，剩余页面矩阵仍待 B34/B36。** 运行证据：`b31-content-2026082513`、`b31-learner-2026082513`、`b36-browser-2026082516`。

| 任务 ID | 目标 | 必须交付/验证 | 状态 |
|---|---|---|---|
| V2-B31-DATA-001 | 建立可追溯持久化测试内容 | 课程、单元、词汇、题目、答案规则、媒体元数据和商品关闭状态进入各 owner schema；数据可重复初始化 | 已完成：本地内容 fixture 与发布链通过 |
| V2-B31-DATA-002 | 清除运行时假数据路径 | 扫描并关闭页面静态样例、Mock API、内存 Repository、localStorage 事实和失败后伪成功 fallback | 已完成：B33 静态/运行边界通过 |
| V2-B31-CONTENT-003 | 接通内容读链 | Admin/API 发布后，learner-web 与 H5 经 Gateway 从 content MySQL 读取相同版本；下线后页面同步变化 | 核心已完成：发布、投影、读取、下线运行证据及 Web/H5 B31 内容页面通过；Admin 发布后的完整跨端 MCP 联动待补 |
| V2-B31-LEARNER-004 | 接通用户写链 | 成人同意、学习目标、时长、偏好和 onboarding 幂等写入 learner/IAM owner schema，刷新和重新登录可读回 | 核心已完成：API/DB `b31-learner-2026082513`，Browser `b36-browser-2026082516`；全量刷新/重登待复测 |
| V2-B31-PROOF-005 | 建立 API→DB→API 证据 | 每个关键字段记录提交值、API 响应、owner 表前后差异、更新时间和重新查询结果 | 已完成：内容 owner/API/幂等对账通过；用户旅程待补 |

### B31 完成 Gate

- 页面展示的数据能在对应 MySQL owner 表中找到，修改后页面可观察到变化；
- 合成测试内容允许使用，但不能存在于前端源码或 Mock 响应中；
- 清空 Redis 或重启前端不能丢失 MySQL 事实。

## 9. B32 — 学习业务、事件和投影完整闭环（5 项）

**状态：领域 API/owner MySQL、Kafka/Outbox、Redis 重建与重启运行切片已完成；Web 核心测评/任务页面和 H5 内容页面已有 Browser MCP 证据，完整双端旅程仍待回归。** 运行证据：`b32-b35-20260825`、`b32-kafka-b35-20260825`、`b32-redis-b35-20260825`、`b36-browser-2026082516`。

| 任务 ID | 目标 | 必须交付/验证 | 状态 |
|---|---|---|---|
| V2-B32-BIZ-001 | 完成课程与练习读写 | 课程进入、学习进度、练习提交和服务端权威判分走真实 API/MySQL；答案不由客户端决定 | 核心已完成：领域 API/DB、Web Browser 和 H5 placement 报告/课程页面 `b36-browser-2026082516`；H5 新鲜任务提交待回归 |
| V2-B32-BIZ-002 | 完成测评、掌握度与 SRS | attempt、错题、mastery、复习计划和下次复习时间由 assessment/learning owner 写入并读回 | API/DB 已完成，Web 测评报告核心已通过；H5 完整答题与 SRS 页面待回归 |
| V2-B32-BIZ-003 | 完成报告与通知 | 学习报告、进度摘要和站内通知从真实领域事实生成，刷新/重新登录后保持一致 | API/DB 已完成，Web 报告核心已通过；通知、刷新/重登和 H5 报告待回归 |
| V2-B32-EVT-004 | 接通 Outbox/Kafka/消费者 | Topic、Outbox、eventId、aggregateId、至少一次、幂等消费、retry/DLQ 和 offset 均有实际运行证据 | 已完成：本地 Topic、重复投递、DLQ、lag 对账通过 |
| V2-B32-CACHE-005 | 验证 Redis 与重启一致性 | Redis 投影可从 MySQL/事件重建；重复提交、服务重启、消费者重启后 API、DB 和页面结果一致 | 已完成：MySQL 重建、Redis 重启和 TTL 对账通过 |

### B32 完成 Gate

- 完整链路达到“登录 → 目标 → 课程 → 练习 → 判分 → SRS/报告/通知”；
- MySQL、Kafka、Redis、API 和页面能以同一业务主体/聚合 ID 对账；
- Kafka Topic 不为空，不能用静态事件 preview 代替实际 publish/consume。

## 10. B33 — 四个前端真实 API 联调与交互修复（5 项）

**状态：四端固定端口、构建、Gateway-only、官网真实投影和 Mobile H5 登录错误/恢复态已完成；Web/H5 核心真实数据页面已补齐，2026-08-26 已将 Web `/practice` 切换到 B25 placement 真实链路但认证后复测待完成，剩余页面全量验收转入 B34/B35。** 运行证据：`b33-fe-2026082513`、`b36-browser-2026082516`、`b36-web-practice-switch-20260826`。

| 任务 ID | 目标 | 必须交付/验证 | 状态 |
|---|---|---|---|
| V2-B33-FE-001 | 四前端固定端口启动 | learner-web、admin-web、official-site、Mobile H5 均可重复启动、构建和访问 | 已完成：四端构建、HTTP 200、固定端口通过 |
| V2-B33-FE-002 | 统一真实 Gateway 客户端 | 所有业务请求经 18070 Gateway；关闭测试替身、静态 fallback、客户端角色/tenant/owner 注入 | 已完成：静态边界与运行投影通过 |
| V2-B33-FE-003 | 修复学习端完整交互 | Web/H5 的登录、onboarding、课程、练习、测评、复习、报告、退出和重新登录均可用 | 部分完成：Web 核心链路通过，`/practice` 已从旧 B10 session 切到 B25 placement 真实链路但认证后新入口待复测；H5 登录/目标/练习报告/课程内容已通过，新鲜答题、退出/重登和剩余页面待 MCP |
| V2-B33-FE-004 | 修复后台与官网联动 | Admin 创建/审核/发布的本地内容可被学习端读取；官网公开投影与登录深链正确，不承载受保护业务 | 部分完成：官网 Gateway 投影、登录深链和 Web/H5 B31 内容通过；Admin 发布后可见性待 MCP |
| V2-B33-UX-005 | 收口页面状态与布局 | Loading/Empty/Error/Permission/Recovery、响应式、键盘/触摸、i18n fallback、主题和 Console/Page Error 完成修复 | 部分完成：H5 390x844/错误恢复/核心内容通过；剩余页面和全量触摸/主题/i18n 回归待执行 |

### B33 完成 Gate

- 四前端不再出现“按钮可点但接口不可用”或布局阻断核心流程；
- learner-web 与 Mobile H5 使用同一后端事实，刷新后数据不回退为样例；
- B33 完成后才正式进入 B34 的 MCP 真浏览器测试。

## 11. B34 — Codex Browser MCP 真浏览器功能验收（5 项）

**状态：部分完成。MCP-001 已完成；已补齐真实注册/登录和 Web/H5 核心数据旅程，Web `/practice` 旧接口已修复但认证后新入口仍待 MCP 复测，完整页面、退出/重登和 Admin 发布联动仍在进行。详见 `docs/07-operations/b34-validation.md`。**

| 任务 ID | 目标 | 必须交付/验证 | 状态 |
|---|---|---|---|
| V2-B34-MCP-001 | 建立 MCP 用例与证据协议 | 使用 Codex Browser MCP 实际导航、点击、输入、提交、等待和截图；禁止用静态测试或单纯 HTTP 调用冒充 UI 通过 | 已完成 |
| V2-B34-MCP-002 | 验收干净会话与认证 | 新标签/干净会话打开 Web/H5、注册、账号密码登录、回跳、刷新、登出、重新登录和受保护深链 | 自有 JWT 旅程待执行；历史其他认证流证据不计入 |
| V2-B34-MCP-003 | 验收 learner-web 完整旅程 | 成人 Gate、目标、课程、练习、判分、SRS、报告、通知和个人设置逐项操作并核对数据库 | 部分完成：成人 Gate→测评报告→任务→课程→断点/完成通过；`/practice` 新 B25 入口已完成代码/构建切换，认证后题目/报告需复测；SRS/通知/设置待逐项验收 |
| V2-B34-MCP-004 | 验收 Mobile H5 完整旅程 | 移动 viewport 下完成同一真实数据旅程，验证触摸导航、返回、刷新、权限和异常恢复 | 部分完成：登录/目标/同意/练习报告/真实课程通过；H5 新鲜答题、报告刷新和触摸回归待执行 |
| V2-B34-MCP-005 | 验收跨前端联动 | Admin 发布内容→Web/H5 可见，官网→登录深链，四端共享版本/locale/theme 边界；形成完整 MCP 证据索引 | 部分完成：官网投影、登录深链和 Web/H5 B31 内容通过；Admin 发布可见性待执行 |

### MCP 测试强制证据

每个用例至少包含：caseId、runId、浏览器类型、URL/viewport、MCP 操作记录、关键页面截图、可见 DOM/结果、requestId/traceId、服务日志、MySQL 前后查询、Kafka eventId（适用时）、实际结果、缺陷编号和复测结果。

CLI/API/SQL 可以用于准备环境和核对事实，但不能替代 Browser MCP 的页面操作。独立 Playwright 脚本或静态组件测试可以作为补充，不能作为 B34 的唯一证据。

## 12. B35 — 异常恢复、持久化和缺陷回归（5 项）

**状态：自动化异常/权限/重启/持久化/幂等/Kafka/Redis 回归已完成；Browser MCP 已完成 Web/H5 核心缺陷回归，Web `/practice` 旧接口已修复但认证后复测、认证负例和剩余页面仍在收口。详见 `docs/07-operations/b35-validation.md`。**

| 任务 ID | 目标 | 必须交付/验证 | 状态 |
|---|---|---|---|
| V2-B35-REG-001 | 认证与权限负例 | 401/403、过期、撤销、跨用户 owner、伪造角色/tenant 和未登录深链由 MCP 浏览器验证 | 部分完成：API 与未登录深链、Gateway 故障恢复通过；退出/撤销、跨用户页面隔离的 Browser 负例待执行 |
| V2-B35-REG-002 | 基础设施异常恢复 | Gateway、IAM JWT、MySQL、Redis、Kafka 或领域服务短暂不可用时页面状态正确，恢复后可继续 | 部分完成：服务停止/恢复与页面错误态证据通过；IAM JWT 新链路待复测 |
| V2-B35-REG-003 | 重启与数据持久化 | 前端、服务、消费者和容器重启后账号、目标、进度、attempt、SRS、报告和通知仍一致 | 已完成：完整 Java 服务重启后 owner facts 读回通过 |
| V2-B35-REG-004 | 幂等、重复和重建 | 重复提交不产生重复事实；Kafka 重投/DLQ、Redis 清空重建和乱序场景完成对账 | 已完成：B32 Kafka/Redis runtime 对账通过 |
| V2-B35-FIX-005 | 缺陷修复与全量复测 | 所有浏览器发现的问题进入台账；P0/P1 清零，P2 有 owner/期限；修复后重跑关联链路和核心旅程 | 部分完成：IAM consent、学习断点、Web/H5 内容/任务路由已修复并回归；H5 全量旅程和剩余页面待执行 |

## 13. B36 — 本机测试完成与交接（5 项）

**状态：终验脚本与自动化 Gate 已完成；Browser MCP 已完成 Web/H5 核心真实数据旅程，Web `/practice` 新入口已完成代码/构建切换但认证后复测待完成，全量双端页面和 H5 报告链未闭环，当前交接仍为 `LOCAL-TEST-NO-PASS`。详见 `docs/07-operations/b36-validation.md`。**

| 任务 ID | 目标 | 必须交付/验证 | 状态 |
|---|---|---|---|
| V2-B36-GATE-001 | 干净启动终验 | 依据 Runbook 从停止状态启动基础设施、14 后端和四前端，连续两轮 readiness 与 smoke 通过 | 已完成：`b36-2026082515` |
| V2-B36-GATE-002 | 双端完整旅程终验 | learner-web 和 Mobile H5 分别由 MCP 浏览器完成一轮自有 JWT 注册/登录到报告的真实数据旅程 | 部分完成：业务页面证据保留，但自有 JWT 认证后题目/报告、退出/重登待复测 |
| V2-B36-GATE-003 | 数据与事件终验 | IAM、领域 MySQL、Redis、Kafka、MinIO、API 和页面证据完整对账，无静态/Mock/内存事实混入 | 部分完成：Web 核心页面与 MySQL、H5 B31 投影已对账；H5 完整测评事件和 Admin 发布联动待补 |
| V2-B36-GATE-004 | 质量与缺陷终验 | 四前端构建、核心后端测试、契约/迁移/端口/安全回归通过；P0/P1 为零 | 已完成：构建、契约、迁移、Redis、配置、端口、B35 有效会话权限回归和 B14 安全扫描通过 |
| V2-B36-HANDOFF-005 | 本机测试交接结论 | 输出 `LOCAL-TEST-PASS` 或 `LOCAL-TEST-NO-PASS`、证据索引、已知问题、启动/恢复 Runbook 和下一阶段建议 | 已完成：当前结论为 `LOCAL-TEST-NO-PASS`；认证阻断已解除，但剩余全量页面/双端旅程仍阻断正式交接 |

### B36 完成 Gate

只有 B28–B36 共 45 项全部有运行证据并通过，才可以宣告：**本机 Web/H5 前后端真实数据功能测试完成。**

该结论不等于生产上线，也不自动关闭原 B27 的 iOS/Android/iPad/微信、staging、RC、生产发布和多角色 Go/No-Go。未来要上线时必须恢复这些外部 Gate。

## 14. 测试开始、测试完成和发布的边界

| 里程碑 | 必须完成 | 可以宣告 | 不能宣告 |
|---|---|---|---|
| 本地开发环境可用 | B28–B29 | 后端和基础设施具备真实运行条件 | 登录/业务可用 |
| 本地开发收口 | B30–B33 | 注册登录、真实数据库和前后端联动已开发完成，可以进入 MCP 正式测试 | 测试完成 |
| 本地测试完成 | B34–B36 | 本机 Web/H5 真实数据功能测试完成 | 真机/微信/生产可上线 |
| Phase 1 发布 | 恢复并通过原 B27 及 B15–B22 发布 Gate | 才可进入生产 Go/No-Go | 仅凭本地测试直接上线 |

## 15. 执行纪律

1. 每章开始先读取本基线、对应 B23–B27 验证文档、架构约束和相关代码；
2. 发现接口或表结构缺失时，先更新 OpenAPI/事件契约和 Flyway migration，再改实现；
3. 代码完成必须同章运行，禁止把静态 PASS 填成运行 PASS；
4. B34/B35 的 UI 结论必须由 Codex Browser MCP 实际操作产生；
5. 每个任务状态只允许“待开始 / 进行中 / 待运行验收 / 已完成 / 阻塞”，阻塞必须给出可执行解除条件；
6. 任何章节都不得重新引入 Phase 2 AI、K12、真实支付或原生端范围。
