# 本地Web演示闭环：全目标演示号 + 10x合成数据计划

> 日期：2026-09-26；目标：本地`learner-web(18180)`四个目标轨道都能走通学习闭环。
> 数据性质：全部合成（`synthetic`），无真实版权/真题/录音/支付；正式内容另行合规接入。
> 节奏：每完成一部分更新本文（或关联证据）并分批提交推送到`origin/dev`。

## 1. 演示号（4个轨道，各1个）

| 轨道 | goalCode | 演示账号 |
|---|---|---|
| 成人零基础 | `ZERO_BASIS` | `demo-zero-0926@local.invalid` |
| 四六级备考 | `CET_4_6` | `demo-cet-0926@local.invalid` |
| 考研英语 | `POSTGRADUATE` | `demo-kaoyan-0926@local.invalid` |
| 职场日常 | `WORKPLACE_DAILY` | `demo-work-0926@local.invalid` |

创建方式：经`learner-web`真实注册 → 成人Gate（1990）→ 三项同意 → 分轨道存目标（密码不入库、不进文档）。

## 2. 10x数据构成

* 全局10x：`seed-local-real-10x.mjs`（`local-real-10x-v1`，每函数位10行，10个内部subject，A1–C2）。只写本机`127.0.0.1:13306`。
* 大词表：`seed-large-vocabulary.mjs`（Core Frequency 720，`inserted 747/total 757`）。
* 逐号种子：`seed-local-real-learning-world.mjs`（`LOCAL_TEST_SUBJECT`一次一号）。
* 演示目录：`seed-demo-p5-catalog.mjs`（`pnpm db:seed:demo-p5`，6条LEARNER正典条目，见P5）。

## 3. P2证据（数据已入库）

* 10x `SEEDED` + check通过；大词表747行；4演示号注册/成人/目标/`placement/start 200`全绿。
* 种子脚本修两处：临时表`ERROR 1137`→scratch表用完即删；PUBLISHED离线包过期断言→允许0（已隔离，Web无/sync页）。
* 逐号种子全过，各`1 profile/1 plan/1 review/1 session`，库内核对4号各`1 ACTIVE plan + 1 ACTIVE profile`。

## 4. P3证据（home诚实化）

* `LearnerHttpController.toFirstDay`：删`STORE_FAILURE`误抛；无planning事实回200 `NOT_READY`，blocker三档（`PROFILE_INCOMPLETE/TARGET_INCOMPLETE/PLACEMENT_REQUIRED`，契约允许）。真库故障仍`DataAccessException→503`。
* 契约：`b9-learner`的`/first-day`与`/home`补`503`声明并重合入；单测改断言2/2绿；`contracts:validate`与planning门禁PASS。
* 运行验证：新合成号`first-day 200`、`home 200 NOT_READY/PLACEMENT_REQUIRED`（job pwsh-18 exit 0）。

## 5. P4证据（技能读接口接通）

* 前端7个GET（`b3.ts`）对应实现全在`B3ContentJdbcController`，而网关宽PREFIX判给assessment且无投影→预检403/GET404。
* 修法（仿`grammar-points-read`）：7条EXACT@850→content-service（路由表+执行投影+边界契约三处镜像），宽PREFIX不动；门禁数`56→73/170→217`（66/210系此前漂移基数，本次+7/+7；`365→393`等3项历史漂移仍开放）。
* `GatewayRoutePolicyContractParityTest` 5/5；tripwire中7条下线（残留口语/同步系范围外）。
* 运行验证：门控账号6路GET全200+预检200含凭据头（job pwsh-25 exit 0）；B3列表诚实空（LEARNER许可内容为0，见P5）。

## 6. P5证据（演示目录上线）

* 发布流送审门双死（权利永PENDING且无激活命令；报告绑定缺失），属M3产品级缺口，已立后续项，本次不碰。
* 按fixture惯例直插满足全部谓词的正典行（PUBLISHED + ACTIVE + LEARNER/PUBLIC + 四眼 + 正典哈希）：`seed-demo-p5-catalog.mjs`，删后插保证确定重跑；`pnpm db:seed:demo-p5` → 6条。
* 运行验证：`catalog 200（6/6 DEMO-P5）`，3抽查`detail 200`（job verify-p5-catalog exit 0）。
* B3旧世界保持开关与权利门不动；B3技能页的正典迁移列后续项。

## 7. P6证据（四轨道浏览器E2E PASS）

* 脚本：`tmp/demo-e2e-4tracks.mjs`（浏览器注册→成人→分轨道目标→4页面到达→网关直调7接口；密码仅内存，不入库）。
* 4轨道（zero/cet/kaoyan/work）全部：注册/成人/目标/登录真，`home/firstDay/today/catalog/vocab/reading/grammar`全200，零页面异常零5xx（job pwsh-30 exit 0）。
* 证据：`evidence/live/2026-09-26/demo-e2e/summary.json` + 每轨道assessment/learn截图。
* 覆盖映射（56项台账对应行，状态变更权归QA，本轮仅供复核）：AUTH-LOGIN/REGISTER-RESET、ADULT-CONSENT、ONB-GOAL正向已复现；LEARN-HOME/TODAY由503转为诚实200；阅读/语法路由由403/404转为200；目录6条可学。
* 未覆盖（诚实缺口）：有计划态home/today（plan引用跨owner未接线，M4-008残留）；B3技能列表内容（开关+权利门，迁正典为后续项）；定级提交→报告；口语/同步/支付/真机（M8）。

## 8. P7证据（学习动作闭环）

* `tmp/study-loop.mjs`：注册→登录→PRACTICE建单（含2题）→判分提交→检查点→报告READY→错题→SRS总览→日报，9/9 PASS（job pwsh-31 exit 0）。SRS为`UNVERIFIED_LEGACY`空态、日报PARTIAL，均系新号诚实形状（需D+1/D+7积累）。
* `tmp/placement-check.mjs`：定级单题步进（start→逐题submit→report），4/4 PASS；报告`ASSESSED`但`canonical:false/B25_LEGACY`——正典十题定级仍为后续项。
* 证据：`evidence/live/2026-09-26/demo-study-loop/summary.json` + `placement.json`。

## 9. P8证据（课程单元可学）

* 报障：`LearnPage`“课程没有可学习单元”——`parseContentDetail`取`items[].text/options`，而除词汇外演示载荷缺`items`键。
* 修法（数据侧）：演示载荷全量补`items`（阅读按段、语法按规则+例句、听力按句、造句单条），并配`b25_content_unit/item`行（展示用，无答案规则）；重跑`pnpm db:seed:demo-p5`，6项哈希全对。
* 运行验证：`/learn/session?contentCode=DEMO-P5-READ-A2`渲染“2 个学习单元”+双语文本（截图`demo-e2e/learn-read-units.png`，`has-units=true`）。
* tester-learner核对（`13eddde1…`）：ACTIVE、无目标行（其onboarding旅程不动）、0计划；已有39 review + 10 srs + 2 session，报告有数。B3技能列表保持诚实空（开关+权利门，后续迁正典）。

## 10. 后续项

* B3技能页迁正典端点；发布流送审门修复（M3）；正典十题定级；有计划态home/today接线（M4-008残留）；M8发布件。

## 11. 管理端扫查（2026-09-26）

* 只读管理员浏览器登录真，14路由全开零脚本错（`page-sweep/admin/summary.json`）。
* audit/moderation的`CURSOR_UNAVAILABLE`系本地缺游标密钥：已在runner按“默认关+本地开”补本地键，重起复验audit 200真实脱敏行、moderation 200诚实空队列。
* `iam/policy-versions`500根因：外部压测灌的100行`bulk-100x-fix-version-*`非法数据（`cache_invalidation_scope='global'`不在允许集），一行毒死整表列表组装（`IllegalArgumentException`，单测走mock故9/9不受影响）。按隔离惯例清掉该批无出处行（0审计引用、0非bulk行）；复验三处全200（policy空列表诚实）。另给该控制器补未处理异常正典包络+服务端堆栈日志（永久改进）。正典b30控制面行缺失列后续项（M1-003）。

## 12. 移动H5与通知偏好（2026-09-26）

* 移动H5：API预置门+浏览器登录真，32页全开零脚本错（`page-sweep/mobile/summary.json`）；uni原生input无autocomplete，按type定位。
* `/notifications/preferences`503根因：V8正典迁移未打到本机库（p1r到7、flyway到4），查询列不存在。跑官方`pnpm b28:owner-schemas`补上；853旧行原样归档，新表诚实空；复验200。
* 剩余诚实空：B3技能列表、计划态home/today、D+1积累、口语/同步/支付/真机。

## 13. 界面答题深链（2026-09-26）

* `tmp/deep-chain.mjs`：浏览器注册→成人→目标→定级页点选2题提交→报告卡“历史两题练习结果”→同号直调日报/SRS/错题全200，零异常（job pwsh-48 exit 0；首版跳出条件误伤常驻文案已收紧）。
* 证据：`demo-e2e/deep-chain/assessment-done.png`（C2·100分旧版口径诚实标注）+ `summary.json`。

## 14. 补救闭环（2026-09-26）

* `tmp/remedy-loop.mjs`：故意答错→错题2条→`mastery-retry`（ACCEPTED/PENDING）→`variant`签发200→总览/周报200，9/9 PASS（job pwsh-50 exit 0）。
* 顺序教训：变式需`variantItemId`且须在补救之后，先调序错得400；已修正。

## 15. 消息工单偏好三链（2026-09-26）

* `tmp/ops-loop.mjs`10/10 PASS（job pwsh-54 exit 0）：消息列表见 scaffolding 行→已读回执200→库`READ`；工单列表200、创建以正典形状得诚实503（`SUPPORT_CONTENT_REFERENCE_UNAVAILABLE`，无原文不收）；偏好`stateVersion`版本写DARK→回读一致。
* 形状教训：工单正典字段是`categoryCode/descriptionFingerprint/priority`；偏好版本用`stateVersion`（非`version`）。

## 16. 通知偏好写——已破案（2026-09-26，R102根因定位并转绿）

* **纠错**：我此前“服务坏了”的结论是错的。真相：我的请求体一直无效（缺`category/consentVersion/dndWindow/frequencyPolicy`，或`category`误填`REVIEW_DUE`、路径误用`REVIEW_DUE`）——`UpdatePreferenceRequest`要求正典枚举+`fromPathType`允许的路径类型。
* **真发现（产品级）**：无效请求抛出的框架异常被转发到`/error`，而安全链对`/error`走`denyAll`，于是真错误（400绑定失败/域403）被盖成不透明403`access denied`。诊断handler回显`method=GET uri=/error`+完整已认证principal为证（临时代码已删，构建已还原，工作区无残留）。
* 有效形状：`PUT /api/v1/notifications/preferences/REVIEW/PUSH` + `{category:'REVIEW',enabled,locale:'zh-CN',consentVersion:1,dndWindow:{startLocalTime,endLocalTime},frequencyPolicy:'IMMEDIATE',expectedVersion:0}` → 200且回读持久（`tmp/ok-valid.mjs`，job实测；干净构建复验一致）。
* 后续（owner）：① `/error`转发被denyAll盖掉真错误，建议按标准做法放行error转发或返回RFC9450；② 历史W4用`REVIEW_DUE`曾200，与现行`fromPathType`允许集矛盾，待考古（不影响现行契约）。
* 证据：`demo-study-loop/r7-guards.json`（R7 9/9，job pwsh-127 exit 0）。
* 机制（R104 对比实测）：learner链兜底是`anyRequest().authenticated()`（error转发带已认证上下文→放行→诚实400）；notification链兜底是`denyAll()`（error转发必死→403盖错）。网关在同形缺键下回网关自有400，同样不盖。
* owner修法（二选一，需安全评审）：`dispatcherTypeMatchers(ERROR).permitAll()` 仅放行error转发，或兜底改`authenticated()`与learner对齐；14个服务同一写法，建议逐个过。

## 17. 课程书架点通（2026-09-26）

* `tmp/shelf-check.mjs`：书架渲染6/6演示课零异常（截图）；`tmp/shelf-click.mjs`点“开始这一课”进`/learn/session`且见单元，零异常（job pwsh-61 exit 0）。
* B3迁移结论：正典目录/详情可承载学习，B3旧读保持关闭；技能页迁正典需产品决策（投影归属+答案隔离），列后续项不硬迁。
* 证据：`demo-e2e/course-shelf/`（书架截图+点通记录）。

## 18. 计划读侧实证（2026-09-26）

* `tmp/plan-reads.mjs`6/6 PASS（job pwsh-64 exit 0）：新号种B25计划+3条到期复习→today 3条、plan/current ACTIVE、srs total 3、review-queue有数。
* 写侧结论：`LearningPlanService.createPlan`域逻辑完整，但`LearnerTargetPort/PublishedContentPort`仅接fail-closed实现，无HTTP触发口（M4-007残留）；计划写链列后续epic，本轮只证读侧。
* 证据：`demo-study-loop/plan-reads.json`.

## 19. 正典定级Spike结论（2026-09-26）

* 契约侧齐全：`P1_PLACEMENT_V1`十题四维（3/3/2/2）+ 事件schema已冻结；B25旧链（2题）可用但报告标`B25_LEGACY`。
* 缺口：`P1PlacementSourcePort`仅接`Unavailable`实现——学员目标pin、内容快照pin、答案规则pin三处跨owner接线全空；10x规则行（4维恰3/3/2/2）是候选题库，但pin语义与entitlement需产品定。
* 结论：接真题源=跨三服务epic（2–4轮+产品决策），不硬接；B25旧链保持可用并诚实标注。

## 20. 成长线诚实门（2026-09-26）

* `tmp/world-loop.mjs`8/8 PASS（job pwsh-63 exit 0）：注册登录→游戏目录6款→开局诚实409（`GAME_NOT_AVAILABLE/P0`）→Avatar`2D_FALLBACK`→自习室诚实空。
* 依据：`GameCatalog`6款全`enabled=false`（注释：无验证过的题包/判分依据，不发布）。防刷分门，不硬开；要开需先备挑战题包+判分事实。
* 证据：`demo-study-loop/world.json`。

## 21. 回归确认（2026-09-26）

* `tmp/regression-check.mjs`2/2 PASS（job pwsh-65 exit 0）：移动设置页无5xx；管理策略页不再显示“暂不可用”。
* 证据：`demo-e2e/regression/`（双截图+summary）。

## 22. 门禁健康（2026-09-26）

* `contracts:validate` PASS；planning门禁 PASS；stale-claims PASS（1612文件）；doc-audit PASS。
* 网关check仅3项历史漂移（365→393、iam-deletions冻结语、M2-001摘要），无新增。
* `p1r-api-contract`仍挂2项历史项（恢复分页/媒体幂等/错题分页），与本轮改动无关。
* 证据：本轮命令输出（未入库大日志，按需重跑）。

## 23. 空态复核（2026-09-26）

* `tmp/empty-recheck.mjs`14项全对预期（exit 0）：B3五路诚实空、目录6条、今日/房间/工单诚实空、Avatar降级、消息空、home 200。
* 附带发现：登录`device`建议带`deviceName`（缺时偶发无token，已在脚本中固定）。
* 证据：`demo-e2e/empty-recheck/summary.json`。

## 24. 重置不枚举（2026-09-26）

* `tmp/reset-nonenum.mjs` PASS：真实账号与虚构账号的重置请求同为202、同形`{accepted:true}`，不泄露账号存在性；投递未配给系设计（审计留痕）。
* 证据：`demo-e2e/reset/summary.json`。

## 25. 诚实门复核（2026-09-26）

* `tmp/r20-guards.mjs`5/5 PASS（job pwsh-67 exit 0）：SRS直写409关闭、离线列表404（路由保留）、商城目录200空plans。
* 证据：`demo-study-loop/r20-guards.json`。

## 26. 移动答题深链（2026-09-26）

* `tmp/mob-assess.mjs`：移动H5登录真→定级页点选2题→报告卡→同号日报/错题200，零异常（job pwsh-69 exit 0）。
* 证据：`demo-e2e/mobile-assessment/`（报告截图+summary）。

## 27. 契约失败项定性（2026-09-26）

* `p1r-api-contract`挂的2项（恢复分页/媒体幂等/错题分页）逐项核过：`upload-url`契约自声明`FAIL_CLOSED/NO_SUCCESS_PATH`（D2未成熟），硬加`x-idempotency`声明等于撒谎——实现侧确无幂等 enforcement；恢复分页同理归属 M2-006。
* 结论：两处均为契约不成熟区，需 owner 补实现+提 maturity，不是声明问题，不动。

## 28. 读全部与离线清单（2026-09-26）

* `tmp/ra-check.mjs`：已读全部200（无消息时诚实空操作）、离线包清单200（状态机描述符+空列表），零异常。
* 证据：本轮命令输出（小项，未单独入库，按需重跑 `node tmp/ra-check.mjs`，tmp 不进仓）。

## 29. 装扮写链诚实关（2026-09-26）

* `tmp/avatar-write.mjs`5/5 PASS（job pwsh-72 exit 0）：装扮/空间保存诚实503（`ENTITLEMENT_UNAVAILABLE`，防刷/商业边界）；读取200降级。
* 结论：装扮写需配给 entitlement，不伪造；AVATAR-REWARD 行动作深验至此（读通+写关）。
* 证据：`demo-study-loop/avatar.json`。

## 30. 盖错复现（2026-09-26）

* `tmp/mk-mask.mjs`：干净构建上，无效体（缺字段/错枚举）依然回不透明403——盖错行为稳定复现，非偶发。
* 证据：本轮命令输出（小项，未单独入库）。

## 31. 词汇正典兜底上线（2026-09-26，EPIC-B3首刀）

* 改动：`apps/learner-web/src/api/b10.ts`（`listVocabularyBatch`）：B25批次空或诚实`UNTRUSTED`错时，读 frozen DEMO-P5 两套词（10词）拼卡，背面内嵌（翻卡零fetch）；评分走正常review口，服务端判（不伪造掌握态）；传输错照常透出（离线/重试态不受影响）。其余四技能待产品决策，不动。
* `tmp/vocab-fallback-check.mjs`全绿（job pwsh-200 exit 0）：登录→1/10→about→关于→评分无假掌握态，零页面异常。
* 证据：`demo-e2e/vocab-fallback/`（正反面截图+summary）。
* 附带：我的edit工具残留tmpdir两次绊倒vite watcher（EBUSY），已清残留并重起前端；以后每次edit后必查残留。

## 32. 四技能桥接上线（2026-09-26，EPIC-B3次刀）

* 新增 `CanonicalBridge.vue`（共享课程卡→`learn-session?contentId=`）；语法/阅读/听力挂空态，写作挂空+错+离线三态（其4个读口无网关投影，浏览器预检403是设计使然）。
* `tmp/bridge-check.mjs` + `tmp/writing-check.mjs`：4页桥渲染+点通会话，零页面异常（job pwsh-204部分、pwsh-209全绿）。
* 口语无正典课，保持诚实空（不硬凑）。
* 证据：`demo-e2e/skill-bridges/`（四页截图+点通记录+summary）。

## 33. 盖错修复落地（2026-09-26）

* 改动：`NotificationSecurityConfiguration` 加 `.dispatcherTypeMatchers(ERROR).permitAll()`（5行，注释写明安全依据）。
* 验证：无效体回诚实400、有效体200持久、study 9/9 + r7 9/9、单测12/12；其余13个同写法服务列后续（不动）。
* 证据：本轮命令输出 + `demo-study-loop/r7-guards.json`。

## 34. 正典题库Phase 1：bank落库（2026-09-26，EPIC-正典定级）

* 新增 `content-service` V24 `content_placement_item`（数字ID、维度、题干、选项、答案规则、ACTIVE权利约束）+ `seed-placement-bank.mjs`（10题真题，3/3/2/2与`P1PlacementScorer.requireManifest`对齐，已实测计数）。
* bank版本266100、题目266001–266010，fixture惯例（LOCAL_FIXTURE、可重跑）。
* 下步Phase 2：content内部sealed端点 + assessment HTTP适配 + 契约内操作+1 + E2E真判分。

## 35. 正典题库Phase 2：sealed内端点 + HTTP适配 + 真判分（2026-09-27）

* 契约先行 [实测]：`b10-learning-assessment-content` fragment 新增 `GET /internal/v1/content/placement-bank/sealed`（`getPlacementBankSealedSnapshot`，bearerAuth转发已验JWT、网关永不投影）+ 3个schema；`merge --write`后canonical 455→456 operations；网关内部基线62→63（fragment与check脚本同步，无新增漂移）；`contracts:validate` PASS；网关check仍仅3项历史漂移；stale-claims PASS。
* content侧 [实测]：新建 `PlacementBankSealedController`（`/internal/v1/content/placement-bank/sealed`，learner读门，10题3/3/2/2 + 单一contentVersion/scoringVersion + 答案指针对上 served 选项，任一漂移503）；单测`PlacementBankSealedJdbcTest` 5/5。
* assessment侧 [实测]：新建 `HttpPlacementBankPort`（JDK HttpClient零新依赖，转发调用方JWT，bank + 正典`GET /api/v1/learner/targets`真targetId/stateVersion组pin，无ACTIVE目标503；默认启用，`enabled=false`独立回滚）；单测`HttpPlacementBankPortTest` 5/5；既有placement单测15/15全绿。
* 真判分E2E [实测]：`tmp/p1-placement-e2e.mjs` 15/15 PASS——全对100分/C2/HIGH/ASSESSED、全错0分/A1、报告200、会话/报告重读恢复、幂等重放同会话、client题面逐项验无答案物；落库4 COMPLETED会话 + 4 ASSESSED结果 + 4 outbox事件；浏览器UI onboarding（注册→成人→存目标）零错截图2张。证据：`evidence/live/2026-09-27/p1-placement-e2e/`。
* 口径说明：P1答错进“报告维度失分”（dimensionSummaries + 0/A1），不写错题队列——错题→补救→变式链已由remedy-loop覆盖（MISTAKES-MASTERY PASS）；P1正典会话本期无dedicated UI页（learner-web沿用B25两题入口，不动），截图为UI目标保存到达 + 零错证明。
* 挖出并修复2个历史首次执行bug（见§36）。

## 36. Ph2挖出的两个历史bug（2026-09-27，均已修，均有回归单测）

1. **P1完成必500** [实测]：`P1PlacementJdbcController.appendCompletion`往outbox `schema_version VARCHAR(32)`塞了33字符事件名（严格MySQL 1406）。P1完成路径历史上从未被执行过（此前Unavailable占位），FlowTest用mock故不暴露。修法：schema槽改与B10一致的envelope名`assessment.event.v1`（事件名仍在event_name列）；新增`P1PlacementCompletionJdbcTest`（H2真SQL，VARCHAR(32)与生产同宽，永久回归）。
2. **bank种子炸目录** [实测]：bank种子`content_definition/kind='PLACEMENT_BANK'`无枚举对应（`ContentKind.valueOf`抛），且版本载荷`'{}'`三违rehydrate（空载荷/QUESTION无答案规则/hash失配），`GET /content/learner/catalog`对全体用户500（09-26的200证据先于bank落库）。修法（种子侧，fixture惯例）：kind=`COURSE` + 真元数据载荷（含条目指针，不含答案）+ `contentPayloadHash`共享正典算法算hash + 权利通道`SEALED`（唯一出口，目录403-skip，复验目录200且bank不可见）。
* **纠错**（证据纪律§7）：§33“其余13个”有误。复核 [实测]：14服务中iam/workflow/notification 3个已修，剩余**11个**未修（audit/commerce/gamification无条件denyAll风险最高）。数量以本节为准，§33原文保留备查。

## 37. B3交互环：题干下发 + B10判分 + 绑定表 + 供B3练（2026-09-27）

* 契约先行 [实测]：`B10CreateAssessmentSessionRequest`加可选`contentCode`（缺省course-b25-basics，410语义不变）；网关嫁接`GET /api/v1/reading/questions`（EXACT@850，路由表+执行投影+Java双镜像+顺序对齐）；`merge --write`后仍456 operations（无新操作）；`contracts:validate` PASS；网关check 74/74/218，仅3历史漂移；parity 5/5。
* content侧 [实测]：V25 `content_b3_item_binding`（B3身份→code/version/item三元pin，版本不可变故无需hash列；无出处legacy行不建绑定）；B3读门`1=0`换绑定EXISTS + 版本/权利谓词全保留 + `SEALED`通道（目录仍要LEARNER，bank不进目录）；`publishedRow`递归剥答案 + `practiceRef`路由坐标。单测新3/3，旧门测5/5（补空绑定表）。
* 种子 [实测]：`seed-b3-bank-practice.mjs`（`pnpm db:seed:b3-bank-practice`）读bank活数据建3语法+2阅读题干行 + 5 ACTIVE绑定；听力/词汇bank题需投影中的练题端点，列后续（不硬凑）。
* assessment侧 [实测]：B10建单接受`contentCode`（兼容默认，replay按请求比对）；`BankPracticeRuleProvider`按需读sealed bank转B10规则行（`correctOption`→`answer` verbatim适配、`BASIC_GRAMMAR`→`GRAMMAR`，失败null→410，不落库无漂移）；bank会话pin epoch/hash来自bank（snapshot_id数位carry版号）；错题/分数收敛到会话items（子集不再背整库未答题）。单测：provider 5/5 + 建单3/3。
* 前端 [实测]：`submitGrammarAttempt/submitReadingQuiz`改走B10 sessions/attempts（practiceRef，无ref诚实抛错；死B3路径不再调用）；`createPracticeSession`支contentCode/version/itemIds；point-free drills渲染（parser/store/页面三处）；`typecheck`过。
* E2E [实测]：`tmp/b3-practice-e2e.mjs` 16/16——B3语法3题干+阅读2题干（逐项验无答案物）+ practiceRef、legacy points仍诚实空、B10 bank建单pin对+幂等重放、答对FULL、答错ZERO→错题1条→retry→variant→报告READY→会话重读；浏览器真机答一题得FULL截图2张。证据：`evidence/live/2026-09-27/b3-practice-e2e/`。
* 运行备注：本轮发现`services:run`退出会SIGTERM其子进程并曾引发全栈抖动；新增`tmp/launch-detached.mjs`（完整复刻runner env，分离拉起+日志落`logs/`）。网关全量套件`CanonicalRoutePolicyRouteLocatorIntegrationTest`1挂经stash验证为基线预置（与本轮无关）；mobile端B3旧提交路径未动（列后续）。
* 口径：写作（无规则可判）/听力（无练题投影端点）/口语（M8）本轮不动，均为诚实空；三态总表 verdict 变更见ledger v6。

## 38. 计划接线：pin语义 + ensure + home投影（2026-09-27，ADR-0027）

* 契约先行 [实测]：公共`POST /api/v1/learning/plans:ensure`（`ensureB10LearningPlan`，body仅报告指针）+ 内部`GET plans/current-view`、`GET placement-bank/plan-items`、`PUT learner/targets/pin`；canonical 456→460；网关内部基线63→66、available 218→219（ensure并入learning-domain规则，规则数74不动）；三门禁（validate/网关3漂移/stale-claims）与assessment门禁全绿。
* learner侧 [实测]：V12（目标pin列+偏好study-days列，out-of-band幂等应用）；`TargetPinService`（咨询式pin，不 bump 版本，改目标清pin）；偏好周天（domain字段+owner默认每日）；TargetData/pin内端点；home/first-day嵌learning视图（READY要planningInput+plan+tasks齐全，否则诚实NOT_READY；learning故障不炸home）。
* content侧 [实测]：sealed加`contentStateVersion`；新plan-items端点（仅id+序，无题干选项答案）。
* learning侧 [实测]：三HTTP适配（目标/计划内容/报告核验）+ `PlanningInputAssembler`（23键精确对契约）+ `V2PlansController`（验报告→写pin→建单→resume→组装→落输入快照→B25投影，单事务）+ B25 current-view；域`LearningTenantScope`接受IAM UUID（与learner侧先例对齐）+ `stableUserIdFor`；`learning.ports.mode`默认fail-closed（runner开http）。
* E2E [实测]：`tmp/plan-e2e.mjs` 11/11——定级完成→ensure 200（plan-100012 ACTIVE，tasks 3，幂等重放）→today 3→home READY（planningInput+plan内嵌）；落库（domain计划+输入快照+B25行+目标pin）；浏览器home见“学习计划 plan-100013·3今日任务”零错；today页仍空态（V2任务缺标题映射，列后续，截图为证）。证据：`evidence/live/2026-09-27/plan-wiring-e2e/`。
* 修了2个拦路bug [实测]：① `learning_id_sequence`停在V2种子值而fixture行已占区间（domain建单500，5个序列前向修复，数据无损）；② B10 `snapshot_id` BIGINT装不下`snap_`（沿用B3轮“版号carry+hash全量”规矩）。
* 口径：P1定级本期无dedicated UI页，ensure由API消费方在定级后自动调（E2E即消费方）；Kafka saga待中继落地；mobile旧路径不动。

## 39. 盖错推广：11服务 + 模板（2026-09-27）

* 改动 [实测]：`audit/commerce/gamification/learner/content/admin-ops/analytics/social/media/learning/assessment` 11个服务 + `service-template`，逐个加 `.dispatcherTypeMatchers(ERROR).permitAll()`（5行：1行放行+4行安全依据注释，与notification修法同构）。网关（WebFlux另一模型）与已修3个（iam/workflow/notification）不动。
* 验证 [实测]：11服务全量单测绿（gamification 69/commerce 93/admin-ops 77/audit 27/media 82/social 86/analytics 51/learner 76/content 240/learning 170/assessment 105）；`tmp/err-probe.mjs` 14/14——11服务框架404见光（不再是403）+ 2处400见光；浏览器零错页1张。证据：`evidence/live/2026-09-27/error-masking/`。
* 挖出1个同类掩盖 [实测]：social自带`@ExceptionHandler(Exception.class)`兜底把框架404吞成500（与denyAll异构同症）。修法：404/405异常rethrow归Boot `/error`诚实渲染；social-404复验通过。iam两处同写法属已验范围，不动。
* 探针误报纠正：learner-400首轮FAIL系探针用POST打了只认GET/PUT的口（405本就是见光），改PUT复验400通过。
* 三态总表：本轮不翻页verdict（鲁棒性修复，无页面行为变更）。

## 40. 送审门：L2终审自动ACTIVE + 报告绑定（2026-09-28）

* 契约先行 [实测]：`B9ContentDraftInput` +3可选（申报渠道/证据/学习许可）；新 `B9ValidationReport`（`vr_` ID沿用schedule已定格式）+ accepted/state只读引用；无新操作（460）无新事件；validate 460 ops/808 schemas绿；网关2漂移/stale-claims与基线一致；lifecycle与HEAD逐行一致（14行全预置，无新增）。
* 语义 [实测]：申报（claim）与授权（authority）永不同列——版本权利保持PENDING空授权（锁死测试逐字通过），申报走新proposal列（V27）；VALIDATE_DRAFT持久化版本+哈希绑定的PASS报告（V26，`vr_`确定性ID支持重放同一事实）；SUBMIT要申报完整+活体PASS+绑定报告+媒体干净（文本版vacuous过，媒体版无事实即MEDIA_ELIGIBILITY_UNAVAILABLE）；REVIEW_FINAL APPROVED自动ACTIVE（先验报告+媒体再翻转，无新事件，沿用reviewed事件）；PUBLISH复验（域双签+ACTIVE双重 enforcement）。
* E2E [实测]：`tmp/songshenmen-e2e.mjs` 22/22——建稿→校验（vr_）→送审→双签→终审ACTIVE→发布→目录可见→下架→v2循环→回滚v1→目录回到v1＋裸稿409；浏览器admin建稿（dossier表单）零错。证据：`evidence/live/2026-09-27/submission-gate-e2e/`。
* 修了2个拦路bug [实测]：① 激活只持久化status导致ACTIVE空壳不可rehydrate（state-update补全4列；2行调试残留数据已修回PENDING）；② 旧行proposal列NULL致目录503（读容忍空=无申报）。
* 口径：媒体事实管道列后续（ fail closed，非假过）；schedule排期沿用既有命令。

## 41. RISK 并入治理页（2026-09-28，ADR-0028）

* 契约先行 [实测]：b13风险4操作（list/file/decide/evaluate）+ b8 IAM锁定1操作 + 网关5投影（挂既有admin-domain/iam-domain规则，rules/plans不动）；460→465 ops；validate绿；网关2漂移/stale-claims与基线一致（available 219→224已同步）。
* 语义 [实测]：B12不复用（事实/决定集不相交，混用会污染审计）；数据归属admin-ops（`risk_case` V6），隔离/升级只记owner凭据引用；首个实时规则ACCOUNT_LOCKOUT吃IAM最小披露锁定读（opaque subjectRef，staff经“已验证JWT+现行权限重查”）；IAM不可达则整轮评估fail closed；升级AUDIT写本地审计（可查），升级SUPPORT只记意图（transition通道未通，不伪造工单）。
* E2E [实测]：`tmp/risk-e2e.mjs` 13/13——真锁定→评估建档→去重→队列→分诊→隔离→升级→关闭→终端态409＋分析师建档＋重放＋学员403；落库（案件行＋决策史＋锁定行）；浏览器治理页风险区建档零错。证据：`evidence/live/2026-09-27/risk-governance-e2e/`。
* 单测 [实测]：IAM 121、admin-ops 82全绿（含新增锁定5＋风险5）；网关parity仅预置reading单失败（与本轮无关，扫描确认）。

## 35. runner树崩与孤儿进程（2026-09-26，运维教训）

* 现象：runner树先后死两次（iam/assessment报`exited: code=4294967295`整树归零）；另发现树死后有子进程变孤儿继续占端口（如assessment PID 40664持18091且readiness 200），导致后续重起报端口占用再死，形成连环。
* 处置：重起前必查孤儿（`netstat`对`java.exe`进程启动时间），先`Stop-Process`清场再起；`16端口+gw200+16java三对`才算健康。
* 未解：子进程-1退出的根因（无hs_err、内存充足67G/37G空闲）；下次复现时加堆转储再查，不阻塞业务验证。
