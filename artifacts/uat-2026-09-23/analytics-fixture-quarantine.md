# 管理统计本地合成数据隔离（2026-09-23）

## 事实与处理

本地 `analytics_service` 原有四张 owner 表各 100 行，全部可归因于本地造数。指标投影中 69 行 `bulk-100x-*` 的状态是 `READY`，却带非枚举错误码；其中 2026-09-18～23 六行导致管理端近 30 天查询在第四批运行时代码中返回 503。另有 21 行来自 `seed-local-real-admin-analytics.mjs` 的固定指标，以及 10 行来自 `local-real-10x-fixture.mjs`，均不能当作真实经营指标。前态完整投影快照见 [analytics-provenance-before.json](analytics-provenance-before.json)。

先检查了代码引用和本地库外键：四张表没有被其他表用外键引用；`local-analytics-fixture` 下没有 IAM principal。事务执行前对四表的 400 行逐项核对前缀、序号、日期和可验证的种子水印，发现未知行即拒绝执行。完整四表快照保存在 `C:\Temp\cloudstudy-analytics-fixture-before-20260923T060923Z.json`（242182 字节，SHA-256 `224eb1f7104e5455485847ad4c91e0e2123ea0f36510f9017a991c3ca78c6a60`），不在 Git。之后在一个数据库事务中把所有 400 行的 `tenant_id` 从 `platform` 改为 `local-analytics-fixture`，同时更正唯一含 `tenantId` 的合成 journal payload；没有删除行或改动其他 owner 数据。

| analytics owner 表 | 处理前 `platform` | 处理后 `platform` | 隔离租户 |
| --- | ---: | ---: | ---: |
| event_receipt | 100 | 0 | 100 |
| event_journal | 100 | 0 | 100 |
| metric_projection | 100 | 0 | 100 |
| recompute_job | 100 | 0 | 100 |

原先近 30 天的六行畸形投影现均在隔离租户。事后 [审计快照](analytics-quarantine-check.json) `status=PASS`，四表平台合成行计数均为 0。`quarantine-local-analytics-fixtures.py` 再运行显示 `ALREADY_APPLIED`，并复核四表各自的精确家族计数。

## 防再生与回归

`local-real-10x-fixture.mjs` 的四组 analytics 种子现在使用隔离租户，`db:check:local-10x` 对这四项增加租户断言，**108/108 PASS**。`seed-local-real-admin-analytics.mjs` 的 1 条 receipt、1 条 journal、7 条指标也固定写入隔离租户；`--static-only` 确认计划的 9 行均被隔离且不写库。三个相关 JS 文件语法检查与 Python 脚本编译通过。只读 `audit-local-analytics-provenance.mjs` 增加平台合成行门禁：若再出现同类行则返回 FAIL。

旧 `bulk-100x` 造数按 `CHANGELOG.md` 记录为仅落本地库、未进仓库；全仓没有找到它的可执行种子源或定时任务，所以无法证明以后有人手动重新注入时会自动改到隔离租户。审计门禁能发现再污染，无法阻止仓库外直接 SQL。`db:check:bulk-100x` 的 analytics 四表仍各 100 行，但全库门禁失败于另外八张不足 100 行的表/临时备份表；这个全库失败不由本次隔离造成，也不能借 analytics 计数宣称数据拟真。

## 真实运行复验

使用一次性合成 staff 经注册、成人 Gate、三项同意和精确授权后走真实 Gateway 与管理端浏览器。历史区间、近 30 天、两个指定指标均为 analytics-service **HTTP 200 / 0 行**；工作台显示真实空态而非错误或假 KPI，刷新可用，1280/390 宽度无溢出、无 page error。证据见 [浏览器结果](admin-two-pages-after-analytics-quarantine/evidence.json)。合成账号已停用，权限清空，活跃会话、设备、角色均为 0。订单页仍有旧 `local-fixture` 行，不能当真实订单。

该结果只恢复了空态和数据诚实性；**真实运营事件投递、投影重算、指标正确性、报表可用性仍未通过验收**。本次没有重启 Java 服务或构建镜像。
