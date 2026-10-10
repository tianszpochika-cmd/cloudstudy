# R1-009 BC-009 同意撤回与能力回收

日期：2026-10-09。分支：`dev-redesign`。Owner：iam-service。依赖：R1-008。
状态：实现与本卡测试已完成，**可以提交审查**。本报告不把本卡标成 ACCEPTED，也不做出站 IT-1。`CURRENT-PROGRESS.md` 与 `CHANGELOG` 未改。

进度页上的「画像首步」描述与卡计划不符。本卡按 `docs/06-design/v2-980plus/redesign/dev-plan-R1.md` 的 R1-009 与 `business-chains.md` 的 BC-009 实现：撤回有回执；相关学习能力按既有契约返回 403；影响列在回执里；历史按追加事实保留；撤回不等于删除账号。

## 范围

公开撤回入口仍是 `PUT /api/v1/iam/consents`，`decision=WITHDRAWN`，实现类 `IamAuthenticationController`（文件 `IamProviderBoundaryController.java`）。`ConsentService.withdraw` 继续通过既有 store 追加新事实，当前表只做投影，历史行保留。本卡没有调用账号删除，也没有改 `IamAccountDeletionController`。

会话是否撤销继续跟该同意类型已有的 `revokeSessions`：`TERMS` / `PRIVACY` / `ADULT_LEARNING` 为真，撤回后既有策略撤销该主体会话；`PRODUCT_ANALYTICS` 与 `VOICE_RECORDING` 为假，会话保持。账号效果与历史效果固定为 `RETAINED`。

学习能力回收发生在 learner-service，并且生产默认开启。`application.yml` 是 `learner.consent-recheck.enabled: ${LEARNER_CONSENT_RECHECK_ENABLED:true}`。属性缺失时 `LearnerHttpConfiguration` 仍创建复检（`matchIfMissing = true`）。只有显式 `LEARNER_CONSENT_RECHECK_ENABLED=false` 才关闭。已签发且声明仍为 `GRANTED` 的 access token 再访问学习读写口时，learner 用服务令牌读 `GET /internal/v1/iam/principals/{principalId}/learning-consent`。事实只来自 `ConsentService.hasRequiredConsentFor(principal, "LEARNING")`。查不到、非 200、异常一律视为未授权，返回 403。

回执使用既有 `B8Consent.withdrawalEffect`。`effect`、`appliesAt`、`cacheInvalidationRequired` 仍是必填。新增可选字段：`affectedCapabilities`、`sessionEffect`、`accountEffect`、`historyEffect`。实现在撤回响应里总是带上这四项。`affectedCapabilities` 由 `ConsentService.capabilitiesRestrictedBy` 从既有必需集合算出：`ADULT_LEARNING` 只有 `LEARNING`；`PRODUCT_ANALYTICS` 为空；`VOICE_RECORDING` 为四个 `VOICE_REMOTE_*`；`TERMS` / `PRIVACY` 覆盖 `ACCOUNT`、`LEARNING`、`ANALYTICS` 与四个语音能力。这是同意事实清单。本卡没有因此去关 IAM 账号设置、设备、会话管理或支持工单的 HTTP 口。

内部学习同意 200 响应补了 `B8LearningConsentFact`：`principalId`、`learningConsent`（`GRANTED|WITHDRAWN`）、`learningAccess`（`ELIGIBLE|RESTRICTED`）。

## 能力边界

learner 学习口（公开 `/api/v1/learner` 的画像/目标/偏好/首日/首页，以及 JDBC 模式 `/internal/v1/learner` 的画像、目标、引导、每日任务、目标 pin）在复检打开且事实已撤回时返回 403。公开口的错误码是既有 `CONSENT_REQUIRED`。B25 JDBC 口的 403 来自 `ResponseStatusException`，正文是框架的 Forbidden，状态码是 403。

B25 隐私导出（`/internal/v1/learner/privacy/export`）继续只看 token 自己的 `adult_gate=PASSED` 与 `consent_state=GRANTED`，不走实时复检。撤回后、旧 token 未过期时，这次运行里导出仍返回 200 `QUEUED`。

账号设置在 IAM（`/api/v1/iam/principal/me`、设备、会话）。支持工单不在 learner-service。这两个边界都没有改对应服务。`ADULT_LEARNING` 撤回会按既有 `revokeSessions` 把该主体会话标成 `REVOKED`，所以旧 token 再读 `principal/me` 得到 401 `iam.session.revoked`。同一时刻账号行仍是 `ACTIVE`，`iam_account_deletion` 计数为 0。另一个未撤回主体的 `principal/me` 仍是 200 `ACTIVE`。

## 改动文件

本卡代码与契约（含本卡开始前已在工作区、本次接续完成的部分）：

- `packages/contracts/fragments/b8/b8-auth-iam.openapi.json`
- `packages/contracts/openapi/v1/openapi.json`
- `packages/contracts/generated/openapi.ts`
- `packages/api-client/src/generated/index.ts`
- `services/iam-service/src/main/java/com/englishflow/iam/domain/ConsentService.java`
- `services/iam-service/src/main/java/com/englishflow/iam/web/IamProviderBoundaryController.java`
- `services/iam-service/src/main/java/com/englishflow/iam/web/IamLearningConsentController.java`（未跟踪）
- `services/iam-service/src/test/java/com/englishflow/iam/web/IamLearningConsentControllerTest.java`（未跟踪）
- `services/iam-service/src/main/resources/application.yaml`（learner-service 客户端权限含 `iam.consent.read`）
- `services/learner-service/src/main/java/com/englishflow/learner/config/LearnerServiceProperties.java`
- `services/learner-service/src/main/java/com/englishflow/learner/web/LearnerHttpConfiguration.java`
- `services/learner-service/src/main/java/com/englishflow/learner/web/LearnerHttpPrincipals.java`
- `services/learner-service/src/main/java/com/englishflow/learner/web/VerifiedLearnerPrincipalFactory.java`
- `services/learner-service/src/main/java/com/englishflow/learner/web/B25LearnerJdbcController.java`
- `services/learner-service/src/main/java/com/englishflow/learner/web/TargetPinController.java`
- `services/learner-service/src/main/java/com/englishflow/learner/web/LearningConsentRecheck.java`（未跟踪）
- `services/learner-service/src/main/java/com/englishflow/learner/web/IamLearningConsentRecheck.java`（未跟踪）
- `services/learner-service/src/main/resources/application.yml`
- `services/learner-service/src/test/java/com/englishflow/learner/web/B25LearnerJdbcAuthorizationTest.java`
- `services/learner-service/src/test/java/com/englishflow/learner/web/LearningConsentRecheckTest.java`（未跟踪）

工作区里下列文档差量是交接要求保留的原样，本卡没有改它们：

- `docs/06-design/v2-980plus/redesign/mockups/mobile/evidence/README.md`
- `docs/06-design/v2-980plus/redesign/mockups/mobile/README.md`
- `docs/06-design/v2-980plus/redesign/mockups/mobile/evidence/independent-r14/README.md`

未改旧 canonical manifest 的历史结论、P1R 状态、冻结契约的 required 数组、`CURRENT-PROGRESS.md`、生命周期脚本 `scripts/redesign/r1-iam-lifecycle/`。没有 git commit，没有 git push。

## 单元测试

命令与退出码（`-q` 不打印 Surefire 汇总横幅；计数来自刚生成的 `TEST-*.xml`）：

IAM Java 这次没有再改，沿用上一轮全量结果，没有重跑：

```text
mvn -f services/iam-service/pom.xml test -q
exit 0
surefire: 25 files, tests=140, failures=0, errors=0, skipped=22
IamLearningConsentControllerTest tests=4 failures=0 errors=0 skipped=0
```

默认改为开启后重跑 learner：

```text
mvn -f services/learner-service/pom.xml test
Tests run: 88, Failures: 0, Errors: 0, Skipped: 1
BUILD SUCCESS
Total time:  4.871 s
Finished at: 2026-10-09T21:56:58+08:00
```

其中 `LearningConsentRecheckTest` tests=8（含 `shippedConfigRechecksLearningConsentUnlessExplicitlyDisabled`，断言出厂 yml 默认是 `${LEARNER_CONSENT_RECHECK_ENABLED:true}`，且未绑定的 `ConsentRecheckProperties.enabled` 为 true）。`B25LearnerJdbcAuthorizationTest` tests=6 failures=0。唯一 skipped 仍是既有的 `LearnerFlywayMigrationTest`。没有为了让旧测试变绿而把生产默认改回 false。learner 测试不启动 Spring 上下文，也没有去连真实 IAM。

IAM 日志里的 `HttpMediaTypeNotSupportedException` 来自既有 `IdempotencyCredentialReplayControllerTest.unsupportedMediaTypeOnAPublicRequestIsAClientError`，该模块退出码仍是 0。22 个 IAM skipped 与 1 个 learner skipped（`LearnerFlywayMigrationTest`）是既有的无库跳过，不是本卡失败。

契约：

```text
node scripts/contracts/merge-b1-fragments.mjs
Contract fragment merge checked: 28 OpenAPI fragments, 20 event fragments, 434 routes, 192 events, 51 AsyncAPI channels, 187 AsyncAPI operations.
exit 0

node scripts/contracts/generate-contracts.mjs --check
Contract generation checked: 5 generated files.
exit 0
```

## 干净库运行

只使用本项目容器 `yuxuexing-local-mysql-1`（`mysql:8.0`，compose project `yuxuexing-local`，service `mysql`，`127.0.0.1:13306`，healthy）。没有 `docker compose down`，没有 prune，没有停止或修改名称含 qida 的容器。端口保持 IAM 18087、learner 18088。

打包：`mvn -o -DskipTests -f services/iam-service/pom.xml package` 与 learner 同样命令，均 exit 0。

专库（跑完已删除，事后 `schema_name LIKE 'r1_009%'` 与 `user LIKE 'r1_009%'` 均为空）：

- schema `r1_009_iam_20261009_8cec75b05cab`
- schema `r1_009_lrn_20261009_8cec75b05cab`
- user `r1_009_8cec75b05cab`

IAM：`spring.profiles.active=local`，`iam.consent.policy-source=local-candidate`，`iam.local-adult-gate-enabled=true`，persistence+flyway，`v13-writers-drained=true`，自签 TLS 只绑 `127.0.0.1:18087`，issuer 仍是 `http://127.0.0.1:18087`。learner：JDBC+flyway，当时显式 `LEARNER_CONSENT_RECHECK_ENABLED=true`（现已与生产默认相同），复检基址 `https://127.0.0.1:18087`，JWKS `https://127.0.0.1:18087/api/v1/auth/jwks`，信任这次自签证书。两个 Java 进程在断言之后已退出，18087/18088 无监听。这次只改默认开关和配置断言，撤回与复检逻辑未改，因此没有重跑整库。

运行原文（`bash /tmp/r1-009-runtime/run.sh`，exit 0）：

```text
MYSQL_IDENTITY {"name":"/yuxuexing-local-mysql-1","image":"mysql:8.0","project":"yuxuexing-local","service":"mysql","status":"running","health":"healthy"}
MYSQL_IDENTITY_OK
PORTS_FREE
PARTIAL_REVOKES=0
SCHEMA_CREATED r1_009_iam_20261009_8cec75b05cab r1_009_lrn_20261009_8cec75b05cab r1_009_8cec75b05cab
IAM_HEALTH_OK
LEARNER_HEALTH_OK
primary.register 201
primary.adult 200 {"status":"PASSED","learningAccess":"ELIGIBLE",...}
primary.accept.TERMS 200 ACCEPTED
primary.accept.PRIVACY 200 ACCEPTED
primary.accept.ADULT_LEARNING 200 ACCEPTED
primary.accept.PRODUCT_ANALYTICS 200 ACCEPTED
primary.login 200
primary.claims consent_state=GRANTED adult_gate=PASSED token_type=access sub=cb0d7727-c7fa-4361-9652-4b4c1bc9fb8e
before.public-profile 200
before.b25-options 200
before.b25-profile 200
before.b25-targets 200
before.privacy-export 200 QUEUED
before.principal-me 200 ACTIVE
withdraw.analytics 200 effect=RESTRICT_PROTECTED_CAPABILITY affectedCapabilities=[] sessionEffect=UNCHANGED accountEffect=RETAINED historyEffect=RETAINED
after-analytics.public-profile 200
after-analytics.b25-options 200
after-analytics.b25-profile 200
after-analytics.b25-targets 200
withdraw.adult 200 effect=RESTRICT_ALL_LEARNING_ACCESS affectedCapabilities=["LEARNING"] sessionEffect=REVOKE_ALL_SESSIONS accountEffect=RETAINED historyEffect=RETAINED cacheInvalidationRequired=true
after-adult.public-profile 403 CONSENT_REQUIRED
after-adult.b25-options 403 Forbidden
after-adult.b25-profile 403 Forbidden
after-adult.b25-targets 403 Forbidden
after.privacy-export 200 QUEUED
after.principal-me 401 errorCode=AUTH_REFRESH_TOKEN_REVOKED message=iam.session.revoked
fact.user-token 403
fact.service-token 200 ["iam.consent.read"]
fact.after-withdraw 200 learningConsent=WITHDRAWN learningAccess=RESTRICTED principalId=cb0d7727-c7fa-4361-9652-4b4c1bc9fb8e
second.before-iam-stop 200
second.principal-me 200 ACTIVE
HTTP_ASSERTIONS_OK
SQL_FACTS
account ACTIVE
principal ACTIVE
deletion 0
ADULT_LEARNING GRANTED open
ADULT_LEARNING WITHDRAWN revoked
PRIVACY_NOTICE GRANTED open
PRODUCT_ANALYTICS GRANTED open
PRODUCT_ANALYTICS WITHDRAWN revoked
TERMS_OF_SERVICE GRANTED open
sessions REVOKED 2
second_account ACTIVE
UNREACHABLE_PROFILE_STATUS 403
UNREACHABLE_BODY {"error":{"message":"learner operation denied: CONSENT_REQUIRED","code":"CONSENT_REQUIRED","retryable":false}}
RUN_DONE node=0
CLEANUP_SCHEMA_DONE
```

结构化收据：`http-result.json`（failures 长度 0，39 条事件）、`sql.txt`、`probe.mjs`。

## 未验证项与开放缺口

- 生产默认已是复检开启。显式 `LEARNER_CONSENT_RECHECK_ENABLED=false` 仍会退回只信 token 声明；那是运维关闭，不是出厂行为。
- B25 学习口 403 的正文是 Forbidden，公开 `/api/v1/learner` 才是 `CONSENT_REQUIRED`。两边状态码都是 403。
- `TERMS` / `PRIVACY` 的回执会列出 `ACCOUNT` 等能力名，因为既有必需集合包含这些文档。本卡没有给 IAM 账号 HTTP 或支持服务加新的 403。
- 支持服务、设备列表、会话列表没有在这次运行里逐个打。账号边界用 `principal/me`、账号行 `ACTIVE`、删除表计数 0 说明。
- 这次运行使用 local-candidate 同意文档和本地成人门，只证明该剖面下的撤回与复检。控制面已发布文档的同一路径没有再跑一遍。
- 没有更新 `CHANGELOG`。没有签收。

## 建议进度页下一行（由审核者决定，本卡未写入 CURRENT-PROGRESS）

`R1-009` BC-009 同意撤回与能力回收：learner 复检生产默认开启，IAM 不可达时学习口 403；撤回回执含影响列表，账号与历史保留。实现完成，待审查，未 ACCEPTED，未出站 IT-1。
