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

- 使用经 ADR 选择的标准 OIDC IdP；授权码 + PKCE、Access Token/JWKS 验签、Refresh Token 轮换、会话撤销、密钥轮换和重放检测均有测试和审计证据，禁止以自研 Token 服务器替代。
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
