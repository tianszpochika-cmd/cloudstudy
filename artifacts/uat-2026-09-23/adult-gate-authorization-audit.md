# 成人准入与旧种子资料污染：只读授权审计

2026-09-23。本轮只读源代码、现有测试和本地 MySQL 聚合计数；没有读取令牌、口令、账号明细，没有请求受保护接口，也没有修改业务代码或数据库。下述“可达”是从当前源码与路由推导，尚需隔离测试账户作 HTTP 回归，不能称为已复现的线上越权。

## 范围与当前数据

- 本地有 **104** 个 `learner_service.b25_learner_profile` 的 `age_confirmed/privacy_consent/terms_consent` 均为 true、但 `iam_service.iam_principal` 成人 Gate 非 APPROVED 或无 `adult_verified_at` 的主体。这些 profile 标记来自旧学习世界种子，不能作为 IAM 成人或法律同意事实。
- 对这 **104** 个主体，只读聚合查询发现有当前、带 document/policy digest 的 IAM consent grant 的主体为 **0**。因此在此刻，`learning-service` 中明确要求 `consent_state=GRANTED` 的 JDBC 路径会对他们拒绝；这不证明其他 owner 均安全。
- 全库未通过上述 Gate 条件的主体共 **205**；其中 **2** 个主体有当前 `ADULT_LEARNING`、`PRIVACY_NOTICE`、`TERMS_OF_SERVICE` 的 GRANTED 记录，但它们不在上述 104 个被污染 profile 集合。这个聚合未比较运行时发布政策的全部字段，不能据此断言两人一定拿到 `GRANTED` JWT。
- 原 UAT 的 **101 个 ACTIVE session** 是会话表状态计数，不代表 101 个有效且未过期的 Access Token，更不代表已经访问学习 API。本审计没有读取会话或 Token 明细。

## 已核实的边界

| 边界 | 源码证据 | 判断 |
| --- | --- | --- |
| IAM 新令牌 | `IamProviderBoundaryController.java:605-631,981-996`；`PasswordAccountService.java:35-52` | 未同时满足 IAM Gate 和 required consent 时，`tokenAccount` 从新令牌剔除 `learning.*`、`assessment.*`、`content.*`、非 profile 的 `learner.*`、media/social/commerce/gamification/notification 等能力，**保留** `learner.profile.read/write` 和 IAM self 权限。JWT 同时携带独立评估的 `adult_gate` 与 `consent_state`。 |
| Gateway | `GatewayConfiguration.java:64-80`；`GatewayJwtValidators.java:23-50` | 非公开路径要求签名及标准 JWT 声明有效，但没有全局成人 Gate / consent 判断；业务准入需由 owner PEP 执行。 |
| learner JDBC | `LearnerHttpPrincipals.java:30-52`；`B25LearnerJdbcController.java:41-109,140-213,370-406,527-529` | 仅要求有效 JWT、platform tenant、learner role、**任意非空 permission**。端点没有单独检查 `adult_gate`、`consent_state` 或所需权限。Gateway 已将 `/api/v1/onboarding/daily-tasks/{today,ensure,.../complete}` 映射到此控制器（`GatewayRouteExecutionPolicy.java:504-508`）。因此持正常 pre-gate JWT 的学习者可理论上读写自己的每日任务投影；`ensure` 的 `contentCode/title` 又由请求提供，没有服务端核实发布内容。 |
| learner 另一路 | `LearnerHttpController.java:59-181,184-186`；`LearnerAccessPolicy.java:18-61` | `/api/v1/learner/*` 使用领域策略，要求 GRANTED consent 和操作权限，不能与上面的 B25 JDBC 内部入口混为一谈。 |
| assessment JDBC | `AssessmentHttpPrincipals.java:26-48`；`B25AssessmentJdbcController.java:57-170,380`；`B10AssessmentJdbcController.java:881` | B25/B10 同样只要求 learner role 与任意 permission，不检查 Gate、consent 或 `assessment.*`。Gateway 映射 placement、daily-stream、sessions、attempts（`GatewayRouteExecutionPolicy.java:555-569`）；pre-gate JWT 保留的 profile 权限足以通过入口的通用检查，理论上可创建/读写评测事实。 |
| learning JDBC | `LearningHttpPrincipals.java:26-55`；`B25LearningJdbcController.java:42-100,758-759` | 要求 `consent_state=GRANTED`，但未显式要求 `adult_gate=PASSED` 或端点专属 `learning.*` 权限。IAM `eligibilityClaims` 把 consent 置 GRANTED 的条件是 `consent.accepted()`，与 Gate 独立（`IamProviderBoundaryController.java:981-996`）；`/iam/consents` 接受授权也未先要求 Gate（同文件 `402-437`，`ConsentService.java:81-141`）。目前 104 人无 IAM grant，故当前挡住；若 Gate 前完成 IAM consents，此边界可能放行。 |
| content learner | `ContentHttpController.java:115-126,162-178`；`ContentReadService.java:114-120,149-157` | 学习者目录与正文只要求 verified actor，未要求 `content.read`、Gate 或 consent。Gateway 映射 `/api/v1/content/learner/catalog` 和 `/{contentCode}`（`GatewayRouteExecutionPolicy.java:515-517`）。未过 Gate 的 pre-gate JWT 仍可理论上读取已发布学习内容。公开内容目录是产品公开能力，需与学习者专属接口分开。 |
| media 与其他 owner | `MediaAccessPolicy.java:34-73` 要求媒体权限、media consent、rights；`GamificationPrincipalResolver.java:34-57`、`SocialPep.java:37-63`、`NotificationReadJdbcController.java:61` 要求各自权限；IAM 会从新 pre-gate token 剥除这些权限 | 对正常**新签发** pre-gate JWT，看到的这些入口有拒绝条件；未逐一覆盖所有路由、旧 Token 或运行时配置。 |

## 客户端显示风险

- Web/Mobile 登录态导航依据 IAM 会话的 `adultGate`，如 `apps/learner-web/src/router/index.ts:248-254`、`apps/mobile/src/stores/session.ts:62`、`apps/mobile/src/auth/navigation.ts:69-84`。这能遮住普通入口，但不是 API 授权边界。
- 两端 onboarding 会从 learner profile 预填 `ageConfirmed/privacyConsent/termsConsent`（Web `OnboardingPage.vue:31-40`，Mobile `onboarding.vue:50-56`）。Mobile 个人页直接把污染的 `store.account.ageConfirmed` 显示为“年龄确认：已确认”（`profile.vue:55`）；这会向人工验收者/用户错误表达 IAM 核验已完成。`learner-content` API 映射层也直接信任这三个 profile 布尔值（Web `api/learner-content.ts:134-136`，Mobile `api/learner-content.ts:78-81,99-102`）。两端下一步仍调用 IAM Gate，但预勾选不应代表当次真实同意。

## 精确修复与验收建议

1. 在 learner B25、assessment B25/B10、learning B25、content learner 服务侧加入一致的 `adult_gate=PASSED` 与所需 IAM consent 检查；每个写/读入口校验自身 `requiredPermission`，保留 profile/成人确认前所需的明确例外。不要仅把拦截放到 Gateway 或前端。
2. IAM 令牌签发让学习用 `consent_state=GRANTED` 与 Gate 决策一致，避免出现 `adult_gate=NOT_EVALUATED` 且 `consent_state=GRANTED` 的学习令牌；保留 consent 独立事实以便法律审计。
3. `learner-service` 的年龄/隐私/条款 profile 列只作用户填写草稿，不得用于展示“已核验/已同意”或授权。Web/Mobile 展示 IAM Gate 与当前发布版本 consent 状态；加载旧 profile 时清除预勾选，要求用户主动确认。
4. 为各 owner 加少量边界测试：同一签名 JWT 保留 `learner.profile.read`、但 `adult_gate=NOT_EVALUATED`、`consent_state=UNKNOWN` 时，普通学习/评测/内容接口为 403；仅允许明确列出的 pre-gate 自助操作。另测 `consent_state=GRANTED` 但 Gate 未过、Gate 已过但 consent UNKNOWN、缺少端点权限、旧 Access Token 的处理。
5. 运行回归使用专用合成测试主体，只记录状态码和无敏感聚合；不得拿 104 个真实/历史主体的账号、Token 做自动请求。当前缺少这组 HTTP 运行证据，不能把静态推导升格为线上已利用结论。

这是一轮针对成人准入的安全/功能专项审计，并非四端全量验收通过证明。
