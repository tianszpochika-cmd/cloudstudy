# R1-012 BC-012 密码重置不枚举

日期：2026-10-09。分支：`dev-redesign`。Owner：iam-service。依赖：R1-002。
状态：干净库证据已采集，本卡断言通过。**不是 ACCEPTED，也不是 IT-1 出站。** 没有 commit，没有 push。`CURRENT-PROGRESS.md` 未改。没有改 `IamProviderBoundaryController.java`、`PasswordResetService.java`、`LearnerHttpController.java`、learner-web/mobile/onboarding 页面或 `packages/i18n`。

## 范围

只对现有 `POST /api/v1/auth/password-reset/request` 与 `POST /api/v1/auth/password-reset/confirm` 做干净库对照。服务行为与卡一致，所以没有改服务。

申请口在同一请求形状下，有账号和无账号都是 202，公开头和去掉逐次相关字段后的响应体一致。响应体只有 `data.accepted=true`，不含令牌或账号标识。无账号不增加 `iam_password_reset_challenge`。有账号增加一行，库里只有 SHA-256 摘要。空白 identifier 仍是 400 `VALIDATION_ERROR` / `iam.password_reset.invalid`，不是 202，也不插行。

默认额度是每标识每分钟 5 次。第 6 次两边都是 429 `RATE_LIMITED` / `iam.password_reset.rate_limited`，`Retry-After: 60`，公开响应一致。无账号的限流突发不插挑战行。

确认口：错误令牌、令牌对但标识是另一个已有账号、令牌对但标识不存在，都是 401，公开错误码和消息相同。用过、过期、预先标成已消费的令牌，对真实标识和不存在标识也是同一组 401，没有 404，正文没有「账号不存在」。

## 新增文件

- `evidence/redesign/2026-10-09/R1-012/run.mjs`
- `evidence/redesign/2026-10-09/R1-012/probe.mjs`
- `evidence/redesign/2026-10-09/R1-012/http-result.json`
- `evidence/redesign/2026-10-09/R1-012/report.md`

打包使用当时工作区里的 iam-service 源码，只为得到可运行 jar。这次没有改 IAM 源码。

## 干净库

只使用 `yuxuexing-local-mysql-1`（`mysql:8.0`，compose project `yuxuexing-local`，service `mysql`，`127.0.0.1:13306`，healthy）。没有 `docker compose down`，没有 prune，没有碰名称含 qida 的容器。IAM 只绑 `127.0.0.1:18087`。启动前该端口无监听。

专库 `r1_012_iam_20261009_cd996f0812ae`，用户 `r1_012_cd996f0812ae`。断言后已删除。结束时 `schema_name LIKE 'r1_012%'` 与 `user LIKE 'r1_012%'` 都是 0，18087 无监听。本轮启动的 Java 进程已退出。

IAM：`spring.profiles.active=local`，`iam.consent.policy-source=local-candidate`，`iam.local-adult-gate-enabled=true`，persistence+flyway，`v13-writers-drained=true`，自签 TLS，issuer 仍是 `http://127.0.0.1:18087`。没有改重置额度，出厂值 `IAM_RESET_RATE_LIMIT` 缺省为 5。Flyway `17,0`。

local 画像的重置投递是进程内队列，原始令牌不进 HTTP，也不进库。确认口要拿「令牌对」的样本，探针按服务同一 SHA-256 规则插入挑战行，时间戳从服务自己写下的那一行复制。随后用真实标识确认得到 204，且该行 `consumed_at` 已写上，说明服务接受的就是这个摘要。错误标识没有消费这一行。

## 命令

```text
mvn -o -DskipTests -f services/iam-service/pom.xml package
exit 0

node evidence/redesign/2026-10-09/R1-012/run.mjs
exit 0
PROBE_EXIT 0
```

原文（失败列表长度 0）：

```text
MYSQL_IDENTITY {"name":"/yuxuexing-local-mysql-1","image":"mysql:8.0","project":"yuxuexing-local","service":"mysql","status":"running","health":"healthy","port":[{"HostIp":"127.0.0.1","HostPort":"13306"}]}
PORT_18087_FREE
PARTIAL_REVOKES=0
SCHEMA_CREATED r1_012_iam_20261009_cd996f0812ae r1_012_cd996f0812ae
IAM_HEALTH_OK
FLYWAY iam=17,0
register.known 201
register.other 201
register.limited 201
sql.before challenges=0
request.missing 202 challenges=0
request.present 202 challenges=1 digestChars=64 unconsumed=true unexpired=true
request.pair equal=true status=202
request.blank.empty 400 VALIDATION_ERROR iam.password_reset.invalid challenges=1
request.blank.spaces 400 VALIDATION_ERROR iam.password_reset.invalid challenges=1
request.blank.newline 400 VALIDATION_ERROR iam.password_reset.invalid challenges=1
request.blank.omitted 400 VALIDATION_ERROR iam.password_reset.invalid challenges=1
confirm.wrong-vs-other-account equal=true 401 INTERNAL_ERROR iam.password_reset.invalid
confirm.wrong-vs-missing equal=true 401 INTERNAL_ERROR iam.password_reset.invalid
confirm.success 204 consumed=true
confirm.used-real-vs-missing equal=true 401 INTERNAL_ERROR iam.password_reset.invalid
confirm.used-vs-wrong-token equal=true 401
confirm.expired-real-vs-missing equal=true 401 INTERNAL_ERROR iam.password_reset.invalid
confirm.expired-vs-wrong-token equal=true 401
confirm.preconsumed-real-vs-missing equal=true 401 INTERNAL_ERROR iam.password_reset.invalid
confirm.preconsumed-vs-wrong-token equal=true 401
rate.known statuses=202,202,202,202,202,429 challenges=9
rate.missing statuses=202,202,202,202,202,429 challenges=9
rate.limited-pair equal=true 429 RATE_LIMITED iam.password_reset.rate_limited
sql.rate-counts 1,1,5,5
HTTP_ASSERTIONS OK
PROBE_EXIT 0
RUN_DONE
CLEANUP_LEFT schemas=0 users=0
PORT_18087_FREE_AFTER
```

申请对照的公开头是：`cache-control: no-store`，`content-type: application/json`，`x-api-version: v1`，以及两边相同的 `strict-transport-security`、`x-content-type-options`、`x-frame-options`、`x-xss-protection`、`connection`、`keep-alive`、`transfer-encoding: chunked`。两边都没有 `content-length`（分块）。`Date`、`X-Request-Id`、`X-Trace-Id` 按次变化，不拿来判账号；整组头值里没有标识符或令牌。公开体是 `data.accepted=true`，`meta` 只剩 `apiVersion=v1` 与 `schemaVersion=1.0.0`。

挑战行数 9 的构成：服务为有账号的申请写 1 行，探针为确认口另插 3 行（有效、过期、已消费），限流账号的前 5 次再写 5 行。无账号申请和它的 5 次受理都不插行。`iam_rate_limit` 里 `password_reset` 的计数是 `1,1,5,5`：对照各 1 次，两个限流标识各停在 5，第 6 次拒绝不再加。

## 观察

确认失败的 HTTP 状态是 401，消息是 `iam.password_reset.invalid`，但公开 `errorCode` 是 `INTERNAL_ERROR`。这是现有 `canonicalErrorCode` 对 `PASSWORD_RESET_INVALID` 走了 default，不是账号存在性分叉。错误令牌、标识错误、用过和过期都是这一组，没有变成 404 或「账号不存在」。本卡没有为此改服务。

## 未做

- 没有签收，没有出站。
- 没有跑 iam-service 单测。打包命令跳过了测试。
- 没有从进程内投递队列读出自然令牌。确认样本是按同一摘要规则插入的挑战行，并用 204 证明服务认这个摘要。
