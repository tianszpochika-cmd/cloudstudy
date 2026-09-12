# Legacy B 系列测试失败分类（2026-09-13）

> 背景：`ci.yml` **只运行 `pnpm test:p1r`**，B 系列不在 CI 内。全量 `tests/` 曾经 **33 项失败**，经本会话修复后降至 **20 项**。本文件记录每一项的根因与处置，避免下一轮重新分析。

## 已修复（24 → 20）

| 测试 | 根因 | 处置 |
|---|---|---|
| b3 事件名必须 `.v1` 结尾 | **过度指定**：catalog 合法地含 36 个 `.v2` 事件（191 个全部符合 `domain.action.vN` 约定） | 改为断言版本化命名约定 ✓ |
| b9 服务不得发出未注册事件 | **扫描范围错误**：`javaSources()` 遍历含 `src/test`，把**测试夹具**当成服务发出的事件 | 限定为生产源码；并修正我自己在 M2-005 引入的未注册事件名 ✓ |
| b10 事件列表逐项冻结 | **脆弱冻结列表**：任何合法新增都失败，却不校验新增是否被允许 | 改为「B10 链路必须仍被覆盖」+「fragment 内每个事件必须在 catalog 注册」✓ |
| b14 / b16 / b8 部分 | **文件名错误**：读 `application.yaml`，而网关用 `application.yml`（iam-service 确实是 `.yaml`，故只改网关路径） | 修正 3 处路径引用 ✓ |

## 剩余 20 项：根因是「为已移除实现写的测试」

`M2-001` 用 P1R 版 Gateway（`GatewayRoutePolicy` / `GatewayRouteExecutionPolicy` / `RateLimitGlobalFilter` / `RuntimeEvidenceSecurityAuditSink`）替换了 B 线版。剩余失败几乎全部在断言**旧版结构**：

| 失败 | 它在断言什么（旧版） |
|---|---|
| b8 × 4 | `NimbusReactiveJwtDecoder.withJwkSetUri`、路由 id `iam-auth`、`SecurityAuditGlobalFilter` 的 `status != 401 && status != 403`、旧 `BoundedSecurityAuditSink` / `SecurityAuditRecord` 类名 |
| b7 × 3 | 旧版 gateway platform 配置 |
| b25 × 2 | `JwtAuthenticationToken` 用法、路由 id `b25-learner-onboarding-target` |
| b33 × 1 | 「Gateway 必须暴露 public site projection」——该路由现由 official-site 自身提供（实测 gateway 404 / official-site 200） |
| b31 × 2 | 旧 admin command 路由与 `/api/v1/content/learner/catalog` 路径 |
| b14 / b16 剩余 | 旧 `allowed-origins:` 单列表（M1-004 已改为**按 profile 分别配置**，是改进） |
| b13 × 1 | analytics 安全过滤器中的旧客户端权威头正则 |
| b27 × 2、b20 × 1 | 各自的静态校验器返回 FAIL（待逐项确认） |

### 覆盖不会丢失

这些关切**已由 P1R 覆盖**：`tests/p1r/p1r-gateway-contract.test.mjs` 的契约断言，加上 **M2-001 运行时证据 30/30**（含 11 项真实浏览器 CORS / Cookie / CSRF / Origin 检查、限流 429+`Retry-After`、401/403 语义、Redis 故障 fail-closed 503 与恢复）。

### 处置计划（下一轮）

对**断言已移除实现**的测试以 `test.skip` 标注并写明原因与替代覆盖来源，而**不是**把它们改写成新实现 —— 后者只会复制 P1R 已有的覆盖，并让这些不在 CI 内的测试继续腐化。AGENTS.md 亦规定 B 线状态不得覆盖 v2 基线。

对 b20 / b27 等**校验器型**失败逐项确认：若校验器本身仍有意义则修其期望，若其对象已消失则同样退役。
