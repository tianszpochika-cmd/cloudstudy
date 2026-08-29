# v2 B23–B27 Phase 1 登录、真实数据与测试任务基线

> 基线 ID：V2-PHASE1-AUTH-DATA-20260823
> 状态：B23/B24 代码与静态验证已完成，平台自有 JWT 登录运行 Gate 待验收；B25 代码、契约、fixture 和本地 MySQL 回放已完成，API/JWT/Redis/重启证据待补；B26 代码与静态验证已完成，Kafka/Outbox、认证后数据和正式浏览器运行证据待验收；B27 代码与静态验证已完成，真机/发布/交接运行证据待验收。
> 范围：只覆盖 Phase 1 18+ 成人产品从“打开即登录”到“注册、登录、真实本地数据闭环、浏览器/真机验收和测试交接”。不新增 Phase 2 AI、Phase 3 K12 或新的默认业务入口。
> 上游：v2 B7+ 代码重塑与交互测试任务基线、G0–G4 治理门禁任务基线、v2 微服务目标架构、v2-980plus 设计包。
> 2026-08-24 本机专项调整：B27 的 iOS/Android/iPad、微信小程序、远程真机、staging、RC 和生产交接运行项暂缓，不再阻塞当前“本机 Web/H5 + 真实数据库”目标；接续执行以 [`v2-B28plus-Phase1-本机真实全栈与MCP浏览器验收任务基线.md`](./v2-B28plus-Phase1-本机真实全栈与MCP浏览器验收任务基线.md) 为准。

## 1. 本次重设解决的问题

原 B23–B27 直接从浏览器实机、移动真机和上线验收开始，遗漏了用户目标的两个前置条件：

1. 没有可运行的自有 IAM、JWT Bearer 和会话，就不能完成注册、登录、会话和受保护业务访问；
2. 没有本地内容/学习数据 fixture、持久化写链和 Kafka 事件，就不能验证真实学习功能。

因此本基线把任务依赖调整为：

| 批次 | 类型 | 目标 | 是否属于正式测试 |
|---|---|---|---|
| B23 | 认证基础开发 | 自有 IAM 账号密码登录、JWT/JWKS、Refresh Token 会话、Gateway/服务侧权限 | 否，开发前置 |
| B24 | 前端登录与交互开发 | H5/Web 全局登录门禁、统一登录页、成人 Gate、401/403 和登录后交互 | 否，开发前置 |
| B25 | 真实本地数据开发 | MySQL 数据 owner、fixture、内容、学习、练习、测评、SRS 和报告写链 | 否，开发前置 |
| B26 | 真实运行测试 | Kafka/Outbox 跨服务闭环、浏览器/H5 真实数据测试、缺陷修复和回归 | 是，正式测试主体 |
| B27 | 真机与发布验收 | iOS/Android/iPad/PWA/小程序、专项质量、staging、RC 和测试交接 | 是，测试收口与发布门禁 |

**B27 不是进入测试阶段的前置条件。** B23–B25 完成并通过测试入口 Gate 后进入 B26 正式测试；B27 是测试完成后的真机、RC、Go/No-Go 和交接阶段。

## 2. Phase 1 目标验收旅程

必须能够从干净浏览器完整复现以下旅程：

1. 打开 Mobile H5 或 learner-web，未登录用户首先看到登录页，不能直接使用受保护学习功能；
2. 通过统一自有登录页提交账号密码到 IAM；不使用假 Token、客户端角色头或固定验证码冒充成功；
3. IAM 校验密码并签发短时 RS256 JWT，Gateway 和每个领域服务独立通过 JWKS 验证，iam-service 在本地 MySQL 建立 principal、设备、会话、成人同意和权限事实；
4. 完成成人 Gate、学习目标和 onboarding，写入 learner-service 所有者的本地 schema；
5. 从本地 content-service 读取已发布课程、单词、练习和测评版本；
6. 完成练习和测评，assessment-service、learning-service 写入 attempt、判分、掌握度、SRS、报告等真实事实；
7. Outbox/Kafka 传播跨服务集成事件，重复提交、刷新、重启后结果仍一致；
8. 退出、Token 过期或撤销后，受保护页面回到登录/权限状态，不能退化为空列表或匿名成功。

本地真实数据的定义：账号凭证、密码哈希、用户主体、同意、会话和全部 Phase 1 领域事实由平台自有服务 schema 管理。Redis 只做缓存/锁/投影，Kafka 只传递集成事实，不能以 localStorage、内存 Map、假数据或页面 fallback 替代数据库事实。

## 3. 依赖与执行顺序

依赖链：B15–B22 运行与平台前置 → B23 认证基础 → B24 前端登录门禁 → B25 本地真实数据 → B26 跨服务与浏览器正式测试 → B27 真机、RC 与交接。

按用户“每次执行一个章节”的方式，当前只能开始 B23。B24–B27 必须等待上游章节的代码、契约、运行和证据 Gate 通过；章节内部可由 Agent 并行处理无文件冲突的任务，但不得跨章节跳过依赖。

所有任务默认：

- 状态为“待开始”，完成定义为 G0–G3（适用时含 G4）证据齐全；
- 测试主体、课程、媒体和支付数据必须合成或脱敏；
- Phase 1 不启用 LLM、ASR、AI 发音评分、RTC、数字人、K12 和真实支付；
- 页面打开、HTTP 200、静态目录、Mock 或同 JVM 调用不能关闭运行态任务；
- 自有 JWT profile 必须通过 ADR、OpenAPI 和运行配置锁定；iam-service 是账号密码认证中心，负责签发 JWT、发布 JWKS 和管理会话，不接受客户端权限覆盖。

## 4. B23 — 自有 JWT Bearer / IAM 运行链（7 项）

**批次目标**：让系统具备真实注册、账号密码登录、JWT 签发与 JWKS 验证、principal、Refresh Token 轮换、会话撤销和服务侧默认拒绝能力。B23 通过后才允许修复登录后的业务旅程。

| 任务 ID | 目标 | 主要宿主 | 必须交付/验证 | 依赖 | 当前状态 |
|---|---|---|---|---|---|
| V2-B23-AUTH-001 | 固化自有 JWT profile | ADR、iam-service、部署配置 | 确认 issuer、audience=`yuxuexing-api`、RS256、JWKS、必需 claims、Access Token TTL、Refresh Token TTL 和私钥注入；禁止外部登录协议 | B8、ADR-0012/0013 | 已落地，JWT 运行 Gate 待验收 |
| V2-B23-AUTH-002 | 建立账号密码和设备配置 | Docker/本地配置、四端 | 注册/登录字段、BCrypt 参数、失败锁定、设备登记、密码重置、合成账号清理和统一登录入口；不得保存明文密码 | B23-001 | 配置完成，IAM 运行待验收 |
| V2-B23-AUTH-003 | 实现登录、刷新和 JWKS | iam-service、Gateway、契约 | `POST /auth/login` 签发 JWT；`POST /auth/token/refresh` 轮换不透明 Refresh Token；`GET /auth/jwks` 发布公钥；生成/校验 OpenAPI | B23-001/002 | 代码/契约完成，真实 HTTP 待验收 |
| V2-B23-AUTH-004 | 落地 IAM 本地事实 | iam-service、MySQL、Redis | principal/subject、tenant、设备、会话、Refresh Token 摘要/历史、撤销、成人同意、策略版本和审计事实持久化；Redis 不作为唯一事实 | B23-003 | 代码/迁移完成，真实写入待验收 |
| V2-B23-AUTH-005 | 接通 Gateway 与服务侧 PEP | api-gateway、领域服务 | JWT/JWKS 验证、issuer/audience/算法/过期校验、Bearer 约束、401/403、RBAC+ABAC、owner/tenant 服务端派生、客户端角色头拒绝、fail closed | B23-003/004 | Gateway/IAM 边界完成，真实 JWT 待验收 |
| V2-B23-AUTH-006 | 验证认证异常和生命周期 | tests、Gateway、IAM | 注册、登录、错误密码、账号锁定、Access Token 过期刷新、Refresh Token 轮换/重放拒绝、登出、设备撤销、JWKS 轮换、服务不可用和 CORS 负例 | B23-005 | fail-closed/静态烟测完成，生命周期待验收 |
| V2-B23-AUTH-007 | 认证契约与证据交接 | packages/contracts、生成客户端、evidence | 重新生成契约/客户端；提交 issuer/JWKS/配置摘要、脱敏日志、数据库记录、401/403 回放和回滚说明 | B23-001–006 | 契约/静态证据完成，运行证据待补齐 |

### B23 完成门槛

- 新浏览器可打开统一账号密码登录入口并获得有效 JWT Bearer 会话；
- /api/v1/iam/principal/me 在有效会话下返回真实 principal，在无效会话下返回 401；
- MySQL 有对应 principal、session、consent/adult-gate 事实；
- Gateway 和至少一个领域服务独立完成 JWT/JWKS/PEP 验证；
- 认证失败不得回退为匿名业务数据或假登录成功。

## 5. B24 — H5/Web 全局登录门禁与登录后交互（7 项）

**批次目标**：修复“未登录直接进入首页并点击业务功能”的问题，把四端的公开边界、登录回跳和受保护路由统一起来。

| 任务 ID | 目标 | 主要宿主 | 必须交付/验证 | 依赖 | 初始状态 |
|---|---|---|---|---|---|
| V2-B24-FE-001 | Mobile H5 全局登录门禁 | apps/mobile、App shell/router | 未登录打开根路径即进入登录页；首页、onboarding、今日任务、课程、测评、练习、词汇、报告、我的等受保护路由统一拦截 | B23-003/005 | 代码完成，运行待验收 |
| V2-B24-FE-002 | 注册/登录和 returnTo | apps/mobile、共享 auth client | 统一账号密码登录、JWT token manager、原始路径回跳、刷新恢复、登出和 Token 过期处理；不从 URL 读取凭证 | B23-003/004 | 前端代码完成，IAM 运行闭环待补 |
| V2-B24-FE-003 | learner-web/admin-web 权限边界 | apps/learner-web、apps/admin-web | Web 工作区和后台路由守卫；官网保持公开只读；管理员菜单、角色、403 和客服/教研权限不能由客户端决定 | B23-005 | 代码完成，运行待验收 |
| V2-B24-FE-004 | 成人 Gate 与 onboarding 写入 | mobile、learner-web、learner-service | 注册后完成 18+、隐私/服务同意、学习目标和偏好；取消或拒绝时不创建可学习状态 | B23-004、B24-001/002 | 前端代码完成，服务端写入待验收 |
| V2-B24-FE-005 | 401/403 和八态交互 | 四端共享 API/页面 | 401 跳登录、403 显示权限原因、loading/empty/error/offline/retry 可恢复；禁止把未授权误显示为“暂无数据” | B23-005 | 代码完成，运行待验收 |
| V2-B24-FE-006 | 国际化、主题和响应式一致性 | packages/i18n、design-tokens、四端 | UI locale 与 contentLocale 分离；中英文 fallback、亮/暗/系统/高对比、键盘/触摸焦点和移动安全区 | B24-001–005 | 代码完成，运行待验收 |
| V2-B24-FE-007 | 登录边界逻辑与构建回归 | 四端、tests | H5/Web 组件、路由、深链、构建、类型、契约客户端和未登录/已登录逻辑测试；真实浏览器正式验收留到 B26 | B24-001–006 | 代码/静态验证完成，浏览器待 B26 |

### B24 完成门槛

- 干净浏览器打开 H5/Web 首先进入登录页；
- 未登录不能通过任何业务入口到达受保护页面；
- 登录成功可以回到原始路径；
- 401/403、错误、空数据和加载状态语义正确；
- 不再出现“页面可点击但真实 API 全部 401”的假可用体验。

## 6. B25 — 本地数据库真实数据与学习闭环（6 项）

**批次目标**：准备可回放的合成业务数据，并让注册后的用户从 onboarding 到学习、练习、测评、SRS 和报告真正读写本地数据库。

| 任务 ID | 目标 | 主要宿主 | 必须交付/验证 | 依赖 | 初始状态 |
|---|---|---|---|---|---|
| V2-B25-DATA-001 | schema、迁移和数据 owner 运行核验 | MySQL、各领域服务、Flyway | iam/learner/content/learning/assessment 等独立 schema、迁移顺序、凭据/写权限、空库和重复迁移；禁止跨服务写表 | B15–B23 | 代码/静态完成；本地 schema 与 fixture 已落地，Flyway 空库/重复迁移和 owner grant 证据待补 |
| V2-B25-DATA-002 | 建立 Phase 1 合成 fixture | content、commerce、media、测试脚本 | 已发布课程/单元/词汇/题目/答案规则/音频引用/商品权益/通知偏好；版本、版权和支付关闭状态可追溯 | B25-001 | 代码/静态完成；20 个合成实体、22 个 owner 表绑定和 3 个 Redis 重建配方已落地 |
| V2-B25-DATA-003 | 真实 onboarding 与 learner 事实 | learner-service、MySQL、mobile/Web | principal 关联、目标、时长、偏好、首日投影、幂等保存、刷新/重启后仍可读取 | B24-004、B25-001/002 | 代码完成；JDBC 内部 seam、V4 迁移和 service fixture 已落地，真实 JWT/API/重启回放待补 |
| V2-B25-DATA-004 | 真实内容读取与权限 | content-service、Gateway、前端 | 公开目录与登录内容边界、课程/章节/题目/媒体 manifest、发布版本、版权和下线状态从本地库读取 | B25-002/003 | 代码完成；JDBC 内容 seam、V4 迁移和 service fixture 已落地，Gateway→API→MySQL 权限回放待补 |
| V2-B25-DATA-005 | 真实学习/测评/SRS/报告写链 | learning-service、assessment-service、notification-service | 练习提交、服务端判分、attempt、mastery、SRS、错题、报告和通知写入各自 owner schema；页面刷新可复现 | B25-003/004 | 代码完成；三个服务 JDBC seam/迁移/测试已通过，跨服务事件联调归 B26 |
| V2-B25-DATA-006 | 数据一致性、重启和证据 | MySQL、Redis、前端、evidence | API→DB→API 回放、幂等键、事务边界、Redis 重建、服务重启、fixture 清理、行数/摘要/owner 对账 | B25-001–005 | 部分完成；root MySQL migration/seed 和行数摘要已验证，Redis 重建、API/JWT、重启读回和正式 owner 对账待补 |

### B25 完成门槛

- 登录用户能看到非空且可追溯的本地课程/练习数据；
- onboarding、练习提交、测评和 SRS 变化能在本地数据库中验证；
- 刷新、重新登录或服务重启后数据仍存在；
- 不使用页面内置样例伪造成功；
- 各服务只写自己的 schema，数据 owner 和迁移证据完整。

## 7. B26 — Kafka/Outbox 跨服务与浏览器真实数据正式测试（6 项）

**批次目标**：在 B23–B25 真实链路具备后，执行正式浏览器/H5 测试、跨服务事件测试、缺陷修复和回归。

| 任务 ID | 目标 | 主要宿主 | 必须交付/验证 | 依赖 | 初始状态 |
|---|---|---|---|---|---|
| V2-B26-EVT-001 | 创建 Kafka 事件运行基线 | Kafka、配置、AsyncAPI | Topic、分区键、consumer group、ACL、retention、健康探针和固定端口；禁止 Kafka RPC | B15、B25-006 | 代码/静态完成；运行待验收 |
| V2-B26-EVT-002 | 接通 Outbox 与可靠消费者 | 各服务、workflow、DLQ | eventId/requestId/traceId/schemaVersion、至少一次、去重、重试、DLQ、回放、乱序、Saga 补偿和人工恢复 | B25-005、B26-001 | 代码/静态完成；运行待验收 |
| V2-B26-EVT-003 | 回放完整跨服务旅程 | Gateway、IAM、learner/content/learning/assessment/notification | 注册→登录→目标→课程→练习→判分→掌握度/SRS→报告/通知的跨进程运行证据和数据库对账 | B26-001/002 | 静态回放完成；真实跨服务运行待验收 |
| V2-B26-BRW-004 | 浏览器/H5 真实数据验收 | Mobile H5、learner-web、Gateway | 干净会话注册登录、登录回跳、真实内容、练习写入、测评、刷新、登出、重新登录和异常恢复 | B25、B26-003 | 矩阵/契约完成；认证后真实数据待验收 |
| V2-B26-BRW-005 | 浏览器专项交互回归 | Web/H5、浏览器、测试工具 | Chrome/Edge/Firefox、响应式、弱网/断网恢复、国际化、主题、键盘/触摸、Console/Network、401/403 和深链 | B24-007、B26-004 | 静态矩阵完成；浏览器/设备专项待验收 |
| V2-B26-BRW-006 | 缺陷修复与测试证据包 | 全系统、docs/07-operations | P0/P1 清零或有批准阻断；截图/录像、请求 trace、服务日志、DB/Kafka 对账、复测结果和缺陷台账可追溯 | B26-001–005 | 证据脚手架完成；缺陷闭环待验收 |

### B26 完成门槛

- B26-BRW-004 的完整用户旅程在真实浏览器中通过；
- 关键写操作能在 MySQL 和事件链中找到对应事实；
- Kafka 主题不再为空，事件具备去重、重试和 DLQ 证据；
- P0/P1 缺陷为零，P2 有负责人和截止日期；
- B26 通过后，才可以把系统交给独立测试/验收人员做完整回归。

## 8. B27 — 真机、专项质量、RC 与测试交接（6 项）

**批次目标**：完成移动设备、PWA/小程序、专项质量和发布候选验收，形成 Phase 1 的 Go/No-Go 和测试交接结论。

> 当前里程碑说明：本章代码/静态基础保留。Mobile H5 和 Web 专项能力由 B28–B36 继续使用；iOS/Android/iPad、微信小程序、远程真机、production-like staging、RC 和生产交接运行 Gate 暂缓，未来准备上线时恢复，不计入本机测试完成条件。

| 任务 ID | 目标 | 主要宿主 | 必须交付/验证 | 依赖 | 初始状态 |
|---|---|---|---|---|---|
| V2-B27-DEV-001 | iOS/Android/iPad/移动 H5 真机 | apps/mobile、批准真机或远程真机实验室 | 注册登录、深链、触摸、横竖屏、安全区、后台恢复、网络切换、音频权限和真实数据闭环 | B26 | 代码/静态完成；真机运行待验收 |
| V2-B27-DEV-002 | PWA 与微信小程序条件编译 | learner-web、apps/mobile | 安装/更新/缓存失效、离线只读、条件编译产物、登录边界、返回/分享；不创建第二套业务页面 | B26、B27-001 | 代码/构建完成；安装、更新和微信工具运行待验收 |
| V2-B27-QUAL-003 | 安全、性能、无障碍专项 | Gateway、IAM、四端、基础设施 | 越权/CORS/限流/JWKS、Web Vitals/API 延迟、低配降级、键盘/读屏/对比度/触摸目标和隐私脱敏 | B26 | 代码/静态完成；专项运行待验收 |
| V2-B27-STG-004 | production-like staging 验收 | Kubernetes/Helm/GitOps、四端 | digest 构建、secret 注入、迁移、探针、网络策略、版本/契约绑定、观测、备份和回滚点 | B21/B22、B26 | 代码/静态完成；staging 运行待验收 |
| V2-B27-RC-005 | RC、回滚和 Go/No-Go | CI/CD、产品/架构/安全/数据/运营 | 不可变 RC、全量回归、恢复/回滚演练、风险接受、P0/P1、变更窗口和双人审批 | B27-001–004 | 代码/静态完成；RC、演练和审批待验收 |
| V2-B27-HANDOFF-006 | Phase 1 测试交接 | docs/07-operations、全系统 | 测试报告、证据索引、已知问题、运行/应急/回滚 Runbook、维护 owner、上线/不发布结论 | B27-005 | 代码/静态完成；独立交接签收待验收 |

### B27 完成门槛

- 实体或批准远程设备证据齐全；
- RC 可重复部署、回滚和恢复；
- 安全、性能、无障碍、隐私和数据对账通过；
- 多角色 Go/No-Go 完成；
- 测试报告和维护交接完成。

## 9. 正式测试阶段的进入、完成和上线门槛

不能把“所有章节完成”简单理解为“才能开始测试”。正确的阶段关系是：

| 阶段 | 进入条件 | 主要批次 | 结果 |
|---|---|---|---|
| 开发收口 | B15–B22 运行前置可用，B23–B25 的契约/代码/本地链路开始 | B23–B25 | 认证和真实数据开发完成 |
| 正式测试入口 | B23–B25 完成；注册登录、登录门禁、MySQL 真实读写 smoke 通过 | B26 开始 | 可以正式进行浏览器/H5 全链路测试 |
| 测试完成 | B26 全部通过，P0/P1 清零，跨服务事件和缺陷证据闭环 | B27 开始 | 可以做真机、RC 和发布评审 |
| Phase 1 可上线 | B27 通过，同时 B15–B22 运行/发布/观察期 Gate 全部通过 | B27 收口 | 才能宣告可上线 |

因此：

- 只完成 B23–B25，不能宣告测试完成，但可以进入 B26 正式测试；
- 只完成 B26，不能宣告上线，还要完成 B27 及 B15–B22 的运行发布 Gate；
- B23–B27 全部完成，且 B15–B22/G0–G4 的运行证据完整，才可以宣告 Phase 1 测试和上线交接完成；
- B0–B14 的代码层完成不等于本轮目标完成，B2 保留的 3 个外部集成 TODO 仍需在对应运行测试中关闭或记录批准例外。

## 10. 当前状态快照（2026-08-24）

| 范围 | 当前状态 | 说明 |
|---|---|---|
| B0–B6 | 历史代码/逻辑基线完成 | B2 的 3 个外部集成 TODO 仍需运行验证 |
| B7–B14 | v2 代码层、契约、逻辑/交互测试切片完成 | 自有 JWT 真实持久化、Kafka、跨进程和设备证据不等同于完成 |
| B15–B22 | 代码与静态 Gate 基础完成；部分本地运行 smoke 已取得 | 认证后业务闭环、跨服务事件、生产等价 staging、回滚和观察期仍未完成 |
| B23 | 代码/契约/迁移与 fail-closed 烟测完成，自有 JWT Bearer 运行待验收 | 注册、账号密码登录、JWKS、有效 JWT、Refresh Token 轮换和 IAM session 仍待运行证据 |
| B24 | 四端登录门禁、成人 Gate、JWT token manager、401/403、i18n/theme 代码和静态验证完成，运行待验收 | 真实登录/刷新和浏览器正式回归仍未关闭 |
| B25 | 代码、契约、fixture、迁移和本地 MySQL 静态/回放基础完成，运行闭环待验收 | API→DB→API、有效 JWT、Redis 重建、服务重启和 owner 对账仍未关闭 |
| B26 | 代码与静态验证完成，运行/正式浏览器证据待验收 | Kafka/Outbox、有效 JWT、API→DB→API、事件对账和缺陷闭环仍未关闭；详见 `docs/07-operations/b26-validation.md` |
| B27 | 代码与静态验证完成；外部设备/发布运行项暂缓 | Mobile H5/Web 子集转入 B28–B36 本机计划；iOS/Android/iPad、微信、staging、RC、回滚和生产交接未来恢复；详见 `docs/07-operations/b27-validation.md` |
| G0–G4 | 代码/静态门禁完成 | 真实范围、运行、设备、安全和发布证据仍需补齐 |
| B28–B36 | 已进入执行，以 B28–B36 文件逐项状态和最终 `LOCAL-TEST-NO-PASS` 为准，不用单一完成比例替代证据 | B28–B33 开发收口，B34–B35 真浏览器测试/修复，B36 本机交接；不包含原生端和生产发布 |

## 11. 证据最低标准

每个任务至少绑定：任务 ID、Feature Ref/ARCH Ref、commit、环境和版本、合成账号、操作步骤、预期/实际结果、截图或录像、Network/traceId、服务日志、数据库或 Kafka 对账、缺陷编号、复测结果和回滚说明。

真实手机号、真实音频、生产凭证、支付密钥、供应商 secret 和未脱敏用户数据不得进入代码、fixture、日志或证据包。

本基线只负责 Phase 1 的 B23–B27 任务定义和状态；执行结果必须追加到对应验证文档和 CHANGELOG，不得把“已设计”改写成“已完成”。
