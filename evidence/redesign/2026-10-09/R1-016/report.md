# R1-016 门说明与同意逐项文案

日期：2026-10-09。分支：`dev-redesign`。Owner：learner-web；Mobile 向导同意步按 R1-011 保持同样三条可见项。依赖：R1-007。
IC：IC-055、IC-056。

状态：向导里的出生年份说明和三条必要同意文案已写入 Web 与 Mobile。**不是 ACCEPTED，也不是 IT-1 出站。** 没有 commit，没有 push。`CURRENT-PROGRESS.md` 未改。没有打开浏览器做可见对稿，所以「文案对稿」这一条**没有 PASS**。

## 文案

两端向导使用同一组句子。

成人门只保留出生年份，不增加月、日或完整生日：

> 只收集出生年份，用来判断是否已满 18 岁。现有成人门不需要月和日，所以不收集完整生日。成人门还没通过时，停在这一步。

拒绝后的出口仍是 R1-007 已有路径：Web 无权限页是「前往账号设置」「帮助与反馈」「退出登录」；Mobile 无权限页是「个人中心与设置」「帮助与反馈」以及原有退出。向导页自己的「退出登录」还在。没有把出口改回「再试一次 / 改年份」。门上的说明是：

> 如果没有通过，仍可前往账号设置、帮助与反馈或退出登录。这里不提供再试一次，也不提供改年份。

同意步可见三项，开始时都不勾选，没有全选：

| 可见名称 | 用途码 | 标记 |
| --- | --- | --- |
| 账号条款 | ACCOUNT_TERMS | 必要 |
| 隐私说明 | PRIVACY_NOTICE | 必要 |
| 成人学习资格 | ADULT_LEARNING_ELIGIBILITY | 必要 |

产品分析和语音录音没有放进这一步。DEC-02 未批，没有新写隐私政策或条款正文，也没有把任何新正文当成已获同意。

已发布版本只读 `GET /iam/principal/me` 的 `consentState.version`。三项用途码都在 `requiredPurposes` 里时，三项显示这一份版本。读不到、版本是空白，或三项用途码不齐，每一项显示「版本未读到」，并写明「已发布版本暂时读不到，这一步先不提交同意」。继续按钮在版本未读到时保持禁用。服务端这份载荷只有一个文档版本，不是三项各自的文档版本；本卡没有改服务端，所以**不能**把「三项各自的已发布版本已分别读到」写成 PASS。

未勾选时的说明是：

> 未勾选时，受影响的是学习资格，不是把账号设置、帮助与反馈和退出登录一起禁掉。

退出登录不随未勾选禁用。没有实现撤回 403，没有改 `PUT /iam/consents` 的签署，没有新增再签。签协议仍走原来的 `recordRequiredConsents`。选步函数 `selectOnboardingResumeStep` 的分支顺序没有改，仍是 rejected、gate、consent、goal、assessment。

## 改动文件

本卡新增或修改：

- `apps/learner-web/src/pages/OnboardingPage.vue`
- `apps/learner-web/src/domain/onboarding-consent-copy.ts`
- `apps/learner-web/tests/adult-consent-copy.test.mjs`
- `apps/mobile/src/pages/onboarding/onboarding.vue`
- `apps/mobile/src/domain/onboarding-consent-copy.ts`
- `apps/mobile/tests/adult-consent-copy.test.mjs`
- `evidence/redesign/2026-10-09/R1-016/report.md`

没有修改 `services/**`、`evidence/redesign/2026-10-09/R1-014/**`、`evidence/redesign/2026-10-09/R1-011/**`、注册页、登录页、重置页，也没有改两端 `onboarding-resume.ts` 的选步顺序。工作区里那些路径上的既有差量不是本卡改的。

## 验证

命令都在对应应用目录里跑。退出码 0。没有失败原文。这是源码句子和现有单测，不是浏览器对稿，也不是干净库回放。

```text
cd apps/learner-web && node --test tests/adult-gate-restricted.test.mjs tests/consent-dynamic-version.test.mjs tests/onboarding-resume.test.mjs tests/onboarding-retry.test.mjs tests/adult-consent-copy.test.mjs
exit 0
tests 17, pass 17, fail 0
duration_ms 1163.683667
```

```text
cd apps/mobile && node --test tests/adult-gate-policy-version.test.mjs tests/mobile-consent-dynamic-version.test.mjs tests/onboarding-resume-step.test.mjs tests/onboarding-resume.test.mjs tests/adult-consent-copy.test.mjs
exit 0
tests 14, pass 14, fail 0
duration_ms 1111.420125
```

## 没有 PASS 的部分

- 没有用浏览器核对可见文案，文案对稿没有 PASS。
- `consentState.version` 是一份学习同意文档版本。三项独立已发布版本没有读到，没有 PASS。
- 签署路径里的旧版本回退没有改，也没有在运行中的网关上核对页面显示的版本与实际 `PUT` 版本一致。
- 撤回 403、再签、DEC-02 正文都不在本卡，没有 PASS。
- 不是 Luna 独立终审，不是 IT-1 出站。
