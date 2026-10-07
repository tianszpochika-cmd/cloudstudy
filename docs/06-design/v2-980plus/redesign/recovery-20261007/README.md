# dev-redesign 接手基线恢复核对（2026-10-07）

核对源码：`ff0f8057f4088ead03ab7890493cdf9d06f6d5f1`。**在本次限定搜索范围内，未找回原机器完整 114 卡计划、状态墙/工具或 R1-001 完整交付与独立验收原件。** 本目录形成可审计的 29 卡来源接手索引，不是新的执行墙；不迁移 ACCEPTED，不签 READY，不解锁 IT-2，不发布完成率。

- [恢复与缺口报告](recovery-report.md)：来源、搜索边界、官网历史证据与后续关闭条件。
- [29 卡阅读索引](cards-29-index.md) / [完整机器索引](cards-29-index.json)：原定义、owner、依赖、验收，以及带行号的来源导航候选。
- [来源清单](source-manifest.json)：25 个定向来源文件的 SHA-256 与最后路径提交。
- [搜索快照](search-snapshot.json)：refs/reflog/worktree/stash/历史/悬空提交的只读命令及实际结果。
- [历史来源完整性](source-integrity-check.json)：R1-002 27/27 工件摘要匹配；官网 sweep 的 22 条历史记录边界。
- [索引验证结果](validation.json)：本目录结构与来源校验，不能作为业务验收。

`build-index.py` 只读取列出的固定 ff0f8057 Git历史blob及路径元数据，只写本 recovery 目录。它是本次恢复索引生成器，**不是**未发布的 `check-redesign-dev-plan.mjs` 或 `test-redesign-task-state.mjs` 的替代品。生成器重放固定来源；已有immutable输出只比对、绝不覆盖，首次生成manifest也必须匹配固定预期摘要；原搜索现场与mobile快照保留不刷新。日常核对命令（仓库根目录）：

```sh
python3 docs/06-design/v2-980plus/redesign/recovery-20261007/build-index.py --verify-replay
python3 docs/06-design/v2-980plus/redesign/recovery-20261007/test-generator-replay.py
python3 docs/06-design/v2-980plus/redesign/recovery-20261007/verify-index.py
```

运行层源台账和旧 P1R 的状态/成熟度保留历史意义。本索引只验证来源 ID 与文件存在；逐卡完整覆盖、契约/事件绑定、data owner 和独立签收仍需关闭相应 GAP。

2026-10-07 独立审查返工：验证器改从固定 `ff0f8057f4088ead03ab7890493cdf9d06f6d5f1` Git历史blob验证25个来源和索引行引用，source-manifest摘要固定为 `d6c4f419fa62932d74ab6542ec0ef16583748cde07790f650dba95a9b2f3b319`。当前工作树合法更新不影响历史核对；当前变化单独记入 [工作树边界](current-worktree-boundary.json)，不导入卡状态。3处原有mobile文件摘要仍需保持。重跑862 PASS / 0 FAIL。

生成器同步固定返工：临时Git夹具改变其工作树progress后仍从固定历史blob重放，结果记录于 `generator-replay-check.json`，exit0；真实progress与5个immutable输出摘要均保持。夹具移除，未改原进度制造测试。
