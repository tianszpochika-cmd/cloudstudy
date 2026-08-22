# contracts

API、事件、JSON Schema、AI 输入输出和内容 schema 的共享契约。修改这里通常需要同步服务、客户端和测试。

OpenAPI、事件目录和 JSON Schema 分别位于 `openapi/`、`events/` 与 `schemas/`；生成物位于 `generated/`。兼容性检查使用 `scripts/contracts/compatibility-diff.mjs`，删除既有路由/事件/字段、增加必填字段、收窄枚举或改变类型都会被视为破坏性变更。

```powershell
pnpm contracts:validate
pnpm contracts:generate
pnpm contracts:compatibility -- --kind openapi
pnpm contracts:compatibility -- --kind events
pnpm contracts:compatibility -- --kind schema
```

所有外部客户端仍只能通过 Gateway 的 `/api/v1` 边界访问；`packages/api-client/src/gateway-test-double.ts` 供四端契约/交互测试使用，不替代真实 Gateway 运行态。
