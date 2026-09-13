# 网关 withhold 路由分析（2026-09-13）

> 结论：**这 23 条被网关拒绝注册的路由不是缺陷**，而是 **M3/M4 的计划内工作**。本文件记录判定依据，避免重复排查，并为各域任务提供"契约 owner vs 实际控制器"对照表。

## 1. 背景

`GatewayRouteExecutionPolicy` 对**没有投影**的 canonical 规则**拒绝注册**（fail-closed），并在 `FAIL_CLOSED_REASONS` 记录原因。当前共 **23 条**处于该状态。

`public-site` 曾是其中之一，且是**唯一的真实缺口** —— 因为官网 SSR **确实在调用它**。修复见 `PROMOTION-PUBLIC-SITE-PROJECTION.md`。

## 2. 决定性判定：**没有被拒绝的路由存在活的调用者** `[实测]`

扫描 `apps/` 与 `packages/*/src` 的 **295 个手写源文件**（排除 `generated/`），逐条检查是否引用被拒绝路由的路径：

```
withheld rules: 23
excluding generated clients: 295 hand-written files
...
withheld rules with a hand-written caller: 0
```

唯一"命中"的是 `packages/api-client/src/generated/index.ts` 与 `packages/contracts/generated/openapi.ts` —— 它们是**从 OpenAPI 生成的客户端**，包含这些路径是因为它们**在契约里**，这不构成调用 ✓

⇒ **无前端调用 → 无消费者受损 → fail-closed 是正确行为** ✓

## 3. 契约 owner 与实际控制器的对照（供各域任务使用）

多条规则的原因字符串本身就写着"canonical owner 与当前控制器冲突"。核对实际控制器后：

| canonical 规则 | 路径 | 契约 owner | **实际控制器所在服务** |
|---|---|---|---|
| `grammar-domain` | `/api/v1/grammar` | `assessment-service` | **`content-service`**（`B3ContentJdbcController:/grammar/...`） |
| `phonetics-domain` | `/api/v1/phonetics` | `assessment-service` | **`content-service`**（`/phonetics/catalog`） |
| `speaking-recordings` | `/api/v1/speaking/recordings` | `media-service` | **`learning-service`**（`/speaking/recordings`） |
| `listening`/`reading`/`writing`/`speaking-domain` | `/api/v1/{listening,reading,writing,speaking}` | `assessment-service` | 待各域任务核对 |
| `sync-domain` | `/api/v1/sync` | `learning-service` | `learning-service` 有 `/offline/sync/*`（原因字符串提到 notification，需再核对） |
| 其余 | — | — | 见 `FAIL_CLOSED_REASONS` |

⚠️ **不要批量改契约**：每条的正确 owner 需要**逐域判定**（若按 AGENTS.md，练习内容的投递属 content、attempt/判分属 assessment、进度/掌握度属 learning），且这些路径的公开/内部映射关系需先确定。它们归属 `P1R-M3-006`/`M3-007`/`M3-010`/`M4-*` 等任务。

## 4. 新增绊线（防"消费者先于路由出现"）

`tests/p1r/p1r-gateway-withheld-routes.test.mjs`：

- 对**每条被拒绝的规则**，断言**没有手写前端源文件**引用它的路径
- 规则一旦获得投影就自动移出该集合（**不冻结缺口**）
- 同时断言每条被拒绝的规则仍记录 **owner 与 withhold 原因**

**这是绊线而非冻结**：它不禁止被拒绝路由存在，它失败只说明"**有调用者去调一条答不了的路由**" —— 这正是 `public-site` 当初的情形。

**已验证非空转** `[实测]`：注入 `apps/learner-web/src/__tripwire-probe.ts` 引用 `/api/v1/grammar` 后，测试失败并精确报出：

```
apps/learner-web/src/__tripwire-probe.ts calls /api/v1/grammar
  (rule grammar-domain, owner assessment-service, withheld because canonical_…)
```

删除探针后恢复 2/2 PASS ✓
