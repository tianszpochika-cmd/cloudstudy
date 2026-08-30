# 恢复与回滚

M1-011 的任务启动提交为 `a55ac26...`，实现提交为 `5b6a3d5...`，review hardening 提交为 `daa543b...`。如需撤销静态契约，按相反顺序回退 `daa543b...` 与 `5b6a3d5...`，再运行 learner planning、生成类型、merge/generate/validate、固定 compatibility、P1R、typecheck、Evidence 和 diff 门禁。

不得移动 `cd92378...`/`868c217...` 等不可变基线，也不得把源码回滚解释为数据库、Outbox、Kafka、workflow、浏览器或真实用户数据回滚。真实 placement/Saga 恢复归 M1-012/M2-006，owner 数据与消息运行恢复归 M2-004/005。
