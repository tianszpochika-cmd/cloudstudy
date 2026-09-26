# 学习 Web 首日链路追验（2026-09-23）

## 验收口径

依据 `JNY-P1-01…05`、`E2E-P1-FIRST-DAY` 和 `PAGE-P1-ONB-GOAL/ASSESSMENT/PLAN-MAP/LEARN-HOME/TODAY`：新成人注册、Gate 与必要同意、目标和时长、正式十题定级或 `UNVERIFIED` 跳过、owner 计划和首个今日任务要在同一主体上贯通。页面可打开、接口返回 200、健康检查通过均不等于整条链路可用。

本轮在现有本地进程上用 Playwright 无头真实浏览器操作，四次重复完整流程。脚本为 [`tests/uat/learner-first-day-followup.e2e.mjs`](../../tests/uat/learner-first-day-followup.e2e.mjs)，最后一轮逐请求状态、页面文字、响应式与 owner 计数见 [`learner-first-day-followup.json`](learner-first-day-followup.json)。使用精确命名的合成账号，密码和访问令牌仅在运行内存中，未写证据；没有改动共享正式数据、重启服务或打包。四个合成账号均已停用，活跃会话总数为 0。

## 真实运行结果

| 环节 | 页面、Gateway、owner 证据 | 结论 |
| --- | --- | --- |
| 注册与成人准入 | UI 注册后到 `/onboarding`；`POST /auth/register` 201，`POST /iam/adult-gate` 200，三项同意 `PUT /iam/consents` 均 200。Gate 前 learner profile/target/options 403，Gate 与同意后重新读取成功。 | 该合成成人路径可操作；真实年龄核验、正式条款版本不在本轮证明范围。 |
| 目标与时长 | UI 选“成人零基础”与每日 30 分钟，`PATCH /learner/profile` 200、`PUT /learner/targets` 200；owner `learner_profile=1`、`learner_goal=1`，goal 事实为 `FOUNDATION/30`。首日投影行 `=1`，但其 `next_action=onboarding.resume`、任务数 0、内部 `completion_percent=25`。 | 目标持久化可用；投影行及内部 25% 不代表计划就绪，公开首页当前以 503 拒绝。 |
| 定级入口 | 保存后进入 `/assessment`，页面为 **0/2**，第一题 `Choose the greeting.`；浏览器请求旧 `GET/POST /assessment/placement/start` 200。设计要求 canonical `P1_PLACEMENT_V1` 十题及四维规则。 | **BLOCKED**。旧两题不可冒充正式定级。 |
| 跳过 | 页面“从 A1 开始”调用旧 `POST /assessment/placement/skip` 200，显示“水平尚未验证”“这不是测评等级”。 | 旧页面提示没有伪称权威成绩；未证明 canonical skip 与下游规划。 |
| 首页、今日 | `/home` 与 `/today` 两次 `GET /learner/home` 均 503；新浏览器重新登录后的首页仍 503。owner `learning_runtime_plan=0`、`learning_runtime_task=0`。页面显示错误和重试，进度为 `—`，没有虚构完成率。 | **BLOCKED**。目标与跳过事实未产生首个可学任务。 |
| 计划图 | `GET /learning/plan/current` 为 200，但页面为空态、owner 计划/任务均 0。 | **BLOCKED**。200 是空投影，不是实际计划或地图。 |

最后一轮采集到 25 个**探针/布局检查**均完成、浏览器页面异常 0。这里的“检查完成”只说明操作与观测可靠；脚本另标 `businessAcceptance.status=BLOCKED`。`/home`、`/today`、`/plan-map` 在 320/390/1280px 均无横向溢出。首次设置在 320/390px、定级在 390px 也无横向溢出。关键截图：[成人 Gate 320px](screenshots/learner/first-day-followup/02-onboarding-gate-320.png)、[旧版两题](screenshots/learner/first-day-followup/04-assessment-390.png)、[首页 320px](screenshots/learner/first-day-followup/06-home-320.png)、[计划图 1280px](screenshots/learner/first-day-followup/08-plan-map-1280.png)。

## 本轮小批界面修复

1. 首页 owner 503 时，主视觉不再写“从一节课开始”并引导去空书架；改为“今日安排暂不可用”，保留任务卡中的单一重试操作。加载阶段也不提前展示课程按钮。
2. 320px 下隐藏主视觉装饰图并让文案占满卡片，消除图案与说明挤在一起；失败态主视觉缩短高度，避免大块空白。对比：[修前首页 320px](screenshots/learner/first-day-followup/06-home-320-before.png)、[修后首页 320px](screenshots/learner/first-day-followup/06-home-320.png)。
3. 计划图空态去掉“完成开户目标后自动生成”的误导承诺与错字，改为当前无计划并提供重试；加载、权限、技术错误分别显示可理解的短提示。对比：[修前计划图 320px](screenshots/learner/first-day-followup/08-plan-map-320-before.png)、[修后计划图 320px](screenshots/learner/first-day-followup/08-plan-map-320.png)。

修改范围为学习 Web 首页、计划图和一条窄屏样式。`pnpm --filter @englishflow/learner-web typecheck` 通过；最终真实浏览器脚本退出码 0，25 个探针检查无失败，页面异常 0；`git diff --check` 无错误。没有重建或部署 Docker 镜像。运行中的 Vite 进程热更新后已完成浏览器复核。

## 仍需完成

- 提供通过发布、版权、安全与规则 pin 的正式十题题源，并把 Web 定级入口切到 canonical API，完成十题、断点、报告和跳过的真实 Gateway/owner 纵向链路。
- 接通目标与定级事实到不可变 planning input、plan/today、首日投影；新主体必须能得到至少一条已发布内容关联的真实任务。当前 `firstDay=1`、`plan=0`、`task=0` 是确定性缺链，不能靠客户端填充或把空列表当完成。
- 复测目标重登、重复提交、跨端冲突、计划失败恢复、首任务进入与完成证据。旧 skip 的 200 只证明旧接口响应，不能算首日任务可用。
- 从首页的课程、技能入口进入真实已发布内容并完成练习。当前合成账号的内容目录读取虽返回 200，首日学习仍无可用内容引用，无法评价“拟真程度最高”。
