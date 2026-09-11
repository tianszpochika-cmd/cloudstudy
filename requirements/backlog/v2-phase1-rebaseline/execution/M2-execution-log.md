# P1R M2 执行日志

## 2026-09-11 M2-001 验收与 M2-002 复审判定

- `P1R-M2-001`：在标准 `yuxuexing-local` 栈（Redis 7 @127.0.0.1:16379）以 JDK 25 构建两棵服务树并执行 `--run --browser --fault` → **`result: PASS`，29/29 检查，`notRuntimeVerified: []`**，11 个真实浏览器用例（Playwright + 系统 Edge CDP），审计覆盖 `200/401/403/404/429/503` 与 `origin_referer_conflict`/`credentialed_referer_untrusted`/`cors_origin_forbidden`；证据 `evidence/p1r/m2/P1R-M2-001/runtime-evidence-2026-09-11.json`。独立只读终审 `agent:m2_001_final_review:opencode-general` 判定 **`ACCEPT`**（P0/P1/P2=`0/0/0`，5 条 P3 加固建议不阻塞）；台账晋升 `ACCEPTED`，canonical manifest 绑定 23 artifacts（`sourceCommit=7ba4d33`，含 jar/sourceTree 摘要核验），状态轨迹 `PLANNED→READY→IN_PROGRESS→REVIEW→ACCEPTED`。责任边界：durable audit→M2-006、NetworkPolicy→M2-008、平台关联→M2-010、staging→M8-013；并发副本不在本任务范围。
- `P1R-M2-002`：独立只读复审判定 **`REWORK`**（P0=0、P1=5、P2=3、P3=3）。`4bc645c` 的 rollback-only 修复方向正确，全套 `71/71（18 skipped）`、IAM compatibility `7/7` 可复现；但 legacy Consent 空摘要兼容、正式 Consent 策略来源、密码重置投递与审计、native 可信上下文、真实 DB/跨进程 Evidence 仍未关闭。任务保持 `IN_PROGRESS / NOT_RUNTIME_VERIFIED`，按执行记录中的 8 个有序批次返工；`P1R-M2-003` 继续锁定。
- 审判依据与 P1/P2/P3 明细、复现命令及限制见 [P1R-M2-001 执行记录](P1R-M2-001.md) 与 [P1R-M2-002 执行记录](P1R-M2-002.md)。

## 2026-09-11 M2-002 返工批次 1：legacy Consent 空摘要兼容

- 对应开放 P1-1。选择显式 legacy 历史表示而非 V14 伪造摘要回填：新增 `ConsentHistoryEntry`（legacy 条目不得携带摘要、`verifiedRecord()` 失败关闭），`ConsentStore.history` 返回类型同步为 `List<ConsentHistoryEntry>`，JDBC/InMemory/FailClosed 三实现一致；`find/findForUpdate` 继续过滤 legacy，授权不受影响。
- 重放语义：`replayConsent` 命中 legacy 条目时确定性 409 `iam.consent.legacy_fact_revalidation_required`；无关 legacy 行不再导致已验证记录重放失败。
- 验证（JDK 25，标准栈 MySQL 8.0 隔离库 `iam_service`）：IAM 全套 `76/0/0（18 skipped）`；`ConsentHistoryEntryTest 5/5`；opt-in `IamConsentJdbcPersistenceContextTest 4/4` + `IamConsentIdempotencyRollbackSafetyTest 2/2`；IAM compatibility `7/7`。
- 边界：只关闭 P1-1；任务保持 `IN_PROGRESS / NOT_RUNTIME_VERIFIED`，下一批为 P1-2 正式 Consent descriptor/策略来源。

## 2026-09-11 M2-002 返工批次 2：正式 Consent 控制面策略来源

- 新增 V14 `iam_consent_document_version` 控制表（不预置 fixture，未发布即失败关闭）与 `JdbcConsentPolicy`（只读 ACTIVE、每类型取最新、坏行/DB 异常一律 `POLICY_UNAVAILABLE`）；新增显式来源开关 `iam.consent.policy-source`（`auto`/`control-plane`/`local-candidate`，非 local/test 禁止 `local-candidate`）；组合根在持久化可用时装配控制面实现。无 HTTP 契约变更、无新增端点。
- 验证（JDK 25，标准栈 MySQL 8.0 隔离库）：IAM 全套 `77/0/0（19 skipped）`；新增 opt-in `IamConsentPolicyJdbcPersistenceContextTest 1/1`（空表 503 → 五类发布后写入成功 → 删除后 503）；opt-in 同意三类 `7/7`；`p1r:data-ownership:check` PASS。
- 非 local 进程冒烟（`v2,local-real` + 持久化 + 真实 RSA 文件密钥）：注册 201、三类同意写入 200、`/iam/principal/me` 200（原 503）且 `consentState.accepted=true`、`unsatisfiedPurposes=[]`、`policySource=IAM_ACTIVE_POLICY_CONTROL_PLANE`；`RESTRICTED` 仅因成人 Gate 未评估（P2-3）。
- 边界：只关闭 P1-2；任务保持 `IN_PROGRESS / NOT_RUNTIME_VERIFIED`，下一批为 P1-3 密码重置投递与审计。

## 2026-09-11 M2-002 返工批次 3：密码重置投递 handoff、审计、HMAC 与 Retry-After

- 新增 `PasswordResetDeliveryPort`/`PasswordResetDelivery` 及 local/test 内存适配器与非 local `UnprovisionedPasswordResetDelivery`：未配置传输不宣称送达，202 仅“已受理”，DENY 审计 `password_reset_delivery_unprovisioned`；传输异常只记 DENY 不改响应。未改 HTTP 契约（`ApiRateLimited` 已声明 `Retry-After`）。
- 防枚举审计：畸形/缺失标识符用 `PrincipalId.unresolved()` 哨兵主体、禁用账户用真实主体，均写 DENY 且不生成挑战/不投递；`confirm()` 对禁用账户返回 401。限流键改为域分离 `HMAC-SHA256(fingerprintSecret, "iam-password-reset-target:"+identifier)`。429 统一返回 `Retry-After: 60`。
- 验证（JDK 25）：全套 `80/0/0（19 skipped）`（新增 3 项）；真实 HTTP 冒烟（local profile）同一标识符第 6 次请求 429 + `Retry-After: 60` + 规范 `RATE_LIMITED` envelope。
- 边界：只关闭 P1-3；真实投递与重试归后续 Outbox/notification；任务保持 `IN_PROGRESS / NOT_RUNTIME_VERIFIED`，下一批为 P1-4 native 可信上下文。

## 2026-09-11 M2-002 返工批次 4：native 可信上下文默认拒绝

- 实现：`iam.auth.native-transport-policy` 默认 `deny`，`local-unverified` 仅限显式 local/test（启动守卫）；`requireDevice`/`trustedSession`/`validateTrustedTransport` 统一拒绝未配置可信上下文的 `NATIVE_SECURE_STORAGE`（400 `iam.auth.native_transport_untrusted`，复用已声明的边界校验，无契约变更）；`application-local.yaml` 用 env 可覆盖占位符显式开启本地允许。Web 行为不变。曾评估的 403 契约声明因触发 M1 固定基线链 promotion 治理而撤回。
- 验证（JDK 25）：全套 `82/0/0（19 skipped）`（+2 新测试）；进程冒烟：deny 下 native register 400 + Web 201（refresh 仅 Cookie）；local 默认 native 201 + body token。
- 边界：只关闭 P1-4；真实 App Attest/Play Integrity 与真机 Keychain/Keystore 验收仍属外部配置；任务保持 `IN_PROGRESS / NOT_RUNTIME_VERIFIED`，下一批为 Consent/Policy 加固（批次 ⑤）与 opt-in Evidence（⑥）。

## 2026-09-04 IAM 账户/密码并发安全检查点

- 源码：`9deb899`。认证改为锁前单次 cost-12 BCrypt、锁内 current principal/hash/status/counter 复核；credential epoch 在校验期间变化时统一 `INVALID_CREDENTIALS` 且零写入，避免旧在途请求污染或锁死刚重置的新凭据。
- 真实 MySQL 8.4/Spring 事务测试覆盖：单笔与四笔旧 hash 在途时 reset 先提交、旧请求全部失败关闭、新 epoch 计数/状态不变、新密码随后登录成功；同一 current hash 四路普通错误精确累计至锁定；audit outage 同时回滚账户事实与 idempotency claim。
- 验证：Java 25 定向 `29/29`；普通全套 `57` 项、`0 failure / 0 error`（13 项外部集成按配置跳过）；MySQL 专项 `8/8`；只含 `9deb899` 的临时 detached worktree 定向 `29/29`；diff PASS。
- 独立审查首轮发现“stale credential 污染新 epoch 计数”并判定 `REWORK`；返工后同一 reviewer 最终 `ACCEPT`、P1/P2=`0/0`。本结论仅关闭账户密码并发批次，`P1R-M2-002` 继续 `IN_PROGRESS / NOT_RUNTIME_VERIFIED`。

## 2026-09-04 Gateway health 与 Evidence 责任闭环校正

- 修正 canonical `GET /api/v1/health` 身份：summary 为“读取 API Gateway 健康状态”，`HealthData.service=api-gateway`；路径、method、operationId、响应 envelope/status/header/schema 与其他 wire shape 均未晋升。
- 受控 compatibility scope 固定为 `OPENAPI_GATEWAY_ROOT_AND_HEALTH_IDENTITY_ONLY`；完整 execution target plan digest 为 `89b7361e29ff87defa1c4579bbf44ed0c4ec1d0ac7327d71fbe6a2d504b13694`，其中 execution target policy semantic digest 为 `d5182f41d59ef89a4e4743db930eda8ab0e42eb1113d6d57b08b9e4af507c2f9`；完整 Gateway root digest 为 `c58a64d1dec50705e462c5ff11fee166ac10c3caf9e4432a7c154b2bbab99ab3`，full OpenAPI semantic digest 为 `1f85e59cc7263cae9cd3517a89f1a394f07fcedfb9aac2669d92aae0e07031d7`，descriptor set digest 为 `864d4bfa2d87df7f7b257e03d116663bc83325947e01609be301a42f41cf678e`。
- 发布 `M2-EVIDENCE-RESPONSIBILITY-ADDENDUM-2026-09-04.md`：M2-001 持有 CORS/CSRF、public-path 与 Redis 限流实现/Evidence；durable audit、NetworkPolicy、平台关联终验、staging 复验分别由 M2-006、M2-008、M2-010、M8-013 持有。六项 Gateway runtime GAP 全部保持 `OPEN`，M2-003 依赖与最终 Gate 不变。
- 验证：Java 25 Gateway `63/63`、Gateway Node `37/37`、contract tooling `63/63`、合并 `26 OpenAPI fragments / 20 event fragments / 396 routes / 191 events`、校验 `427 operations / 783 schemas / 191 events`、生成物 `5/5`、相对 `66246d5` 的 OpenAPI compatibility `0 breaking`、计划 `108/108` 均 PASS。
- 源码检查点：`9560c75`。独立治理审查首轮为 `REWORK`、P1/P2=`0/2`，修正执行入口/交接旧责任、Addendum 适用范围、M2-004 audit-service owner、历史 superseded 范围及 digest 标签后，同一 reviewer 最终 `ACCEPT`、P1/P2=`0/0`；`P1R-M2-001` 仍因真实跨进程 Evidence 未齐而继续 `IN_PROGRESS / NOT_RUNTIME_VERIFIED`。

## 2026-09-04 中断恢复与 Gateway 安全收口检查点

- 恢复起点：`dev@9e88958f22a3abff7f4521b819330be84207c0ae`，当时工作区干净且本地远程跟踪为 `0/0`；既有 IAM/Gateway 成果全部保留，没有执行 reset/clean/checkout。
- Gateway 检查点：`acee36a84ee1fd6557ac3b62a41d033622e8da4a`。移除三条尚无 provider-signature 边界的支付回调 execution projection，使其在精确高优先级规则上 404 fail closed；响应提交前把 request/trace header 归一为单值；B12/B13/B14 及未注册的 core-api compatibility 默认关闭。
- 契约投影同步为 `151 projections / 168 available operations / 197 unavailable operations`，当时 execution target digest 为 `5fbbaa85800a951a06251478270fb97ff1a5c61bbada38e62c11823792377af1`；该历史值随后由上方 health/治理校正检查点的新 digest 取代。
- 验证：Java 25 Gateway `62/62`、Gateway Node `32/32`、全量 P1R `1416/1416`、contracts merge/validate、Git baseline compatibility、Gateway audit、plan、GAP registry 和 diff PASS。独立只读审查确认支付回调不存在前缀逃逸，但指出 Gateway health 仍错误沿用 `service=core-api`，真实 Netty header-copy 顺序也尚未跨进程验证。
- 状态：`P1R-M2-001` 继续 `IN_PROGRESS / NOT_RUNTIME_VERIFIED`。本轮不关闭任何 runtime GAP，不创建 canonical Evidence，不解锁 M2-003。
- 平台依赖审计确认：durable audit 自然属于 M2-006、NetworkPolicy 运行证明自然属于 M2-008/M2-010；把二者同时作为 M2-001 前置会形成依赖闭环。下一治理检查点须明确实施/Evidence/最终 Gate 责任，不能降低最终标准或提前验收。
- 远程：首次 fetch/push 因 GitHub HTTPS 连接重置/443 不可达失败；本地提交已安全落盘，网络恢复后必须重试推送并记录远程 SHA。

## 2026-09-01 启动

- 前置：M1-018 独立终验 `ACCEPT`、P1/P2=`0/0`；全局 Evidence Gate PASS；远程 `dev` 已包含 `d7fdabb01655e3c2c1e13c076d7ba2bf8281875c`。
- 并行轨道：`P1R-M2-001` Gateway 与 `P1R-M2-002` IAM 转为 `IN_PROGRESS`；`P1R-M2-003` 仅做只读预研，等待两项依赖验收。
- 执行模型：统筹 Agent 独占 Git、台账、Evidence 和公共文件；Gateway 与 IAM 执行 Agent 使用互斥服务目录，不提交、不推送。
- 运行诚实性：当前可完成代码、Java 25 测试和本机可用依赖验证；未实际运行的 Redis/MySQL/JWKS/upstream/浏览器/NetworkPolicy/跨进程链路继续 `NOT_RUNTIME_VERIFIED`。
