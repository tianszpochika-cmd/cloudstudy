# M1-017 Analytics telemetry ingress

状态：`D2_CONTRACT_READY` / `NOT_RUNTIME_VERIFIED`

本页只描述 analytics-service 的客户端 telemetry ingress 契约。唯一的 source fragment 是
`packages/contracts/fragments/b13/b13-commerce-admin-analytics.openapi.json`；专属策略位于
`config/p1r-analytics-ingress.v1.json`。

## 边界

`POST /api/v1/analytics/telemetry` 只接收有限的 UI telemetry 事件。请求没有
`tenantId`、`actorId`、`principalId`、`role`、`ownerId` 或删除/保留状态字段；tenant、subject、同意状态、删除状态和 policy version 均由已验证的服务端上下文提供。所有 `clientAuthority` 声明必须精确为 `NONE`。

请求 payload 使用显式 `oneOf`，每个分支都是 `additionalProperties: false` 的闭合对象。页面、控件、播放和错误事件只允许结构化 code/enum 字段；`rawText`、`rawBody`、`description`、`body`、`freeText`、密码、Token、原始音频、支付凭据、签名及其嵌套变体均拒绝。未知字段和未约束的对象类型 fail closed。

## 同意、删除与失败语义

- 同意必须由服务端判定为 `GRANTED`；缺失、撤回或未知状态返回 `SUPPRESSED`。
- IAM 删除状态只有 `ACTIVE` 可继续接收；`PENDING_COOLING_OFF`、`EXECUTING`、`RECOVERY_REQUIRED`、`ANONYMIZED` 以及缺失/未知状态均返回 `SUPPRESSED`。`CANCELLED` 不能由客户端或 analytics 直接放行；只有 IAM 重新解析为 `ACTIVE` 且同意仍为 `GRANTED` 后才可接收。
- telemetry 使用 Idempotency-Key 和 client event 摘要重放原回执；telemetry 的失败、重试或抑制不能重试或修改任何学习、支付、审核或其他领域事实。
- 采样由服务端策略控制，客户端不能通过采样提示、保留期限或事件字段扩大采集范围。

## 事件隔离与运行边界

该 route 的 transport 固定为 `HTTP_TELEMETRY_ONLY`，不发布 Kafka 事件、不是 Kafka producer，也不写领域事实。`analytics.metric.projected.v1` 等后端脱敏投影事件仍由独立事件治理维护，UI telemetry 不得加入 B13 事件 fragment、AsyncAPI 或 Outbox。

当前证据只覆盖 OpenAPI/config 的静态闭合检查和 mutation 负例：真实 Gateway/IAM/PEP、同意和删除事实源、数据库、对象存储、Kafka、consumer、workflow、浏览器及 E2E 仍未验证。局部测试：

```powershell
node --test tests/p1r/p1r-analytics-ingress-contract.test.mjs
```
