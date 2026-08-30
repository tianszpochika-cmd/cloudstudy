# 恢复与回滚

- `UNPUBLISH` 只清除公开指针并推进 epoch/projection；不得把重复下线伪装成 `ARCHIVED`。
- `ROLLBACK` 使用已有不可变版本和显式 expected state/version，不重写审核或发布历史；旧版本是否可回滚由版权、active pin 与 retirement policy 共同约束。
- 排期任务固定 `SCHEDULED/CANCELLED/EXECUTED/INVALIDATED/RECOVERY_REQUIRED`，失败后通过只读恢复信息、审计 ID 与后续 owner command 继续，不允许无审计重放。
- B10 fallback 只影响未来读取；正在运行的 session/attempt/report/mastery 保留原 pin 或显式不可用，禁止静默重判。
- 本任务自身是契约与生成物变更，可按 `18d7d38..e05c774` 的源码提交逆序回退，再重跑 merge/generate/validate/compatibility/P1R 门禁；不得移动固定 baseline 或把回退当成数据库/Kafka runtime rollback。
