# telemetry

语学星跨端事件、request ID、trace ID、RBAC/租户边界和隐私过滤的统一底座。

## 单一事实源

- `policies/access-control.json`：角色、资源、动作、租户/本人作用域和导出字段策略。
- `policies/telemetry-events.json`：事件注册表、事件版本、允许字段和敏感字段规则。
- `schemas/telemetry-event.schema.json`：统一事件 envelope 的 JSON Schema。

默认策略是拒绝（`defaultEffect: deny`）。未注册角色、资源、动作、事件或导出字段都不能被隐式放行。

## 运行库入口

`src/index.mjs` 提供纯 Node ESM 实现，可被 JavaScript/TypeScript 服务或测试直接调用：

- `createTelemetryEnvelope` / `assertTelemetryEvent` / `sanitizeTelemetryEvent`。
- `createRequestContext`，统一生成或传递 `requestId`、`traceId`、`correlationId`、`actorId`、`tenantId`。
- `evaluateAccess` / `authorize` / `authorizeExport`，默认拒绝并强制本人或租户边界。
- `maskExportFields`，未知字段丢弃，账号、电话、IP、标识符按策略脱敏。
- `createApiSuccessEnvelope` / `createApiErrorEnvelope` / `assertApiEnvelope`，对应现有 `{requestId,data,meta}` 和 `{requestId,error}` 约定。

禁止密码、Token、Authorization/Cookie、原始音频/音频字节、支付凭证、银行卡安全码和私钥进入埋点或错误响应；违规输入会抛出可供程序判断的错误码。

## 最小本地验证

仓库根目录执行：

```text
node scripts/security/run-b0-harness.mjs
```

该入口只使用 Node 内置模块，先校验机器可读策略，再扫描合成夹具，最后运行 `node --test` 的契约与集成测试，不需要启动 MySQL、Redis、Core API 或任何外部服务。
