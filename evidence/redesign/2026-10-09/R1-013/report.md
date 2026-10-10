# R1-013 BC-201 门被拒后的清理与重进

日期：2026-10-09。分支：`dev-redesign`。Owner：iam-service。依赖：R1-006。
本报告不把本卡标成 ACCEPTED，也不做出站 IT-1。`CURRENT-PROGRESS.md` 未改。没有 commit，没有 push。

## 行为

`POST /api/v1/iam/adult-gate` 在主体已经是 `REJECTED` 时不再重算年龄。换新的幂等键、把出生年改成成年年份，响应仍是 200 `REJECTED` / `RESTRICTED` / `evidenceStatus=REJECTED`，`retryAllowed=false`。不调用 `approve`，因此不能变成 `PASSED`，也不写入第二套年龄判定。同键回放走既有加密快照，仍是 200，正文与第一次相同。

这条路径不调用 `AdultGateService.invalidate`，也不调用 `sessions.revokeAll`。第一次未成年拒绝仍只写 fact store 的 `REJECTED`，当前会话保持 `ACTIVE`，`/api/v1/iam/principal/me` 仍是 200。退出只撤销当前会话；再次登录的新会话是 `ACTIVE`，访问令牌 `adult_gate=REJECTED`，不是 `NOT_EVALUATED`，也不是 `PASSED`。`/me` 的门学习资格和同意学习资格都是 `RESTRICTED`，不是 `ELIGIBLE`。

库里没有出生年列。`adult_verified_at` 在拒绝后保持空。账号行保留为 `ACTIVE`，`iam_account_deletion` 为 0。原 `adult_gate` 审计仍是 1 条 `DENY` / `adult_age_below_minimum`，没有 `ALLOW`。字符列里没有 `1995` 或 `2015`。没有启动 learner-service，也没有调用画像删除。

`JdbcAdultGateFactStore.approve` 与内存实现都拒绝把已经 `REJECTED` 的行改成 `APPROVED`。第一次拒绝的 `retryAllowed` 仍是 `true`，与 R1-006 的控制器断言一致；只有已经拒绝之后的新请求把响应收成 `retryAllowed=false`。

## 改动文件

- `services/iam-service/src/main/java/com/englishflow/iam/web/IamProviderBoundaryController.java`
- `services/iam-service/src/main/java/com/englishflow/iam/domain/JdbcAdultGateFactStore.java`
- `services/iam-service/src/main/java/com/englishflow/iam/domain/InMemoryAdultGateFactStore.java`
- `services/iam-service/src/test/java/com/englishflow/iam/web/IamAdultGateControllerTest.java`
- 本目录的 `run.mjs`、`probe.mjs`、`http-result.json`、`sql.txt`

未改 `apps/**`、`packages/i18n/**`、`learner-service/**`、`PasswordResetService`、R1-011 / R1-012 证据目录。`IamProviderBoundaryController.java` 里已有的同意撤回回执字段未改。

## 控制器测试

```text
mvn -f services/iam-service/pom.xml test -Dtest=IamAdultGateControllerTest
exit 0
Tests run: 10, Failures: 0, Errors: 0, Skipped: 0
```

新增「测试 10」：拒绝后换键提交成年年份仍 `REJECTED` 且 `retryAllowed=false`；同键回放正文不变；`/me` 仍 200；退出后再登录的 claim 是 `REJECTED`；再登录会话为 `ACTIVE`。原拒绝会话在换键时仍是 `ACTIVE`。

打包：

```text
mvn -o -DskipTests -f services/iam-service/pom.xml package
exit 0
```

## 干净库

只使用 `yuxuexing-local-mysql-1`（`mysql:8.0`，compose project `yuxuexing-local`，service `mysql`，`127.0.0.1:13306`，healthy）。没有 `docker compose down`，没有 prune，没有碰名称含 qida 的容器或进程。开跑前 18087 无监听。

```text
node evidence/redesign/2026-10-09/R1-013/run.mjs
exit 0
PROBE_EXIT 0
PROBE_SUMMARY passed=14 failed=0
FLYWAY iam=17,0
CLEANUP_LEFT schemas=0 users=0
PORT_18087_FREE_AFTER
```

专库 `r1_013_iam_20261009_8c5460575767` 与用户 `r1_013_8c5460575767` 已在探针结束后删除。本卡启动的 IAM 进程已停，事后 18087 无监听。

观察到的结果：

| 检查 | 结果 |
|---|---|
| 未成年提交 | 200 `REJECTED` / `RESTRICTED`；库 `REJECTED`，`adult_verified_at` 空；会话 `ACTIVE`；`/me` 200 |
| 未成年同键回放 | 200，正文相同 |
| 新键 + 成年年份 | 200 仍 `REJECTED` / `RESTRICTED`，`retryAllowed=false`，`effectiveAt` 不变 |
| 该次落库 | 状态与版本不变，`adult_verified_at` 仍空，`adult_gate` 审计行数不变，会话仍 `ACTIVE` |
| 成年年份同键回放 | 200，正文相同，`retryAllowed=false` |
| 退出后再登录 | 令牌 `adult_gate=REJECTED`，`consent_state=UNKNOWN`；新会话 `ACTIVE`；旧会话因退出而为 `REVOKED` |
| 再登录后 `/me` | 200，门与同意的学习资格都是 `RESTRICTED`，账号投影 `RESTRICTED` |
| 保留 | 账号 1 行且 `ACTIVE`；删除申请 0；审计 8 行未删；`adult_gate` 为 1 条 DENY、0 条 ALLOW；无出生年列；字符列无 `1995`/`2015` |

## 未验证

- learner-service 画像没有在本卡库里造出来再读回。实现没有调用 learner，因此没有删画像，但画像保留本身未验证。
- 两条首次提交并发交错、一条先落成 `REJECTED` 之前另一条已经开始 `evaluate` 的窗口，没有做并发试验。已提交的 `REJECTED` 行不能被 `approve` 改成 `APPROVED`，这一条只由顺序探针和 SQL 条件覆盖。
