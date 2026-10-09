# CURRENT-HANDOFF — dev-redesign 迭代 2（第二轮重设计）

> 更新：2026-10-09。本分支只有一套当前进度入口：[迭代 2 当前进度](docs/06-design/v2-980plus/redesign/CURRENT-PROGRESS.md)。本文件仅提供阅读路径，不重复维护完成率或任务状态。

## 接手入口

1. 核对分支、提交与已有差量；阅读 [AGENTS](AGENTS.md)。
2. 阅读[当前进度与最近工作点](docs/06-design/v2-980plus/redesign/CURRENT-PROGRESS.md)、[重设计包](docs/06-design/v2-980plus/redesign/README.md)、[R1 执行计划](docs/06-design/v2-980plus/redesign/dev-plan-R1.md)。
3. 当前进度：R1-002~006、R1-008 已通过独立终审签收；R1-007 门未过等待态双端实现与单测全绿；下一步推进 R1-009（画像首步极简：目标/时长/每日提醒）。当前没有足够证据宣称 IT-1 已出站或 IT-2 已开工。
4. 本机启动、测试与 SDK 检查见[开发指南](docs/07-operations/local-development.md)和[10 月 6 日环境验证](docs/07-operations/local-environment-verification-2026-10-06.md)；运行状态需重新检查，环境通过不升级业务验收。

“迭代 2”是这轮 Redesign；IT-2 是 R1 内的定级站；Phase 2 是产品 AI 阶段。三者分别使用，不互相解锁。

## 历史与文件边界

- 原 P1R、B/DEV/G、56 页台账和九月接手顺序仅供复用与审计；[九月历史交接](CURRENT-HANDOFF-ARCHIVE-2026-09-28.md)保留原文。不要根据旧完成率、勾选或“下一步”认领新工作。
- 不改旧 canonical manifest/验收状态，不回写或删除历史证据；本轮 R1 证据按当前提交单独收集。
- 更新进度时只维护[当前进度页](docs/06-design/v2-980plus/redesign/CURRENT-PROGRESS.md)及对应卡证据，并提交到 `origin/dev-redesign`。
- 本次文档整理前已有移动原型文档差量（`mockups/mobile/evidence/README.md`、`mockups/mobile/README.md`、`mockups/mobile/evidence/independent-r14/README.md`）；应核对来源并保留，不因入口整理一并覆盖或提交。
