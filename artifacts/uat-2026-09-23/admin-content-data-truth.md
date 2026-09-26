# 管理端内容历史探针数据核查与精确清理（2026-09-23）

本批只处理本机 MySQL 的 `content_service` 历史测试探针。清理前有 106 条 `content_definition`，其中 11 条没有对应 `content_version`；清理后分别为 **103** 和 **8**。这只是数据真实性的一小步，不代表其余内容具备真实版权、审核或课程资格。

## 来源与引用盘点

当前定义的主要来源为 `wct-*` 34、`LIVE-PUB*` 33、`bulk-*` 16、`local-10x-*` 10、其他 8、`E2E-PACK-*` 2、`REPRO-PACK-*` 2、`T14-PACK-*` 1。10 条 `local-10x` 来自现行 `local-real-10x-v1` 合成种子，保留以支持本地测试。`bulk-course-0085..0090` 的 `created_by=bulk-100x-created_by-*` 不对应 IAM 账号，`created_at` 还在本机当前日期之后；这些字段证明其夹具来源，却不能抵消现存引用。

对 11 条无版本定义及 14 个子 lexeme/item ID，在 **14 个现行 owner schema、173 张表**的字符串/JSON 字段中做了只读引用扫描，并另外核对版本、公开投影、排期、outbox、学习/学员/评测/媒体 pin。扫描不包含历史单体 `yuxuexing` 或本轮备份 schema。原始逐项结果见[清理前扫描](admin-content-data/reference-scan-before.json)。

| 范围 | 发现 | 处理 |
| --- | --- | --- |
| `bulk-course-0085..0090`（6 条） | 每条都有 `content_public_projection`、B25 内容行、B10 评测会话和 B25 题目规则引用。 | 保留。无版本却有公开/评测事实，需要独立核查或隔离，不能直接删。 |
| `E2E-PACK-MUBBMMMQ` | 子词条处于 `IN_REVIEW`。 | 保留审核状态及记录。 |
| `E2E-PACK-MUBBNORG` | 子词条 `PUBLISHED`，另有 outbox 和已执行排期。 | 保留发布历史及记录。 |
| `REPRO-PACK-MUBA8O9Q`、`REPRO-PACK-MUBBRQQR`、`T14-PACK-MUBIT0T8` | 2026-09-21 合成账号创建，标题即探针编码，词条为 `repro-alpha/bravo/...` 或 `batch-one`，题干为 `batch stem`；全部 DRAFT，无审核/发布/授权事实、公开投影、排期、outbox 或跨服务 pin。仅自身 11 条 lexeme、1 条 item 和 14 条精确幂等回执。 | 备份并精确清理。 |

`wct-*` 和 `LIVE-PUB*` 以及其他历史行中已有发布、审核或权利状态；本批没有按前缀删除，也没有改版权状态。

## 清理和可回滚备份

[精确清理脚本](../../scripts/database/cleanup-local-content-repro-probes.py) 默认只读；`--apply` 在同一批次重新扫描 173 张 owner 表，锁定目标行并逐项校验身份、DRAFT 状态、审核/发布字段、子对象 ID、幂等回执和直接引用。备份完成后才在本地事务中删除，删除行数与预期不符即回滚。事前 dry-run 通过。

- 删除：`content_definition` **3**、`lexeme` **11**、`content_item` **1**、`content_idempotency_record` **14**；未删除版本、公开投影、排期、outbox 或其他服务行。[事务证据](admin-content-data/cleanup-evidence.json)
- [可回滚 SQL 备份](admin-content-data/backup-repro-t14-3-probes.sql)：29 条独立 INSERT，10,142 bytes，SHA-256 `ce600cfc413bdb74fce15d8667b7202e3857f2195af31c132dfac62284fb46b5`。仅应核对目标仍为空、在同一本地 schema 上人工审查后回灌；本轮未执行恢复。
- 清理后再次扫描 173 张表，被删的 3 个编码和 12 个子对象 ID 的命中从 **29 降至 0**；[清理后扫描](admin-content-data/reference-scan-after.json)。定义 106→103、无版本 11→8，`local-10x` 仍 10 条、bulk 6 条、E2E 2 条，公开投影仍 56 条。再次运行清理脚本返回 `already-clean`，无第二次写入。

## 再生边界与剩余风险

现行 `db:seed:local-real-all` 仅串接 learning-world/commerce/admin-analytics 种子；`db:seed:local-10x` 的内容编码由 `local-real-10x-v1` 生成；`db:seed:large-vocab` 也没有本批 `REPRO-PACK-*`、`T14-PACK-*` 编码。当前仓库 `scripts/` 与 `database/` 除精确清理脚本外无这些前缀或本批精确编码，因此现行种子不会把被删三条重新写回。外部一次性探针若重新运行并生成新编码，仍需单独治理。

保留的 8 条无版本定义仍不可信：特别是 bulk 6 条存在公开投影与评测引用，不能因显示为“版本缺失”就视为已清理。当前 `content_definition` 103 条仍满足旧的每表 100 条数量门槛，但行数门槛不代表素材真实或可发布。
