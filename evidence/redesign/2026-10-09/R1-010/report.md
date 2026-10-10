# R1-010 BC-010/BC-202 画像目标与每日时长落库

日期：2026-10-09。分支：`dev-redesign`。Owner：learner-service。依赖：R1-008。
状态：本卡范围内的落库、读回、回放和冲突已跑通。**不是 ACCEPTED，也不是 IT-1 出站。** 没有 commit，没有 push。`CURRENT-PROGRESS.md` 与 `CURRENT-HANDOFF.md` 未改。

## 范围

已确认的目标和每日时长走现有 `PUT /api/v1/learner/targets`，写入 V1 表 `learner_goal`（同时写 `learner_profile.onboarding_state`）。`GET /api/v1/learner/targets` 把已保存行读回。没有目标时返回 404，不插入空行。

对外 `goalCode` 仍是 `FOUNDATION|COLLEGE_CET|POSTGRADUATE_ENGLISH|WORKPLACE_DAILY`。库内 `goal_type` 继续用 V11 已有检查约束里的历史值：`COLLEGE_CET` 落成 `CET_4_6`。这不是新枚举。响应里的规范码是 `COLLEGE_CET`。

`B9LearnerTarget` 要求 `targetVersion` 与 `stateVersion` 相等。原先响应只有 `stateVersion`。本卡在 `LearnerHttpController.TargetData` 补上 `targetVersion`，并在构造时拒绝两者不一致。没有改 B9 枚举，没有改 first-day 去暴露 `nextAction`，没有加标签列或每日提醒，没有做本机草稿，没有改 B25 写口，没有改 `/onboarding/options`。

学习同意复检没有关。干净库 PUT 成功发生在复检显式为 true、IAM 学习同意事实可读的剖面上。登记后、成人门和必要同意完成前，同一目标口返回 403 `CONSENT_REQUIRED`，并且 `learner_goal` 仍是 0 行。

## 改动文件

本卡新增或修改：

- `services/learner-service/src/main/java/com/englishflow/learner/web/LearnerHttpController.java`（响应补 `targetVersion`，且必须等于 `stateVersion`）
- `services/learner-service/src/test/java/com/englishflow/learner/web/LearnerTargetPersistenceTest.java`
- `evidence/redesign/2026-10-09/R1-010/probe.mjs`
- `evidence/redesign/2026-10-09/R1-010/run.mjs`
- `evidence/redesign/2026-10-09/R1-010/http-result.json`
- `evidence/redesign/2026-10-09/R1-010/sql.txt`

没有修改 `apps/learner-web/**`、`apps/mobile/**`、`packages/i18n/**`、`tests/b23/**`、`evidence/redesign/2026-10-09/R1-009/**`，也没有修改同意复检相关的 `LearnerHttpConfiguration`、`IamLearningConsentRecheck`、`LearningConsentRecheck`、`LearningConsentRecheckTest`、`application.yml` 的 consent-recheck 段、`ConsentRecheckProperties`、IAM 撤回控制器或 `ConsentService`。工作区里那些文件的既有差量不是本卡改的。

## 单元测试

```text
mvn -f services/learner-service/pom.xml test
exit 0
Tests run: 91, Failures: 0, Errors: 0, Skipped: 1
BUILD SUCCESS
Total time:  3.525 s
Finished at: 2026-10-09T22:07:33+08:00
```

其中 `LearnerTargetPersistenceTest` tests=3 failures=0：无目标 GET 404 且内存库无行；`COLLEGE_CET`/30 分钟落成 `DRAFT` + 内部 `CET_4_6`，读回规范码、分钟和版本 1，`targetVersion=stateVersion`；同键同体回放且 outbox 仍为 1；同键异体 `IDEMPOTENCY_CONFLICT` 映射 409；过期 `expectedStateVersion` 为 `CONCURRENT_UPDATE` 映射 409；缺分钟、`LANGUAGE_CERT`、60 分钟都不落库。

唯一 skipped 仍是既有 `LearnerFlywayMigrationTest`（未设置 `learner.migration.integration`）。没有失败原文。

## 干净库 HTTP

只使用 `yuxuexing-local-mysql-1`（`mysql:8.0`，compose project `yuxuexing-local`，service `mysql`，`127.0.0.1:13306`，healthy）。没有 `docker compose down`，没有 prune，没有碰名称含 qida 的容器。端口保持 IAM 18087、learner 18088。启动前这两个端口无监听。

命令：

```text
node evidence/redesign/2026-10-09/R1-010/run.mjs
exit 0
```

专库在断言后已删除。结束时 `schema_name LIKE 'r1_010%'` 与 `user LIKE 'r1_010%'` 都是 0，18087/18088 无监听。本轮启动的两个 Java 进程已退出。

运行约束：IAM `spring.profiles.active=local`，`iam.consent.policy-source=local-candidate`，`iam.local-adult-gate-enabled=true`，persistence+flyway，`v13-writers-drained=true`，自签 TLS 只绑 `127.0.0.1:18087`，issuer 仍是 `http://127.0.0.1:18087`。learner JDBC+flyway，`LEARNER_SCHEMA` 指向专库，JWKS `https://127.0.0.1:18087/api/v1/auth/jwks`，信任这次自签证书。`learner.consent-recheck.enabled=true`，没有设置 `LEARNER_CONSENT_RECHECK_ENABLED=false`。learner 用服务令牌读 IAM 当前学习同意；这次 PUT 能 200，说明当时 IAM 返回了通过的学习同意，而不是把复检关掉。

Flyway：IAM `17,0`；learner `12,0,12`。

原文（失败列表长度 0，25 条事件）：

```text
MYSQL_IDENTITY {"name":"/yuxuexing-local-mysql-1","image":"mysql:8.0","project":"yuxuexing-local","service":"mysql","status":"running","health":"healthy","port":[{"HostIp":"127.0.0.1","HostPort":"13306"}]}
PORTS_FREE
PARTIAL_REVOKES=0
SCHEMA_CREATED r1_010_iam_20261009_dfd353d3ff81 r1_010_lrn_20261009_dfd353d3ff81 r1_010_dfd353d3ff81
CONSENT_RECHECK_EXPLICIT_TRUE
IAM_HEALTH_OK
LEARNER_HEALTH_OK
FLYWAY iam=17,0 learner=12,0,12
register 201 "has-data"
before-grant.put 403 "CONSENT_REQUIRED"
sql.before-grant  {"goals":0,"profiles":0,"b25":0,"idempotency":0,"outbox":0}
adult 200 "PASSED"
accept.TERMS 200 "ACCEPTED"
accept.PRIVACY 200 "ACCEPTED"
accept.ADULT_LEARNING 200 "ACCEPTED"
accept.PRODUCT_ANALYTICS 200 "ACCEPTED"
login 200 "has-data"
claims  {"consent_state":"GRANTED","adult_gate":"PASSED","token_type":"access","sub":"fc080ce6-afa3-4c3e-8770-ce9b871a95a6"}
get.missing 404 ""
sql.after-missing-get  {"goals":0,"profiles":0,"b25":0,"idempotency":0,"outbox":0}
put.partial 400 "INVALID_PROFILE"
sql.after-partial  {"goals":0,"profiles":0,"b25":0,"idempotency":0,"outbox":0}
put.saved 200 {"goalCode":"COLLEGE_CET","dailyQuotaMinutes":30,"targetLevel":"B1","stateVersion":1,"targetVersion":1,"targetId":1001,"replayed":false}
sql.row  "DRAFT\t1\tCET_4_6\t30\tB1\t1001\t1"
sql.after-put  {"goals":1,"profiles":1,"b25":0,"idempotency":1,"outbox":1}
get.readback 200 {"goalCode":"COLLEGE_CET","dailyQuotaMinutes":30,"stateVersion":1,"targetVersion":1,"targetId":1001}
put.replay 200 {"goalCode":"COLLEGE_CET","dailyQuotaMinutes":30,"stateVersion":1,"targetVersion":1,"targetId":1001,"replayed":true}
put.conflict 409 "IDEMPOTENCY_CONFLICT"
put.stale 409 "CONCURRENT_UPDATE"
sql.after-conflict  {"goals":1,"profiles":1,"b25":0,"idempotency":1,"outbox":1}
sql.row-after  "DRAFT\t1\tCET_4_6\t30\tB1\t1001\t1"
get.after-conflict 200 "COLLEGE_CET"
get.first-day 200 {"state":"NOT_READY","hasNextAction":false}
HTTP_ASSERTIONS_OK
PROBE_EXIT 0
RUN_DONE
CLEANUP_LEFT schemas=0 users=0
PORTS_FREE_AFTER
```

`sql.row` 列顺序是 `onboarding_state`、`profile_version`、`goal_type`、`daily_study_minutes`、`starting_level`、`target_id`、该主体 `learner_goal` 行数。缺 `dailyQuotaMinutes` 的 PUT 是 400，没有造行。`b25_learner_goal` 全程 0。first-day 这次响应没有 `nextAction` 字段。

结构化收据：`http-result.json`、`sql.txt`。没有失败原文。

## 未验证项

- 没有把 learner 进程停掉再启动后做第二次读回。已验证的是同一进程里 PUT 之后的 GET，以及当时 MySQL 行。
- 契约把 `If-Match` 标成必填，且要求它与 `expectedStateVersion` 精确一致。现有适配器和 learner-web 都不发送这个头。本卡没有新增头校验，运行断言也没有覆盖错误 `If-Match`。版本冲突覆盖的是请求体 `expectedStateVersion`。
- `LearnerFlywayMigrationTest` 仍跳过。这次专库实际执行了 learner V1–V12，12 个版本、0 失败，但不能代替那个被跳过的测试类。
- 续上只验证了服务端已确认的目标、级别和每日时长。没有做本机草稿，也没有做切号。DEC-05 的本机持久草稿仍未实现，本卡不把它写成已完成。
- 登记后的 403 来自当时令牌尚未 `GRANTED`（`CONSENT_REQUIRED`）。复检活路径的证据是：复检保持开启，且带 `GRANTED` 声明的登录令牌在 IAM 可答时 PUT 为 200。没有另做一次 IAM 不可达时的 403。
- 没有签收，没有出站。
