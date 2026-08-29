# v2 安全、数据边界与埋点底座

> 状态：继承 B0 的机器可读策略，并绑定 v2 的 Gateway/IAM/RBAC/ABAC 目标架构。`packages/telemetry/` 和 B0 harness 是静态策略证据，不代表 `iam-service`、Gateway 或服务侧 PEP 已经完成。
> 权威架构：[v2 微服务目标架构](./v2-microservices-architecture.md)、[平台能力矩阵](./v2-platform-capability-matrix.md)、ADR-0010、[ADR-0013](../10-decisions/0013-self-owned-jwt-authentication-center.md)。

## 1. 默认拒绝与最小角色

IAM 授权语义以 ADR-0010、B8 OpenAPI 和版本化策略包为事实源。`packages/telemetry/policies/access-control.json` 是迁移期 B0 静态防护与埋点/导出测试输入，不能冒充运行期 IAM policy，也不能覆盖 Phase 1 业务角色。任何未注册或来源不可信的授权事实都不通过。

| 角色 | 作用域 | 允许的最小资源边界 |
| --- | --- | --- |
| `visitor` | 匿名公开边界 | 官网公开投影、课程/价格/下载/合规；不产生已登录 authority |
| `learner` | 本人 + 服务端派生的 Phase 1 tenant | 本人画像、学习、会话、测评、权益、设备与隐私请求 |
| `content-editor` | 服务端 tenant 内的内容草稿 | 内容与媒体编辑及提交审核；不能自审、发布或读取用户/支付资源 |
| `reviewer-l1` / `reviewer-l2` | 分离的受审内容版本 | 分别执行一审/二审；作者、一审和二审的职责分离由服务端事实校验 |
| `release-operator` | 已通过双审与版权 Gate 的版本 | 发布、下线、回滚；不能编辑或审核自己的内容版本 |
| `finance` | 最小商业范围 | 订单、支付、权益、退款与对账；不能继承客服或平台管理员的业务明文权限 |
| `support` | 已分派工单的最小脱敏范围 | 回复、升级和受控恢复命令；不能直接改密码、分数、奖励或权益账本 |
| `privacy` | 指定隐私请求范围 | 导出/删除审查、法律保留例外与回执；不能浏览无关个人数据 |
| `auditor` | 只读审计范围 | 审计检索和脱敏导出；不能修改业务事实或删除审计记录 |
| `platform-admin` | 受控平台配置范围 | 角色/策略草稿与应急配置；仍受 tenant/owner/phase/consent、双人审批和审计约束 |
| `system` / `payment-channel` | 可信服务身份或验签渠道范围 | 仅执行具名系统任务或签名回调；不能借内部身份跨服务写表或直接发放权益 |

实现层要求（目标由 `iam-service` 统一承载，领域服务必须重复执行 PEP）：

1. principal 必须有稳定 subject、会话、服务端 tenant、角色/权限绑定、policy version 和事实来源；任何必需上下文缺失直接拒绝。
2. 资源 tenant/owner/content rights 由领域 owner 从持久化事实加载，再与 principal 比较；请求体中的同名字段不具有 authority。
3. `learner` 必须命中本人 owner；同一 Phase 1 tenant 的其他学习者仍拒绝。`platform-admin` 也没有绕过 owner、版权、阶段、同意或隐私目的的全局通行权。
4. 内部 PDP 调用必须有可信服务身份、受众和调用服务声明；外部客户端不能直接调用，也不能通过角色头、tenant/owner 或 permission 字段扩大权限。

### 1.1 成人 Gate、同意与策略版本

- 成人 Gate 由 IAM 按服务端时间与当前政策版本判断，记录最低年龄、判定状态、证据摘要和重验证时间；出生年份或确认框只是输入。Phase 1 未证明 18+、政策过期或需重验证时进入受限状态并 fail closed。
- 同意按 purpose、required/optional、文档 version/digest 和授予/撤回事实管理。required consent 缺失、撤回或需重确认时拒绝对应动作；optional consent 只控制其目的范围，不得被复用为通用授权。
- policy 变更遵循不可变 `DRAFT → SUBMITTED → APPROVED → ACTIVE → REVOKED`，提交者与批准者必须分离；激活/撤销产生审计与缓存失效事实。旧策略历史可回放但不能重新变成静默生效版本。

### 1.2 自有 JWT Bearer 认证边界

- `iam-service` 校验平台账号密码并在 Phase 1 直接签发短时 RS256 JWT Access Token，公开只读 RSA JWKS；认证中心不依赖外部身份提供方。ES256 只能在新增 ADR、同步更新契约与 JWKS key schema、密钥管理和运行实现并通过验证后扩展。
- Gateway 和每个领域服务都必须独立校验 issuer、audience、签名算法、公钥、时间窗口、token type 和必要 scope/permission；JWKS 不可用、密钥轮换不确定或撤销状态不确定时 fail closed。
- Access Token 只通过 `Authorization: Bearer` 发送；不进入 URL、日志、事件、埋点、错误 envelope 或业务数据库。Refresh Token 是认证中心管理的轮换/撤销会话凭证，Web 仅用 HttpOnly/Secure/SameSite Cookie，移动端仅用 Keychain/Keystore。
- 登录、刷新、登出、设备撤销和密码重置接口均由 IAM 提供；`iss/sub/aud/exp/iat/nbf/jti/token_type/scope` 为最低声明，业务角色/权限/租户由服务端事实生成。

### 1.3 Gateway 路由、来源和直接访问边界

- Gateway D2 政策的单一事实源是 `packages/contracts/fragments/p1r-gateway-boundary.openapi.json`。每个 active `/api/v1` operation 必须经有序规则唯一映射到 owner；规则未覆盖、同优先级冲突、未知 owner、`/internal/v1` 外部暴露或把新领域写入送往 `core-api` 时均拒绝。
- learner-web、admin-web、mobile H5、official-site 与原生端使用不同 origin/transport profile。credentialed CORS 只接受精确 origin 且禁止 wildcard；official-site 不建立业务会话；原生端不使用 Cookie，并把 `NATIVE_SECURE_STORAGE` 与可信客户端/设备上下文交叉校验。
- 携带认证 Cookie 的非安全方法先精确校验 `Origin`，仅在没有 `Origin` 时允许精确 `Referer` origin 回退；缺失、不受信或冲突返回 canonical 403。SameSite 只是纵深防御，不能代替来源校验。
- JWT 预检、具名 route-class 限流、canonical 401/403/429/5xx、`Retry-After`、requestId/traceId、幂等键和脱敏边界审计均必须由合同驱动。受保护/高风险路径的限流后端异常默认 503 fail closed。
- Gateway 对 `/internal/v1` 返回拒绝只证明应用入口语义；生产仍必须用 Ingress/NetworkPolicy/安全组和独立服务凭据阻断客户端直连领域服务，并提供跨进程运行 Evidence。

P1R-M1-004 只完成上述 D2 合同与自动审计；现有 WebFlux 配置、真实 Redis/JWKS、浏览器行为和网络隔离由 P1R-M2-001 修复和验收。

## 2. 导出字段策略

`authorizeExport` 先检查角色、动作、租户/本人边界，再由 `maskExportFields` 输出。未知字段默认丢弃，禁止把“未配置”当作“原样导出”。

- 账号标识、资源 ID、request/trace ID：稳定哈希，保留对账能力但不暴露原值。
- 邮箱、电话、显示名、IP：部分脱敏。
- 时间、状态、课程目标、金额分、币种和渠道：按角色策略保留。
- `password`、Token、Authorization/Cookie、原始音频/音频字节、支付凭证、银行卡号/CVV/CVC、JWS/receipt、私钥：丢弃或在埋点/错误 envelope 入口直接拦截。

## 3. 统一埋点 envelope

事件注册表是 `packages/telemetry/policies/telemetry-events.json`，JSON Schema 是 `packages/telemetry/schemas/telemetry-event.schema.json`。事件名必须符合 `domain.action.vN`，事件 payload 必须在注册表中声明，并包含不带版本后缀的 `schema`。

每条事件至少包含：

```text
eventId, eventName, eventVersion, occurredAt, environment, source,
requestId, traceId, correlationId, actorId, tenantId, payload
```

匿名事件的 `actorId/tenantId` 可以是 `null`，但关联 ID 不能缺失。`createTelemetryEnvelope` 会生成缺省 ID；`assertTelemetryEvent` 和 `sanitizeTelemetryEvent` 会拒绝未知事件、未知字段、版本不匹配和敏感字段。

错误日志只允许记录稳定 `errorCode`、错误类别、是否可重试和耗时等摘要，不记录原始请求、Token、音频或支付凭证。

## 4. 本地与 CI 入口

该 B0 harness 只依赖 Node 内置模块，不启动数据库、缓存、消息队列、HTTP 服务或外部供应商：

```text
# 完整 B0 校验：策略检查 + 合成夹具扫描 + node:test
node scripts/security/run-b0-harness.mjs

# 分步运行
node scripts/security/verify-policies.mjs
node scripts/security/scan-synthetic-fixtures.mjs
node --test tests/contract/api-envelope.test.mjs tests/contract/telemetry-contract.test.mjs tests/contract/telemetry-compatibility.test.mjs tests/integration/security-boundary.test.mjs
```

CI 直接调用 `node scripts/security/run-b0-harness.mjs` 即可；不需要编辑根 `package.json`，也不需要任何真实账号、密钥、音频或支付数据。

## 5. 与后续服务接入的边界

- Gateway 负责 JWT 预校验、路由级策略和边界限流；`iam-service` 负责 principal、成人/同意、角色/权限/策略控制面和版本化 PDP；每个领域服务必须把已验证 subject、服务端 tenant、所需 permission/action、本地 resource/owner/rights、phase、device trust、consent 和 policy version 映射为结构化决策输入。
- 正常热路径在领域服务本地 PEP 执行。高风险、动态策略或安全缓存未命中才远程调用 PDP；policy 过期/撤销不确定、cache invalidation 未收敛、PDP 超时/不可用、内部服务身份或关键事实缺失时一律 DENY。
- 当前 `services/core-api` 的过滤器只能作为迁移适配，不是最终权限实现；在 v2 迁移完成前不得把其现有的客户端角色约定视为 RBAC 完成。
- 不应在各服务复制一套角色枚举；共享的是 contracts/决策接口，策略事实归 IAM，资源所有权事实归领域服务。
- API 响应沿用 `{requestId,data,meta,serverTime}` 和 `{requestId,error}`，错误详情进入 `createApiErrorEnvelope` 前必须经过敏感字段检查。
- 业务事件只能先登记到事件注册表并通过兼容性测试，再被 Java、前端或 worker 消费。
- 数据库表、审计表、登录 Token、支付 JWS 和原始媒体仍由各自领域任务实现；本底座只规定它们不能越过安全/埋点边界。

## 6. v2 授权验收最低条件

- Gateway 直连阻断、JWT/JWKS 轮换、Token 撤销和服务侧二次验签均有运行证据。
- learner、content-editor、reviewer-l1、reviewer-l2、release-operator、finance、support、privacy、auditor、platform-admin 等 Phase 1 规范角色在本人/租户/资源 owner/动作矩阵上有 allow/deny 测试。
- `X-B5-Role`、`X-Role`、客户端 tenant/owner 字段不能提升权限；缺少上下文默认 deny。
- 权限变更、策略版本、决策 ID、403、导出和高风险后台操作可通过 requestId/traceId/auditId 回放。
- 成人/required consent 的缺失、撤回、过期和重验证均有拒绝测试；策略 draft/submit/独立 approve/activate/revoke、职责分离与缓存失效均有契约和运行证据。
