# 支持 / 治理 / 恢复 / 权限变更（backend group 2）— 2026-10-13

分支：`feat/v2-support-governance`（独立 worktree `cloudstudy-support-gov`）。**未部署**，待 Luna 签收。

## 范围

1. **客服工单**：带可核验媒体附件的工单可创建与状态流转；仅正文指纹的历史工单继续 fail-closed（503），界面给出中文不可用原因。
2. **治理处置**：IT-7 处置写链默认仍冻结；配置 `adminops.it7.disposition-open=true`（或环境变量 `ADMINOPS_IT7_DISPOSITION_OPEN`）后，分诊 / 隔离 / 升级 / 关闭会真正改案件状态。
3. **人工恢复**：`execute` 先跑白名单副作用再标 `EXECUTED`；当前支持 `TICKET/REOPEN`（把 `support_ticket` 从 RESOLVED/CLOSED 重开为 IN_PROGRESS），并写入 `recovery_side_effect_log`。未知 subject/action fail-closed。
4. **权限变更**：管理端「身份与权限」页在具备 `iam.policy.submit|approve|activate` 时露出送审 / 审批 / 激活按钮；无权限时按钮禁用并显示中文原因。后端 IAM 控制面本已存在，本轮只接线 UI。

## 迁移（仅新增）

- `services/workflow-service/.../V3__recovery_side_effect_log.sql`：新表 `recovery_side_effect_log`。

## 契约提案（未改 `packages/contracts`）

见同目录 `SUPPORT-GOVERNANCE-CONTRACT-PROPOSALS-20261013.md`。

## 测试

- workflow-service：`ManualRecoveryServiceTest`、`ManualRecoveryExecuteEffectTest`
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
