# 恢复与回滚证据

- 静态回滚顺序：先逆序回退 M1-018 Evidence C/D，再依次回退 `2a747ba`、`9820ff4`、`c548b60` 与 `dea989a`，然后重跑 total/gap/Evidence/contracts/compatibility/P1R/G/typecheck/plan/CI/diff 门禁。
- 总 Gate 的每条命令保留显式、有界超时；超时必须报告具体 checker 并返回非 PASS。
- 事件和数据恢复仍遵循 M1-007 的 retry/DLQ/replay/Saga/receipt D2 契约；本任务未执行真实恢复。
- Git 回退不等于数据库、Redis、broker、workflow、会话、浏览器或设备状态回滚；真实恢复由 M2/M8 验收。
