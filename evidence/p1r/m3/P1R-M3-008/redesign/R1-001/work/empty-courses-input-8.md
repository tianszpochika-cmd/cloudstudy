# R1-001 合法空课程输入只读盘点（不写库、不下架共享课程）

> 结论先行：现有仓库中**不存在**可直接使用的 owner 隔离合法空课程事实；`publicSiteProjection` 对 PUBLIC/PUBLIC 取全部课程且 `uiLocale` 仅影响其它 facet（`ContentHttpController.java:86-107`），换语言/前端过滤/MOCKED 均不能当权威空。以下为只读盘点证据与最小新建方案（交主审批准限定环境准备范围）。

## 1. 只读核查（均未连库、未写库）

| # | 核查对象 | 结果 |
|---|---|---|
| 1 | `ContentHttpController.publicSiteProjection:86-87` | `reads.catalogEntries(PUBLIC, PUBLIC, null, null, null, null)`——locale/targetLevel/contentType 全部传 null；`uiLocale` 仅用于 `normalizeUiLocale` 影响 downloads/announcements/compliance（`:107-111`），**课程投影不因 uiLocale 变空** |
| 2 | `ContentReadService.catalogEntries:159-182` | 取 `repository.findAll()` 全部定义，仅保留 `currentPublishedVersion` 存在且投影策略通过者；空的唯一合法来源是“零已发布版本”（单测 `catalogExposesPublished` 用 `NONEXISTENT` locale 造空仅证明过滤器语义，不等于公开空事实） |
| 3 | `scripts/database/seed-demo-p5-catalog.mjs` | 现有 6 DEMO（+1 `sg-live` 共 7）全部 `status='PUBLISHED'`；脚本为 delete-then-insert 共享 `platform` tenant——**不可用于造空**（会下架共享课程，禁令禁止） |
| 4 | `scripts/database/*fixture*/quarantine*` | 现有隔离手段均为事后搬运（analytics/social/support/offline），无 content 公开课程的预置隔离空 schema/快照；`local-real-10x-fixture.mjs` 为共享 platform 写入型 fixture，不适用 |
| 5 | `content-service/src/test` | 空目录断言仅内存仓（`InMemoryContentRepository`），无可复用的 DB 空 fixture 文件 |
| 6 | migration V1..V27 | 均为 schema 演进 + B3/B2/B25 历史 seed；无“空课程”开关；`V23` 为 legacy 解绑修复，不可借用下架共享课程 |

## 2. 最小新建方案（待主审批准，不在本阶段执行）

- 新增隔离 fixture 脚本 `scripts/database/seed-r1-001-empty-courses.mjs`（拟新增，需主审批准后才创建）：仅做两件事——
  1. `mysqldump` 备份 `content_service.content_definition/content_version` 中 7 个公开课程行的 `content_id` 清单（只读导出，不删）；
  2. 在**同一 schema 内、同一事务**中将该 7 行的 `current_published_version_id` 置 NULL（可逆 UPDATE），终验后同一事务回滚恢复；全程记录前后 `SELECT content_code,current_published_version_id` 只读核查。
- 影响面：仅 content 读路径在窗口期内返回权威空（`catalogEntries` 无已发布版本→空数组→BFF `empty`）；不新增 migration、不改公开过滤契约、不动 commerce/IAM/Gateway、不清库；outbox/relay/consumer 保持关闭，无事件外溢。
- 替代方案（若主审不批准上法）：content owner 在隔离 MySQL 实例（非 13306 共享卷）重放 V1..V27 migration + 不执行 seed，还原零课程基线，仅供 TC01 空态分支；本卡不新建实例，需 owner 提供连接串。
- 若两方案均不批准：TC01 空态“内容准备中”分支保持 BLOCKED，其余分支（成功态链/价格权威空/CTA 精确入口）可先行终验。

## 3. 核查步骤（READY 后，由终验执行）

1. 基线：公开 GET 三路 200，7 ID 与 `generatedAt` 固定；
2. 批准后执行隔离空 fixture（或连隔离实例），公开 GET 课程 `[]` + BFF `empty` + DOM“内容准备中”可见；
3. 回滚恢复后复测 7 ID 一致；归档前后 SELECT 输出与请求/截图哈希。
