# B7 代码层验证与测试阶段交接

> 执行日期：2026-08-22  
> 范围：Platform 0、v2 契约、Gateway 兼容边界、数据/观测底座、官网源代码、四端国际化与主题适配。  
> 结论：B7 代码层已完成，可进入逻辑/交互测试阶段；Java 25 + Maven 运行态构建仍待具备对应工具链后复核。

## 交付证据

| 任务 | 代码证据 | 当前结果 |
|---|---|---|
| `V2-B7-PLAT-001` | `services/service-template/`、`services/api-gateway/pom.xml`、固定端口登记、`apps/miniapp-wechat/README.md` | Java 25 / Spring Boot 4.1.1 模板与健康/readiness 配置已落地；旧 `core-api` 未被改成 v2 服务 |
| `V2-B7-API-002` | `packages/contracts/schemas/v1/`、`scripts/contracts/compatibility-diff.mjs`、生成的 `packages/contracts/generated/schemas.ts`、`packages/api-client/src/gateway-test-double.ts`、`tests/b7/gateway-client.test.mjs` | OpenAPI/事件/JSON Schema 校验、生成和 breaking diff 已可执行；请求 envelope、trace 和幂等头有测试替身 |
| `V2-B7-GW-003` | `services/api-gateway/src/`、`tests/b7/gateway-platform.test.mjs` | `/api/v1`、GET/HEAD-only 兼容路由、默认拒绝安全链、local profile 只读兼容、requestId/traceId、CORS、限流占位、JWT 预校验边界和错误映射已实现；无领域写入 |
| `V2-B7-DATA-004` | `database/mysql/migrations/V0001–V0004`、`database/redis/keyspace.registry.json`、`tests/b7/data-observability.test.mjs` | schema ledger、幂等、Outbox、审计、Redis namespace/TTL 和静态安全验证已覆盖 |
| `V2-B7-OBS-005` | `packages/telemetry/`、服务模板 OTel 配置、`tests/b7/data-observability.test.mjs` | requestId/traceId 关联、敏感字段拒绝、错误 envelope 和 Redis/迁移验证通过 |
| `V2-B7-OFS-006` | `apps/official-site/pages/`、`components/`、`server/routes/`、`tests/b7/official-site.test.mjs` | 首页、课程、价格、下载、关于、合规、SEO/robots/sitemap、公开状态和受控登录深链已具备；不调用登录后学习 API |
| `V2-B7-FE-007` | `packages/i18n/`、`packages/design-tokens/`、四个应用的 `v2-foundation` 适配入口、`tests/b7/i18n-theme.test.mjs` | `zh-CN`、UI/content locale 分离、fallback/格式化/伪本地化、四主题、SSR no-flash、Vue Web/uni-app/Element Plus 适配已落地 |

## 已执行验证

```text
node --test tests/b7/*.test.mjs                         28/28 passed
pnpm contracts:validate                                 passed
pnpm contracts:generate                                 passed
pnpm contracts:compatibility -- --kind openapi          compatible
pnpm contracts:compatibility -- --kind events           compatible
pnpm contracts:compatibility -- --kind schema           compatible
pnpm db:validate                                         passed
pnpm redis:validate                                      passed
pnpm ports:check                                         passed; api-gateway=18070
pnpm --filter @englishflow/i18n typecheck               passed
pnpm --filter @englishflow/design-tokens typecheck      passed
pnpm --filter @englishflow/api-client typecheck         passed
pnpm --filter @englishflow/learner-web typecheck       passed
pnpm --filter @englishflow/admin-web build              passed
pnpm --filter @englishflow/official-site build         passed
pnpm --filter @englishflow/mobile build:h5             passed
pnpm --filter @englishflow/mobile exec tsc --noEmit    passed
```

## 仍待测试阶段补证

1. 当前机器为 Java 24，未安装 Maven，因此两个 Java 25 服务未执行 `mvn validate/test`；代码与 POM 已静态校验，需在 Java 25 + Maven 环境执行：

   ```text
   mvn -f services/api-gateway/pom.xml -o test
   mvn -f services/service-template/pom.xml -o test
   ```

2. Gateway 的 自有 JWT 登录/JWKS、服务侧 PEP/RBAC/ABAC 属于 B8 Gate；B7 只保留默认拒绝的 JWT 预校验边界和 local profile 只读兼容，不能宣称 IAM 已完成。
3. CORS/限流目前是本地 allow-list 和进程内占位，不是生产级分布式限流。
4. 需要浏览器真实 viewport、键盘/读屏、主题持久化、SSR hydration、四端条件编译和真机交互回归；官网当前公开内容为静态投影，B9 再接入公开数据投影。
5. Nuxt/uni-app 构建产生的 `.nuxt/`、`.output/`、`dist/` 仅是本地产物，不是源码完成证据。
