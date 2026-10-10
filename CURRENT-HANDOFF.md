# CURRENT-HANDOFF — dev-redesign 迭代 2（第二轮重设计）

> 更新：2026-10-11。本分支只有一套当前进度入口：[迭代 2 当前进度](docs/06-design/v2-980plus/redesign/CURRENT-PROGRESS.md)。本文件仅提供阅读路径，不重复维护完成率或任务状态。

## 接手入口

1. 核对分支、提交与已有差量；阅读 [AGENTS](AGENTS.md)。
2. 阅读[当前进度与最近工作点](docs/06-design/v2-980plus/redesign/CURRENT-PROGRESS.md)、[重设计包](docs/06-design/v2-980plus/redesign/README.md)、[R1 执行计划](docs/06-design/v2-980plus/redesign/dev-plan-R1.md)。
3. 当前进度以 [CURRENT-PROGRESS](docs/06-design/v2-980plus/redesign/CURRENT-PROGRESS.md) 为准。R1-009 是同意撤回与能力回收，不是画像；画像是 R1-010。Luna 对基线 `69bea68b` 的终审仍是 IT-1 **REJECT / FAIL**、IT-2 **BLOCKED**，原件在 `evidence/redesign/2026-10-10/station-acceptance/`，不要改写成通过。其后未签收的证据：`it2-station` 是 PASS_WITH_NOT_RUN；`it2-browser` 后缀 `5e3c868e` 和 `it1-recheck` 后缀 `ce0aa296` 的 `summary` 都是 PASS，`accepted`、出站标记和 `lunaStamp` 都是 false。`it1-recheck/screenshots/failure.png` 是通过前一次手机端保存失败的画面。IT-1 出站仍要 17 张卡的干净库证据和独立签收。IT-3 已按真实 BC 拆成 R1-030…042，浏览器后缀 `d2012bf6` 的 `summary` 是 PASS，`lunaStamp` 仍是 false。IT-4 后缀 `c460b646` 与 IT-5 后缀 `1f244c3b` 的 `summary` 都是 PASS，未签收。IT-6 已拆成 R1-070…090，浏览器后缀 `ad30b8bc` 的 `summary` 是 PASS，`accepted`、`it6Outbound`、`lunaStamp` 都是 false。IT-7 已拆成 R1-091…115，浏览器后缀 `3ef210cd` 的 `summary` 是 PASS，链 PASS，`accepted`、`it7Outbound`、`lunaStamp` 都是 false；较早失败后缀 `ffbedda0` 保留。收口台在进程内存里。不要按剩余张数补卡。GAP-WALL-114 仍 OPEN。不要动 qida 容器，不要删除保留库 `r1_it1_browser_20261010_iam_5d9f4b7e` 和 `r1_it1_browser_20261010_cnt_5d9f4b7e`。
4. 本机启动、测试与 SDK 检查见[开发指南](docs/07-operations/local-development.md)和[10 月 6 日环境验证](docs/07-operations/local-environment-verification-2026-10-06.md)；运行状态需重新检查，环境通过不升级业务验收。

“迭代 2”是这轮 Redesign；IT-2 是 R1 内的定级站；Phase 2 是产品 AI 阶段。三者分别使用，不互相解锁。

## 历史与文件边界

- 原 P1R、B/DEV/G、56 页台账和九月接手顺序仅供复用与审计；[九月历史交接](CURRENT-HANDOFF-ARCHIVE-2026-09-28.md)保留原文。不要根据旧完成率、勾选或“下一步”认领新工作。
- 不改旧 canonical manifest/验收状态，不回写或删除历史证据；本轮 R1 证据按当前提交单独收集。
- 更新进度时只维护[当前进度页](docs/06-design/v2-980plus/redesign/CURRENT-PROGRESS.md)及对应卡证据，并提交到 `origin/dev-redesign`。
- 移动原型三份文档已由 `69bea68b` 保存；它们属于历史原型证据，不计本轮站级验收范围。接手仍须核对当前工作区差量，不能把已提交历史记录称为未提交。
