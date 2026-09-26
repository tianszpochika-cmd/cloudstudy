# 本地Web演示闭环：全目标演示号 + 10x合成数据计划

> 日期：2026-09-26；目标：本地`learner-web(18180)`四个目标轨道都能走通学习闭环。
> 数据性质：全部合成（`synthetic`），无真实版权/真题/录音/支付；正式内容另行合规接入。
> 节奏：每完成一部分更新本文（或关联证据）并分批提交推送到`origin/dev`。

## 1. 演示号（4个轨道，各1个）

| 轨道 | goalCode | 用途 |
|---|---|---|
| 成人零基础 | `ZERO_BASIS` | 发音+核心词+短句起步 |
| 四六级备考 | `CET_4_6` | 词汇听力节奏 |
| 考研英语 | `POSTGRADUATE` | 长难句阅读 |
| 职场日常 | `WORKPLACE_DAILY` | 会话场景邮件 |

创建方式：经`learner-web`真实注册`@local.invalid`合成账号 → 成人Gate → 三项同意 → 存目标。
命名建议：`demo-zero@local.invalid` / `demo-cet@local.invalid` / `demo-kaoyan@local.invalid` / `demo-work@local.invalid`（密码不入库、不进文档）。

## 2. 10x数据构成

* 全局10x：`scripts/database/seed-local-real-10x.mjs`（`FIXTURE_ID=local-real-10x-v1`，`ROWS_PER_FUNCTION=10`，10个内部subject，A1–C2分层）。覆盖内容版本/投影/课程/单元/词表、plan/task/srs/review/mastery、题规则/session/attempt/report、媒体asset、XP/ledger/grant、房间/席位、订单/回调/权益/退款、通知/离线包/工单。只写本机`127.0.0.1:13306`。
* 全量套件：`seed-local-real-all.mjs` = learning-world + commerce + admin-analytics。
* 大词表：`seed-large-vocabulary.mjs`（Core Frequency 720，PUBLISHED/VALID）。
* 逐号种子：`seed-local-real-learning-world.mjs`要求`LOCAL_TEST_SUBJECT`为单个`ACTIVE @local.invalid`账号，每演示号各跑一次（含onboarding选项、profile/goal/preferences/daily-task/plan/library/review/continue-context）。

顺序：全局10x → 大词表 → 全量套件 → 逐号×4 → 内容发布（草稿→双审→发布，下线回滚抽测）。

## 3. 主链堵点与修法（fail-closed，不造假）

1. `home 503 STORE_FAILURE`：有目标无计划时抛（`LearnerHttpController.toFirstDay`）。修法定级→计划产出，或契约改诚实空态。
2. 技能路预检403/GET404（阅读/语法练习/写作/听力）：网关owner冲突（`reading-domain`不可执行）。按契约拆到content/learning/assessment真实owner，重建网关复测。
3. 定级题源503：用种子题规则+版本化快照闭环`start→submit→报告`。

## 4. 验收（learner-web）

每号走：注册→成人→目标→定级十题→计划→今日→词汇/语法/阅读/听力→SRS→错题→报告→世界。证据：浏览器截图+requestId/traceId+库行，回填56项台账对应行；失败保留，不断言通过。

## 5. 提交节奏

P1本文 → P2灌库（含数量核对）→ P3 home → P4网关 → P5定级发布 → P6全目标E2E。每步独立commit推送。
