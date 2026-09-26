# 社交排行榜本地夹具只读核查（2026-09-23）

本报告仅检查本机 `127.0.0.1:13306` 的 owner 表、当前源码与 Git 基线；没有写数据库、触碰账号或输出个人标识。结论只适用于该本机快照，不代表容器全栈或正式环境。

## 来源与范围

| `platform` 排行榜行 | 行数 / 去重学习者 | 可核验来源 |
| --- | ---: | --- |
| `source_watermark='local-fixture'` | **371 / 200** | 全部为 `FOCUS_MINUTES`、`DAY`、`PUBLISHED`、`snapshot_version=1`、`score=20`、`qualified_units=20`；分布于 2026-08-25、08-26、08-27、09-16 四天。Git 基线的 `seed-local-real-learning-world.mjs` 曾以 `iam_principal` 所有 `platform/ACTIVE` 账号为输入，按当天日期插入这些固定记录；`ON DUPLICATE KEY UPDATE` 会重写分数。当前工作树已删去这段社交写入。 |
| `source_watermark LIKE 'local-10x-%'` | **10 / 10** | 10 条的自增 ID、`local-10x-leaderboard-watermark-NN`、`DAILY_FOCUS`、日期、90–99 分及 61–70 单位，与 Git 基线 `local-real-10x-fixture.mjs` 的十行公式 **10/10 精确一致**。当前构建语句已排除社交夹具；定义仍保留在源码。 |
| 其他 | **0** | 本机 `platform` 表的 **381/381** 行均落在上述两组，未发现不匹配的排行榜行。 |

`iam_account` 关联显示：371 条 `local-fixture` 行中，78 行关联 `@local.invalid`、22 行关联 `@example.invalid`、270 行没有 account 行、**1 行关联其他域名的 ACTIVE account**；那一行仍完全匹配旧脚本的固定 20/20 指纹，于 09-16 写入。10 条 `local-10x` 全部关联 `@example.invalid`。仅凭邮箱域名不能决定删改范围，也不能把这一个普通域名账号当成测试账号。该账号的现存社交房间成员、座位、专注、互动、举报和幂等记录均为 0；非固定种子 review、assessment session、XP ledger 均为 0。这说明**本行**缺乏真实专注成绩证据，不代表账号其他数据可清理。

## 引用与碰撞

- `local-social-fixture` 租户当前排行榜 **0 行**；按 `(tenant_id, leaderboard_kind, period_type, period_start, subject_id)` 验证，拟隔离的 381 行与目标租户碰撞 **0**。
- `information_schema` 中指向 `soc_leaderboard_projection` 的外键 **0**，其他表也没有排行榜行 ID 专用字段。当前 `local-real` Controller 按租户、kind、period 和**当天日期**读取排行榜，不按行 ID 查找；今天 09-23 的 `platform` 行数为 **0**，当前接口不会展示这些历史记录。`DAILY_FOCUS` 也不是该接口默认 `FOCUS_MINUTES` 种类。
- `soc_trusted_event_dedupe` 的 100 条均为 `room.member.joined`，没有排行榜事件；`soc_idempotency_record` 100 条 JSON 响应中含 `leaderboard` 的为 0。抽查 analytics event journal、audit fact、workflow outbox/dead letter/request idempotency 的事件名或 JSON，含 `leaderboard` 的也为 0。这排除了已知直接引用；**不能证明所有自由文本或仓库外事件绝无引用**。
- `repair-local-learning-world-seed.mjs` 已把这一组 `local-fixture` 排行榜列入 `REVIEW_ONLY`，不会自动删除；它的顾虑成立：旧种子可能覆盖账号当日原分值，缺失此前快照时无法重建原分值。

## 建议

可对这 **381 条精确指纹行**做可回退的租户隔离，不按账号域名或全表删除。先在本机备份原行及主键、唯一键、数值、来源和时间字段，复核备份 381/381 与目标唯一键无碰撞；再在单一事务中只把匹配两类指纹且仍属于 `platform` 的行改到 `local-social-fixture`，断言平台匹配行变为 0、隔离租户为 381、其他行不变。保留恢复脚本和备份清单；一条关联普通域名账号的行也只隔离**排行榜投影**，不动 IAM 或学习历史。执行前应再次运行只读计数，防止本机服务产生新写入。

当前源码已经停止两种社交夹具的插入，但需要在下一批镜像中验证种子来源与运行配置，防止旧版脚本重新写入。隔离后排行榜会呈现真实空态；这只修复虚假数据，不代表真实学习事件、合格专注、发布/冻结快照、隐私可见性和跨端排行功能已经验收。

## 交叉审查后的实际结果

主任务在上述独立审计后执行了一次精确隔离；[提交后只读核验](../audit-2026-09-23/social-room-fixtures/leaderboard-post-quarantine.json)显示：离线完整备份 SHA-256 复算一致，platform 榜单 0 行，隔离租户 381 行，归一化全行 SHA-256 与备份相同；六张房间表仍是 platform 0、隔离 601 行。备份路径、SHA 和逐列恢复命令见[隔离及恢复记录](../audit-2026-09-23/social-room-fixtures/README.md)。本核验未再写数据库，也未执行恢复。关联普通账号的那一条仍只有合成投影被隔离，账号和其他领域事实未触碰；旧种子覆盖过的可能原始分值无法从现有快照重建。
