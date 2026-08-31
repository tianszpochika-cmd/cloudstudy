# 恢复与回滚证据

- 通知达到最大尝试或遇未知失败后进入 DLQ/受控 recovery；恢复任务不能改写 source domain fact，关闭任务也不能代替 owner receipt。
- 同步以服务端 subject/device/aggregate 排序和去重；同 hash 可 replay，异 hash、gap、乱序、stale/future base 必须返回显式 conflict，恢复仍回到 owner-specific command。
- support 的 reopen、assignment、SLA、resolution 与 retention 都要求 expectedVersion/CAS、审计引用和 owner receipt；未知 legal hold 或缺对账时禁止清理/关闭。
- 源码回滚：先按逆序回退 M1-016 Evidence/台账集成提交，再回退 `9a38ff2185286bc8e279f785ff3fad5de30de569`，随后重跑专项、contracts、compatibility、event、Gateway、B26、P1R、plan、gap、Evidence 与 diff 门禁。
- Git 回退不等于真实通知、数据库、broker、workflow、support 数据或客户端缓存回滚；这些运行恢复仍由后续任务验收。
