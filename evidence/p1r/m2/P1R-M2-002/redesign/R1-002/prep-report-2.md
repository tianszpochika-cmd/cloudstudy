# R1-002 输入收尾包-2（PLANNED revision 27，不申请 READY，不实施业务差量）

> 状态基线 `[实测]`：revision 27；R1-001 ACCEPTED 无漂移；R1-002/003/004/005 PLANNED；HEAD `3d11be33`；本批零业务改动、零后台启动（静态 validate + 真实迁移 DDL 除外）、零注册 POST。
> 原 `prep-report.md` / `source-and-inputs.json` 保留；本包为新增 `-2` 版本。

## 1. 专用 IAM 验收库（任务1，已建立）

- 新库 `[实测]`：`r1_002_iam_t2e`（`iam-schema-2.json` 全 PASS）——V1,V3…V18 共 17 文件真实迁移（版本+checksum+`flyway_schema_history` 真实历史；`t2a-d` 调试残留保留，终验仅用 `t2e`）。
- V13 `[读取+实测]`：单向 cutover（`V13__key_and_version...sql:1-3` 要求先停写入口、排空旧 writer）；新空库无旧 writer——`iam_idempotency_record` 0 行 + history 从 V1 起完整，故 `writers-drained` 条件空真成立；`IamRuntimeConfiguration:260-289` 在新库上按正常路径执行（无需 repair）。
- 身份分离 `[实测]`：migrator（DDL 族 + DML， migration 过程需要执行 seed INSERT/UPDATE/DROP 旧表）与 runner（`SELECT,INSERT,UPDATE,DELETE` 仅新库；`JdbcIdempotencyStore:58 complete/97 reject` 需 UPDATE、`124` 需 DELETE，runner 已具备）分离；凭据仅子进程内存，不落盘。
- 基线 `[实测]`：iam_principal/account/device/session/consent 全 0 行；迁移种子如实记录——iam_role 1 行（learner）、iam_permission 30 行（V1 9 + 后续迁移增补）、`iam_consent_document_version` 0 行（V14 只建表不种文书，符合预期）。
- 禁令遵守：未复制共享 history（自建 history 表逐版本 INSERT）、未伪造 SUCCESS（逐文件真实执行+回查）、未碰 `iam_service`/既有身份（`SELECT COUNT` 仅只读核对共享 DEMO 未动——本批未复查共享计数，沿用 prep9/reviewer-1-prep 的 11 行前后一致结论，不重复声称）。

## 2. 隔离启动配置（任务2，静态 validate）

- 新脚本 `r1-002-safe-run-2.cjs` `[实测]` PASS：JDBC database=`r1_002_iam_t2e` == `iam.persistence.schema` == 专用 runner 身份一致；持久化+Flyway 开启（`IAM_PERSISTENCE_ENABLED/ IAM_FLYWAY_ENABLED/SPRING_FLYWAY_ENABLED=true`，与 R1-001 关闭式包装器相反且正确——`IamRuntimeConfiguration:162-165` 持久化启用时禁关 Flyway）；replay/fingerprint 双秘密独立稳定（仅子进程注入，长度/独立性由 `isStrongSecret` + 不等性门槛约束，值不落盘）；RS256（issuer `http://127.0.0.1:18087`、aud `yuxuexing-api`、key-id `iam-local-2026-08`，私钥仅 `IAM_JWT_PRIVATE_KEY_FILE`）；`password-min-length=12`；政策源 `control-plane`（只读验证见任务3）；端口 IAM 18087/Gateway 18070/learning 18090。
- TLS/Secure `[读取+缺口]`：`application.yaml:89 refresh-cookie-secure:true` 为默认；`application-local.yaml:10` local 显式 false——**不能作为本卡安全验收结果**；JWT RSA 私钥不是 TLS 服务器证书。本批最小 TLS 方案（待主审签收）：验收走 `https://127.0.0.1:<TLS_PORT>/api/v1/auth/register`（由 owner 提供可信测试证书+端口，或批准 `Secure=false` 仅作功能连通预检且安全项另验）；不擅改全局端口/协议登记；不用 HTTP+Cookie 字符串冒充 TLS 证明。缺口 T1 待签收。
- 领域 403 真实路径 `[读取]`：`LearningHttpPrincipals:26-55`（JWT 验签→tenant=platform→role learner→权限非空→adult PASSED+consent GRANTED+phase-1+ACTIVE，否则 403；缺 claims 即 403）；路由 Gateway `/api/v1/learning/*→learning-service:18090`（`GatewayRoutePolicy:178`）。401（无 Token）/404/503 不得冒充 403——TC01 终验时持受限 Token 调 `/api/v1/learning/today` 取真实 403。

## 3. 合成政策 fixture（任务3，已建立）

- 新脚本 `prepare-policy-fixture-2.cjs` `[实测]` PASS：`iam_consent_document_version` 3 行 ACTIVE（TERMS_OF_SERVICE/BASE_REQUIRED、PRIVACY_NOTICE/BASE_REQUIRED、ADULT_LEARNING/LEARNING_REQUIRED；document/policy digest 沿用 `localCandidate` 固定源值；published_at `2026-08-30`；capabilities/withdrawal/revoke_sessions 与 `JdbcConsentPolicy:24-29` + `ConsentService:23-26` 一致）；用户基线 iam_account/consent/session 全 0 行（无成人判定、无个人同意、无学习能力）；文书标本地合成测试用途。
- 来源验证 `[读取]`：`IamRuntimeConfiguration:318-348`——`control-plane` 走 `JdbcConsentPolicy`（ACTIVE 最新发布，缺失 fail closed）；auto 在 local profile 会选 local-candidate（不可冒充）；本卡固定 `control-plane` + 持久化启用 + JdbcTemplate 存在，满足控制面分支。
- 密码仅测试运行时生成，不落证据；本批未注册账号。

## 4. Gate/TC/Outbox/恢复方案与实现范围提案（任务4）

- 术语更正：`TenantScope`（`TenantScope.java`）是数据 owner 范围（platform 租户派生），不是 JWT 学习 scope；受限 JWT 由控制器 `tokenAccount()`（allow-list 剥离学习权限 `:621-635`）→ `JwtTokenService.issue`（`eligibilityClaims` NOT_EVALUATED/UNKNOWN `:1023-1039`）完成。新用户无成人/同意≠政策控制面应空（控制面 3 文书 ACTIVE 为注册前置 `requirePublishedPoliciesForAuthentication`）。
- HTTP 附加字段拒绝：`B8RegisterRequest additionalProperties:false + x-client-authority-fields:[]` 为契约层；`Claims.none()` 仅 domain 层（控制器 `:134` 传 none，`RegisterRequest` 仅 3 字段故 HTTP 未知字段由 Jackson/validation 拒绝）。留真实 TC02 核验，不以 `Claims.none` 为 HTTP 通过证据。
- Outbox 承接（M1-018 `iam.account.bootstrap.created.v2`，IAM→learner，Outbox 至少一次；旧 B8 `auth.*.v1` historical-only 禁 dual publish）：
  - 现状 `[读取]`：注册链仅 DB 事务+审计（`IdempotencyService:91-102`、`JdbcAccountStore:28-38`、`JdbcAuditFactPort:27-46`）；全仓无 `iam.account.bootstrap` producer/table（grep 零命中）；audit 表不能冒充 Outbox。
  - 复用：`content-service` 的 `ContentOutboxKafkaRelay` 模式（claim→broker-ack→PUBLISHED，至少一次+消费端去重）为公共能力参照；learner 侧按契约 consumerRule 建 owner-bound bootstrap 投影（不开放学习能力）。
  - 拟扩围（提案，不实现）：`services/iam-service/src/main/resources/db/migration/V19__iam_account_bootstrap_outbox.sql`（新建 `iam_account_bootstrap_outbox` + 事务内写入，拟新增）；`.../domain/IamAccountBootstrapOutbox.java`（port，拟新增）；`.../domain/JdbcIamAccountBootstrapOutbox.java`（adapter，拟新增）；`.../integration/IamAccountBootstrapRelay.java`（relay，拟新增，需 Kafka topic `platform.iam.v2` 复用既有 `CONTENT_KAFKA` 回环配置模式）；`PasswordAccountService.register`/`IamProviderBoundaryController.register` 事务内挂接（一处调用变更）；`application.yaml` 补充 `iam.events.bootstrap.*` 配置段。旧 B8 v1 不 dual publish；audit 保持审计用途。
  - 交主审确认实现范围后再实施；不要求准备阶段先做完 producer/下游全链。
- TC03 可控恢复方案（不提前执行，不扩 R1-003）：
  - DB 失败：在专用库事务内对 `iam_account` 建同 identifier 预置行 → 同键 POST 得 409（非 201）→ 删预置行 → 同键重试 201；owner 读回 iam_account/iam_session/iam_principal/iam_consent/iam_decision_audit 前后计数。
  - 必要 Outbox 失败（待主审批 Outbox 扩围后）：relay 暂停或 topic 不可达 → 注册事务标记 PENDING/失败（非 201）→ 恢复后同键重试仅建一次 + Outbox 行 exactly-once 语义（dedupeKey 去重）。
  - 审计失败：审计端口异常 → 注册 fail closed（非 201），无孤儿账号/会话。
  - 内存异常不冒充真实 DB 回滚；每次恢复仅断言一次创建（`uk_iam_account_identifier` + idempotency COMPLETED 一条）。

## 5. 条件与停止点

- 已具备：专用库真实迁移+双身份+3 文书+零用户基线；静态启动白名单；jar 身份（沿用 reviewer-1-prep `5d3fcdf8…43852295B`，未重采）；端口/依赖 LISTENING。
- 缺失（主审签收）：T1 TLS 入口方案；Outbox 扩围实现范围确认；E3 合成 identifier/device fixture 终值（TC 执行时生成）；C1/G1/G2 终核（终验时）。
- 本包新增 `prep-report-2.md` + `source-and-inputs-2.json` + `commands-2.log`；原报告/收据/证据保留；零业务改动、零注册 POST；状态保持 PLANNED，不 READY/start/ACCEPTED，不进 R1-003～005。
