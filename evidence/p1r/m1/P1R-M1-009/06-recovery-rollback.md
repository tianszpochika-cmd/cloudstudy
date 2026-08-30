# 恢复与回滚

- 上传完成、处理 task、retry 和录音完成都绑定幂等键与版本；stale callback 不能覆盖较新 asset/task 状态。
- 只有 TRANSIENT 失败进入最多 5 次的指数 jitter 重试；未知失败关闭，预算耗尽进入 workflow-owned DLQ 与人工恢复。
- manifest 的媒体、字幕或 fallback 不可用必须返回明确状态和替代，不允许空白成功或伪造 CLEAN/rights/publish eligible。
- 删除在 legal hold、revoke 和 cancel 检查之后执行，只有确认 DELETED 才有 purge receipt；本任务没有执行真实删除。
- 源码可按 `ca282cd..2e7304a` 逆序回退，并重跑 merge/generate/validate/compatibility/media/Gateway/IAM/P1R/typecheck/plan；不得移动固定 baseline，也不得把源码回退当成对象、数据库或 broker runtime rollback。
