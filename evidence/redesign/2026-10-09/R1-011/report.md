# R1-011 BC-011 按服务端事实续步到定级入口

日期：2026-10-09。分支：`dev-redesign`。Owner：learner-web、mobile。依赖：R1-010（`GET/PUT /api/v1/learner/targets` 已能落库读回）。
IC：IC-004、IC-009、IC-057。

状态：两端续步选择、首页引导条和守卫判断已接到 IAM 成人门、必要同意和 `GET /learner/targets`。**不是 ACCEPTED，也不是 IT-1 出站。** 没有 commit，没有 push。`CURRENT-PROGRESS.md` 未改。没有用新号走真实网关和浏览器，所以「新号按真实剩余步骤走到现有定级入口」这一条**没有 PASS**。

## 行为

再进入时只看服务端事实，不用 first-day blocker，也不用注册时间：

- 成人门不是 `PASSED`（含 `REQUIRED`、`UNKNOWN`、字符串 `NOT_EVALUATED`）停在成人门。对象状态 `NOT_EVALUATED` 在 Web 读口里先收成 `REQUIRED`，步仍然是门。门未过时不请求 `GET /learner/targets`。
- `REJECTED` 去现有无权限页，不留在向导表单。Web 路由原本就会把非账号页转到 `forbidden`；Mobile 对向导和学习页使用严格的 `adultGate !== 'REJECTED'`，设备页在同意前仍可进。
- 必要同意不可读，或 `ACCOUNT_TERMS` / `PRIVACY_NOTICE` / `ADULT_LEARNING_ELIGIBILITY` 未齐，停在同意。`PRODUCT_ANALYTICS` 不挡。
- 目标可读且没有行（404）停在目标。目标读失败停在目标，文案是「学习目标暂时无法读取」，不把它写成没有目标，也不因此来回重定向。`403 CONSENT_REQUIRED` 拉回同意。
- 目标已保存时主按钮去现有定级入口 `assessment`，不要求重填。规范码 `FOUNDATION|COLLEGE_CET|POSTGRADUATE_ENGLISH|WORKPLACE_DAILY` 先映射成界面码再判断已保存。
- 未提交字段只留在当前页。离开后清空。页面写明「离开后不会保留」。没有「已存本机」或「目标草稿已保存在本地」。可选重点不随目标提交，文案写明离开后不保留。
- 没有 `POST /placement/sessions`。没有把跳过定级接到建计划。没有做首学任务或 24 小时门。Web 测评页原有的「跳过测评，选择起点」仍是次入口，本卡没有改那一页。

首页引导条在事实读到且未完成时显示真实进度，按钮文案是「继续设置，开始学习」。目标已保存并且本浏览器已经进入定级路由之后收起。收起标记是 `sessionStorage` 键 `yx.onboarding.placement-entry.${subject}`，不是目标草稿，也不是注册时间。换设备、换浏览器、以及没有 `sessionStorage` 的原生容器都**没有验证**，不能写成已收起。

## 改动文件

本卡新增或修改：

- `apps/learner-web/src/domain/onboarding-resume.ts`
- `apps/learner-web/src/domain/learner-content.ts`
- `apps/learner-web/src/api/learner-content.ts`
- `apps/learner-web/src/stores/learner-content.ts`
- `apps/learner-web/src/pages/OnboardingPage.vue`
- `apps/learner-web/src/pages/HomePage.vue`
- `apps/learner-web/src/router/index.ts`
- `apps/learner-web/tests/onboarding-resume.test.mjs`
- `apps/learner-web/tests/learner-store-subject-isolation.test.mjs`
- `apps/mobile/src/domain/onboarding-resume.ts`
- `apps/mobile/src/api/learner-content.ts`
- `apps/mobile/src/stores/learner-content.ts`
- `apps/mobile/src/pages/onboarding/onboarding.vue`
- `apps/mobile/src/pages/home/home.vue`
- `apps/mobile/src/pages/assessment/assessment.vue`
- `apps/mobile/src/auth/navigation.ts`
- `apps/mobile/tests/onboarding-resume-step.test.mjs`
- `apps/mobile/tests/mobile-learning-account-scope.test.mjs`
- `apps/mobile/tests/mobile-gateway-auth-bootstrap.test.mjs`
- `evidence/redesign/2026-10-09/R1-011/report.md`

没有修改 `services/**`、`packages/contracts/**`、learner-web 的 `RegisterPage.vue`、`LoginPage.vue`、`PasswordResetPage.vue`、`auth-failure-copy.ts`，也没有改 `packages/i18n` 的 auth 段。没有改 `CURRENT-PROGRESS.md`。没有改 `evidence/redesign/2026-10-09/R1-012`。学习同意复检没有关。工作区里那些路径上的既有差量不是本卡改的。

## 验证

命令都在对应应用目录里跑。退出码 0。没有失败原文。

```text
cd apps/learner-web && node --test tests/onboarding-resume.test.mjs tests/onboarding-retry.test.mjs tests/c02-learner-profile.test.mjs tests/adult-gate-restricted.test.mjs tests/learner-store-subject-isolation.test.mjs tests/c03-learning-flow.test.mjs
exit 0
tests 20, pass 20, fail 0
duration_ms 817.070917
```

```text
cd apps/learner-web && node --test tests/consent-dynamic-version.test.mjs
exit 0
tests 3, pass 3, fail 0
duration_ms 458.329375
```

```text
cd apps/mobile && node --test tests/onboarding-resume-step.test.mjs tests/onboarding-resume.test.mjs tests/c02-learner-profile.test.mjs tests/mobile-learning-account-scope.test.mjs tests/mobile-gateway-auth-bootstrap.test.mjs tests/c03-learning-flow.test.mjs
exit 0
tests 34, pass 34, fail 0
duration_ms 1475.035125
```

```text
cd apps/mobile && node --test tests/mobile-consent-dynamic-version.test.mjs tests/mobile-settings-devices.test.mjs
exit 0
tests 11, pass 11, fail 0
duration_ms 566.7405
```

这些测试编译续步纯函数，并用假的 HTTP 客户端跑 `readOnboardingResume`：`FOUNDATION` + 15 分钟映射成 `ZERO_BASIS` 且步为定级；404 是可读的空目标；其它读失败不是空目标；门未过不读目标；`REJECTED` 出步为 rejected；必要同意未齐或同意不可读停在同意；`PRODUCT_ANALYTICS` 不挡。页面源码断言不含「3 击」「3 分钟」「已存本机」「目标草稿已保存在本地」，也不含 `placement/sessions`。既有 onboarding 重试、C02、C03、成人门、账号隔离、设备页在同意前可进、同意版本 409 重试，都通过。

没有跑浏览器，没有跑真机，没有对真实 IAM 和 learner 走一遍新号。Vue 页面没有挂载执行。因此引导条跨端收起、原生容器没有 `sessionStorage` 时的收起、以及新号真实剩余步骤走到定级入口，都没有 PASS。
