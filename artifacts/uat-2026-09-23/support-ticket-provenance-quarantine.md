# 客服工单本地来源审计与隔离

## 已执行

本机 `admin_ops_service.support_ticket` 原有 **101** 条，全部在 `platform`。按固定 ID、确定性种子算法、摘要、资源引用、版本和字段组合交叉确认后，在一个事务内将以下 **74** 条移至 `local-support-fixture`：

| 来源 | 数量 | 依据 |
| --- | ---: | --- |
| `bulk-100x` | 55 | 0046–0100 连续序号；摘要、资源引用、版本、审计占位符一致 |
| `local-real-10x-v1` | 10 | 工单 ID、请求者 ID、摘要、引用和 SHA-256 与确定性种子逐项一致 |
| admin/analytics 本地种子 | 1 | 固定 `ticket-local-001` 及完整字段匹配 |
| 手工演示种子 | 8 | 演示摘要 1–8、固定资源引用、分类/优先级/状态和 demo 账号一致 |

**27 条保留在 `platform`，每一列均未改动。** 它们都有 IAM 账号、owner 审计及幂等收据；16 条可与仓库运行脚本直接关联，另 11 条未完全追溯。不能因测试域名或摘要为哈希就移动它们。

隔离的 74 条保留原始工单 ID 和请求者引用，只变更 `tenant_id`，并清空合成的 `last_audit_id`。其中 55 个审计 ID 本来无对应记录；10 个 local-10x ID 指向合成审计，且已有真实后继记录引用其哈希。为保留不可变审计链，未修改 `admin_audit_record`。当前应用仅接受 `platform` 管理 JWT，这批 fixture 工单不再进入正式列表。

## 备份与精确保护

- 完整 101 行备份：`C:\Temp\cloudstudy-support-quarantine\support-ticket-before-20260923T070723Z.json`（Git 仓库外）。
- SHA-256：`a09544309efacca0f3c39a0d7158b85711bd1bd22e338f311a8510962e211d92`；已重新计算核对。
- [隔离脚本](../../scripts/database/quarantine-local-support-fixtures.py) 默认只做 dry run；`--apply` 限制本机 MySQL 13306，要求原始 101 条、四族精确计数与编号、目标租户为空、无幂等/outbox 工单 ID 链接；对每条执行 ID、源租户、指纹、资源引用、版本联合条件更新。若任一条件漂移则事务回滚。
- 迁移后逐字段比对备份和当前 101 行：74 条仅有预期两列变化，27 条完全相同；租户计数 `platform=27`、`local-support-fixture=74`，全表总数仍 101。

## 复测

- [种子保护测试](../../tests/uat/support-fixture-seed.test.mjs)：2/2，通过。`local-real-10x`、admin/analytics、手工演示三个种子入口现只向 fixture tenant 写工单；analytics 原有静态保护检查通过。
- [Gateway 探针证据](support-quarantine-gateway-live.json)：匿名列表 401；未授权账号 403；完成成人 Gate、同意及只读权限后，管理列表 200 / **27**，该账号自身列表 200 / **0**，平台工单详情 200，fixture 工单详情 404。前后 owner 计数相同。
- 三次临时探针账号均精确置为 `DISABLED`，有效会话 **0**。前两次因 IAM 在成人 Gate/同意前剥离 `support.*` 权限而得到 403，第三次按正式流程完成 Gate/同意后通过。

## 仍需保留的边界

27 条是可追踪的本地 owner 工单，不等同于真实用户投诉或客服可处理工单。当前管理端 `/support` 仍只展示历史列表，消息和处理命令链尚未开放；本次仅验证读取及租户隔离，不能将客服完整功能记为通过。
