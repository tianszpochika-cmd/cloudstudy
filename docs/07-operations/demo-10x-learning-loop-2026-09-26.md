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

## 16. 通知偏好写阻塞项（2026-09-26，三轮未解→阻塞）

* 现象：同token GET偏好200，任何PUT偏好（含空体/无体/W4最小体/双类目）一律403`{"code":"FORBIDDEN","message":"access denied"}`；绕过网关直调亦然；R6发现，R8深挖，R9矩阵二分仍现。
* 已排除（实测）：网关（直调同错）、包体（空/无/全同错）、token权限声明（解码齐全）、转换器/链/控制器/命令/策略/解析器/过滤器/方法注解（逐项读码，均无方法分支）、类注解、双链（单链确认）、CSRF（已关）、Origin头（加了同错）、Idempotency-Key（直调无键同错）。
* 反证：同服务同token下PUT消息已读200、GET偏好200；PUT不存在路径亦403（方法级），POST同路径404（路由正常）。
* 结论：服务内对偏好PUT路径的拒绝无可见配置对应，需owner带trace/调试器跟`AuthorizationFilter`后链路。读侧与设置页渲染不受影响；W4在9月曾PUT成功，属回归窗口。
