# 契约提升：B3 语法点只读查询

- 状态：**负责人已批准；源文件、canonical 合并与专项验证已完成；冻结 Gateway 基线逐项促升待执行**
- 影响任务：`P1R-M2-001`（Gateway 冻结规则与执行目标）、B3 语法点只读投影
- 运行状态：**`NOT_RUNTIME_VERIFIED`**

## 1. 提升范围

仅提升 `GET /api/v1/grammar/points`：在其现有宽前缀规则之上增加优先级更高的精确 `GET` 规则，owner 为 `content-service`，内部重写到 `/internal/v1/content/learner/grammar/points`。操作契约要求 Bearer 身份验证和 `content.read`；content-service 再执行本地 learner PEP，检查已验证 principal、learner 身份、成人 Gate、consent 与权限事实。

响应使用 cursor 分页 envelope（`data.items`, `data.source`, `meta.hasMore/pageSize/nextCursor`）；服务端支持 `cursor`、`pageSize` 和可选 `cefrLevel`。Web 与 mobile 的语法点列表调用已改为使用契约参数 `pageSize`。精确重写会保留查询参数。

兼容性复审后，OpenAPI 中原有的泛型 `200.data` 响应 schema 和原有响应码集合保持不变；`items/source` 是当前 owner 实现返回的结构，不在本次 M2-001 提升中收紧为新的 wire contract。本次 B3 操作只新增已列入 allowlist 的五个 owner/鉴权元数据节点。

**未提升**语法树、练习、题目详情、提交 attempt 或其他 B3 路由。既有 `grammar-domain` 宽前缀规则及其 assessment owner 均未改动；它仍没有可执行 projection，其他语法操作继续 fail closed。

## 2. 冻结基线影响

现有已验收 M2-001 checker 仍冻结在 56 条 route rules、56 个 execution plans、170 个 available operations 和旧执行目标摘要。共享 worktree 在本次精确 B3 路由之前已经有其他未协调的 Gateway fragment 变更，因此以下将接受基线、共享变更和本次差量分开记录：

| 状态 | Rules | Plans | Projections | Available operations | Execution-target SHA-256 |
|---|---:|---:|---:|---:|---|
| 已接受的 M2-001 冻结值 | 56 | 56 | 153（Gateway 测试汇总） | 170 | `0da3e568fac7394dda30eda71e0e1b23b4414ebf581208d23e9e82eb271cb4d7` |
| 共享 fragment：本次 B3 路由前 | 65 | 65 | 192 | 209 | `20ef850d004c8eed4326036b7455bd37c46005a9350d8b9548f9f65d949dbf00` |
| 共享 fragment：加入本次 B3 路由后 | 66 | 66 | 193 | 210 | `38f5d42132b44db7dc999b03a33e06b187bf48ef0a8e05f27af8e93cb80cf558` |

本次 B3 路由自身使共享 fragment 增加 **1 rule、1 plan、1 projection、1 available operation**。执行目标摘要从本次改动前的 `20ef850d…` 变为 `38f5d421…`。当前 Gateway root-extension digest 从 `632765d3…` 变为 `709cbc72…`；`executionTargetPolicy` digest 保持 `d5182f41d59ef89a4e4743db930eda8ab0e42eb1113d6d57b08b9e4af507c2f9`。这些共享 fragment 数值包含先前尚未协调的变更，不可当作仅由本次 B3 工作产生的冻结值。

`scripts/contracts/compatibility-diff.mjs` 已将本次操作新增的五个 OpenAPI 节点明确列入 M2-001 additive-node allowlist：`x-owner`、`x-permission`、`security`、`x-contract`、`x-authorization`。源基线摘要不得改写。canonical OpenAPI 已合入这五项及 B3 Gateway rule/plan；兼容性工具中的 Gateway root/预期 projection 摘要仍需在逐项促升后重算，不能直接接受整个共享 fragment。

## 3. 数据发布仍关闭

`B3ContentJdbcController.ELIGIBLE_CONTENT` 中原有的 `AND 1 = 0` 保持不变。因此即使 Gateway projection 可注册、鉴权通过且 SQL 执行，该端点仍返回空列表，不会发布 legacy B3 数据。只有完成 owner-owned canonical content-version provenance 绑定、迁移和读取时校验后，才可由单独决策移除该门。

本提升不构成内容批准，也不声称 Gateway 或浏览器运行时已验证。

## 4. 已同步的契约与尚待协调的 checker

本次已从 28 个 OpenAPI fragment 合并 canonical 文档，语义差异包含 B3 的五项操作元数据与一条 Gateway rule/plan；另同步既有 B8 设备时间描述。`contracts:merge:check`、`contracts:generate:check`、`contracts:validate` 和 B3 专项 3/3 均通过；生成文件与当前 canonical 一致，无需单独写入。事件目录未变。以下仍不能据此整体晋升：

- `scripts/audit/p1r-gateway-contract-check.mjs`：最终 route rule count、execution-plan count、available-operation count、`FROZEN_EXECUTION_TARGET_PLAN_SHA256`；保留精确 projection 和 fail-closed 校验。
- `tests/p1r/p1r-gateway-contract.test.mjs`：冻结摘要与汇总计数（当前测试仍为 56 / 56 / 153 / 170 / 195）。
- `scripts/contracts/compatibility-diff.mjs`：最终 M2-001 Gateway-root semantic digest、OpenAPI expected-projection digest，以及按现有 descriptor 机制核验是否需要更新 descriptor-set digest。保留 M2-001 的 source-baseline digest。

最后一致的 Gateway 冻结快照是 `86fbd830`；当前共享 fragment 相对其新增 10 条规则、40 个投影，不能机械更新上述 checker。逐项促升分组和最低证据见[Gateway 基线核对](../../../../artifacts/uat-2026-09-25/gateway-baseline-reconciliation.md)。促升后再运行全量 Gateway contract checker 和兼容性门禁，核对差异只包含获批的执行目标。

## 5. 已运行的专项验证

- `B3PublishedContentGateJdbcTest`: **5/5 PASS**（H2/controller 测试；不是 MySQL 或部署运行证据）
- `GatewayRoutePolicyContractParityTest` 与 `GatewayPathProjectionProcessTest`: **8/8 PASS**（静态策略和 mock process-forwarding；不是活 Gateway 验收）
- `b3-grammar-points-owner-route.test.mjs`: **3/3 PASS**
- M2-001 additive-node allowlist 子测试：**1/1 PASS**
- withheld-route 全量扫描仍报告其他 B3/B11/speaking/sync 调用所对应的 withheld operation；本次 grammar-points 列表调用已由精确 projection 覆盖，其他调用未在此范围放行。
