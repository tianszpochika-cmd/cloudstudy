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

## 7. 待办（P6）

* 全目标浏览器E2E：注册→成人→目标→目录→单词详情→今日→home，每号截图+证据，回填56项台账。
* B3技能页迁正典端点；发布流送审门修复（M3）；M8发布件。
