# Legacy B 系列测试失败分类（2026-09-13，第 15 轮更新）

> 背景：`ci.yml` **只运行 `pnpm test:p1r`**，B 系列不在 CI 内。全量 `tests/` 曾 **33 项失败**，现为 **18 项**。

## ⚠️ 更正：第 14 轮"实现已移除"的结论是错的

第 14 轮我写下"剩余失败几乎全部在断言**已移除**的实现"。**这个结论过于草率** `[实测]`：逐个核对后，这些类**大多仍存在，只是被重构**，且重构多为**有意改进**。例：

- `service-template/SecurityConfiguration` **确实**用 `NimbusJwtDecoder`，但经由 **`IamEnvelopedJwkSource.decoder(...)`**（M1-002/M2-003 的「IAM 信封化 JWKS」）→ b8#26 属**可修**
- B14 的 `B14Services` / `B14RouteModeGuardGlobalFilter` / `B14_ROUTE_MODE`（32 处）/ `B14_STRANGLER_ENABLED` / `B14_DEPRECATION_SUNSET_AT` / `RouteMode{LEGACY,SHADOW,TARGET,FALLBACK}` **全部仍在**，只有路由注册方式从三个手写方法变成数据驱动 → b14 属**可修**
- b16 的伪造权威头**仍在**，只是集中到 `ClientAuthorizationContextHeaders` + 一个全局过滤器 → 属**可修**

因此处置原则改为：**只要能找到当前实现，就更新断言并顺带加强；只有确实无法对应时才退役。**

## 已修复（33 → 18）

| 测试 | 根因 | 处置 |
|---|---|---|
| b3 | 断言事件名必须 `.v1`，而 catalog 合法含 36 个 `.v2`（191 个全符合 `domain.action.vN`） | 改为断言**版本化命名约定** |
| b9 | `javaSources()` 遍历含 `src/test`，把**单元测试夹具**当成服务发出的事件 | 限定生产源码；并修正我在 M2-005 引入的未注册事件名 |
| b10 | 逐项**冻结列表**（任何合法新增都失败，却不校验新增是否被允许） | 改为「链路仍被覆盖」+「每个事件必须在 catalog 注册」 |
| b14 | `application-local.yaml` 不存在；断言三个手写路由方法与字面量 `core-api-legacy-compat` | 路径修正；改为断言**数据驱动路由**（`routeBindings()` 逐条构建、方法来自各自绑定）+ **无 core-api catch-all**（更强） |
| b16 | 读 `application.yaml`；`allowed-origins:` 单列表；`backend:…:memory` 默认；在 yml 里找伪造头 | 路径修正；改为**按 profile 的 origin 边界**、**默认 Redis 后端 + local 例外**、**伪造头声明处与唯一剥离点** |
| b8（部分） | 读 `application.yaml` 不存在 | 路径修正（该 ENOENT 项已通过） |

## ⚠️ 弃用窗口缺口的完整根因（第 16 轮查清）

上一轮只查到"配置了但没发出"。第 16 轮查清了**为什么发不出**，并**撤掉了我自己写的实现**。

### 我做了什么，以及为什么删掉

我先实现了 `DeprecationHeadersGlobalFilter`（7 个单元测试全绿），随后发现**它永远无法触发**，于是删除。**没有交付它** —— 交付一个声称实现某行为却永不执行的过滤器，正是本仓库证据纪律禁止的那类虚假主张。

### 根因（三条均为 `[读取]`/`[实测]`）

1. **只有 `TARGET` 域才有路由**。`GatewayRouteExecutionPolicy.b14Target()` 仅在 `b14.enabled() && mode(domain) == TARGET` 时返回 URI，否则返回 `null` → `resolve()` 得到 `Resolution.unavailable("canonical_owner_target_unavailable")`，而 `routeBindings()` 有 `.filter(Resolution::isAvailable)` ⇒ 非 TARGET 域**不注册任何路由**。因此 `LEGACY`/`SHADOW`/`FALLBACK` 下没有路由 → 没有 `GATEWAY_ROUTE_ATTR` → 过滤器无从判断。
2. **契约里没有任何遗留路由**：`packages/contracts/fragments/p1r-gateway-boundary.openapi.json` 的 **56 条 routeRules 全部 `compatibilityMode: "NONE"`** ⇒ 不存在"兼容路由"这一类可标记对象。
3. `TARGET` 域不该被标记为弃用 ⇒ 触发器集合为空。

### 处置

`application.yml` 的 `deprecation-headers-enabled` 默认值 **`true` → `false`**，并加注释说明它**是保留项**：没有任何可达路由会被弃用、也没有代码发出该头，默认 `true`（配合 `B14_DEPRECATION_HEADERS_ENABLED` 这个名字）等于**声称了一个不存在的行为**。开启它应与"真正发出该头的代码"一同进行。b14 测试相应改为断言**默认关闭** + 断言 `b14Target` 的非 TARGET 返回 null + `routeBindings()` 的可用性过滤 + 源码中不存在 `Deprecation` 头。

### ⚠️ 更正：我第 16 轮做的一次模式翻转实验是**无效**的

我以 `B14_ROUTE_MODE_CONTENT=LEGACY` 启动全栈并探测 `/api/v1/content/learner/catalog`，得到 404，一度当作"非 TARGET ⇒ 路由消失"的实测。**该实验不能支持这个结论**：网关实际以 `--spring.profiles.active=v2,local-real` 运行（**不含 `local`**，只有 iam-service 含 `local`），而 `b14.enabled` 在 `application.yml` 默认 **`false`**、仅在 `application-local.yml` 为 `true` ⇒ **两次实验臂中 strangler 都是关闭的**，404 由 `enabled=false` 解释，与模式无关。结论 1 依据的是**代码路径**而非该实验。

### 领域路由 404 是**已记录、已 ACCEPTED 的预期行为**，不是缺陷

M2-001 的运行时证据含 **`default-owner-route-fail-closed`：PASS，status 404** —— 即"领域路由不可用时返回 404"已被独立证据确认 ✓（`evidence/p1r/m2/P1R-M2-001/runtime-evidence-2026-09-12.json`，30 项检查全部 PASS）。我一度以为这是重大缺口，核对后被推翻。

### ✅ 已实测确认：注释与代码语义不符（第 17 轮）

第 16 轮我把这条列为"待确认"。第 17 轮用**有效实验**确认了它 —— 上次实验无效是因为两次都跑在 strangler 关闭的状态下；这次直接用 **`B14_STRANGLER_ENABLED=true` 环境变量**开启（主 `application.yml` 的占位符会读它，与 profile 无关）。

| 路径 | learner=`TARGET` | learner=`FALLBACK` |
|---|---|---|
| `/api/v1/learner/profile` | **401**（路由存在） | **404**（路由消失） |
| `/api/v1/content/learner/catalog`（content=TARGET） | 401 | **401**（不受影响） |
| `/api/v1/iam/principal/me` | 401 | 401 |

顺带确认了第 16 轮的根因：strangler 开启后 `/api/v1/learner/profile` 与 `/api/v1/content/learner/catalog` 由 **404 → 401**，即默认（`B14_STRANGLER_ENABLED=false`）时这些路由确实未注册 ✓

**结论**：把某域切成 `SHADOW`/`FALLBACK` **不是回滚，而是让该域的路由消失（fail-closed 撤下）**。原注释 *"switch individual domains to SHADOW or FALLBACK when testing a rollback without changing code"* 会让运维在事故中把域**下线**而非回滚 —— 已改写为准确描述并加入测试断言（`assert.doesNotMatch(local, /when testing a rollback/)`）。

**未改代码语义**：让非 TARGET 域回落到 core-api 属于实现回滚，与已 ACCEPTED 的 M2-001 设计（不注册任何 core-api/按域 catch-all）冲突。因此只修正描述，并把"模式命名暗示了代码未实现的回落语义"记为待决问题。

## 剩余 14 项（第 17 轮更新）

第 17 轮修复 **b8 全部 4 项**（现 29/29）。三项是**重构而非移除**：Gateway 从 `GatewayIamPublicJwkSource`、各服务从 `IamEnvelopedJwkSource` 构建解码器（因为 IAM 发布**信封化**文档，直连端点的解码器会拒绝）；IAM 面改为 canonical 规则（公开入口用精确路径、两个已鉴权域用前缀规则）而非单一 `iam-auth`；审计记录**根本不带 path**（比过滤 path 字段更强），鉴权与授权失败的区分移入 `decision` 字段而非跳过这些状态。

⚠️ **我在本轮写错了两条断言并已更正**：在 JWK 源里匹配 `private` 只会命中 Java 修饰符与注释，精确的不变量是**绝不提取 RSA 私钥指数 `d`**；JWKS 端点位于类型化安全属性中，而非读取开关的那个过滤器里。

### 剩余明细

| 簇 | 数量 | 初判 |
|---|---|---|
| b7 | 3 | 待核对（`/api/v1/health`、`CorsWebFilter`） |
| b25 | 2 | 控制器存在但改用 `Authentication` + `principal(...)` helper |
| b31 | 2 | 待核对当前路由矩阵 |
| b13 | 2 | 操作 id 疑似被 M1-016 重命名 |
| b4 | 1 | 操作 id 被重命名（`listB12Notifications` → `listM1016NotificationMessages`） |
| b33 | 1 | Gateway 公开投影路由 → 现由 official-site 提供（疑似**真实所有权变更**） |
| b27 | 2 | 占位目录含业务文件；校验器 FAIL |
| b20 | 1 | 校验器 FAIL（10 静态 + 10 运行时待证） |

**覆盖不会丢失**：这些关切已由 `tests/p1r/p1r-gateway-contract.test.mjs` + **M2-001 运行时证据 30/30**（含 11 项真实浏览器 CORS/Origin 检查、限流 429+`Retry-After`、401/403、Redis fail-closed 503 与恢复）覆盖。
