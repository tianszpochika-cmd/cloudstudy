# 2026-10 旧材料归档

> 归档日期：2026-10-30（分支 `dev`）。文件原文不改，只把相对链接改到新位置。当前状态见 [docs/STATUS.md](../../STATUS.md)。

## 1. `r1-114-wall/` — 114 卡墙材料（已被 115 卡账取代）

2026-10-26 提交 `d2e5bcb8` 把原 114 卡墙材料补回仓库，但 2026-10-11 的 [CARD-LEDGER](../../takeover/CARD-LEDGER.md) §0.1 已声明 R1-001…R1-115 共 115 张重建卡账为权威卡墙，GAP-WALL-114 已 CLOSED。为避免两套卡墙并存，整包归档：

- 文档：`status-wall.md`、`status-wall.html`、`dev-plan-R1.status.json`、`dev-plan-R1.tasks.json`、`execution-handbook.md`、`input-gates.md`、`task-specs/`（3 份）、`tasks/`（R1-001…114 与 README）。原位置 `docs/06-design/v2-980plus/redesign/`。
- 工具：`scripts/` 下 `check-redesign-dev-plan.mjs`、`generate-redesign-dev-plan-index.cjs`、`redesign-task-state.mjs`、`test-redesign-task-state.mjs`、`lib/redesign-task-state.mjs`、`lib/redesign-task-wall.mjs`、`lib/render-redesign-task-cards.cjs`。CI 与 package.json 都没有调用它们；脚本内写死的旧路径未改，归档后不再可直接运行。
- 未归档：同一提交里的 `design-source-traceability.md` 仍被当前业务/交互链文档引用，留在原处；29 卡的 `dev-plan-R1.md` 仍是当前计划。

## 2. `handoffs/` — 旧交接与进度页

- `CURRENT-HANDOFF-2026-10-21.md`：根 `CURRENT-HANDOFF.md` 在 2026-10-30 前的全文，主体是 10-13…10-21 额度暂停/续做检查点（含 `dev-redesign` 推送失败、“本地 UI 9 / 远程 7”）。这些提交已于 2026-10-26 进入 `origin/dev`。
- `CURRENT-PROGRESS-2026-10-21.md`：`redesign/CURRENT-PROGRESS.md` 在 2026-10-30 前的全文，含签收前的“GAP-WALL-114 OPEN”表述和逐卡收据表。
- `CURRENT-HANDOFF-ARCHIVE-2026-09-28.md`：九月历史交接，原在仓库根目录。

根 `CURRENT-HANDOFF.md` 与 `CURRENT-PROGRESS.md` 保留原路径（大量文档链接到它们），已改写为指向 STATUS 的短页。

## 3. `clyunedev-german-server/` — 旧德国服务器运维记录

德国服务器 `37.120.160.36`、`clyunedev.com` 域名已不是当前环境（当前：SJC `173.249.208.210`，`clyune.com`）。归档 5 份带日期的记录：2026-09-20/09-21 跨电脑交接、09-21 官网 UI 发布、09-21 公网入口检查、10-11 部署记录。仍描述编排步骤的[单机预发布手册](../../07-operations/clyunedev-single-host-pre-release-runbook.md)留在原处并加了说明。

## 4. 未移动、仍按历史保留的材料

- `evidence/**`、`artifacts/**`：证据与审查原件，被 manifest、CHANGELOG 和 `recovery-20261007` 哈希快照引用，移动会破坏校验，保持原位。其中 `evidence/redesign/2026-10-07/orchestrator-review/*` 与 `R1-002-D1/review/identity-next-decision.md` 有 16 个链接指向已归档的 114 卡材料，因证据不改写而成为死链，目标文件可在本目录找到。
- `docs/takeover/ui-audit-20261013/` 顶层的 PAUSE-/RESUME-/CHECKPOINT-/PUSH-RECEIPT-/PUBLISH- 检查点：已签收的页面审查（如 `mobile-onboarding/FINAL-UI-REVIEW-20261015.md`）链接到它们，保持原位，按历史阅读。
- 签收账与台账（`docs/takeover/*SIGNOFF*`、`CARD-LEDGER.md`）原文不改，其中的 `dev-redesign` 是当时分支名。
