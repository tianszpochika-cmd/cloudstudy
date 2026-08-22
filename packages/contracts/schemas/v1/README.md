# JSON Schema v1

跨服务 JSON Schema 以 `registry.json` 为入口。Schema 只描述可跨边界复用的结构，不承载领域事实；OpenAPI 和事件契约分别位于 `openapi/` 与 `events/`。

修改 Schema 时必须同时运行：

```text
pnpm contracts:validate
pnpm contracts:generate
pnpm contracts:compatibility -- --kind schema --baseline <old.json> --current packages/contracts/schemas/v1/registry.json
```
