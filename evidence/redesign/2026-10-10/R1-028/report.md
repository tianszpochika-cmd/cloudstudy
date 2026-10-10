# R1-028 定级引导、答题、反馈、报告与重试文案

日期：2026-10-10。分支：`dev-redesign`。卡：R1-028 / IC-010、IC-011、IC-012、IC-058、IC-059。Owner 表面：learner-web。依赖：R1-022。R1-027 的续答行为保持不变。

状态：Web 与 Mobile 定级页补了可见文案，并只展示服务端已经给出的题序、回执和报告。**不是 ACCEPTED，也不是 IT-2 出站。** 没有 commit，没有 push。本卡没有改 `CURRENT-PROGRESS.md`。没有浏览器走查，没有实机 PASS。没有改 `services/**`、`packages/contracts/**`、`evidence/redesign/2026-10-10/R1-024/**`、`evidence/redesign/2026-10-10/R1-027/**`。

对稿来源是 `docs/06-design/v2-980plus/redesign/interaction-chains.md` 的 IC-010、IC-011、IC-012、IC-058、IC-059 和 U2。本卡只补这几幕的可见文案和已有状态展示。

## 页面文案

两端定级引导相同：标题「开始定级」，说明「共 10 道题。用来了解你现在的英语起点，方便安排后面的学习。」，主按钮「开始」。没有「3 分钟」。没有会话号时，「开始」才去读取；已有 `asess_` 仍只 GET，不因引导再 POST。

答题中显示「第 N 题，共 M 题」。`acceptedSequence > 0` 时显示「服务端已接收 N 题。」选项只有题面文字，不显示正确答案，不显示 `correctOption`。未提交选择的句子是「当前选择只留在这一页。离开后，还没提交的选择不会保留。」页面没有「已存本机」或「可离线答完」。

提交回执的 `outcome` 只有恰好是 `FULL` 或 `ZERO` 才出现人话：「刚才提交的这题答对了。」「刚才提交的这题没有答对。」句子不指出哪个选项。没有 `outcome` 时不编造成绩，也不展示服务端英文解释。409 先 GET、检查点未变才用原幂等键重试一次；这种采用检查点的结果不当成新的对错回执。提交失败时用「答案状态尚未确认。请先重新读取，不会因此新开一套题。」

已有正式报告时显示「报告已生成」。两端都有计数时才写「答对 N 题，共 M 题。」旧报告若服务端带了等级和分数，仍用原来的取整方式展示；新报告没有这些字段时不编造。建议里若含 `correctOption` 或 `answerRule` 则不展示。报告说明：「重测会另开一套题，这份报告会保留。是否调整已有计划需要另外确认。」SKIPPED 仍是「已跳过测评」和「水平尚未验证」，不装成正式报告，也不出现重测按钮。

重测按钮只在服务端已经给出完成态的正式报告上出现。按钮是 `disabled`，文案是「重测尚未接通」，没有点击处理，不会在前端伪造新会话。客户端还没有重测口。

检查点句子保持 R1-027：Web 是「定级进度在服务端」和「重新读取会从已接收检查点的下一题继续，不会新开一套题。」Mobile 把这两句合成一句。加载仍是「正在准备测评」。空态说明「目前没有可用题目，可以稍后重试。」读取动作用「重新读取」。

## 保持的行为

- 已有 `asess_` 会话只 GET，停在 `acceptedSequence` 的下一题。
- 没有会话号才 POST 新会话。恢复失败不再 POST。
- 提交带读到的 `stateVersion`。409 先重新 GET，检查点未变才用原幂等键重试一次。
- 未提交的选择不写入 localStorage。持久化只留会话号。
- Web 跳过卡上的「参加测评」仍走原有 `restartAssessment()`。那不是本卡的重测按钮。Mobile 跳过卡没有这个入口，也没有新增重测 POST。
- 向导选步、三条必要同意、注册、登录、重置文案没有在本卡里改。

## 改动文件

本卡的文案和已有状态展示落在：

- `apps/learner-web/src/domain/learner-content.ts`
- `apps/learner-web/src/api/learner-content.ts`
- `apps/learner-web/src/stores/learner-content.ts`
- `apps/learner-web/src/pages/AssessmentPage.vue`
- `apps/learner-web/tests/c04-assessment-chain.test.mjs`
- `apps/learner-web/tests/placement-checkpoint-resume.test.mjs`
- `apps/learner-web/tests/placement-score-units.test.mjs`
- `apps/mobile/src/domain/learner-content.ts`
- `apps/mobile/src/api/learner-content.ts`
- `apps/mobile/src/stores/learner-content.ts`
- `apps/mobile/src/pages/assessment/assessment.vue`
- `apps/mobile/tests/c04-assessment-chain.test.mjs`
- `apps/mobile/tests/placement-checkpoint-resume.test.mjs`
- `apps/mobile/tests/placement-score-units.test.mjs`
- `evidence/redesign/2026-10-10/R1-028/report.md`

这些 learner-web / mobile 文件里还有 R1-027 及更早卡片已经在工作区里的差量。本卡在其上补回执与正式报告的只读字段，以及上面的页面句子。工作区里 services、contracts、入门页、登录注册重置、`CURRENT-PROGRESS.md` 和其他证据目录上的差量不是本卡改的。

## 验证

没有起服务，没有打 MySQL，没有浏览器走查。测试是 `node:test` 读源码和解析器，不是实机。

```text
cd /Users/Admin/Desktop/work/cloudstudy/apps/learner-web && node --test tests/placement-checkpoint-resume.test.mjs tests/c04-assessment-chain.test.mjs tests/placement-score-units.test.mjs tests/onboarding-resume.test.mjs
exit 0
tests 29, pass 29, fail 0
```

```text
cd /Users/Admin/Desktop/work/cloudstudy/apps/mobile && node --test tests/placement-checkpoint-resume.test.mjs tests/c04-assessment-chain.test.mjs tests/placement-score-units.test.mjs tests/onboarding-resume-step.test.mjs
exit 0
tests 28, pass 28, fail 0
```

`placement-checkpoint-resume` 仍覆盖已有会话只 GET、无会话才 POST、提交带 `stateVersion`、409 原键重试一次，以及页面不写「已存本机」「可离线答完」。`c04-assessment-chain` 覆盖引导、题序、FULL/ZERO 两句、「报告已生成」和不可用的「重测尚未接通」。命令原文在 `/tmp/r1-028-review.md`。

## 没有 PASS 的部分

- 没有浏览器或真机走查。引导、答题、反馈、报告和重测按钮没有实机 PASS。
- 重测口还没有接到客户端。按钮保持不可用，没有假装已经重测。R1-024 正在改服务端重测，本卡没有改那部分。
- IC-012 稿里的主按钮是「生成我的计划」。两端正式报告的主按钮仍是已有的「查看今日状态」。本卡没有接计划生成。
- Mobile 引导卡另有「返回学习首页」。这是原有的离开入口，引导说明和「开始」与 Web 相同。
- Web 跳过卡保留「参加测评」。Mobile 跳过卡没有这个按钮。
- 旧报告的分数取整仍按各端已有表达式：Web `Math.round(report.score)`，Mobile `Math.round(report.value.score * 100)`。只在服务端确实带了分数时显示。
- 不是 Luna 独立终审，不是 IT-2 出站，也不是 L2 干净库重放。
