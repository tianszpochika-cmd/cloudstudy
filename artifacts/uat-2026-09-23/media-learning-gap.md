# Phase 1 媒体与学习闭环独立运行验收（2026-09-23）

## 范围与判定

按 `PAGE-P1-GRAMMAR/LISTENING/READING/SPEAKING/WRITING/SRS/REPORT` 和《学习机制与学习引擎规则》核对现行学习 Web、移动端、Gateway、media/learning owner、MySQL owner schema。检查包括当前本地进程的匿名 HTTP 路由探针、服务端与客户端调用、只读数据聚合及 Java 测试。没有使用用户凭据、跳过成人 Gate、提交学习记录或改写数据库。匿名 401 只表示请求进入了受保护链路，**不是登录后功能通过**；全局行数不能证明某个学习者完成闭环。

| 功能 | 判定 | 当前可复现事实 | 尚未通过的关键条件 |
| --- | --- | --- | --- |
| 语法 | **BLOCKED** | 两端调用 `/grammar/points`、`/grammar/practice/attempts`；Gateway GET/POST 均 404。learning-service 旧内部提交按答案是否含 `has/good` 判分。 | 内容版本与答案规则钉、assessment 判分、错误修复和 mastery 可信事件链。 |
| 写作 | **BLOCKED** | 两端 `/writing/prompts`、`/writing/submissions` 均 404。旧 learning 内部提交非空答案即 80 分，改错非空即 100 分。 | 草稿版本、与已发布题目规则绑定的评价、纠错、恢复与报告。 |
| 听力与媒体播放 | **BLOCKED** | `/listening/materials`、`/listening/sessions` 均 404；`/media/assets/{id}/manifest` 和 signed-url 匿名为 401。11 条已发布 B3 听力材料中 10 条 `segments=[]`，只有 1 条 `mediaRef.assetId` 能关联到 media owner 的资产。 | 真实可播放媒体、毫秒字幕/文本替代、授权与版权、断点、听写的版本化判分和失败降级。 |
| 阅读 | **BLOCKED** | `/reading/articles`、`/reading/attempts`、`/reading/progress` 均 404。11 条已发布 B3 阅读文章中 10 条 `blocks=[]`。旧内部判分使用固定选项/短语。 | 可阅读正文、文章/问题版本、标注、进度、判分与报告。 |
| 口语与录音 | **BLOCKED** | `/phonetics/catalog`、`/speaking/recordings`、`/speaking/shadowing/completions` 均 404。media owner 的资产接口不能直接代替录音 consent、上传、回放、自评和 assessment attempt。 | 真实音素素材、麦克风拒绝后的无录音路径、录音生命周期、本人授权与可信完成证据。 |
| SRS 复习 | **PARTIAL** | 旧 `/learning/srs/overview`、`/srs/states`、POST `/srs/reviews` 和 `/learning/review-queue/{id}/complete` 匿名均为 401；存在本人表与幂等记录。现行 B25 写口接受客户端 `quality=0..5` 或 `PASS/FAIL` 并直接更新 SRS stage/due，未验证题目、可信客观 outcome 或到期时间。 | `SM2_Q03_V1` 的唯一可信 transition、`q=0..3` cap、早复习拒绝、版本/内容 pin、离线顺序重放。不能将旧路线判为目标算法 PASS。 |
| 今日任务与进度 | **PARTIAL** | `/learning/today`、`/learning/media-progress` 匿名 401；本地 runtime plan/task 各 100 条，主要为合成夹具。新账号首日计划没有自动生成，见 `first-day-gap.md`。 | 目标/测评→规划输入→真实任务、内容引用、活动完成证据、进度水位与冲突恢复。 |
| 日/周/阶段报告 | **PARTIAL** | 旧 `/learning/stats/daily-report`、`/weekly-report` 匿名 401；契约 canonical `/learning/reports/DAILY` 则 404。旧报告只从 `b25_learning_review` 计算复习数与所谓正确率，学习时长、新学、D+1/D+7 等为 null；源 review 又可由客户端质量自报。 | 各 owner 的已接受事实、水位、版本、分子分母、来源 attempt、迟到事件处理与日/周/阶段对账。 |
| 媒体资产授权层 | **PARTIAL** | media-service 提供 manifest 和短时授权的受保护路由；`MediaAccessPolicy` 检查 tenant、phase、consent、权限、rights、owner。匿名请求 401；Java 测试通过。移动 B11 响应解析错配已在源码修复，尚无端到端播放证据。 | 可由对象存储实际访问的短时 URL、真实浏览器播放、对象字节/校验、已发布内容引用、字幕、撤权、低配与移动设备能力。 |
| 离线同步 | **BLOCKED** | 两端 B11 兼容调用 `/sync/changes`，匿名 POST 为 404；部分旧 `/offline/sync/*` owner 接口存在，但不能替代合同化顺序重放。 | manifest 权利、队列顺序/幂等/冲突、录音及媒体缓存权限、断网与恢复 E2E。 |

## HTTP 证据边界

当前 Gateway `http://127.0.0.1:18070`，按两端实际 method/path 发起无令牌请求。GET `/api/v1/grammar/points`、`/writing/prompts`、`/listening/materials`、`/reading/articles`、`/phonetics/catalog` 全部 **404**。POST `/api/v1/grammar/practice/attempts`、`/writing/submissions`、`/listening/sessions`、`/reading/attempts`、`/speaking/recordings`、`/speaking/shadowing/completions` 和 `/sync/changes` 亦 **404**；PUT `/reading/progress` **404**。GET `/api/v1/learning/srs/overview`、`/srs/states`、`/stats/daily-report`、`/stats/weekly-report`、`/review-queue`、`/today`、`/mastery/overview`、`/media/assets/no-such-asset/manifest`，以及 POST `/learning/srs/reviews`、`/media/assets/no-such-asset/signed-url`，均 **401**。契约 canonical GET `/api/v1/learning/reports/DAILY`、`/learning/plans/current`、`/learning/mastery` 均 **404**。

上述关键 GET 在本批 16 个服务重启后复测，五类技能仍为 404、旧 SRS/旧日报与 media manifest 仍为 401、canonical 日报仍为 404。这与 Gateway `GatewayRouteExecutionPolicy.java` 的 B3 owner 冲突 fail-closed（140–144 行）、旧学习路由（528–543 行）和 media 映射（570 行起）一致。现行客户端路径见 `apps/learner-web/src/api/b3.ts`、`b10.ts`、`b11.ts` 和 `apps/mobile/src/api/b3.ts`、`b11.ts`；真实 Web 浏览器观察见 `apps/learner-web/audit-evidence/2026-09-23/learner-web-audit.md` 的技能行。详细 B3 owner 冲突另见 `skills-gap.md`。

## 数据真实性核对

只读查询本地 `127.0.0.1:13306` 的 owner schema，未读取个人明细：

```sql
SELECT COUNT(*) FROM content_service.b3_content_experience
 WHERE resource_type='LISTENING_MATERIAL' AND availability='PUBLISHED';
-- 11
SELECT COUNT(*) FROM content_service.b3_content_experience
 WHERE resource_type='LISTENING_MATERIAL' AND availability='PUBLISHED'
   AND JSON_LENGTH(JSON_EXTRACT(payload_json,'$.segments'))=0;
-- 10
SELECT COUNT(*) FROM content_service.b3_content_experience c
 JOIN media_service.media_asset m
   ON m.asset_id=JSON_UNQUOTE(JSON_EXTRACT(c.payload_json,'$.mediaRef.assetId'))
 WHERE c.resource_type='LISTENING_MATERIAL' AND c.availability='PUBLISHED';
-- 1
SELECT COUNT(*) FROM content_service.b3_content_experience
 WHERE resource_type='READING_ARTICLE' AND availability='PUBLISHED'
   AND JSON_LENGTH(JSON_EXTRACT(payload_json,'$.blocks'))=0;
-- 10 of 11 published
```

`media_service.media_asset` 共 100 行，其中 **44 UPLOADING、56 ACTIVE**；`media_rendition` 100 行标 READY，但这只是元数据，不是对象字节和客户端可播证明。41 个 ACTIVE asset 仍使用 `bulk-100x-%` 的 object key。`learning_service.b25_learning_srs_state` 277 行、`b25_learning_review` 315 行、`learning_runtime_plan/task` 各 100 行、`b3_learning_interaction` 758 行；这些大多来自 `local-real-10x`/`bulk-100x`，不代表新学习者的目标、题目、媒体、活动、复习和报告已相互关联。夹具 `scripts/database/local-real-10x-fixture.mjs` 中听力 `segments: []`、阅读 `blocks: []`，且听力 `fixtureText('media', index)` 与 media owner 的 UUID asset ID 是两套键。必须以已发布内容和真实关联逐条核对，而不是再增加行数。

初始客户端缺陷是 `MediaManifest` / `MediaManifestItem` 返回 `assetStatus=ACTIVE`、`rightsStatus=ACTIVE`、`items[{renditionKey,status,...}]`，而移动 B11 原来只读 `availability=READY`、`rightsStatus=AUTHORIZED`、`variants`；短时授权的 `SignedMediaUrl` 也被误作 manifest。当前 `apps/mobile/src/api/b11.ts` 已分别解析 owner manifest 与 URL，只把 ACTIVE/有 READY 项及未过期的同 asset 签名地址标记可播；404、拒绝或无效签名地址保持不可播。由于技能目录仍 404，这只是源码/行为测试修复，没有真实播放器验收。

媒体服务自身还使用 `InMemorySignedUrlPort` 的 local-real 适配器：它返回 `baseUrl + '/' + assetId + '?token=' + 内存 grant token`。本地 `baseUrl` 配为 MinIO bucket 地址，但 URL 未使用媒体事实中的 `object_key`，token 亦非对象存储预签名参数。`MediaServiceConfiguration.java:107–113`、`InMemorySignedUrlPort.java:57–61` 和 `scripts/runtime/run-v2-services.mjs:315` 可复现此构造。授权响应 200 即使出现，也不能据此认定对象存储接受该 URL、媒体字节可播放。需要 media owner 接入真实受控对象存储签名/代理，并测 200 字节、Range、校验、过期和撤权。

## 规则与构建验证

`B25LearningJdbcController.java:332–357,419–439,616–631` 的公开兼容复习入口把客户端质量或 PASS/FAIL 转成阶段、间隔和到期时间；没有读取内容 owner 的题目/规则或 assessment outcome，也没有 `dueAt` 早复习门禁。`report()`（558–608 行）由这些 review 表计算日报/周报，`calculationVersion=B25-SRS-REPORT-1`。设计 `04-学习机制与学习引擎规则.md` §6.4–6.5、§9 要求可信 `SM2_Q03_V1` transition、早复习 409、已接受 owner 事实及报告水位，当前运行路线不能满足。

`TEMP/TMP=C:\Temp` 后运行 `mvn -f services/media-service/pom.xml test -q`：Surefire **71 项、0 失败、0 错误、2 跳过**；`mvn -f services/learning-service/pom.xml test -q`：**153 项、0 失败、0 错误、3 跳过**。这是代码级验证，不能代替 Gateway→浏览器/移动端→MySQL/Kafka→报告的 E2E。测试日志在 `C:\Temp\cloudstudy-media-uat-test.log`、`C:\Temp\cloudstudy-learning-uat-test.log`。

移动 B11 修复后，`pnpm --filter @englishflow/mobile typecheck` 通过，`pnpm --filter @englishflow/mobile test:b11` **13/13 通过**；其中 5 个行为测试实际调用媒体适配器，覆盖 owner 清单、撤权/上传中、兼容清单、同资产未过期 URL 和授权失败不回退旧地址。`git diff --check` 通过；`pnpm --filter @englishflow/mobile build:h5` 完成。浏览器 UI 复测只证明 H5 界面状态，不证明真实播放器或录音服务通过。

## 移动端 B11 状态交互复测

原图 `artifacts/uat-2026-09-23/screenshots/mobile/b11-reading-light.png` 在错误状态同时显示共用面板和阅读页兜底卡片，出现两次重试及内部等级 `Performance`。已删除阅读、听力的重复兜底卡片，由 `B11StatusPanel` 一处提供错误/空态提示与重试；画质四档在内容可用时显示“精致/舒适/轻量/省资源”，动效按钮仍可切换。阅读版权撤销状态不会展示正文。口语页在无音标、无示范音频、无本地草稿时隐藏空音标和录音控件；已有本地草稿仍保留恢复入口，麦克风按钮不主动请求权限。

受控浏览器夹具复测覆盖注册的 155 个页面/尺寸/主题组合，**0 页面异常**；B11 阅读/听力/口语在 320、390、768 px 及浅色、深色、高对比主题的服务不可用场景均为 **1 个状态面板、1 次重试、0 个 `Performance` 文本**。390 px 修复后截图为 `screenshots/mobile/b11-ui-after/b11-reading-light.png`、`b11-listening-light.png`、`b11-speaking-light.png`。另用明确标注“非真实课程”的阅读夹具进入 ready 状态，验证中文画质标签与关闭/开启动效交互，截图 `b11-reading-ready-light.png`。这些夹具不构成内容真实性、真实授权或端到端业务 PASS。

## 修复与复测顺序

1. 先以契约/ADR 明确内容读、media 授权、assessment 作答与规则评分、learning 进度/SRS 的逐 operation owner；再接 Gateway 路由和两端生成客户端，保持服务侧 PEP。不能把整个 B3 前缀盲转一个服务。
2. 对公开教学数据做逐条审校，发布正文、分段、字幕/文本替代、题目/答案规则和版权有效媒体；保证 content 的 asset ID 与 media owner 有可播放、可撤权的真实关联。批量模拟夹具留在隔离环境，不能进入学习者目录。
3. 将 legacy SRS 写入口收束到版本化可信 transition，禁止客户端自报 objective outcome/质量直接推进掌握；报告以 owner 已接受事件、水位与来源构成，缺失维度明确处理中。
4. 成批部署后，以通过成人 Gate 的合成账号走六技能→attempt→复习→进度/日报/周报，覆盖错答、重复/倒序/早复习、版本改变、无媒体/麦克风、版权撤销、断网恢复和跨账号拒绝。每步保存浏览器/移动端、Gateway、owner、DB/事件与报告对应证据。

本次修改移动 B11 媒体 API 适配器、状态面板及阅读/听力/口语页面，并补充定向测试与浏览器 UI 夹具；未修改 Gateway、领域服务或本地数据。共享服务由主 Agent 集中成批重启，重启后关键路径结论不变。以上 `BLOCKED` 不是测试资源不足导致的推测；技能路由 404 与内容/规则缺口均已由运行请求和 owner 数据确认。
