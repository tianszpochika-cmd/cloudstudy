# R1-002 输入收尾包-3（PLANNED revision 27，不申请 READY，不实施业务差量）

> 状态基线 `[实测]`：revision 27；R1-001 ACCEPTED 无漂移；R1-002/003/004/005 PLANNED；HEAD `3d11be33`；本批零业务改动、零注册 POST；后台仅任务2短时隔离 IAM 预检（已停止），零共享写入。
> 原 `prep-report.md` / `source-and-inputs.json` / `prep-report-2.md` / `source-and-inputs-2.json` 保留；本包为新增 `-3` 版本。t2a～t2e 与旧证据保留，不再声称 t2e 已通过 Flyway。

## 1. 真正可用 Flyway 验收库（任务1）

- 新库 `[实测]`：`r1_002_iam_t3g`（`iam-schema-3.json` 全 PASS）——`flyway-maven-plugin:12.4.0`（`mvn dependency:list` 实测锁定，与 iam 构建一致）在 `services/iam-service` 模块域内执行 canonical V1,V3…V18 真实 `migrate`；`info`/`validate` exit 0 原生输出归档；原生 `flyway_schema_history`（installed_rank/success/checksum）回查 17 行 `1,3…18 SUCCESS`；V13 最终结构 `chk_iam_idempotency_request_fingerprint` 存在；runner（DML-only）读回 5 表 0 行；种子 role 1 / permission 30。
- 失败如实保留：t3b 空库骨架后 `mvn` 直调 exit null（Windows `.cmd` shim 需 shell）→ shell 修复后插件缺 MySQL 方言（根模块域）→ `-pl services/iam-service` 修复后 PASS；`t3b-f` 中间库保留，终验仅用 `t3g`。
- 秘密生命周期 `[实测]`：`t3-secrets/r1-002-secrets.json`（0600）一次生成、后续复用；长度 migrator/runner 28、B64url replay/fingerprint 各 43 且独立；迁移/预检/启动子进程从同一 vault 注入；证据仅记录存在性/长度/独立性，不输出值。随机密码随进程丢失问题已关闭（vault 文件复用）。
- 政策 fixture 复用 `[实测]`：3 文书（TERMS/BASE、PRIVACY/BASE、ADULT_LEARNING/LEARNING_REQUIRED；digest/capabilities/published_at/ACTIVE 与 `localCandidate` 同源）在 `t3g` 待终验时插入（本批未提前插入，保持库零基线可验）；用户零基线（无成人/同意/学习权限）由终验前复查确认。

## 2. TLS 与可执行启动器 v3（任务2）

- 新脚本 `r1-002-launcher-3.cjs`：`--validate` PASS；`--start/--stop` 实现（子进程 env 注入，不污染调用方；PID 记 `launcher-3/pid.json`，仅停自己进程）。
- 固定 IAM 18087 + 127.0.0.1；TLS 测试证书自签 CN=127.0.0.1/SAN IP（keytool 实测指纹 `EC:EA:72:…:BD:45`，30 天）；JWT 签名密钥（`secrets/iam-rsa-private.pem` 经 `IAM_JWT_PRIVATE_KEY_FILE`）与 TLS 证书分开；issuer/audience 不变；`refresh-cookie-secure=true` 显式覆盖 local false（预检核 `application.yaml:89` 默认 true）。
- 短时预检 `[实测]`：自有 IAM PID 23020→39360（两次启动；首次缺 JWT key/第二次 adult-gate 开关失败如实记录并修复）→ TLS pin 命中 + 健康 200 + JWKS `kid=iam-local-2026-08`（`tls-preflight-3.json` PASS；https 传输如实记录 pin 前置确认，不等同生产 CA 链）；Gateway→IAM/JWKS 走 `http://127.0.0.1:18087`（与生产 TLS 终止点分离）；Gateway→learning 真实 403 路径保留（`LearningHttpPrincipals:50-55`），终验时持受限 JWT 取真实 403。
- 未新增 TLS_PORT、未改共享端口/全局配置；私钥未入 Git/证据/日志；本批无需提前证明注册 Cookie/三 TC。

## 3. Outbox 扩围提案修正（任务3，只提案不实现）

- canonical 事件 `iam.account.bootstrap.created.v2`（事件版本 v2），Kafka topic `platform.iam.v1`（`b26-event-runtime.json:290` owner iam-service，分区键 aggregateId；事件版本≠主题版本）。
- 语义：账号事实与 Outbox 同一本地事务提交，relay 异步发送；至少一次投递 + 消费端按 (principalId,aggregateVersion,dedupeKey) 去重（`m1-018:19`）；不宣称 Kafka exactly-once（参照 `ContentOutboxKafkaRelay:31-33` 崩溃-确认窗口语义）。
- 字段映射：principalId=aggregateId=`AccountRecord.principalId`（UUID 字符串；契约要求 `prn_` 前缀——**ID 格式冲突**：现有 `PrincipalId.toString()` 输出裸 UUID（`PrincipalId.java:32-34`），与契约 `^prn_[A-Za-z0-9._:-]{15,127}$` 不符；证据确凿，影响 payload 校验；不自行改契约，交主审裁定：A. 发行时加 `prn_` 前缀并保持内部 UUID 解析兼容，或 B. 修契约放宽 pattern）；aggregateVersion=1（新建；`content_version` 无对应，用固定 1 + 幂等键去重）；dedupeKey=幂等 scope+key+fingerprint 派生（与 `IdempotencyService` 同源）；auditId=`iam_decision_audit` 行 id（`JdbcAuditFactPort:28` INSERT 返回键）；traceId/requestId=控制器 `responseMeta`（`:1156-1157`，BFF 头透传）；schemaVersion=`1.0.0`（沿 `ApiResponseMeta`）。
- 可复用能力：content `ContentOutboxRelayPort`（claim/markPublished/markFailed/reclaim）接口语义 + `ContentOutboxKafkaRelay`（broker-ack 后 mark、退避+jitter、DLQ）实现模式；`spring-kafka` 依赖（iam pom 已有则复用，否则新增——以 `mvn dependency:list` 为准，终验前确认）。
- 精确文件清单（拟新增/修改，待主审更新源规格与卡片后实施）：
  1. `services/iam-service/src/main/resources/db/migration/V19__iam_account_bootstrap_outbox.sql`（拟新增：`iam_account_bootstrap_outbox` 表 + 去重键 + lease 列）。
  2. `services/iam-service/src/main/java/com/englishflow/iam/domain/IamAccountBootstrapOutbox.java`（拟新增：port 接口，参照 ContentOutboxRelayPort）。
  3. `services/iam-service/src/main/java/com/englishflow/iam/domain/JdbcIamAccountBootstrapOutbox.java`（拟新增：JDBC adapter，同事务写入）。
  4. `services/iam-service/src/main/java/com/englishflow/iam/integration/IamAccountBootstrapRelay.java`（拟新增：@Scheduled relay，topic `platform.iam.v1`，headers 携带契约 envelope 全字段）。
  5. `services/iam-service/src/main/java/com/englishflow/iam/domain/PasswordAccountService.java`（修改 1 处：register 事务内同写 Outbox 行）。
  6. `services/iam-service/src/main/java/com/englishflow/iam/web/IamProviderBoundaryController.java`（修改 1 处：register 组装 envelope 字段 auditId/traceId/requestId）。
  7. `services/iam-service/src/main/resources/application.yaml`（修改 1 段：`iam.events.bootstrap.*` topic/lease/重试配置）。
  8. `services/iam-service/src/test/java/com/englishflow/iam/IamAccountBootstrapOutboxTest.java`（拟新增：同事务/去重/relay 单元测试）。
- 原卡 4 文件外扩围须主审更新源规格与生成卡片；不 dual publish 旧 B8 `auth.*.v1`；不以 audit 代 Outbox；不提前实现其它 IAM 事件。

## 4. TC03 修正与交付（任务4）

- A. 本地事务写入失败（可撤销故障）：专用库内对 `iam_account` 建同 identifier 预置行（事务外准备，可删）→ 同键 POST 注册得 409（非 201，业务冲突语义）→ 删预置行 → 同键重试 201；读回 `iam_account/iam_principal/iam_session/iam_consent/iam_decision_audit/iam_account_bootstrap_outbox（待扩围后）` 前后计数，证明无残留部分提交。409 本身不代替回滚测试（冲突≠崩溃回滚）；**DB 崩溃回滚**另用事务内 Outbox/audit 写入点故障注入（待 Outbox 扩围确认后实施，见下）。
- B. relay/Kafka 暂不可用：本地事务成功 + Outbox 行 PENDING 持久化 → 注册仍 201（事件待发送语义）→ 恢复 broker → relay 发送 → 消费端去重验证（dedupeKey 同一事件 дважды投递仅投影一次）；发送故障≠本地事务失败；不扩 R1-003 全量幂等矩阵。
- 本组仅交付故障方案 + 验收脚本占位（`tc03-plan-3.json`：步骤/读回项/预期码），不提前注册、不注入业务故障。
- 交付：`prep-report-3.md` + `source-and-inputs-3.json` + `commands-3.log`（哈希见内）；静态核查/环境实测/待执行验收已区分；剩余缺口：T1 TLS 生产 CA 方案（测试 pin 已备）、Outbox 扩围规格确认、E3 终值 TC 时生成、C1/G1/G2 终核；若主审确认无缺口，申请更新扩围规格并签 READY（不自行推进状态）。PLANNED 保持。
