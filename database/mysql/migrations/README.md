# MySQL 迁移基线

本目录是 MySQL 8.x 的单一迁移入口。文件使用 `V0001__description.sql` 形式命名，版本号必须连续、按字典序执行；清单由 `migration-manifest.json` 维护。脚本按规范化 UTF-8 内容计算 SHA-256，并把版本、描述、checksum 和执行结果写入 `schema_version`。

当前 B0 基础迁移：

| 版本 | 表 | 用途 |
|---|---|---|
| V0001 | `schema_version` | 迁移账本和 checksum 防篡改 |
| V0002 | `idempotency_keys` | 写请求占位、首次响应与重复请求语义 |
| V0003 | `outbox_events` | 事务内事件出站、重试和死信 |
| V0004 | `audit_logs` | 安全、后台、内容、数据访问的追加审计 |
| V0005 | `media_assets` | S3 对象元数据、版权、可见性和断点下载信息 |

## 执行和检查

默认连接本地固定端口：`127.0.0.1:13306`，数据库用户/库名为 `yuxuexing`。可通过 `MYSQL_HOST`、`MYSQL_PORT`、`MYSQL_USER`、`MYSQL_PASSWORD`、`MYSQL_DATABASE` 覆盖，密码通过子进程环境变量传给 mysql 客户端，不写入命令行。

```powershell
# 只做文件、命名、连续版本、禁止语句和清单检查
node scripts/database/validate-migrations.mjs

# 空库迁移前检查；只读，不创建、不删除
node scripts/database/check-database.mjs --mode empty

# 按版本执行，已应用且 checksum 相同的版本会跳过
node scripts/database/run-migrations.mjs --apply

# 存量库/迁移后检查表、列、索引和 schema_version checksum
node scripts/database/check-database.mjs --mode existing
```

`run-migrations.mjs` 不会自动递增端口，也不会执行 `DROP DATABASE`、`DROP SCHEMA`、`DROP TABLE` 或 `TRUNCATE TABLE`。迁移文件是追加式基线；已写入 `schema_version` 的文件禁止原地改写。若发现 checksum 不一致，应新增迁移并人工调查，而不是删除账本行。

## 幂等、Outbox 和审计语义

### 幂等写请求

服务端在业务事务开始时，以 `scope_code + scope_subject + idempotency_key` 唯一键占位，并保存规范化请求体的 SHA-256 `request_hash`。同一范围、同一 key：

- `request_hash` 相同且状态为 `SUCCEEDED`：原样返回首次 HTTP 状态和响应 JSON，不重复执行业务副作用；
- `request_hash` 不同：返回 `409 IDEMPOTENCY_KEY_REUSED`，不得覆盖首次记录；
- 状态为 `PROCESSING`：短暂等待或查询结果；超过 `processing_expires_at` 后由同一服务按租约恢复，不能并发创建第二条业务事实；
- `FAILED` 只允许按服务错误策略重试，不能伪造成功响应；记录在 `expires_at` 后由清理任务删除。

客户端离线同步必须复用同一个 key；服务端时间是过期和重放判断依据。数据库唯一约束是最终边界，Redis 幂等短缓存只能降低重复请求压力。

### Outbox 回放

领域事务在同一 MySQL 事务中写入业务事实和 `outbox_events`，提交后由 dispatcher 按 `status = PENDING/FAILED`、`available_at` 批量领取。领取使用短租约 `locked_by/locked_until`，发布成功更新 `PUBLISHED/published_at`；超时或失败增加 `attempt_count` 并指数退避，超过策略进入 `DEAD_LETTER`。

投递语义为至少一次。发布确认后进程崩溃可能造成事件重放，消费者必须以 `event_id` 或 `dedupe_key` 建立自己的消费幂等记录；重复事件返回已处理结果并确认消息，不能再次发 XP、权益、通知或状态变更。需要回放时只重置指定事件的状态和 `available_at`，必须保留原 `event_id`、payload 和审计链路。

### 审计

`audit_logs` 只追加，不承载手机号、邮箱、原始 token、原始 IP、完整答案或音频。`before_hash/after_hash/ip_hash/user_agent_hash` 只存不可逆摘要，`metadata_json` 只存版本化、脱敏的证据。普通业务删除不得级联删除审计；保留任务只能按合规策略处理到期数据，财务、审核和安全主审计不得被开发清理脚本触碰。

## 存量库策略

存量库检查只读地识别基础表、列、索引和账本状态。旧详细设计中的 `sys_idempotency_record`、`ops_audit_log`、`cnt_media_asset` 等域表不会被脚本自动重命名或删除；迁移适配必须另开版本，先做字段映射和回填，再切换读写。生产删除字段采用“停用 -> 新列/新表 -> 回填 -> 双写观察 -> 最后清理”的多阶段流程。

## 开发 fixture

合成 seed 位于 `database/mysql/seeds/dev/V0001__core-foundation.sql`，对应 JSON 清单位于 `tests/fixtures/mysql/core-foundation.json`。只写占位元数据，不写音频 bytes、手机号、邮箱、token、API key 或生产凭证。

```powershell
node scripts/database/validate-fixtures.mjs

# 默认只预览；明确传 --apply 才清理固定 fixture 标记行
node scripts/database/reset-dev-data.mjs
node scripts/database/reset-dev-data.mjs --apply
```

清理脚本只删除 `DEV_FIXTURE_CORE_FOUNDATION`、`fixture:core-foundation:*`、`scope_code=fixture` 和 `asset_key=fixture/core-foundation/*` 命中的行，永远不执行 DROP/TRUNCATE。重置前应保留脚本输出，便于审计和回归复现。
