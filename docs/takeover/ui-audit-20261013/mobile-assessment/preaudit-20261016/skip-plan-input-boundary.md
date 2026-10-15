# MB006 最后窄补：SKIPPED → 保守计划的请求边界

2026-10-16，只读契约、生成类型、owner 与现有 mobile 方法；无源修改、服务开关修改、浏览器/API/测试执行。以下不是运行 PASS，也不撤回已经获准的快速开始业务路径。

**当前 `plans:ensure` 没有可供 SKIPPED 基线使用的独立 pointer 分支；不能只补前端调用完成保守计划闭环。**

| 层 | 现有权威输入与精确位置 |
|---|---|
| endpoint/契约 | `POST /api/v1/learning/plans:ensure`，operationId `ensureB10LearningPlan`。`packages/contracts/fragments/b10/b10-learning-assessment-content.openapi.json:1749,1766,1803–1808` 要求 placement report pointer。 |
| request schema | 同文件 `:4269–4283`：`B10EnsurePlanRequest` 为 `additionalProperties:false` 的封闭 object，唯一字段/唯一必填是 `placementReportId:string`；没有 baselineId、sessionId、来源 discriminator 或 oneOf 分支。不能自行增加指针字段。 |
| generated 类型 | `packages/contracts/generated/openapi.ts:4033`：`export type B10EnsurePlanRequest = { placementReportId: string; };`；`:4573` 的操作映射使用此类型。导出链为 `packages/contracts/src/index.ts:1` → `generated/index.ts:1` → `openapi.ts`，可由 `@englishflow/contracts` 使用。 |
| owner 接收 | `services/learning-service/src/main/java/com/englishflow/learning/web/V2PlansController.java:99–118`：先要求 learning.plan.write 与幂等键，只读取 placementReportId，缺少/超长拒绝，再交 `reports.verify()`；`:123–139` 后续 pin 与 target 校验使用核验报告的值。 |
| owner 核验 | `services/learning-service/src/main/java/com/englishflow/learning/adapter/http/VerifiedPlacementReport.java:74–82` 按 reportId 读取 assessment 的正式 reports 口；`:88–94` 与 `:132–149` 两种报告形状都明确只接收 ASSESSED 和 COMPLETED，否则拒绝。不是“有一个字符串就可以 ensure”。 |
| mobile 能力 | `apps/mobile/src/api/plan-today.ts:13–19` 的 `ensureLearningPlan(placementReportId)` 仅发送 `{ placementReportId }`；幂等键由 `domain/plan-today.ts:60–61` 稳定派生。`:75–79` 的 shouldEnsurePlan 明确不接 SKIPPED；`stores/learner-content.ts:407–408,464–475` 仅在正式报告后执行此方法。现有 helper 可以直接复用 ASSESSED 路径，不能用于 SKIPPED。 |

契约中 `B9PlacementBaseline` 虽含 SKIPPED（`generated/openapi.ts:3048`），属于计划输入的基线数据形状；不能据此推导上述公开请求已接受 baseline/session 指针。assessment 当前真实 skip 回执也没有 reportId/digest（前份补充已给证据），严禁为调用 ensure 捏造 reportId、用 sessionId 冒充，或把 SKIPPED 改写成 ASSESSED。

最小实现边界应分清：

- **现在可接**：已有 canonical skip 的真实 client/store 写入、同键/owner/权限保护、SKIPPED/UNVERIFIED 读回；页面诚实显示未完成定级与当前今日状态，不称已生成保守计划，不发报告型 ensure。
- **正式报告保持**：复用当前自动 `ensureLearningPlan(realReportId)` 与 ADR-0027 的幂等流程。
- **保守计划闭环 GAP**：业务路径已经获准（DEC-03），但本次所核的 ensure 请求/owner 实现不接 SKIPPED baseline。要完成该闭环，需 assessment/learning/contract owner 为真实基线 pointer 及核验规则补齐权威契约与实现，再生成类型、补最小 client 方法并验证；字段名和新的业务行为由该契约确定，本材料不发明。不能以纯页面重排宣称已完成，也不能把此实现 GAP 误述为现行快速开始业务被关闭。

本次没有找到可直接复用的 SKIPPED ensure 客户端方法。若 MB006 的验收范围要求“快速开始后已建立保守计划”，这部分应记 `GAP_CONTRACT_OWNER_WIRING`，由 Root 在正式任务范围内具名处理；不可用模拟任务/假报告消除。
