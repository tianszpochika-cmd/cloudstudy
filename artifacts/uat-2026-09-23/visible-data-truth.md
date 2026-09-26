# 四端可见数据真值核查（本机只读，2026-09-23）

## 范围与口径

本轮只读检查本机 Gateway 公开响应、四端调用路径、owner 种子源码和本机 MySQL 聚合计数；没有登录、输出个人标识/凭据、修改数据库或重启服务。计数是本机快照，不代表 Docker 镜像或公网部署。页面渲染与 owner 表中存在记录，都不能证明记录来自真实学习、付款、审核或对象存储。

## 存量风险：学习世界种子曾向所有活跃账号扩散

旧版 `scripts/database/seed-local-real-learning-world.mjs` 曾把 `iam_service.iam_principal` **所有** `tenant_id='platform' AND status='ACTIVE'` 账号作为种子输入；即使设置 `LOCAL_TEST_SUBJECT`，旧 `UNION` 仍保留全部活跃账号。它向 learner、learning、assessment、commerce、gamification、notification、social 等 owner schema 写入或覆盖业务事实。现行源码已要求一个真实存在、处于 ACTIVE 且标识为 `@local.invalid` 的合成账号，并用单行临时表限制 owner 写入；缺少该账号或指向非本地数据库时会在写入前拒绝。两项拒绝测试通过，尚未重新执行完整种子。下面的 167 个账号是修复前的本机存量，范围保护不会自动清理或恢复它们。

| 只读本机证据 | 当前数量 | 用户可见后果 / 对应读链 |
| --- | ---: | --- |
| 精确匹配 `SHA2('seed-task-' + principal_id)` 的 principal | **167** | `GET /api/v1/learner/first-day`、首页/今日任务可能把虚构课程任务当成已分配学习。另有匹配 `seed-plan` 的非 local-10x/非 demo 账号 157 个；读链 `GET /api/v1/learning/plan/current`。 |
| 其中 IAM 成人 Gate 并非 `APPROVED`，但 learner profile 的 `age_confirmed`、`privacy_consent`、`terms_consent` 均为 true | **104 / 167** | 画像可能暗示用户已完成成人与条款确认。IAM 仍应作为服务端门禁；这项核查没有证明绕过 IAM。脚本第 63–74 行会在冲突时覆盖这三个 learner 标志。 |
| 精确 seed ID 的 B25 review、assessment session/report、commerce entitlement、XP/coin ledger、reward grant、未读 notification | **各 167** | 旧评测报告可显示 `COMPLETED`、A1、1.000 分；学习报告可由伪 review 推导；`/api/v1/commerce/entitlements/me` 可显示没有购买事实的有效权益；`/api/v1/gamification/me/summary` / `ledger` / `rewards` 可显示未挣得的成长值；`/api/v1/notifications/messages` 可显示“本地学习数据已就绪”测试通知。对应源代码在种子第 137–145、180–197、386–397、404–434、504–513 行。 |
| 上述 167 个账号按标识类别聚合 | `@example.invalid` 12、`@local.invalid` 78、无 IAM account 行 76、其他域名 1 | 至少 1 个账号不能按常见测试域名识别；没有输出其标识，也不能仅按邮箱后缀假定其业务数据可删除。 |

`learner_profile`、目标、偏好以及 gamification feature state 使用 `ON DUPLICATE KEY UPDATE` 覆盖既有值；无原值快照时，不能简单删行恢复用户选择。定向清理要先备份/审计，再按确定性 seed ID、固定 `idempotency_key`、`source_ref='local-real-learning-fixture'`、`source_watermark='local-fixture'` 等 owner 级来源逐表核对；对已被用户继续操作的任务、权益、奖励或设置先停下人工审查。未来的合成 fixture 应进入隔离账号/环境，不应与真实用户混用。

## 其他明确的数据质量风险

| owner / 来源 | 本机证据 | 当前可见边界与建议 |
| --- | --- | --- |
| content `local-real-10x-v1` | `content_service.b3_content_experience` 有 10 条 `PUBLISHED` 听力材料且 `segments=[]`、10 条 `PUBLISHED` 阅读文章且 `blocks=[]`，另有 10 条标题为“本地语法点”的已发布语法点；`b2_content_chunk` 有 10 条已发布本地 fixture。来源为 `scripts/database/local-real-10x-fixture.mjs` 第 306–363、342–348、856–862 行。 | 当前五技能 Gateway 旧路由仍有 404，未证实这些记录正由学习页成功展示；一旦路由接通，发布状态会让空正文和伪媒体引用冒充可学内容。按 `fixtureId` / 固定 ID 将这批覆盖夹具下线，真实课程通过权利、媒体字节、分段、双审和发布门禁产生。不要仅改标题掩饰空内容。 |
| notification/offline | `notification_offline_package` 有 1 条 `PUBLISHED` 记录使用固定 `b4-offline-signature-v1` 和空 `signed_part_urls_json`；来源为 `seed-local-real-learning-world.mjs` 第 526–533 行。 | 当前离线路由仍未形成可验下载链；若被展示，用户会拿到不可用包。精确下线这条 fixture，只有 manifest、真实分片、校验、签名和设备恢复通过后再发布。 |
| admin support | `admin_ops_service.support_ticket` 当前 101 条中有 8 条摘要包含“演示”；管理端此前授权读取 `/api/v1/admin/ops/tickets?limit=50&includeAll=true` 为 200/101。 | 客服列表是真实 owner 读取，却仍混有测试语义。按已知 seed 标识隔离/筛除演示工单，再用真实可追踪的工单生命周期验收；不要把“演示”改成貌似真实的投诉来提高拟真度。 |

## 当前公开边界与待复测

本机匿名 `GET /api/v1/public/site/projection?uiLocale=zh-CN` 当前 HTTP 200：课程 0、公告 0、下载渠道 3、合规 2；`GET /api/v1/public/commerce/catalog` 当前 HTTP 200、方案 0。先前占位公告已不在当前公开响应中。本轮没有登录这些被种子影响的账号，因此各受保护读链的 UI 后果是基于现行 Gateway 路由、前端调用和 owner 表行的**推断**，需要在修复与数据隔离后再做授权页面复测。对 167 个账号的业务资料先保留取证快照，避免“清理”误删其后真实学习与用户设置。
