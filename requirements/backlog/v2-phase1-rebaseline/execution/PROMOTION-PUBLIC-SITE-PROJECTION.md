# 契约提升请求：官网公开投影路由（`public-site`）

- 状态：**待执行**（需要一次独立评审；本文件是实现者提供的完整依据与执行配方）
- 发现轮次：第 19 轮；修复实现与运行时验证：第 20 轮；机制查清与提升包产出：第 21 轮
- 影响任务：`P1R-M2-001`（冻结基线）、`P1R-M3-008`（官网公开内容，缺口归属）

---

## 1. 缺口（已实测）

官网 SSR 经网关消费 `/api/v1/public/site/projection`，但该路由**未被注册**，返回 404：

```
GET http://127.0.0.1:18070/api/v1/public/site/projection  ->  404 NOT_FOUND
```

**根因链**：

1. canonical 规则 `public-site` 的 `upstreamOwner` 是 **`admin-ops-service`**
2. 但该端点的控制器在 **`content-service`**：`ContentHttpController:79`
   `@GetMapping("/api/v1/public/site/projection")`，且 `ContentSecurityConfiguration:120` 对它 `permitAll`
3. `admin-ops-service` 中该路径 **0 命中**
4. 因此 `GatewayRouteExecutionPolicy` 在 `FAIL_CLOSED_REASONS` 记录
   `canonical_owner_admin_ops_conflicts_with_current_content_controller`，**拒绝注册**该规则
5. ⇒ 网关正确 fail-closed，但官网拿不到自己的公开投影

## 2. 分歧方向已判定：**改契约，不改代码**（`[读取]`）

`ContentHttpController.publicSiteProjection` 的实现给出了决定性证据：

```java
data.put("courses", entries.stream().map(ContentHttpController::card).toList());   // 本服务已发布事实
// Pricing remains commerce-owned and is read from the canonical public
// commerce endpoint by the official-site aggregation boundary.
data.put("pricing", List.of());                                                    // 有意留空，commerce 拥有
data.put("downloads", publicSiteFacets("DOWNLOAD", locale));                       // 本服务持久化投影
data.put("announcements", publicSiteFacets("ANNOUNCEMENT", locale));
data.put("compliance", publicSiteFacets("COMPLIANCE", locale));
return new SiteProjectionEnvelope(data, new PublicSiteMeta(..., "CONTENT_SERVICE", false, ...));
```

- **无任何跨服务读取**（pricing 明确留空并注明由官网聚合边界从 commerce 取）
- 响应元数据**自称 `CONTENT_SERVICE`**
- `downloads`/`announcements`/`compliance` 是**本服务的持久化读投影**，注释写明"never client-supplied static cards"

⇒ `admin-ops-service` 是**契约里的笔误**，`content-service` 才是正确 owner ✓
（这也与 AGENTS.md 的 `content-service` 拥有内容事实、`P1R-M3-006` 拥有"公开与学习投影"一致。）

## 3. 修复内容（三层，顺序即契约优先）

### 3.1 `packages/contracts/fragments/p1r-gateway-boundary.openapi.json`

`routeRules` 中：

```diff
-{ "ruleId": "public-site", ... "upstreamOwner": "admin-ops-service", ... }
+{ "ruleId": "public-site", ... "upstreamOwner": "content-service",  ... }
```

`routeExecutions` 中该条：

```diff
 "ruleId": "public-site",
 "defaultStatus": "UNAVAILABLE",
-"defaultReason": "canonical_owner_admin_ops_conflicts_with_current_content_controller",
-"projections": []
+"defaultReason": "no_exact_canonical_execution_target",
+"projections": [{
+  "projectionId": "public-site.projection",
+  "status": "AVAILABLE",
+  "publicPathTemplate": "/api/v1/public/site/projection",
+  "methods": ["GET"],
+  "executionKind": "UPSTREAM",
+  "upstreamOwner": "content-service",
+  "targetUriConfig": "gateway.b14.service-base-urls.content",
+  "pathStrategy": "PRESERVE_PUBLIC_PATH",
+  "targetPathTemplate": "/api/v1/public/site/projection",
+  "controllerEvidence": {
+    "sourcePath": "services/content-service/src/main/java/com/englishflow/content/web/ContentHttpController.java",
+    "requestMapping": "/api/v1/public/site/projection"
+  }
+}]
```

### 3.2 `GatewayRoutePolicy`（`rule("public-site", …, "content-service", …)`）

### 3.3 `GatewayRouteExecutionPolicy`

- 新增证据常量 `CONTENT_PUBLIC_SITE_PROJECTION`
- 新增 `add(definitions, "public-site", preserve("projection", "/api/v1/public/site/projection", CONTENT_PUBLIC_SITE_PROJECTION, HttpMethod.GET));`
- 从 `FAIL_CLOSED_REASONS` 删除 `public-site` 条

## 4. 运行时验证（第 20 轮已实测）

```
gateway /api/v1/public/site/projection      : HTTP 200      ← 修复前 404
  data keys: generatedAt, projectionVersion, contentEpoch, courses, pricing, downloads, announcements, compliance
official-site SSR /api/public-projection    : HTTP 200 (14615 bytes)
网关测试（含契约对齐测试）                  : 82/82 PASS
```

## 5. 为什么不能由实现者单独落地（**本文件存在的原因**）

该改动是**破坏性契约变更**，会改写**已 ACCEPTED 的 `P1R-M2-001` 冻结基线**。治理面如下：

### 5.1 `scripts/audit/p1r-gateway-contract-check.mjs`

| 常量 | 现値 | 需改为 |
|---|---|---|
| `FROZEN_EXECUTION_TARGET_PLAN_SHA256` | `89b7361e…b13694` | `4138acfa…3b8c3`（用模块自带的 `executionTargetPlanDigest()` 重算） |
| `EXPECTED_AVAILABLE_EXECUTION_OPERATION_COUNT` | `168` | `169` |
| `EXPECTED_UNAVAILABLE_EXECUTION_REASONS` | 含 `'public-site'` | **删除该条** |

### 5.2 `scripts/contracts/compatibility-diff.mjs`

> ⚠️ **第 21 轮更正**：本条最初被我判为"必须扩展封闭的三描述符放行集合"。**实测显示该判断可能过严** —— 兼容性检查报出的两条都是**摘要不匹配**（`m2-001.gateway-root`、`m2-001.expected-projection`），**不是**"未预期的变更描述符"。既有描述符 `['x-p1r-gateway-boundary', …]` **位于根扩展内部**，因此很可能已经涵盖本次变更，只需重算摘要即可。

需重算（**用模块自身的函数**，不得手算）：

- `M2001_GATEWAY_ROOT_SEMANTIC_SHA256` = `stableGovernanceSha256(canonical[diff.M2001_OPENAPI_ROOT_EXTENSION])`
  —— **必须从合并后的 canonical OpenAPI 取值**（该值是 fragment 的副本）
- `M2001_EXECUTION_TARGET_POLICY_SEMANTIC_SHA256` = `stableGovernanceSha256(boundary.executionTargetPolicy)`
- `M2001_OPENAPI_EXPECTED_SEMANTIC_SHA256` = `stableGovernanceSha256(buildM2001OpenApiExpectedProjection(previous, approved, allowance))`

**`M2001_OPENAPI_SOURCE_SEMANTIC_SHA256` 不得改动** —— 它是源基线摘要，固定不变。

`M2001_OPENAPI_DESCRIPTOR_SET_SHA256` **仅当**描述符集合确实需要新增条目时才重算（`scripts/contracts/promote-public-site-projection.mjs --apply` 会先应用、再合并、再算摘要，据此可判定是否真的需要动它）。

> 该放行集合体现"**只允许被刻意、可追溯地变更**"。若实测表明无需扩展，则本次提升**落在既有放行范围内**，只是摘要需随之重算 —— 这正是该机制的设计用法。

### 5.3 派生契约与钉住旧基线的测试

- `pnpm contracts:merge` 重新生成 `packages/contracts/openapi/v1/openapi.json`
- `GatewayBoundaryProcessTest.disabledUnacceptedOwnerRouteFailsClosedInsteadOfFallingThrough`
  用 `public-site` 当"不可接受 owner"的样例 —— 该路由变可用后需换样例（**注意：改用无规则接纳的路径，而不要削弱该测试**；匿名规则中已无不可用者）
- `CanonicalRoutePolicyRouteLocatorIntegrationTest`
  的 `assertUnavailable(..., "public-site")` 需移到 `assertProjected(...)`（跨 owner 拒绝性质由其余 8 条继续覆盖）
- 连带 `M1-009`…`M1-018` 的"固定基线链"测试（未处理时 P1R 出现 10 项失败）

## 6. 执行配方

```powershell
node scripts/contracts/promote-public-site-projection.mjs --apply   # 逐层应用并重算全部治理值
node scripts/contracts/merge-b1-fragments.mjs --write               # 再生成 canonical OpenAPI
node scripts/audit/p1r-gateway-contract-check.mjs                   # 期望 PASS
node -e "import('./scripts/contracts/compatibility-git-baseline.mjs').then(m=>console.log(m.runGitBaselineCompatibility({ref:m.REQUIRED_CI_CONTRACT_BASELINE_REF,governanceRef:m.REQUIRED_EVENT_GOVERNANCE_BASELINE_REF,kind:'all'}).compatible))"   # 期望 true
node scripts/dev/run-node-tests.mjs tests/p1r                       # 期望 1427/1427
mvn -f services/api-gateway/pom.xml -o test                         # 期望 82/82
# 运行时：B14_STRANGLER_ENABLED=true 启动全栈后探测该路径，期望 200
```

## 7. 实现者的请求

实现者认为该修复**正确、必要、已运行时验证**，且分歧方向有实现代码的直接证据支持。

**但落地它需要扩展一个已验收任务的冻结放行集合与四个治理摘要，实现者不对此自行批准** —— 请独立判定：是接受本次提升，还是改为把控制器迁到 `admin-ops-service`（本文件 §2 的证据倾向于前者）。
