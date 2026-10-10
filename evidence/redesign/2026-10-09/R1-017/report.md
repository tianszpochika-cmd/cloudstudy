# R1-017 画像字段与首页引导条

日期：2026-10-10。证据目录按卡要求放在 `evidence/redesign/2026-10-09/R1-017`。分支：`dev-redesign`。Owner：learner-web；Mobile 向导和首页引导条按同一规则对齐。依赖：R1-010。
IC：IC-057、IC-009。

状态：目标和每天时长的回填、已保存后的定级主按钮、未完成时的首页引导条已写入 Web 与 Mobile。**不是 ACCEPTED，也不是 IT-1 出站。** IT-1 还缺这张卡的验收，以及此前已记录的实机缺口。没有 commit，没有 push。`CURRENT-PROGRESS.md` 未改。没有打开浏览器，也没有上机走查，所以画像字段和引导条的可见对稿**没有 PASS**，实机**没有 PASS**。

## 行为

目标和每天时长先完成。Web 上的重点标签仍是「可选重点，可以稍后补」，不参与能否继续。本卡没有新增标签列，也没有每日提醒。Mobile 向导没有标签。

再进入时，回填只使用已保存目标。`GET /api/v1/learner/targets` 的规范码是 `FOUNDATION`、`COLLEGE_CET`、`POSTGRADUATE_ENGLISH`、`WORKPLACE_DAILY`，每天时长是 5、15、30、45。客户端读目标后仍会把规范码记成既有界面别名（例如 `COLLEGE_CET` 记成 `CET_4_6`）；表单再用 `prefillSavedTarget` 转回规范码，不把库内历史别名 `ZERO_BASIS`、`CET_4_6`、`POSTGRADUATE`、`WORKPLACE` 显示出来。没有保存值、读到未知码，或时长不在这四档时，目标留空，不填假目标。保存仍经原来的 `mapUiGoal`，不改选步函数，也不改既有写入别名。

目标已保存时，主按钮文案是「开始定级」，`data-primary-action` 为 `assessment`。Web 去现有路由 `assessment`，Mobile 去现有页 `/pages/assessment/assessment`。文案没有「3 击」或「3 分钟」。未保存时主按钮仍是「保存并开始测评」。快速开始没有变成主按钮；Web 定级页原有的次入口「跳过测评，选择起点」未改。

未完成时，首页引导条动作仍是「继续设置，开始学习」。剩余步骤按当前选步缩小：确认身份时是「确认身份、必要同意、学习目标」，同意步是「必要同意、学习目标」，目标步是「学习目标」，已保存目标后是「定级」。引导条没有「已存本机」或「目标草稿已保存在本地」。已保存且尚未进入定级时，引导去现有定级入口；更早的步骤仍回向导。

`selectOnboardingResumeStep` 的返回顺序没有改，仍是 rejected、gate、consent、goal、assessment。R1-016 的出生年份说明、三条必要勾选（`ACCOUNT_TERMS`、`PRIVACY_NOTICE`、`ADULT_LEARNING_ELIGIBILITY`）和「版本未读到」没有改。

## 改动文件

本卡新增或修改：

- `apps/learner-web/src/domain/onboarding-resume.ts`（在 `hasPlacementEntryReached` 之后追加规范码、回填和剩余步骤；选步函数未改）
- `apps/learner-web/src/pages/OnboardingPage.vue`
- `apps/learner-web/src/pages/HomePage.vue`
- `apps/learner-web/tests/onboarding-resume.test.mjs`
- `apps/mobile/src/domain/onboarding-resume.ts`（与 Web 同一份追加；两端文件一致）
- `apps/mobile/src/pages/onboarding/onboarding.vue`
- `apps/mobile/src/pages/home/home.vue`
- `apps/mobile/tests/onboarding-resume-step.test.mjs`
- `evidence/redesign/2026-10-09/R1-017/report.md`

没有修改 `services/**`、注册页、登录页、重置页、`evidence/redesign/2026-10-09/R1-014/**`、`evidence/redesign/2026-10-09/R1-016/**`。工作区里那些路径上的既有差量不是本卡改的。

## 验证

命令都在对应应用目录里跑。退出码 0。这是源码句子和现有单测，不是浏览器对稿，也不是实机。命令全文和退出码同时写在 `/tmp/r1-017-review.md`。

```text
cd /Users/Admin/Desktop/work/cloudstudy/apps/learner-web && node --test tests/onboarding-resume.test.mjs tests/onboarding-retry.test.mjs tests/c02-learner-profile.test.mjs tests/adult-gate-restricted.test.mjs tests/learner-store-subject-isolation.test.mjs tests/c03-learning-flow.test.mjs tests/consent-dynamic-version.test.mjs tests/adult-consent-copy.test.mjs
exit 0
tests 28, pass 28, fail 0
duration_ms 1540.32775
```

```text
cd /Users/Admin/Desktop/work/cloudstudy/apps/mobile && node --test tests/onboarding-resume-step.test.mjs tests/onboarding-resume.test.mjs tests/c02-learner-profile.test.mjs tests/mobile-learning-account-scope.test.mjs tests/mobile-gateway-auth-bootstrap.test.mjs tests/c03-learning-flow.test.mjs tests/mobile-consent-dynamic-version.test.mjs tests/mobile-settings-devices.test.mjs tests/adult-gate-policy-version.test.mjs tests/adult-consent-copy.test.mjs
exit 0
tests 52, pass 52, fail 0
duration_ms 2115.391417
```

`apps/learner-web/tests/profile-target-live-contract.test.mjs` 没有放进通过命令。它的 require 钩子加载 `b1.ts` 时遇不到 `./unavailable` 的桩。本卡没有改 `b1.ts`，也没有改这个测试。

## 没有 PASS 的部分

- 没有用浏览器核对可见画像字段和引导条，文案对稿没有 PASS。
- 没有实机走查，实机没有 PASS。
- 不是 Luna 独立终审，不是 IT-1 出站。此前已记录的实机缺口仍在。
- 新账号浏览器回放、If-Match 与既有网关缺口都没有在本卡重新验证。
