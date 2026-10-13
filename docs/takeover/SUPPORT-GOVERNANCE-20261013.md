# 支持 / 治理 / 恢复 / 权限变更（backend group 2）— 2026-10-13

分支：`feat/v2-support-governance`（独立 worktree `cloudstudy-support-gov`）。**未部署**，待 Luna 签收。

## 范围

1. **客服工单**：带可核验媒体附件的工单可创建与状态流转；仅正文指纹的历史工单继续 fail-closed（503），界面给出中文不可用原因。
2. **治理处置**：分诊 / 隔离 / 升级 / 关闭一律要求 `admin.risk.write` 或 `admin.moderation.write`，只有读权限返回 403 `CLOSURE_WRITE_FORBIDDEN`（冻结与打开两种状态都一样）；界面无写权限时不露按钮并给中文原因。IT-7 处置写链默认仍冻结；配置 `adminops.it7.disposition-open=true`（或环境变量 `ADMINOPS_IT7_DISPOSITION_OPEN`）后，分诊 / 隔离 / 升级 / 关闭会真正改案件状态。
3. **人工恢复**：`execute` 先跑白名单副作用再标 `EXECUTED`；当前只支持 `TICKET/REOPEN`。
   - workflow-service **不再直接写 admin-ops 的库**：通过 admin-ops 内部命令 `POST /internal/v1/admin-ops/tickets/{id}/recovery-reopen` 执行，转发执行人的 JWT，`Idempotency-Key = recovery-{recoveryId}`；admin-ops 自己校验 `support.ticket.manage`、校验状态并写审计（`SUPPORT_RECOVERY_REOPEN`）。
   - 幂等范围是「租户 + 工单」而不是执行人，所以任何执行人重试同一个恢复单都会重放第一次的结果。
   - 结果分三类：成功 → `EXECUTED`；admin-ops 明确拒绝（4xx）→ `FAILED`；结果未知（超时、5xx、连不上）→ 保持 `APPROVED`，返回 503 `RECOVERY_EFFECT_UNCERTAIN`，可直接重试，重试时副作用被重放即标 `EXECUTED`。已 `EXECUTED` 的再执行是空操作。
   - workflow 只写自己库里的 `recovery_side_effect_log`（APPLIED / FAILED / UNCERTAIN）。
   - 执行人除 `admin.recovery.command` 外还需要 `support.ticket.manage`。
4. **权限变更**：管理端「身份与权限」页在具备 `iam.policy.submit|approve|activate` 时露出送审 / 审批 / 激活按钮；无权限时按钮禁用并显示中文原因。后端 IAM 控制面本已存在，本轮只接线 UI。

## 迁移（仅新增）

- `services/workflow-service/.../V3__recovery_side_effect_log.sql`：新表 `recovery_side_effect_log`。

## 契约提案（未改 `packages/contracts`）

见同目录 `SUPPORT-GOVERNANCE-CONTRACT-PROPOSALS-20261013.md`。

## 测试

- workflow-service：`ManualRecoveryServiceTest`、`ManualRecoveryExecuteEffectTest`、`ManualRecoveryControllerPermissionTest`、`ManualRecoveryControllerEndpointPermissionTest`（P2-2 端点级）、`AdminOpsRecoverySideEffectTest`、`AdminOpsRecoverySideEffectOwnSchemaTest`、`ManualRecoveryRetryIdempotencyTest`
- admin-ops：`SupportControllerFailClosedTest`、`SupportVerifiedContentWorkflowTest`、`It7DispositionAdmissionTest`（既有 IT7 frozen 用例保持通过）
- admin-web：`b8-policy-write-actions.test.mjs` 等

## UI 验收步骤（签收后、部署前可在本地跑）

1. 客服：用带媒体附件引用的工单走 ACKNOWLEDGE → START → RESOLVE（二次确认）→ CLOSE；对无附件历史工单确认「仅查看」与中文原因。
2. 恢复台：双人申请 → 批准 → 执行 `TICKET/REOPEN`，详情出现「执行结果」；未知 action 应失败且不标 EXECUTED。
3. 治理：默认 disposition 按钮不可用、中文拒绝文案；仅在配置打开后可推进案件。
4. 权限：会话缺 `iam.policy.*` 时按钮灰掉并有中文提示；有权限时可送审 / 他人审批 / 激活。

## 未做 / 遗留

- 未部署、未改生产配置；处置开关默认 false。
- 恢复副作用白名单目前只有 `TICKET/REOPEN`；其它 subject/action 仍拒绝。
- 权限页未做「新建草稿」表单（创建草稿仍走 API / 既有控制面）；本轮只接线生命周期写操作。
- 契约字段提案未合入 `packages/contracts`。

## 安全说明

- **P3-1（已知、可接受）**：执行人可以与申请人是同一人。双人控制在「批准」这一步强制（批准人 ≠ 申请人），执行只是把已批准的决定落地，并在收据里同时记录申请人、批准人、执行人。
- **P2-2（已核对 2026-10-13）**：
  - 显式校验：`ManualRecoveryController` 四个端点（request / approve / reject / execute）在进入幂等与 service 之前先按 JWT 校验 `platform` 租户与对应权限（request 要 `admin.recovery.request`，其余三个要 `admin.recovery.command`），缺权限 / 错租户 / 缺 claims / 无 JWT 一律 403。这是过滤链之外的纵深校验（过滤链本身也按同一权限准入）。admin-ops 侧 `recoveryReopen` 仍要求 `SUPPORT_TICKET_MANAGE` + 同租户。测试：`ManualRecoveryControllerPermissionTest`（helper 级）+ `ManualRecoveryControllerEndpointPermissionTest`（端点级：四个端点错 scope 403 且 service 未被触及）。
  - 内部接口未暴露（只读核对，未改任何配置）：
    - nginx（`infra/docker/clyunedev/nginx-host.conf`、`nginx-host-clyune.conf`）：`api.clyunedev.com` / `api.clyune.com` 只 `proxy_pass http://127.0.0.1:18070`（网关），并把 `/actuator*` 直接 404；没有任何 `location` 直连 workflow（18071）或 admin-ops（18097），`internal/v1` 字样只出现在注释与 404 规则之外——结论：nginx 层没有暴露内部接口。
    - 网关（`GatewayRouteExecutionPolicy` + `CanonicalRoutePolicyWebFilter`）：公网路径只有 `/api/v1/...`；任何 `/internal/...` 或 `/api/v1/internal/...` 在路由前被 `isExternalInternal` 直接 404（`CanonicalRoutePolicyWebFilterTest.rejectsExternalInternalAliasesBeforeTheRemainingChain` 覆盖）；`admin-recovery` 规则只把公网 `/api/v1/admin/recovery/...` 重写到内部目标，**没有**把 `/internal/v1/workflow/...` 或 `.../recovery-reopen` 原样对外开放的 projection——结论：网关层没有暴露内部路径（外部打 `/internal/...` 得到 404）。
    - 容器（`docker-compose.core/full.yml`）：只有网关映射宿主端口（`127.0.0.1:18070`）；admin-ops / workflow 无 `ports:`，只在 `clyunedev` 私有网络内被网关经 `http://admin-ops-service:18097` / `http://workflow-service:18071` 调用——结论：容器层没有把内部端口暴露到宿主。
- **P3-2**：工单操作按钮只对 `support.ticket.manage` 显示（`AdminSupportView.availableActions` 无该权限直接返回空数组，`act()` 再按同一权限拦截并提示中文原因；后端 `transition` / `prepareTransition` / `recoveryReopen` 同样以 `SUPPORT_TICKET_MANAGE` 强制，缺权限 403）。执行人可以是申请人：双人控制发生在审批环节（批准人 ≠ 申请人，`ManualRecoveryRequest.approve/reject` 强制），执行只是把已批准的决定落地，并在收据里同时记录申请人、批准人、执行人。

## 已知缺口：工单流转未经网关开放

网关只路由 `GET/POST /api/v1/admin/ops/tickets` 与 `GET /api/v1/admin/ops/tickets/{id}`，**没有** `/transitions` 与 `/transitions/prepare`。管理端工单按钮因此在线上会得到 404。补路由需要改网关路由表和 `p1r-gateway-boundary` 契约片段（契约只能提案）并重建 api-gateway，不在本次部署范围内。提案见契约文档第 5 节。

## Luna 签收记录（2026-10-13）

- 合并：`feat/v2-support-governance` → `dev-redesign` @ `e61829ff`；`packages/contracts` 无改动。
- 测试：admin-ops 110/0 失败/2 跳过（基线 93/0/2）；workflow-service 70/0/13（基线 58/0/13）；vue-tsc 通过；admin-web node 56 项中 3 项为既有 admin-audit 基线失败，无新增。
- 部署（37.120.160.36）：先备份 `supgov-pre-deploy-20261013102944.sql.gz`；`mysql-migrate` 应用 workflow V3（preflight/apply/verify 全通过）；仅重建 admin-ops、workflow-service、admin-web；api-gateway 未动；`ADMINOPS_IT7_DISPOSITION_OPEN` 未设置（=false）。回滚镜像记录：`/srv/cloudstudy/running-before-e61829ff.txt`。
- 冒烟 `SMOKE-SUPGOV-20261013`（脚本 `scripts/seed/smoke-supgov-20261013.mjs`）18/18 通过：
  - 仅哈希建单 503；校验附件建单 200（VERIFIED_CONTENT_V1）。
  - 真实 `TICKET/REOPEN` 恢复：admin 申请 201 → admin 自批 403 → reviewer 批准 → admin 执行 EXECUTED（“admin-ops support_ticket -> IN_PROGRESS”）→ 重复执行幂等 EXECUTED；工单回到 IN_PROGRESS；admin-ops 审计 `SUPPORT_RECOVERY_REOPEN` 1 条；`recovery_side_effect_log` APPLIED 1 条。
  - 未知动作 `TICKET/DELETE` 执行被拒 403（请求停留 APPROVED，未产生副作用）。
  - reviewer 无 `admin.recovery.request` 申请 403；策略页 reviewer 403 / admin 200；IT7 写开关 FROZEN、dispositionOpen=false。
  - 公网 `/internal/v1/workflow/**`、`/internal/v1/admin-ops/**` 均 404。
- 清理：先备份 `supgov-smoke-pre-cleanup-20261013103609.sql.gz`，执行 `scripts/seed/cleanup-supgov-smoke-20261013.sql`，残留 0；reviewer 临时恢复权限已收回。admin_audit_record 为哈希链只追加表，冒烟审计记录保留。
- 遗留：网关未路由 `/tickets/{id}/transitions(/prepare)`，生产工单按钮会 404（见合同提案第 6 节，需网关+合同变更）；未知动作拒绝后请求停留 APPROVED 而非 FAILED（安全，但状态可读性待改进）。
