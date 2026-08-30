# 恢复与回滚

M1-007 的稳定源码提交链为 `64b5f96`、`ce3e3bb`、`12ab943`、`93d75d7`、`a6cdb51`、`6ce98a9`，来源检查点为 `93c764f`。三次评审返工分别关闭状态机/因果与 Schema 条件、G1 计数与兼容字段注入、完整事件治理委派与 Outbox attempt 下界问题。

若需回退，按上述源码提交逆序撤销，然后重新运行 reliability、Saga、merge、generate、validate、双基线 compatibility、P1R、G1、B26、typecheck、CI 与 diff 门禁。不得删除或移动不可变契约基线 `463c4b2` 与治理基线 `868c217`。

本任务没有运行数据写入、数据库迁移或 broker 变更，故不存在数据逆迁移。未来 M2 runtime 的补偿、恢复和回滚必须由其自身 Evidence 证明，不能引用本 D2 包代替。
