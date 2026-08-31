# 恢复与回滚证据

- 对账差异只能进入受控 case；恢复必须满足 precondition version、两个不同服务端审批主体、审批收据、执行收据和恢复后重跑。
- refund 处于 `PROCESSING` 时不得撤销权益；只有完整金额且已验证 settlement 才可产生 revoke/invalidation。退款或撤销不得删除合法学习记录。
- 权益缓存以单调版本、失效版本和 tombstone 失败关闭；未知、过期、乱序或恢复不确定不得用 grace 放行。
- 源码回滚：按任务顺序先回退 M1-015 Evidence/台账集成提交，再回退 `f7a2e76fcc206c26f296ae6f1c2a4296d0a8a573`；随后重跑 commerce、contracts、compatibility、event、Gateway、B26、P1R、plan、gap、Evidence 和 diff 门禁。
- Git 回退不等于真实订单、权益、provider、数据库、broker 或缓存回滚；这些运行恢复仍由 M2/M7/M8 验证。
