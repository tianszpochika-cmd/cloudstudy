# 开发种子

这里只放可重复执行的纯合成数据。不得导入真实手机号、邮箱、token、API key、原始音频、支付凭证或真实订单。

当前 fixture：

- `V0001__core-foundation.sql`：为 `media_assets`、`idempotency_keys`、`outbox_events`、`audit_logs` 写入带固定标记的占位元数据；不包含任何音频 bytes。
- 对应 JSON：`tests/fixtures/mysql/core-foundation.json`。

先执行迁移，再执行 seed SQL。seed 使用固定 UUID、dedupe key 和 asset key，重复执行不会新增同一 fixture。清理请使用仓库脚本的预览模式，确认输出后再传 `--apply`；脚本只清理固定 fixture 标记，不使用 `DROP DATABASE`、`DROP TABLE` 或 `TRUNCATE`。
