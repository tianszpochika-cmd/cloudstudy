# 契约证据

- 事件目录共 154 条：7 条 `CANONICAL_D2`、147 条 `HISTORICAL_CANDIDATE`。
- 14 个固定 fragment 具有精确路径、顺序和事件所有权；payload 必须在所属 fragment 内闭包，未知、重复、移动或孤儿 schema 均失败关闭。
- AsyncAPI 3.0 只投影 7 条 canonical 事件：7 个 channel、7 个 send、14 个 receive，共 21 个 operation；Kafka binding 版本为 `0.5.0`。
- 154 个生成 TypeScript 事件接口均保留必填字面量 `schemaVersion`。
- 兼容性采用双不可变 Git 基线：`463c4b2` 保护旧契约，`868c217` 保护本任务首次引入的治理字段和 B26 静态路由政策。

复现入口：`pnpm contracts:merge:check`、`pnpm contracts:generate:check`、`pnpm contracts:validate` 与 manifest 中记录的双基线 compatibility 命令。
