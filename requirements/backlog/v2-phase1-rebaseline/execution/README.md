# P1R 执行记录

本目录是 Phase 1 重基线计划的当前执行日志入口。任务状态只以 `../02-编号任务台账.md` 为准，验收结论只以 `evidence/p1r/` 下通过校验的 canonical manifest 为准；旧 B0–B36、DEV、G 与旧 Evidence 只能作为 `historical-candidate`。

## 当前检查点

- 工作分支：`dev`。
- M0 实现范围已经完成统一集成；`P1R-M0-001`、`002`、`003`、`004`、`005`、`007`、`008` 已接受。
- `P1R-M0-006` 的版本清单、锁文件、许可证与 SBOM 机制已完成，但严格安全 Gate 保持 `BLOCKED`：移动端 uni-app 工具链仍带有 1 个 Vite high 漏洞，未添加豁免、未强制覆盖不兼容的编译器 peer dependency。
- M1 只允许从已接受的 `P1R-M0-008` 依赖边界开始做契约工作；M0 安全红灯解除前，不得把整个 M0 或任何发布 Gate 宣告为 PASS。
- `P1R-M1-001` 已由独立评审接受；实现源为 `96e1b541cdda8e9e5ad02bc79ea0c5b9032064c4`，canonical manifest 位于 `evidence/p1r/m1/P1R-M1-001/manifest.json`。
- `P1R-M1-002` 已由独立 Terra Ultra 评审接受；最终实现源为 `25705c4caab46449cfaa577db08bd13c8ad13fba`，canonical manifest 位于 `evidence/p1r/m1/P1R-M1-002/manifest.json`；M1 整体尚未完成。
- `P1R-M1-003` 已由独立 Luna Max 评审接受；最终实现源为 `82b27f4108cfb976a274c2ac0cc34b1c9460a7a7`，canonical manifest 位于 `evidence/p1r/m1/P1R-M1-003/manifest.json`；只证明 IAM 权限、成人 Gate、consent、tenant、admin policy 与 PEP/PDP D2 契约，不冒充 M2 运行实现。

## M0 记录索引

| 任务 | 执行记录 | canonical 状态 |
|---|---|---|
| `P1R-M0-001` | `P1R-M0-001.md` | `ACCEPTED` |
| `P1R-M0-002` | `P1R-M0-002.md` | `ACCEPTED` |
| `P1R-M0-003` | `P1R-M0-003.md` | `ACCEPTED` |
| `P1R-M0-004` | `P1R-M0-004.md` | `ACCEPTED` |
| `P1R-M0-005` | `P1R-M0-005.md` | `ACCEPTED` |
| `P1R-M0-006` | `P1R-M0-006.md` | `BLOCKED` |
| `P1R-M0-007` | `P1R-M0-007.md` | `ACCEPTED` |
| `P1R-M0-008` | `P1R-M0-008.md` | `ACCEPTED` |

统一命令、结果、并行轨道、阻塞和下一台电脑的恢复步骤见 `M0-execution-log.md` 与 `CURRENT-HANDOFF.md`。

## M1 记录索引

| 任务 | 执行记录 | canonical 状态 |
|---|---|---|
| `P1R-M1-001` | `P1R-M1-001.md` | `ACCEPTED` |
| `P1R-M1-002` | `P1R-M1-002.md` | `ACCEPTED` |
| `P1R-M1-003` | `P1R-M1-003.md` | `ACCEPTED` |
