# R1-019 B25 写口下线（只读保留）

日期：2026-10-10。分支：`dev-redesign`。卡：R1-019 / BC-019。Owner：api-gateway。依赖：R1-018 已在工作区。

状态：网关不再把 `POST /api/v1/assessment/placement/start` 转到 B25 写口，带合法 JWT 的新开题直接 404。旧会话读口 `GET /api/v1/assessment/placement/start` 仍转发到 `/internal/v1/assessment/placement/start`，`sessionId` 查询参数保留。`POST /api/v1/assessment/placement/sessions` 仍按原规则转到 `/internal/v1/assessment/placement/sessions`。**不是 ACCEPTED，也不是 IT-2 出站。** 没有 commit，没有 push。`CURRENT-PROGRESS.md` 未改。没有改 assessment-service、content-service、apps。

## 行为

旧 B25 开题写口和旧会话读口是同一条公开路径上的两个方法。`B25AssessmentJdbcController` 里 `POST /placement/start` 会建会话，`GET /placement/start` 按主体或 `sessionId` 读已有会话。只改网关就能拆开：执行投影 `assessment-domain.placement-start` 现在只剩 `GET`。

`POST /api/v1/assessment/placement/start` 仍会落到粗粒度 `assessment-domain` 规则，但没有任何执行投影接受这个方法。`CanonicalRoutePolicyWebFilter` 在转发前返回 404，`errorCode` 是 `NOT_FOUND`。路由表里也不再有接受 POST 的 `canonical-assessment-domain-placement-start`。

保留的旧读口：

- `GET /api/v1/assessment/placement/start` → `GET /internal/v1/assessment/placement/start`
- `GET /api/v1/assessment/placement/report/{sessionId}` 仍转发，本卡没有删
- `GET /api/v1/assessment/placement/sessions/{sessionId}` 是 P1 读口，本卡没有改

`POST /api/v1/assessment/placement/submit-step` 和 `POST /api/v1/assessment/placement/skip` 仍转发。那不是本卡的开题写口。评估服务里的 `@PostMapping("/placement/start")` 还在，只是网关不再把它暴露出来。

公开 OpenAPI 里 deprecated 的 `POST /api/v1/assessment/placement/start` 仍在文档中。网关不再执行它。

## 改动文件

本卡修改：

- `services/api-gateway/src/main/java/com/englishflow/gateway/policy/GatewayRouteExecutionPolicy.java`
- `services/api-gateway/src/test/java/com/englishflow/gateway/config/GatewayPathProjectionProcessTest.java`
- `services/api-gateway/src/test/java/com/englishflow/gateway/policy/GatewayRoutePolicyContractParityTest.java`
- `packages/contracts/fragments/p1r-gateway-boundary.openapi.json`
- `packages/contracts/openapi/v1/openapi.json`（只删了 `assessment-domain.placement-start` 投影里的 `POST`；该文件工作区里还有其他卡的未提交差量，不是本卡改的）
- `scripts/audit/p1r-gateway-contract-check.mjs`（可用执行操作计数 224 → 223）
- `tests/p1r/assessment-executable-contract-parity.test.mjs`
- `evidence/redesign/2026-10-10/R1-019/report.md`

没有修改 `services/assessment-service/**`、`services/content-service/**`、`apps/**`、`evidence/redesign/2026-10-10/R1-018/**`、`evidence/redesign/2026-10-10/R1-020/**`。

## 验证

```text
cd /Users/Admin/Desktop/work/cloudstudy/services/api-gateway && mvn -Dtest=GatewayRoutePolicyContractParityTest,GatewayPathProjectionProcessTest,CanonicalRoutePolicyRouteLocatorIntegrationTest test
exit 0
Tests run: 16, Failures: 0, Errors: 0, Skipped: 0
CanonicalRoutePolicyRouteLocatorIntegrationTest: Tests run: 6, Failures: 0, Errors: 0
GatewayPathProjectionProcessTest: Tests run: 4, Failures: 0, Errors: 0
GatewayRoutePolicyContractParityTest: Tests run: 6, Failures: 0, Errors: 0
```

`GatewayPathProjectionProcessTest` 用回环上游证明：带 JWT 和 body 的 `POST /api/v1/assessment/placement/start` 是 404 `NOT_FOUND`，上游收不到请求；`GET /api/v1/assessment/placement/start?sessionId=legacy-session-1` 转到 `/internal/v1/assessment/placement/start` 且查询串保留；`POST /api/v1/assessment/placement/sessions` 仍转到 `/internal/v1/assessment/placement/sessions`。

```text
cd /Users/Admin/Desktop/work/cloudstudy && node --test tests/p1r/assessment-executable-contract-parity.test.mjs
exit 0
tests 2, pass 2, fail 0
```

从仓库根跑同一组 `-Dtest` 时，api-gateway 模块本身是 SUCCESS，随后 reactor 进入 iam-service，因没有匹配测试而失败，退出码 1。那不是网关测试失败。上面模块内命令才是本卡结果。

改前 `validateGatewayContract()` 已是 FAIL，四条都在：公开操作 365/399、`iam-account-deletions` 未冻结、M2-001 执行计划摘要已偏离 `0da3e568…`、内部操作 66/67。改后仍是这四条。可用执行计数现在是 223，这条检查仍绿。本卡没有重写冻结摘要。投影与 fragment 仍一致（`canonicalProjectionMatches: true`）。

## 没有 PASS 的部分

- 没有起真实 assessment-service，也没有用库里的旧 B25 行证明 GET 读回正文。网关测试只证明 GET 仍转发到现有内部读口。
- `POST /placement/submit-step` 和 `POST /placement/skip` 仍可转发。不能写成全部 B25 写口已下线。
- 网关契约检查器整体仍是 FAIL，原因是改前就有的冻结漂移。本卡没有把它收成 PASS，也没有重冻摘要。
- 没有浏览器走查。
