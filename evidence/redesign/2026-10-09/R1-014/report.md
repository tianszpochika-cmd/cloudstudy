# R1-014 001…013 同一专库回放

日期：2026-10-09。分支：`dev-redesign`。Owner：QA。依赖：R1-001…013。
本报告不标 ACCEPTED，也不写 IT-1 已出站。015…017 不在这张卡里。没有 commit，没有 push。`CURRENT-PROGRESS.md` 未改。没有改 IAM/learner 业务 Java，没有改 `apps/learner-web/**`、`apps/mobile/**`、`packages/i18n/**`，也没有改 `evidence/redesign/2026-10-09/R1-011/**`。

## 结论

同一只空库上的后端断言 **21/21 PASS**，`node evidence/redesign/2026-10-09/R1-014/run.mjs` 退出码 **0**。这只覆盖这次实际打到的后端链。

不能把 001…013 汇总成全绿：

- R1-001 的 11 个公开页这次没有对已启动的官网做 HTTP。`127.0.0.1:18182` 无监听，本回放没有启动官网。
- R1-007 只重跑了 learner-web 已有单测。Mobile 没有单独重跑。
- R1-011 仍在改向导。本回放没有跑它，也没有把它写成 PASS。已有报告写明新号按真实剩余步骤走到定级入口没有 PASS。

没有 FAIL 项。未验证项不记成 PASS。

## 库与进程

只使用 `yuxuexing-local-mysql-1`（`mysql:8.0`，compose project `yuxuexing-local`，service `mysql`，`127.0.0.1:13306`，healthy）。没有 `docker compose down`，没有 prune，没有碰名称含 qida 的容器。端口沿用 IAM 18087、learner 18088。开跑前这两个端口无监听。

专库从空库创建，由服务自己的 Flyway 播种，没有另跑内容种子。IAM `17,0`，learner `12,0`。开跑时 `iam_account=0`、`learner_goal=0`。

- schema `r1_014_iam_20261009_bde32c82b018`
- schema `r1_014_lrn_20261009_bde32c82b018`
- user `r1_014_bde32c82b018`

学习同意复检保持开启：子进程环境没有 `LEARNER_CONSENT_RECHECK_ENABLED`，运行配置写的是 `learner.consent-recheck.enabled=true`，没有设成 false。IAM 为 `local`、`iam.consent.policy-source=local-candidate`、`iam.local-adult-gate-enabled=true`、persistence+flyway、`v13-writers-drained=true`，自签 TLS 只绑 `127.0.0.1:18087`。learner 为 JDBC+flyway，JWKS 指向这次 IAM。

打包使用当时工作区源码，只为得到可运行 jar，没有改 Java：

```text
mvn -o -DskipTests -f services/iam-service/pom.xml package
exit 0

mvn -o -DskipTests -f services/learner-service/pom.xml package
exit 0
```

回放命令与原文（失败列表长度 0）：

```text
node evidence/redesign/2026-10-09/R1-014/run.mjs
exit 0
PARENT_CONSENT_RECHECK_ENV_UNSET
MYSQL_IDENTITY {"name":"/yuxuexing-local-mysql-1","image":"mysql:8.0","project":"yuxuexing-local","service":"mysql","status":"running","health":"healthy","port":[{"HostIp":"127.0.0.1","HostPort":"13306"}]}
PORTS_FREE
PARTIAL_REVOKES=0
SCHEMA_CREATED r1_014_iam_20261009_bde32c82b018 r1_014_lrn_20261009_bde32c82b018 r1_014_bde32c82b018
CONSENT_RECHECK_EXPLICIT_TRUE
IAM_HEALTH_OK
LEARNER_HEALTH_OK
PASS seed.flyway status=200 {"iamAccounts":0,"learnerGoals":0,"iamFlyway":"17,0","learnerFlyway":"12,0"}
PASS register.201-no-learning status=201 {"adult_gate":"NOT_EVALUATED","consent_state":"UNKNOWN","permissionCount":4,"learningPermissionCount":0,"permissions":["iam.self.read","iam.self.write","learner.profile.read","learner.profile.write"]}
PASS register.replay-same-result status=201 {"firstStatus":201,"sessionSame":true,"deviceSame":true,"accounts":1}
PASS login status=200
PASS refresh status=200 {"rotated":true}
PASS revoke status=200 {"logoutStatus":200,"meAfterStatus":401,"session":"REVOKED","error":"AUTH_REFRESH_TOKEN_REVOKED"}
PASS adult-gate.passed status=200 {"gateStatus":"PASSED","learningAccess":"ELIGIBLE"}
PASS adult-gate.rejected status=200 {"gateStatus":"REJECTED","learningAccess":"RESTRICTED"}
PASS adult-gate.rejected-retry-still-rejected status=200 {"gateStatus":"REJECTED","learningAccess":"RESTRICTED","retryAllowed":false,"session":"ACTIVE"}
PASS consents.three-accepted status=200,200,200
PASS consents.relogin status=200 {"adult_gate":"PASSED","consent_state":"GRANTED"}
PASS targets.missing-404 status=404 {"goalRows":0}
PASS targets.put-learner-goal status=200 {"goalCode":"COLLEGE_CET","dailyQuotaMinutes":30,"sql":"CET_4_6\t30\tB1","goalRows":1}
PASS targets.get-readback status=200 {"goalCode":"COLLEGE_CET","dailyQuotaMinutes":30,"targetLevel":"B1","stateVersion":1,"targetVersion":1}
PASS withdraw.adult-learning-403 status=200 {"withdrawDecision":"WITHDRAWN","profileStatus":403,"profileError":"CONSENT_REQUIRED","targetsStatus":403,"targetsError":"CONSENT_REQUIRED"}
PASS withdraw.account-active status=none {"accountStatus":"ACTIVE"}
PASS password-reset.known status=202 {"accepted":true}
PASS password-reset.unknown status=202 {"accepted":true}
PASS password-reset.body-equal status=202/202 {"equal":true}
PASS password-reset.blank-400 status=400,400,400
PASS devices.kick-401 status=200 {"loginA":200,"loginB":200,"listStatus":200,"currentCount":1,"currentIsA":true,"kickStatus":200,"kickedMe":401,"callerMe":200,"sessionA":"ACTIVE","sessionB":"REVOKED"}
PROBE_SUMMARY pass=21 fail=0
PROBE_EXIT 0
RUN_DONE
CLEANUP_LEFT schemas=0 users=0
PORTS_FREE_AFTER
```

结束后再次读库：`schema_name LIKE 'r1_014%'` 为 0，`user LIKE 'r1_014%'` 为 0。18087/18088 无监听。本轮启动的 Java 进程已不在。本轮临时运行目录已删。结构化收据是 `http-result.json`。

同意齐全后的目标写入放在撤回之前，仍是同一个 PASSED 主体、同一个库。撤回之后学习口必须是 403，不能再当作「同意齐全」去写目标。

## 逐步结果

| 步骤 | 状态码 | 结果 |
|---|---|---|
| 空库 Flyway 种子 | IAM 17 成功 / 0 失败；learner 12 成功 / 0 失败；账号 0、目标 0 | PASS |
| 注册，令牌没有学习资格 | 201。`adult_gate=NOT_EVALUATED`，`consent_state=UNKNOWN`，4 项基础权限，学习权限 0 | PASS |
| 同键注册回放 | 201。sessionId 与 deviceId 与第一次相同，账号仍为 1 | PASS |
| 登录 | 200 | PASS |
| 刷新 | 200。新 refresh cookie 与旧 cookie 不同 | PASS |
| 撤销 | 登出 200；原 access 再读 `/api/v1/iam/principal/me` 为 401 `AUTH_REFRESH_TOKEN_REVOKED`；会话 `REVOKED` | PASS |
| 成人门 PASSED | 200 `PASSED` / `ELIGIBLE` | PASS |
| 成人门 REJECTED | 200 `REJECTED` / `RESTRICTED` | PASS |
| REJECTED 后换键，成年年份 | 200 仍 `REJECTED` / `RESTRICTED`，`retryAllowed=false`；原会话 `ACTIVE` | PASS |
| 三同意 TERMS / PRIVACY / ADULT_LEARNING | 200 / 200 / 200，均为 `ACCEPTED` | PASS |
| 同意后再登录 | 200。令牌 `adult_gate=PASSED`，`consent_state=GRANTED` | PASS |
| 无目标 GET `/api/v1/learner/targets` | 404。`learner_goal` 0 行 | PASS |
| PUT `/api/v1/learner/targets` | 200。`COLLEGE_CET` / 30 分钟。库内 `CET_4_6`、30、`B1`，1 行 | PASS |
| GET 读回 | 200。`COLLEGE_CET` / 30 / `B1`，`stateVersion=1`，`targetVersion=1` | PASS |
| 撤回 ADULT_LEARNING 后学习口 | 撤回 200 `WITHDRAWN`。`GET /api/v1/learner/profile` 403 `CONSENT_REQUIRED`。`GET /api/v1/learner/targets` 403 `CONSENT_REQUIRED` | PASS |
| 撤回后账号 | SQL `iam_account.status=ACTIVE`。这一项没有新的 HTTP 状态码 | PASS |
| 有账号的密码重置 | 202，`data.accepted=true` | PASS |
| 无账号的密码重置 | 202，`data.accepted=true` | PASS |
| 两边响应体 | 去掉逐次的 `requestId`、`traceId`、`serverTime` 后一致。两边都是 `data.accepted=true`，`meta.apiVersion=v1`，`meta.schemaVersion=1.0.0` | PASS |
| 空白 identifier | 空串、纯空白、缺字段都是 400 `VALIDATION_ERROR` | PASS |
| R1-005 多设备踢出（同一库，额外后端项） | 两台登录 200/200；设备列表 200 且恰一个当前设备；踢出 200；被踢 `/me` 401；主调 `/me` 200；会话 `REVOKED` / `ACTIVE` | PASS |

## 前端卡

没有改页面。

R1-001 已有证据：

- `evidence/redesign/2026-10-07/R1-001-implementation/task-spec.md`
- `evidence/redesign/2026-10-07/R1-001-implementation/validation-summary.json`
- `evidence/redesign/2026-10-07/R1-001-implementation/browser-observation.json`

这次不改文件跑了不依赖官网进程的 node 测试：

```text
cd apps/official-site && node --test tests/b13-official-site.test.mjs tests/b14-fe-005.test.mjs tests/website-entry.test.mjs
exit 0
tests 14, pass 14, fail 0
```

`apps/official-site/tests/r1-001.test.mjs` 会请求已经在跑的 `http://127.0.0.1:18182`。该端口没有监听。本回放没有启动官网。这 11 页的实机 HTTP **未验证**。

R1-007 已有单测文件是 `apps/learner-web/tests/adult-gate-restricted.test.mjs`。这次重跑：

```text
cd apps/learner-web && node --test tests/adult-gate-restricted.test.mjs
exit 0
tests 4, pass 4, fail 0
```

`apps/mobile/tests` 里没有同名的门未过等待态测试。Mobile 套件这次没有跑，因为 R1-011 正在改 `apps/mobile/**`。Mobile 等待态 **未验证**。

R1-011 现有说明在 `evidence/redesign/2026-10-09/R1-011/report.md`：两端续步单测当时退出码 0，但没有用新号走真实网关和浏览器，真实剩余步骤走到定级入口没有 PASS。本回放不重复那条，也不把它改写成 PASS。

## 未验证

- R1-001 十一页在 18182 上的直接 HTTP。
- R1-007 Mobile。
- R1-011 新号真实路径。
- 没有停掉 learner 再启动后做第二次目标读回。已验证的是同一进程里 PUT 之后的 GET，以及当时的 MySQL 行。
- 没有签收，没有出站。
