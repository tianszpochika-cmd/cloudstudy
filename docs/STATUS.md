# 项目当前状态（2026-10-30）

> 本页是仓库**唯一的当前状态总览**。更新时只改本页对应行；细节以下面链接的签收账与审查原件为准。带日期的报告、证据、签收账和检查点保持原样，不随本页改写。

## 分支

- **工作分支：`dev`**（跟踪 `origin/dev`）。原 `dev-redesign` 已并入 `dev` 并删除；仓库只保留 `dev` 与 `master`。
- 历史证据、签收账与检查点里出现的 `dev-redesign` 是当时的分支名，保留原文。

## R1（迭代 2 第二轮重设计）

| 项目 | 状态 | 依据 |
|---|---|---|
| R1 卡墙 | **完成**：R1-001…R1-115 共 115/115 张，IT-1…IT-7 全部签收（2026-10-11，基于合并提交 `7a6ac0a2`） | [CARD-LEDGER](takeover/CARD-LEDGER.md) §0.1、§6；[LUNA-SIGNOFF](takeover/LUNA-SIGNOFF.md) |
| 原 114 卡墙 | 已被 115 卡账取代，GAP-WALL-114 / RES-WALL-114 已 CLOSED（2026-10-11）；10-26 补入的 114 卡材料已归档 | [归档说明](archive/2026-10-legacy/README.md) |
| R1 计划 | [dev-plan-R1](06-design/v2-980plus/redesign/dev-plan-R1.md)（IT-1～IT-7） | — |

## 移动端 UI 规格

| 轮次 | 状态 | 文档 |
|---|---|---|
| 第 1 轮（mobile-uispec-20261017） | **34/34 页已批准** | [页面清单](design/mobile-uispec-20261017/PAGES.md)、[交互](design/mobile-uispec-20261017/INTERACTIONS.md) |
| 第 2 轮（mobile-uispec-v2） | **3/34 已批准**：login、onboarding、home；**已暂停** | [页面清单](design/mobile-uispec-v2/PAGES.md)、[审查](design/mobile-uispec-v2/AUDIT.md) |

## 正式页面 UI 逐页重设计（MB 移动 / LW Web）

来源：[UI-PAGE-AUDIT](takeover/UI-PAGE-AUDIT-20261013.md)。下表所有提交均已在 `origin/dev`（2026-10-26 推送）。

| 页面 | 状态 |
|---|---|
| MB-001 登录 / MB-002 注册 / MB-003 找回密码 | 已签收并推送（PUSHED_SCOPED） |
| MB-004 新手引导 | 已签收并推送（PUSHED_UI_SCOPED） |
| MB-005 受限访问 | UI 本地验收通过（`758dc0fb`），现已在 dev |
| MB-006 测评 | C8 已签 UI_ACCEPTED_LOCAL（2026-10-21，`8a66cc73`） |
| MB-007 首页 | C8 候选稿未签（`b64db8e9`），2026-10-21 暂停 |
| MB-008 及以后 | 未开始（PENDING） |
| Web LW-001/002/003 登录/注册/找回 | 已签收并推送（PUSHED_SCOPED）；其余 Web 页 PENDING |

## 部署

- SJC 服务器 `173.249.208.210`，域名 `clyune.com`：`learn.clyune.com`（学员 Web）、`admin.clyune.com`（后台）、`mobile.clyune.com`（移动 H5）、`api.clyune.com`（网关）。运行版本 `4990dd29`（2026-10-13），落后 `origin/dev`（截至 2026-10-30 落后 132 个提交）。
- 旧德国服务器 `37.120.160.36` 与 `clyunedev.com` 域名已不是当前环境；其记录已归档到 [clyunedev-german-server](archive/2026-10-legacy/clyunedev-german-server/)。
- 编排资产仍在 `infra/docker/clyunedev/`（目录名沿用历史名称），操作步骤见[单机预发布手册](07-operations/clyunedev-single-host-pre-release-runbook.md)，域名与 IP 以本页为准。

## 文档入口

- 接手：本页 → [根交接](../CURRENT-HANDOFF.md) → [迭代 2 进度页](06-design/v2-980plus/redesign/CURRENT-PROGRESS.md) → [文档中心](README.md)。
- 已归档的旧材料：[docs/archive/](archive/README.md)。
