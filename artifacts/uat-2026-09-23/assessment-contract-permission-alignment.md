# 评测路由权限与契约对齐（2026-09-23）

## 已对齐的运行入口

Gateway `assessment-domain` 当前只投影 13 条路径、14 个 HTTP 方法，全部转发至 `assessment-service`。其中 13 个方法在 B1/B10 OpenAPI、Gateway 投影及评测 Controller 的服务侧 PEP 中已对齐：`assessment.session.read` 用于本人会话、报告、错题读取；`assessment.session.write` 用于创建、提交、checkpoint、跳过和错题状态变更。两项权限都在 IAM 成人学习者许可集中；未给 IAM 增加权限。B1/B10 对应操作现声明 `x-owner=assessment-service`、`x-contract.owner/write` 和精确的 `x-authorization.requiredPermission`。未实现的 canonical placement 路径仍没有 Gateway 投影。

`POST /api/v1/assessment/mistakes/{mistakeId}/verify` 与 `/variant` 的契约现声明运行时必需的 `Idempotency-Key`。当前 Controller 仅校验该请求头，没有持久化 key 的重放去重；契约明确写 `durable deduplication pending`，这两条写路径**仍不满足真正的幂等验收**。

## 保留的设计与运行冲突

`GET /api/v1/assessment/daily-stream` 是第 14 个方法。冻结的 B2/M1-013 契约把它定义为 `learning-service` 只读兼容入口，权限 `learning.plan.read`；当前 Gateway 实际转发到 `assessment-service` 的 B25 Controller，首次读取会插入 `b25_assessment_session`，服务侧要求 `assessment.session.write`。为避免悄悄改写冻结的目标架构，B2 OpenAPI 新增 `x-current-runtime-divergence`，如实标记当前 owner、权限及写入副作用。该 GET 需要改成真正只读的 learning 投影，或经架构决策重新设计 API/契约；在此之前不能作为设计一致的验收 PASS。

另外，B1 的旧 placement 路径仍写着 canonical B10 adapter 目标，实际运行的是 B25 独立逻辑；本次仅修正可执行入口的权限/owner/write 声明，不能把 adapter 语义、canonical 评分链或完整首日流程认定为已验收。B10 canonical `PUT /sessions/{sessionId}/checkpoint` 仍无 Gateway 投影；可执行的是旧 attempt-scoped checkpoint。

## 验证

- `pnpm contracts:merge` 与 `pnpm contracts:merge:check`：28 OpenAPI 碎片、424 路由合并通过。
- 评测权限交叉层测试与 placement/assessment/learning-loop 契约测试：305/305 通过；`git diff --check` 通过。
- `pnpm contracts:validate`：仍在既有 `POST /api/v1/admin/recovery/recoveries needs x-idempotency declaration` 处失败，不能宣称全量契约验证通过。
- Gateway 全量冻结契约测试仍失败：当前规则/路由/投影计数与冻结的 M2-001 基线漂移（例如预期 56 条规则、365 个公开操作，实际 393 个公开操作），且 admin-recovery 与 IAM 删除投影未同步该基线。本次没有更改 Gateway 策略或该冻结基线。
