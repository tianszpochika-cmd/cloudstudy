# B0 安全、数据边界与埋点底座

> 状态：B0 已落地的机器可读基线。实现位于 `packages/telemetry/`，本地验证入口位于 `scripts/security/run-b0-harness.mjs`。

## 1. 默认拒绝与最小角色

安全策略的单一事实源是 `packages/telemetry/policies/access-control.json`。策略包含角色、资源、动作、作用域和导出字段；任何未注册项都不通过。

| 角色 | 作用域 | 允许的最小资源边界 |
| --- | --- | --- |
| `learner` | 本人 + 本人所在租户 | 本人画像、学习记录、学习会话、测评尝试、本人数据导出 |
| `admin` | 所属租户 | 租户内用户/画像/学习记录/内容/媒体/权益/审计查询，以及租户导出 |
| `content-editor` | 所属租户 | 内容与媒体的编辑、提交审核和内容导出；不能读取用户或支付资源 |
| `finance` | 所属租户 | 订单、支付、权益只读与财务导出 |
| `auditor` | 所属租户 | 审计日志只读与审计导出 |
| `finance-auditor` | 所属租户 | 财务只读 + 审计只读与合并导出 |

实现层要求：

1. actor 必须有稳定 `id`、`roles` 和 `tenantId`；缺失租户直接拒绝。
2. 租户角色只能访问 `resource.tenantId === actor.tenantId` 的资源；没有全局角色。
3. `learner` 还必须在 `ownerId/subjectId/userId/actorId` 中命中本人 ID；同租户的其他学习者也拒绝。
4. 不允许通过客户端提交的角色、租户或资源归属字段扩大权限；服务端应从已验证会话和持久化资源加载这些字段。

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

- Core API 的过滤器/拦截器应把已验证 actor、资源租户和动作映射为 `evaluateAccess` 输入；不应复制一套角色枚举。
- API 响应沿用 `{requestId,data,meta,serverTime}` 和 `{requestId,error}`，错误详情进入 `createApiErrorEnvelope` 前必须经过敏感字段检查。
- 业务事件只能先登记到事件注册表并通过兼容性测试，再被 Java、前端或 worker 消费。
- 数据库表、审计表、登录 Token、支付 JWS 和原始媒体仍由各自领域任务实现；本底座只规定它们不能越过安全/埋点边界。
