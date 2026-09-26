# 本地社群合成数据隔离记录（2026-09-23）

## 已完成：100 个可见房间及关联行

`dry-run.json` 是写入前的只读快照，`blockers=[]`。当时 `social_service` 的 `platform` 恰有 100 个房间：89 个 `bulk-100x-soc_study_room-room-0012..0100`、10 个 `local-10x-room-01..10`、1 个 `room-local-foundations`。范围只含下表的 601 行；排行榜及其他账号投影不在本次事务中。

| 表 | bulk | local-10x | foundation | 移入 `local-social-fixture` |
| --- | ---: | ---: | ---: | ---: |
| `soc_study_room` | 89 | 10 | 1 | 100 |
| `soc_room_member` | 33 | 31 | 37 | 101 |
| `soc_seat_lease` | 65 | 10 | 25 | 100 |
| `soc_focus_state` | 31 | 34 | 35 | 100 |
| `soc_interaction` | 84 | 10 | 6 | 100 |
| `soc_report` | 71 | 10 | 19 | 100 |

284 条 bulk 子行使用本表名生成的 `room_id`，本来就没有对应房间；local-10x 的 95 条和 foundation 的 122 条子行均按 `tenant_id + room_id` 关联到房间。本批六表中，已匹配账号的直接主体均为 `.invalid`，无其他租户 IAM principal；9 个 bulk owner 仅有 platform principal 而无账号，foundation 的少量历史 UAT 成员没有 IAM principal。完整行一律保留在备份与隔离租户。跨 schema 的 `room_id`/`room_ref` 列、232 个 JSON 列均没有这 100 个房间 ID；六表无外键消费者。此项是当前数据库检查，不代表未知库外作业永远不会再写入。

先在 Git 仓外保存完整行备份，再由 `scripts/database/quarantine_local_social_rooms.py --apply` 在一个 MySQL 事务中逐行锁定、比对快照、移动六表 `tenant_id`，提交前确认源行清零、目标行数及规范化全行 SHA-256 与备份相同。两次预演错误均发生在备份/写入前，修正后仅有一次成功提交。备份为 `C:\temp\cloudstudy-social-rooms-before-20260923T093217Z.json`，SHA-256 为 `609cc729d30b8ab14465aa6e5eeec58a7cedeb37842f41bd18fec2ceb1fb747a`；文件含完整主体标识，必须留在 Git 外并限制访问。独立文件哈希复算一致。该备份也是回滚事实源，因为社群租约清扫器可跨租户改变已隔离的席位/成员/专注行。

`post-quarantine.json` 的提交后只读验证：platform 六表候选行全为 0、全部可见房间为 0；隔离租户 601 行，各表规范化全行哈希与备份一致；隔离租户 IAM principal 为 0；`failures=[]`。`node scripts/database/check-local-real-10x.mjs` 的 108 项检查 PASS，额外检查 platform 社群 fixture 行数为 0。`GET http://127.0.0.1:18070/api/v1/social/rooms?limit=20` 匿名请求返回 401，证明鉴权边界仍生效；没有现成安全浏览器登录态（浏览器库存为空），所以尚无 Gateway 已认证空列表和 320/390px 手机 H5 截图，不能将数据库结果冒充浏览器验收。

两条仓内种子路径已移除 `social_service` 写入：`scripts/database/local-real-10x-fixture.mjs` 不再生成社群房间/关联/排行榜 SQL，`scripts/database/seed-local-real-learning-world.mjs` 不再为所有活动账号生成 `local-fixture` 排行榜，也不再写 foundation 房间/席位/举报。相关健康检查现在要求 platform fixture 房间/席位为 0，其他领域的校验仍保留。三个脚本 `node --check` 通过，聚焦 Node 测试 11/11、Python 范围测试 2/2。仓库未找到 bulk-100x 写入器，只有旧计数器 `scripts/database/check-bulk-100x.mjs`；若库外批量写入器仍运行，可能再次污染 platform。`db:check:bulk-100x` 的旧最低行数门槛也不再适用于隔离后的社群表，不应为通过该旧门槛重播种子。

### 回滚（仅需恢复时执行）

先暂停社群写入及库外种子，确认备份 SHA 与本记录一致，运行：

```powershell
python scripts/database/quarantine_local_social_rooms.py --restore C:\temp\cloudstudy-social-rooms-before-20260923T093217Z.json --backup-sha256 609cc729d30b8ab14465aa6e5eeec58a7cedeb37842f41bd18fec2ceb1fb747a
```

恢复脚本先拒绝 platform 已有同 ID、目标 ID 集改变及备份哈希不符的情况，在单事务中逐列写回备份原值，并检查源表全行 SHA-256 与备份一致后提交；失败会回滚。隔离租户的运行时状态可能在日后漂移，因此不能仅用反向 `tenant_id` 更新恢复。回滚会使原 100 个技术房间再次对 platform 可见，须仅在确实需要回退时使用。

## 已完成：381 条合成排行榜投影

`leaderboard-dry-run.json` 是写入前的只读审计：platform 排行榜恰为 381 行，其中 371 行 `source_watermark='local-fixture'`，10 行覆盖 `local-10x-leaderboard-watermark-01..10`；固定分数、十行种子公式及全行哈希均与旧种子吻合。目标租户原为 0 行，唯一键碰撞、外键消费者、结构化引用和 232 个 JSON 列命中均为 0。聚焦测试当时为 5/5 PASS。交叉审查后主任务运行了一次 `scripts/database/quarantine_local_social_leaderboards.py --apply`，仅把这 381 行在单事务中从 `platform` 移到 `local-social-fixture`；房间、IAM 和学习表均不在该脚本写入范围。

Git 外完整备份为 `C:\temp\cloudstudy-social-leaderboards-before-20260923T095151Z.json`，SHA-256：`57f4b37e54eda161423f618bfa1efd0c02a5b580dcece9d0cceb04a4cb3e6445`，原行全量 SHA-256：`3e965184bafbffe83fc93ae3bd6764946c33ed730e864cc89ed7a08ae83e4b4e`。备份含主体标识，不能纳入 Git、日志或截图。

独立运行 `scripts/database/verify_local_social_leaderboard_quarantine.py` 后，`leaderboard-post-quarantine.json` 显示：备份文件 SHA 独立复算一致；platform 榜单候选及总数均为 0；目标租户恰有 381 行且备份的 381 个 ID 全部命中；把目标 `tenant_id` 规范化后，全行哈希与原备份一致，`failures=[]`。六张房间表仍为 platform 0、隔离 601 行；bulk 幂等记录与事件去重仍各 100 条，隔离租户 IAM principal 0。该验证没有执行第二次 apply 或 restore。

371 条基础投影中有 1 条关联非 `.invalid` IAM 账号。它仍逐字段吻合旧脚本给所有活动账号写的固定 20/20 分值和 `local-fixture` 水印，没有对应真实社群活动证据；隔离只影响这一条排行榜投影，不触碰账号和学习事实。**语义风险**是旧种子曾用 `ON DUPLICATE KEY UPDATE` 覆盖分数，没有更早快照就无法重建该账号可能曾有的原始成绩。当前数据质量修复也不等于真实排行榜链路已经验收；已认证 Gateway/移动端可见空态仍待浏览器检查。

### 排行榜恢复命令（只有确需回退时执行）

```powershell
python scripts/database/quarantine_local_social_leaderboards.py --restore C:\temp\cloudstudy-social-leaderboards-before-20260923T095151Z.json --backup-sha256 57f4b37e54eda161423f618bfa1efd0c02a5b580dcece9d0cceb04a4cb3e6445
```

恢复脚本先核备份 SHA、格式、原 ID 集与平台唯一键碰撞，在单事务中从备份逐列恢复 381 行，并核对全行哈希后提交。恢复将使这些固定分数重新出现在 platform；目前没有执行恢复。当前引用扫描能排除显式行 ID 和特定 JSON 水印，但无法证明仓库外事件或按主体/日期消费完全不存在。
