# 验收标准

## A. Phase 1 新用户首日路径

- 用户能在 3 分钟内完成登录、年龄边界确认和学习目标选择。
- 测评中断后可以恢复，不重复提交已完成题目。
- 测评由确定性规则计算，结果标注为产品参考，不宣称官方认证。
- 测评结束后展示起点建议、首个目标和今日任务。
- 首次任务完成后展示下一次复习时间和继续学习入口。

## B. Phase 1 课程与练习

- 每个单元有目标、输入材料、练习、反馈和完成条件。
- 题目、答案、解析、版权状态和评分规则均有版本号。
- 练习提交幂等，重复点击不会生成重复记录。
- 错误能进入个人复习队列，并带有来源和优先级。
- 用户可以查看历史答案、参考答案和规则化建议。

## C. Phase 1 内容与后台

- 草稿内容不能被学习者访问。
- 发布、下线和批量修改都有操作者、时间、版本和变更记录。
- 后台 API 按角色限制课程、用户、订单和数据导出权限。
- 每项内容都记录来源、版权状态、授权凭证或开放许可依据。
- 内容发现错误后可以快速下线、修订和恢复指定版本。

## D. Phase 1 账号、权益与隐私

- 用户可查看隐私政策、数据用途、权限状态和账号注销入口。
- VIP 到期后权益降级，学习数据不丢失。
- 激活码不可重复使用，兑换、撤销和过期均可审计。
- 支付功能仅在商户资质、平台审核和退款流程就绪后开启。
- 测试环境只使用合成或脱敏数据。

## E. Phase 2 AI 验收（Phase 1 不适用）

- AI 输出必须符合约定 schema，解析失败时使用安全降级结果。
- 反馈必须引用当前课程目标，不得泛泛评价整体英语水平。
- 生产请求记录模型、提示词版本、耗时、成本估计和错误类型。
- AI 生成内容必须经过内容安全检查、来源记录、版本管理和必要的人工审核。
- AI 失败不能阻塞课程完成，也不能丢失原始练习记录。

## F. 质量与安全

- Gateway 和每个领域服务都有鉴权、权限校验、速率限制和输入校验；不能只验证 Gateway。
- 关键事件能在日志和分析系统中关联 requestId/traceId。
- 跨端核心流程覆盖 Web/H5、iOS、Android 的响应式和弱网测试。
- 动效具有 Ultra / High / Medium / Performance 四级降级策略。
- 生产发布前完成隐私、内容版权、平台审核和回滚清单。

## G. v2 Gateway 与 API 平台验收

- 所有外部业务请求只通过 `api-gateway` 和 `/api/v1` 版本入口；直连领域服务在网络策略和应用层均被阻断或明确限制为内部流量。
- Gateway 能执行路由、CORS、限流、requestId/traceId 注入、JWT/JWKS 预校验、超时和错误 envelope；异常时不会把内部堆栈或凭证返回客户端。
- OpenAPI/AsyncAPI/JSON Schema 均来自 `packages/contracts/`，生成物、兼容性 diff、operationId、错误码和弃用窗口可复现。
- Gateway 发生故障、路由回滚或旧 `core-api` 兼容切换时，有可执行的回滚和流量恢复证据。

## H. v2 IAM、RBAC 与 ABAC 验收

- `iam-service` 使用账号密码校验并直接签发符合 ADR-0013 的短时非对称 JWT Bearer Access Token；认证中心发布 JWKS 并支持公钥轮换。登录、刷新、登出、会话撤销、Refresh Token 轮换/重放检测、密码重置、设备撤销和审计均有测试证据；正式方案不使用 OIDC/OAuth、Keycloak 或第三方身份提供方。
- Access Token 至少包含 `iss`、`sub`、`aud`、`exp`、`iat`、`nbf`、`jti`、`token_type`、`scope`，必要时包含服务端生成的 `permission`/`permissions`、`role`/`roles`、`tenant_id` 和 `session_id`；`aud` 固定为 `yuxuexing-api`，算法只允许登记的 RS256/ES256。
- Gateway 与每个领域服务独立通过 JWKS 验证 issuer、签名、算法、audience、时间窗口、token type 和权限声明；错误 issuer/audience/signature/algorithm/expired token 返回 401，身份有效但无权限返回 403。
- Web Access Token 不写入 localStorage/sessionStorage；Refresh Token 仅使用 HttpOnly + Secure + SameSite Cookie。移动端 Refresh Token 只能进入 Keychain/Keystore 等系统安全存储，安全存储不可用时不得降级到普通 storage；official-site 不保存业务 Token。
- 密码只以 Argon2id（不可用时 BCrypt cost≥12）哈希保存；登录接口必须限流、失败锁定、返回不泄漏账号存在性的错误，密码重置令牌一次性、短时、可撤销且不写日志。
- 生产 JWT 私钥只能由 secret manager/KMS 注入，不能进入 Git、镜像、普通配置、日志、URL、事件、埋点或截图。
- 权限决策至少验证 subject、tenant、role、permission、action、resource、owner、phase、content rights、device/consent；缺失上下文默认拒绝。
- `learner` 只能访问本人资源；租户管理员不能越租户；内容、财务、隐私、审计和发布操作按最小权限分离；高风险操作需要审计或双人审批。
- Gateway 与领域服务均执行 PEP；`X-B5-Role`、`X-Role`、客户端 tenant/owner 字段不能提升权限；401、403、资源不存在和空数据语义可区分。
- 服务侧 PEP 使用已验证 JWT、资源本地事实和版本化策略包/短时安全缓存；远程 PDP 仅用于高风险、动态策略或安全缓存未命中。PDP 失效、撤销不确定或策略版本过期必须 fail closed，不能成为普通请求的无限同步依赖。
- Phase 1 的 tenant 由服务端固定派生；Phase 3 的共享 schema 表、查询、唯一约束和索引必须带 `tenant_id`/`TenantScope`，并有跨租户读取、写入和后台导出拒绝测试。MySQL 不得被描述为自动行级隔离。
- 角色、权限、策略版本、授权决策、拒绝原因和高风险操作可用 `requestId/traceId/decisionId/auditId` 回放；导出字段按默认脱敏策略处理。

## I. v2 微服务、数据与事件验收

- 每个服务拥有明确的 API、数据库/schema、Flyway migration、Redis namespace、事件契约、运行 owner 和回滚责任；已从 `core-api` 抽取的服务还必须具有独立 OCI 进程、凭据和发布流水线，不能以“创建目录/README”或同 Pod/JVM 共置作为完成证据。
- 禁止跨服务写表、共享 ORM entity、跨服务 SQL join 和把 Redis 当唯一事实源；跨域协作使用 API、gRPC、事件、Saga 或补偿。
- 内容/题目答案规则版本、attempt/判分/报告、计划/SRS/掌握度分别由 content、assessment、learning 的唯一 owner 管理；admin/workflow/audit 只能聚合、发命令或留痕，不能跨域双写。
- 关键跨服务写入使用 Outbox 和幂等键；事件包含 eventId、requestId、traceId、schemaVersion 与聚合分区键，采用至少一次投递，消费者支持去重、重试、乱序、DLQ 和回放。UI 点击、日志、指标和 RPC 不得伪装成领域事件。
- 具备超时、重试预算、熔断、优雅停机、健康探针、容量告警和故障注入证据；关键业务不会因重复消息重复记账。
- 生产前完成备份/PITR、RPO/RTO、恢复演练、SLO、OpenTelemetry Trace/Metric/Log/Audit 关联、SBOM 和依赖漏洞扫描。

## J. v2 架构迁移验收

- 新领域服务通过 Gateway/IAM 接入旧 `core-api` 后，先完成契约、数据一致性、权限、观测和回滚验证，再切换写流量。
- 新领域服务只有在独立进程、schema/凭据、发布/回滚、故障隔离和数据 owner 证据齐全后才可标为“已抽取”；否则仍标注为 `core-api` 迁移兼容。
- 旧服务路由只有在新服务达到业务、数据、安全、SLO 和回滚 Gate 后才能关闭；旧任务的“已完成”不能替代 v2 迁移证据。
- 新任务同时引用 `FEAT/PRD-ATOM/V2-980` 与 `ARCH-*`，并标注目标服务 owner、前端项目、契约、迁移和证据包。

## K. Phase 1 运行态与系统测试验收

- Java 25/Maven、容器/测试基础设施、Gateway、IAM 和 Phase 1 目标服务可以按固定端口在干净环境中重复启动；每个服务具备独立进程、schema/凭据、health/readiness、优雅停机和可回滚发布证据。
- 至少一条学习读链路和一条关键写链路完成真实测试运行态回放：Gateway → 服务侧 PEP → 领域事实 → Outbox/Kafka → 消费者 → Trace/Audit；内容、判分、学习掌握度仍由唯一 owner 管理。
- 四个前端均通过真实测试 API 完成核心路径：登录/成人 Gate、Onboarding、学习/练习/复习/报告、后台审核/运营、官网公开投影；401/403、Loading/Empty/Error/Permission/Recovery 和安全深链语义正确。
- 浏览器、H5、iOS、Android、iPad、PWA、微信小程序条件编译覆盖安装/升级、权限、后台恢复、横竖屏、弱网/离线、性能、键盘/读屏、对比度、国际化 fallback、主题持久化和四级画质降级。
- 契约/事件/迁移/Redis/配置/端口、安全扫描和生成客户端无 breaking；P0/P1 缺陷为零，P2 缺陷有责任人、风险接受或上线前修复计划。

### K.1 当前本机真实全栈专项验收

- 当前专项只验收 learner-web、Mobile H5、admin-web、official-site、本机基础设施和 `config/v2-runtime-services.json` 登记的 14 个后端进程；iOS/Android/iPad 原生、微信小程序、远程真机、staging、RC 和生产发布暂缓。
- 页面动态数据必须来自 `Browser → Frontend → Gateway → Domain Service → MySQL owner schema`。允许使用合成测试账号和合成课程，但必须持久化并通过正式 API 提供；组件常量、静态 JSON、Mock Server、内存 Repository、localStorage 和固定 Token 不能作为成功证据。
- MySQL 是领域事实源；Redis 只能是可重建缓存/投影，Kafka 只承载跨服务事实，MinIO 只承载本地测试媒体。关键写操作必须以 requestId/traceId、owner row 和 eventId（适用时）对账。
- UI 验收必须由 Codex Browser MCP 实际打开页面、点击、输入、提交、等待、刷新和截图；CLI/API/SQL 只能辅助准备环境和核对事实，不能替代浏览器操作。
- B28–B33 完成后才进入 B34 正式本机浏览器测试；B34–B36 全部通过、P0/P1 为零并连续两轮冷启动/核心旅程成功后，才可给出 `LOCAL-TEST-PASS`。
- `LOCAL-TEST-PASS` 只代表本机 Web/H5 前后端真实数据功能可测试，不代表原生端、微信、production-like staging、RC、生产 Go/No-Go 或 Phase 1 上线通过。

## L. Phase 1 发布与上线验收

- staging 与 production 具备分层配置、不可变镜像、secret 注入、SLO/错误预算、告警、值班 Runbook、版本签名和可验证回滚点。
- 隐私告知/同意、账号导出/注销/删除/留存、内容版权/双审/撤回、审计脱敏和支付 sandbox/回调/退款/对账证据完整；真实支付默认关闭，未获得资质不得打开。
- MySQL/Redis/Kafka/对象存储完成备份/PITR、RPO/RTO 和恢复演练；恢复后通过数据/事件对账，不能只证明进程重新启动。
- 产品、架构、安全、数据、运营共同完成 Go/No-Go；生产小流量上线、关键旅程 smoke、迁移对账和观察期无未处置 P0/P1，Phase 1 上线报告与维护责任已归档。
