# 本地 10x 测试数据

`local-real-10x-v1` 是面向本地 MySQL 的可重复合成 fixture。它为 10 个固定 UUID 学习者建立跨服务关联数据，每个业务功能表至少 10 条；B3 的 14 种资源类型各 10 条，gamification 的每个 feature 各 10 条。

## 使用

在仓库根目录执行：

```bash
pnpm db:seed:local-10x
```

该命令先写入，再运行 118 项覆盖检查。只检查、不写入数据库：

```bash
pnpm db:check:local-10x
```

生成器也支持静态检查：

```bash
node scripts/database/seed-local-real-10x.mjs --static-only
node scripts/database/check-local-real-10x.mjs --static-only
```

默认目标严格遵守本地端口 `127.0.0.1:13306`。如使用临时的非标准本地映射，需显式设置 `MYSQL_HOST`、`MYSQL_PORT`，并设置 `LOCAL_FIXTURE_ALLOW_NONLOCAL=1`；不要对生产数据库执行该命令。日期默认固定为 `2026-08-26`，可用 `LOCAL_FIXTURE_DATE=YYYY-MM-DD` 覆盖。

## 数据边界

fixture 只写入各服务自己的 owner schema：IAM、learner、content、learning、assessment、media、notification、gamification、social、commerce、admin-ops 和 analytics。Gateway、worker、service-template 没有业务数据库，因此不生成数据库行；旧 `core-api` 不参与 v2 fixture。

outbox、幂等、事件去重/receipt 等技术表不计入“每个功能 10 条”，也不会被清理或覆盖。媒体只写元数据和对象引用，不写音频字节；analytics 只写脱敏投影，不写个人信息、凭证或 token。

所有 fixture 主键、业务引用和幂等键均使用 `local-10x` 标识，采用 upsert，可重复执行。清理时应按该标识逐表处理，禁止使用 `DROP DATABASE`、`TRUNCATE` 或无条件 `DELETE`。
