# B3 已发布内容与学习交互来源复核（只读）

核查日期：2026-09-23。范围是本机 MySQL 的 `content_service`、`learning_service`、`media_service`、`iam_service` owner 表，以及对应迁移、种子和服务读取代码。本轮只执行查询并写此报告；没有修改数据库、服务或业务代码。计数是本机快照，不能外推为其他环境的事实。没有记录主体标识、账号标识、提交答案或密钥。

## 已确认的来源和关联

| 类别 | 当前数量 | 来源和风险判断 |
| --- | ---: | --- |
| `b3_content_experience` 中 `platform/PUBLISHED/content_version_id=301` 的 `b3-*` 行 | 113 | ID 集合恰好等于 [V7](../../services/content-service/src/main/resources/db/migration/V7__seed_b3_learner_experience_content.sql) 的 18 条、[V11](../../services/content-service/src/main/resources/db/migration/V11__complete_local_phonetics_catalog.sql) 的 54 条、[V20](../../services/content-service/src/main/resources/db/migration/V20__french_phonetics.sql) 的 41 条，无多余或缺失 ID。V7 是本地学习样例；V11 注释明确称英语目录为 owner facts；V20 是法语教学目录。迁移来源证明它们由本地种子发布，**不证明 95 条音标目录是应删除的假知识**。 |
| canonical `content_version.content_version_id=301` | 0 | 113/113 行的列值和 JSON `contentVersionId` 均为 301，但没有 canonical 版本、审核和授权快照可核验。当前 `PUBLISHED` 不能充当正式发布证据。 |
| 直接匹配已发布内容的 `b3_learning_interaction` | 233 条，99 个主体，6 个内容项 | 按 `tenant_id + domain_code + resource_key` 连接，均为 `ACCEPTED`。只按 `resource_key` 连接会多计 5 条。内容和交互分别由 content-service、learning-service 持有；不能跨 owner 直接删除。 |
| 可精确识别的本地种子交互 | 192 条，96 个主体，2 个内容项 | 96 条 `GRAMMAR/ATTEMPT/3701`、96 条 `WRITING/SUBMISSION/3301`。幂等键分别具有 `seed-b3-grammar-mistake-`、`seed-b3-writing-history-` 前缀，且 `payload_json.fixture` 与 `result_json.fixture` 同时为 `LOCAL_FIXTURE`，与 [learning-world 种子](../../scripts/database/seed-local-real-learning-world.mjs) 的插入语句相符。这是**交互行**的可靠合成标记，不表示相关账号/主体或其其他学习记录均可清理。种子从当时全部 ACTIVE 平台主体生成，未限制为 `.invalid` 账号。 |
| 无精确夹具标记的交互 | 41 条，8 个主体，5 个内容项 | 幂等键、payload、result 均无上述双侧 `LOCAL_FIXTURE` 标记；结果 `source=mysql`，输入 `contentVersionId=301`。当前 8 个主体均无 IAM account/principal，也无 account deletion 记录；这只说明当前身份映射缺失，**不能推定为合成数据**。行中有学习者提交字段，应按可能存在真实/混合历史保护，不查看或输出答案。 |

8 个未标记交互主体中，5 个也拥有上述精确种子交互，另 3 个没有。它们在整个 B3 交互表中共有 131 条记录，因此不能把这 41 条视为孤立历史。上述迁移集合只证明当前 **ID** 来源；内容 payload 后来还可能被更新，例如 [V8](../../services/content-service/src/main/resources/db/migration/V8__mark_local_media_projection_ready.sql) 修改了听力媒体可用状态，不能把当前全行视为迁移原文的字节级副本。

113 个内容 ID 的排序集合 SHA-256 为 `814055d11092b0716bf55b373fa7949c069b25d270ec036c6ee187c3a08b9107`；192 个双侧标记交互 ID 的排序集合 SHA-256 为 `b4e7ec6cc45964802d76c3a5203badb88d1d8a540acdae7d6cc39d3bda87bbad`。这些哈希只用于下次复核集合是否变化，不是完整行备份或恢复材料。

### 六个已有直接学习历史的内容项

| `experience_id` | 精确种子交互 | 来源未确认交互 | 处置边界 |
| --- | ---: | ---: | --- |
| `b3-grammar-exercise-3701` | 96 | 0 | 内容为 V7 样例，直接交互均可由双侧夹具标记识别；仍需保护其他同主体学习事实。 |
| `b3-writing-prompt-3301` | 96 | 12 | **混合引用**；不能因种子交互多而删除整项及其历史。 |
| `b3-grammar-sentence-3201` | 0 | 12 | 来源未确认的历史，保留。 |
| `b3-listening-material-3401` | 0 | 11 | 来源未确认的历史，且关联本地音频资产，保留历史。 |
| `b3-grammar-point-3103` | 0 | 5 | 来源未确认的历史，保留。 |
| `b3-reading-question-3950` | 0 | 1 | 来源未确认的历史，保留。 |

其余 107 个内容项无**直接** `domain_code + resource_key` 学习交互，包括 95 个 V11/V20 音标目录项和 12 个 V7 项。但 V7 内部仍有语法点、练习、句子、听力材料/片段、阅读文章/词条/题目等 payload 引用；最小对立对也引用音素。因此“无直接交互”不等于可逐行独立移除。内容若下线，应以引用闭包和页面行为一起决定范围。

## 版本、权利、媒体与服务读取

- 113 个 payload 中仅 2 个有直接 `mediaRef`，都指向 `b3-audio-3401`；仅听力材料、阅读文章 2 项在 JSON 顶层自称 `rightsStatus=AUTHORIZED`，其余 111 项无此字段。读取到的媒体 owner 资产 `b3-audio-3401` 为 `ACTIVE`，一个 rendition 为 `READY`，但 `storage_provider=LOCAL_OBJECT_STORE`、`license_code=LOCAL_FIXTURE_AUDIO`、`authorization_evidence_ref=local-real-learning-fixture`。它由 [本地种子](../../scripts/database/seed-local-real-learning-world.mjs) 写入，不能用来证明正式授权。
- media owner 中另有 11 个 `content_version_id=301` 资产，均有本地 fixture/probe 类许可证及证据标记；它们不是这 113 个 B3 payload 的直接 `mediaRef`。12 个媒体资产的 `rights_status` 均为 `ACTIVE`，但 canonical 301 仍缺失；状态字符串不替代版本级权利和审校。
- 以实体列 `content_version_id=301` 查询，assessment 的 session/item-rule、learning runtime 的 plan/task/review/mastery/SRS、content 的 course/public projection/cache invalidation 均为 0；B3 内容为 113、media asset 为 12。**JSON、事件或未检查的外部引用不能因此排除**。
- [内容读取控制器](../../services/content-service/src/main/java/com/englishflow/content/web/B3ContentJdbcController.java) 只投影 `availability='PUBLISHED'`：状态改为 `UNPUBLISHED` 后列表消失、单项返回 404。[学习读取控制器](../../services/learning-service/src/main/java/com/englishflow/learning/web/B3LearningJdbcController.java) 的写作历史、语法掌握度仍读取持久交互；[B25 错题读取](../../services/learning-service/src/main/java/com/englishflow/learning/web/B25LearningJdbcController.java) 也读取此表。历史不是可随内容状态一并删除的缓存。
- 学习控制器的写入路径以请求资源 ID、规则反馈和本地交互表为基础；不能仅凭内容 `UNPUBLISHED` 推断后端从此拒绝新提交。若下线内容，要另验新入口与直连写入行为。

## 精确候选与禁区

1. **内容可进入“待审核下线”候选池：113 条。** 推荐目的只是撤销当前缺 canonical 版本证据的公开可用状态，不是认定知识内容为伪造。执行前由 content owner 做全行备份及哈希，并锁定完整 113 ID 集合、`platform/PUBLISHED/301` 当前状态；按业务依赖整体评估，特别是六个有历史的资源。数据库 [V6 约束](../../services/content-service/src/main/resources/db/migration/V6__add_b3_learner_experience_content.sql) 只允许 `platform` 租户，不支持直接搬到隔离租户。旧 V7/V11/V20 `INSERT IGNORE` 已发布种子在新环境仍可能重新带出；需由后续版本化迁移/播种规则收口。
2. **交互的高置信合成候选：上述 192 条。** 精确圈定需同时满足 `platform/ACCEPTED`、两种指定 domain/action/resource/幂等键组合，以及 payload/result 双侧 `fixture=LOCAL_FIXTURE`。即使这些交互是脚本生成，其种子针对当时所有 ACTIVE 主体，且 63/96 个主体当前仍为 ACTIVE（43 个关联 `.invalid` 账号，20 个当前无 account）；其余 33 个主体当前缺 principal。若另行清理，必须先审查 owner 历史、衍生读取、完整行备份与恢复机制。[V4 约束](../../services/learning-service/src/main/resources/db/migration/V4__create_b3_learning_interactions.sql) 同样固定 `platform` 租户，不支持直接跨租户隔离。
3. **明确不能动：41 条未标记交互及其可能的历史关联。** 当前身份缺失不构成删除依据。`b3-writing-prompt-3301` 同时被种子和未标记交互使用；其他四个内容项只有未标记交互。不可把 233 条整体归为旧夹具，也不可仅因 content 301 缺失就删交互。

本轮没有提出或执行数据库变更。下一步若决定下线，先解决正式内容版本/授权、旧历史展示及直连学习写入边界，再做同一快照下的备份、引用复核和可恢复的 owner 范围变更。
