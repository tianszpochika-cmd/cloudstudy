# 剩余已发布内容与官网信息审计（本机只读）

核查时间：2026-09-23 11:14 CST；bulk 公告状态于本轮后续重新读取。范围为本机 `127.0.0.1:13306` 的 content、media、learning owner 表及匿名 Gateway 公开投影；本审计没有登录、修改数据库或审查用户原文。计数是本机快照，不能代表 Docker 镜像或公网发布。

## 设计基线

[Phase 1 内容运营设计](../../docs/06-design/v2-980plus/phase1-business-operation/05-后台内容运营与客服业务流程.md)要求内容版本与来源、授权、媒体元数据绑定；发布需同一版本/hash 的独立 L1/L2 审核、PASS 校验、VALID rights snapshot、必需媒体 `READY/CLEAN`、官方字幕或文本替代和阶段 Gate。缺权利应拒绝发布。`PUBLISHED` 这一字符串及 payload 内自称的 `AUTHORIZED` 不等于上述证据。

## B3 学习内容：113 条发布记录失去 canonical 版本关联

| 只读核查 | 本机结果 | 含义 |
| --- | ---: | --- |
| `b3_content_experience` 的 `availability='PUBLISHED'` | 113 | 其 `tenant_id` 都是 `platform`、ID 都以 `b3-` 开头、`content_version_id` 都是 `301`；无其他已发布 B3 行。 |
| `content_version.content_version_id=301` | 0 | 113/113 左连接找不到 canonical 版本，因此无法从该表核验此批内容的审核、授权和发布事实。 |
| 音素及最小对立对 | 英语音素 48、法语音素 37、最小对立对 13 | 85 条音素均有 mouthProfile 和 2D fallback 标记，但英语 48 条共用一条通用描述，法语 37 条仅两种描述；均无资产引用。教学准确性、口型和发音素材需人工审校。 |
| 其他 B3 资源 | 15 | 听力材料 1 条有 1 个文本片段、阅读文章 1 条有 2 个 blocks；本轮未发现剩余已发布听力/阅读正文为空。另有语法、写作、题目等 13 条。 |
| 听力媒体 `b3-audio-3401` | 资产 1、rendition 1 | B3 payload 自称 `READY/AUTHORIZED`；media owner 实际标 `LOCAL_OBJECT_STORE`、`LOCAL_FIXTURE_AUDIO`、`local-real-learning-fixture`、`local-fixture-v1`，不能充当正式版权授权与媒体审校证据。 |

可用如下只读条件精确圈定 113 条；执行下线之前应另行保存快照、关联学习记录和恢复方案：

```sql
SELECT COUNT(*)
FROM content_service.b3_content_experience
WHERE tenant_id = 'platform'
  AND availability = 'PUBLISHED'
  AND content_version_id = 301
  AND experience_id LIKE 'b3-%';
```

这批内容**已有使用痕迹**：以 `domain_code + resource_key` 双键连接 `learning_service.b3_learning_interaction`，得到 233 条 `ACCEPTED` 交互，涉及 99 个主体、6 个内容项；其中 192 条幂等键以 `seed-` 开头，另 41 条来源未分类。仅以 `resource_key` 连接会得到 238 条，额外 5 条是跨 domain 的误匹配。其他已检查的 assessment、learning runtime、content projection 表按 `content_version_id=301` 均为 0；media asset 有 12 条 301 关联，都是本地 fixture/probe 标记。**不能声称这批内容无人使用，也不能删除学习交互**。若决定下线，需要使新访问与旧交互/继续学习分别有明确语义，保留历史与审计。

## 官网公开字段与占位公告

匿名 Gateway 中英文投影均为课程 0、公告 0、下载渠道 3、公示 2。初次读取时，owner 表另有 19 条 `PUBLISHED`、`en-US` 的 `bulk-100x` 公告，其中当前时间窗口内 1 条有效，但 19 条全缺 `announcementCode/title`，所以运行中的字段过滤使它们没有出现在公开投影。其精确圈定条件如下，**下线前**命中 19，其他已发布公告为 0：

```sql
SELECT COUNT(*)
FROM content_service.content_public_site_facet
WHERE status = 'PUBLISHED'
  AND facet_type = 'ANNOUNCEMENT'
  AND ui_locale = 'en-US'
  AND facet_id LIKE 'bulk-100x-content_public_sit-facet-%'
  AND JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.fixtureId')) = 'bulk-100x-v1'
  AND JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.seed')) = 'bulk-100x'
  AND JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.table')) = 'content_public_site_facet'
  AND JSON_EXTRACT(payload_json, '$.announcementCode') IS NULL
  AND JSON_EXTRACT(payload_json, '$.title') IS NULL;
```

随后主任务按上述来源标记精确下线；本审计重新只读查询确认这 19 条均已是 `UNPUBLISHED`，其余公告也无 `PUBLISHED` 行。仍应检查产生 `bulk-100x-v1` 的数据来源，防止再发布。

| 下载/公示记录 | 公开字段与结果 | 后续处理 |
| --- | --- | --- |
| 学习 Web 渠道，双语 | `platform=WEB`、`status=AVAILABLE`、有 channel，但无 `downloadUrl`；Gateway 公开投影同样无可操作 URL。官网 `/download` 跳至 `/start`，后者另用配置的 learner Web 地址作为注册/登录入口，本地入口机制与下载渠道的 `AVAILABLE` 声明是两条链。 | 若作为可用渠道发布，需填入经审核的公开入口并做可达性验证；否则精确置为不可用/不投影。不能用本机 `127.0.0.1` 链接作为公网证据。 |
| 移动 App 渠道，双语 | 只有一张 `platform=IOS` 卡，文字合并 iOS/Android/iPad，状态 `COMING_SOON`，无 URL；无独立 Android/iPad 下载记录。 | 当前没有宣称已可下载，不能以此验收 App 安装包、商店审核或 Android 渠道。 |
| 微信小程序渠道，双语 | `COMING_SOON`，无 URL。 | 与 Phase 1 暂未开放的陈述一致；需要条件编译与审核后另行发布。 |
| 两项公示，双语 | 成人阶段边界、隐私与数据处理均有 code/title/body/version/effectiveAt，能够进入公开投影。 | 文字说明是真实页面内容；没有主体备案、许可编号或法律审校/批准事实，本轮不能代替正式合规公示验收。 |

## 处理边界

19 条 bulk 公告已由主任务按精确条件下线；WEB 下载渠道的 `AVAILABLE` 与缺 URL 矛盾仍可按固定 `facet_id=download-learner-web` 两语言逐项修正，改前应确认正式入口。113 条 B3 的 orphan 状态是确定的，但因 233 条学习交互和媒体/版权/教学审校缺口，**不能整批直接删除或把通用占位文案改成“真实内容”**。它们需要内容 owner 的版本归属、用户学习连续性方案、版权证据、媒体核验及人工双审；确认后再通过 canonical 发布流程重新上线。
