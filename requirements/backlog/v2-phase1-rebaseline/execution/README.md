# P1R 执行记录

本目录是 Phase 1 重基线计划的当前执行日志入口。任务状态只以 `../02-编号任务台账.md` 为准，验收结论只以 `evidence/p1r/` 下通过校验的 canonical manifest 为准；旧 B0–B36、DEV、G 与旧 Evidence 只能作为 `historical-candidate`。

## 当前检查点

- 工作分支：`dev`。
- 当前台账计数：`15 ACCEPTED / 1 BLOCKED / 1 IN_PROGRESS / 91 PLANNED`（共 108 项）。
- M0 实现范围已经完成统一集成；`P1R-M0-001`、`002`、`003`、`004`、`005`、`007`、`008` 已接受。
- `P1R-M0-006` 的版本清单、锁文件、许可证与 SBOM 机制已完成，但严格安全 Gate 保持 `BLOCKED`：移动端 uni-app 工具链仍带有 1 个 Vite high 漏洞，未添加豁免、未强制覆盖不兼容的编译器 peer dependency。
- M1 只允许从已接受的 `P1R-M0-008` 依赖边界开始做契约工作；M0 安全红灯解除前，不得把整个 M0 或任何发布 Gate 宣告为 PASS。
- `P1R-M1-001` 已由独立评审接受；原实现源为 `96e1b541cdda8e9e5ad02bc79ea0c5b9032064c4`，共享制品最新在 `e05c774b02ece081a5c05145b623f39d1ecd39e1` 完成 current-source revalidation，canonical manifest 位于 `evidence/p1r/m1/P1R-M1-001/manifest.json`。
- `P1R-M1-002` 已由独立 Terra Ultra 评审接受；原最终实现源为 `25705c4caab46449cfaa577db08bd13c8ad13fba`，共享制品最新在 `e05c774b02ece081a5c05145b623f39d1ecd39e1` 完成 current-source revalidation，canonical manifest 位于 `evidence/p1r/m1/P1R-M1-002/manifest.json`；M1 整体尚未完成。
- `P1R-M1-003` 已由独立 Luna Max 评审接受；原最终实现源为 `82b27f4108cfb976a274c2ac0cc34b1c9460a7a7`，共享制品最新在 `e05c774b02ece081a5c05145b623f39d1ecd39e1` 完成 current-source revalidation，canonical manifest 位于 `evidence/p1r/m1/P1R-M1-003/manifest.json`；只证明 IAM 权限、成人 Gate、consent、tenant、admin policy 与 PEP/PDP D2 契约，不冒充 M2 运行实现。
- `P1R-M1-004` 已由独立 Luna Max 终验接受；Gateway D2 原实现源为 `e4618b324e5a93926da0750a8100fc9377ac97ec`，共享制品最新在 `e05c774b02ece081a5c05145b623f39d1ecd39e1` 完成 current-source revalidation，canonical manifest 位于 `evidence/p1r/m1/P1R-M1-004/manifest.json`。真实 WebFlux CORS/CSRF、public-path、Redis 限流、持久审计、网络直连隔离和跨进程证据仍属于 `P1R-M2-001`。
- `P1R-M1-005` 已由独立 Luna Max 终验接受；原最终实现源为 `21cdd3a94d0c721c96f5257d26efbb0c1b9354fb`，共享制品最新在 `e05c774b02ece081a5c05145b623f39d1ecd39e1` 完成 current-source revalidation，canonical manifest 位于 `evidence/p1r/m1/P1R-M1-005/manifest.json`。本任务只冻结 D2 数据所有权与迁移政策。
- `P1R-M1-006` 已由独立 reviewer `agent:m1_005_independent_review:gpt-5.6-luna:max` 接受原最终实现源 `3e4ba856742f28ba9d3fc4a3264c4b24c1cafc5a`；共享制品最新在 `e05c774b02ece081a5c05145b623f39d1ecd39e1` 完成 current-source revalidation。输出保持 `NOT_RUNTIME_VERIFIED`；真实 Kafka 运行验证仍归 M2-005。
- 因 M1-008 更新了共享契约、生成物、Gateway/B26 静态输入与测试，`P1R-M1-001` 至 `P1R-M1-007` 的 canonical manifest 已统一绑定 `e05c774...` 做 current-source revalidation；各任务的原始实现源、完成时间、reviewer、兼容基线与历史复核链仍保存在 manifest `provenance`，没有被改写成 M1-008 的实现成果。
- `P1R-M1-007` 已由独立 reviewer `agent:m1_007_independent_review:gpt-5.6-luna:max` 终验接受原最终源码 `6ce98a95b75e7efca05cc511f5f773dbf2be08a4`，另一位 Luna Max 交叉复核亦接受；共享制品最新在 `e05c774b02ece081a5c05145b623f39d1ecd39e1` 完成 current-source revalidation，canonical manifest 位于 `evidence/p1r/m1/P1R-M1-007/manifest.json`。结论仅为 `D2_CONTRACT_READY` / `NOT_RUNTIME_VERIFIED`；B26 仍为 `static-only` / `runtimeStatus=pending` / `defaultDecision=NO-GO`，真实 owner schema/事务、Kafka/consumer 与 Saga/人工恢复分别归 M2-004/005/006。
- `P1R-M1-008` 已由三条 Luna Max 只读轨道一致接受最终源码 `e05c774b02ece081a5c05145b623f39d1ecd39e1`，canonical manifest 位于 `evidence/p1r/m1/P1R-M1-008/manifest.json`。11 个内容 command、双审身份与阶段集合、排期发布、公开/学习投影、B10 pin/fallback、5 个 canonical content 事件及 composed TypeScript 生成均通过失败关闭验收，当前源码 P1/P2 为 0；结论仍只为 `D2_CONTRACT_READY` / `NOT_RUNTIME_VERIFIED`。

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
| `P1R-M1-004` | `P1R-M1-004.md` | `ACCEPTED` |
| `P1R-M1-005` | `P1R-M1-005.md` | `ACCEPTED` |
| `P1R-M1-006` | `P1R-M1-006.md` | `ACCEPTED` |
| `P1R-M1-007` | `P1R-M1-007.md` | `ACCEPTED` |
| `P1R-M1-008` | `P1R-M1-008.md` | `ACCEPTED` |
