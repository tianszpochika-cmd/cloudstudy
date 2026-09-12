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

## 2026-09-11 M2-002 返工批次 5：Consent/Policy 部分提交加固

- `ConsentService` 成功审计移至 CAS 之后（拒绝零审计、审计失败随生产事务整体回滚）；`PolicyControlService.activate` 先目标 CAS 后 supersede，旧版本并发 CAS 失败转基础设施失败整体回滚，杜绝两个 ACTIVE 或半 supersede。
- 故障注入测试：activate 目标 CAS 拒绝 → 零 supersede、旧 active 不变；Consent CAS 拒绝 → 零成功审计；审计失败不可见事实测试改为事务化模拟（`TransactionalConsentStore`）后通过。
- 验证（JDK 25）：全套 `84/0/0（19 skipped）`；opt-in MySQL 事务矩阵 `10/10`。
- 边界：下一批 ⑥ 全 opt-in/跨进程 Evidence（P1-5），随后 ⑦ `local-adult-gate-enabled` 守卫（P2-3）；任务保持 `IN_PROGRESS / NOT_RUNTIME_VERIFIED`。

## 2026-09-11 M2-002 返工批次 6：全 opt-in 矩阵与跨进程持久化 Evidence

- opt-in 矩阵（真实 MySQL 8.0 隔离库，Flyway V14）：六个类 **18/18 PASS**；隔离 schema `iam_v13_test_20260911_a` 上 `IdempotencyV13MigrationSecurityTest` **1/1 PASS**；IAM 全套 `86/0/0（19 skipped）`。
- 跨进程持久化冒烟（`v2,local-real` + 持久化 + 真实 RSA 密钥）：注册 201 → 重启进程 → 刷新 200 且 `rotation=1`、history 1 行，DB `ACTIVE` 校验一致。
- 冒烟发现并修复两个真实缺陷：refresh 缺失 body 的幂等指纹 NPE（契约允许空 body）；不支持媒体类型被映射为 500（现为 400，并增加未预期异常服务端日志）。
- 证据：`evidence/p1r/m2/P1R-M2-002/opt-in-cross-process-evidence-2026-09-11.json`（sourceCommit=实现提交）。
- 边界：下一批 ⑦ `local-adult-gate-enabled` 守卫（P2-3）与 P3，随后重跑最终独立复审；任务保持 `IN_PROGRESS / NOT_RUNTIME_VERIFIED`。

## 2026-09-11 M2-002 返工批次 7：adult gate 守卫与幂等回调加固

- P2-3：非 local 启用 `iam.local-adult-gate-enabled` 即启动失败（local/test 放行），单元测试覆盖。
- P3：completed replay 的预期 `IamPolicyException` 不再于事务回调内抛出（转 `Outcome.failure` 事务外抛出），记录型 runner 测试证明；首答=重放一致性已由既有控制器测试覆盖；Clock 注入剩余项为元数据时间戳，另行排期。
- 验证（JDK 25）：IAM 全套 `88/0/0（19 skipped）`。
- 边界：全部返工批次（①–⑦）完成，下一步重跑最终独立复审；任务保持 `IN_PROGRESS / NOT_RUNTIME_VERIFIED`。

## 2026-09-11 M2-002 批次 8：终审 ACCEPT 与 P2-1 加固

- 最终独立只读复审判定 `ACCEPT`（P0=0、P1=0；P2=1 潜伏 fail-open、P3=2 非阻塞）；复跑 IAM `88/0/0（19 skipped）`、opt-in `18/18`、V13 `1/1`、P1R `1421/1421`、evidence gate PASS。
- 按复审建议加固：`hasRequiredConsentFor` 空必需描述符集合改为失败关闭（消除空控制面 fail-open）；`local-candidate` 来源守卫上移启动守卫并补单测；Clock 说明更正；legacy 控制器级 409 用例留作 P3 后续。
- 验证（JDK 25）：IAM 全套 `89/0/0（19 skipped）`；opt-in 同意类 `5/5`。
- 下一步：复审确认后进入 `REVIEW → ACCEPTED` 与 canonical manifest。

## 2026-09-11 M2-002 最终验收（ACCEPTED）

- 终审对 `c9f935b` 判定 `ACCEPT`（P0/P1/P2=0/0/0）；canonical manifest `evidence/p1r/m2/P1R-M2-002/manifest.json`（35 artifacts，sourceCommit `c9f935b`）；台账 `ACCEPTED`，轨迹 `PLANNED→READY→IN_PROGRESS→REVIEW→ACCEPTED`。
- 终审复跑：IAM `90/0/0（20 skipped）`、opt-in 全矩阵 `19/19`、V13 `1/1`、P1R `1421/1421`、evidence gate PASS。
- `P1R-M2-003` 依赖满足但未认领；总体阶段仍 `D2_CONTRACT_READY / NOT_RUNTIME_VERIFIED`。

## 2026-09-11 M2-003 Batch 1a：learning-service 事实来源修复

- 用户确认采用“服务侧 PDP/本地策略事实”方案；JWT 只提供身份/租户/角色/权限。
- learning-service：新增 JWT authorities 转换器与 `LearningHttpPrincipals` 默认拒绝入口（缺 tenant/角色/权限即 401/403），删除生产 `phaseOne()` 硬编码 GRANTED 工厂与死代码 resolver；测试夹具迁移 test-only。
- 验证（JDK 25）：learning 全套 `121/0/0/0`；learning-loop contract PASS（50 adversarial cases）。

## 2026-09-11 M2-003 Batch 1b：assessment-service PEP 基线

- assessment-service：新增 JWT authorities 转换器与 `AssessmentHttpPrincipals` 默认拒绝入口（缺 tenant/角色/权限即 401/403），B10/B25 控制器统一接入；关闭此前 tenant 缺省放行分支。
- 验证（JDK 25）：assessment 全套 `37/0/0/0`；assessment contract PASS（5 routes / 78 adversarial cases）。
- 下一步：Batch 1c content-service 与 learner-service 对齐；随后 Batch 2-4。

## 2026-09-11 M2-003 Batch 1c：content 与 learner 服务对齐

- content-service：新增 JWT authorities 转换器与 `ContentHttpPrincipals` 默认拒绝入口（B3/B25 弱入口统一接入）；工厂要求显式 platform tenant 且 roles/permissions 不得同时为空；修复头过滤器驼峰参数黑名单永不匹配的真实缺陷。
- learner-service：新增转换器与 `LearnerHttpPrincipals`（UUID/`prn_` 主体、platform 租户、learner 角色、非空权限），B25 统一接入。
- 验证（JDK 25）：content `113/0/0/0`、learner `30/0/0/0`；新增负例测试全通过。
- Batch 1（learning/assessment/content/learner）完成；下一步 Batch 2（media/social/admin-ops）。

## 2026-09-11 M2-003 Batch 2①：media-service

- 新增 JWT authorities 转换器与 `MediaHttpPrincipals` 默认拒绝入口，`MediaController.context()` 统一接入；头过滤器由 5 个拒绝头扩展到基线 12 个（含工作负载身份/mTLS 头）与 10 个参数。
- 验证（JDK 25）：media `51/0/0/0`；media contract PASS。
- 下一步 Batch 2② social-service、③ admin-ops-service。

## 2026-09-11 M2-003 Batch 2②：social-service

- 修复 `SocialJwtAuthenticationConverter` 的 tenant 缺省回退 `platform`：缺失/空白/非 platform 一律 `BadCredentialsException`（fail-closed）；新增 converter 负例测试（缺 tenant/异租户/无 consent 不可用）。
- 验证（JDK 25）：social `48/0/0/0`；gamification-social contract PASS。
- 下一步 Batch 2③ admin-ops-service。

## 2026-09-11 M2-003 Batch 2③：admin-ops-service

- 复核权限映射（`PERM_`/`ROLE_` 已正确、tenant 缺失已 fail-closed）；头拒绝由 5 个扩展到 13 个（工作负载身份/mTLS 头）。
- 新增 converter/AdminPep/头过滤器测试；验证（JDK 25）：admin-ops `44/0/0/0`。
- Batch 2 完成（media 51、social 48、admin-ops 44）；下一步 Batch 3（notification/commerce/analytics）。

## 2026-09-11 M2-003 Batch 3①：notification-service

- 新增头拒绝过滤器（12 头/7 参数）、统一 401/403 envelope 与 JWT authorities 转换器并接入 Resource Server；resolver 既有 401/权限来源语义不变。
- 验证（JDK 25）：notification `76/0/0/0`；notification-sync-support contract PASS。
- 下一步 Batch 3② commerce、③ analytics。

## 2026-09-11 M2-003 Batch 3②：commerce-service

- `UntrustedCommerceFactsFilter` 由静默剥离改为显式拒绝（13 头/7 参数，403）；新增 `CommerceJwtAuthenticationConverter` 并接入 Resource Server；callback 路径保持 authenticated fail-closed + 域层 HMAC 签名校验不变。
- 验证（JDK 25）：commerce `72/0/0/0`；commerce contract PASS。
- 下一步 Batch 3③ analytics-service。

## 2026-09-11 M2-003 Batch 3③：analytics-service

- 新增 JWT authorities 转换器并接入；头拒绝由 6 扩展到基线 14 个并新增查询参数拒绝；resolver 负例测试覆盖权限/租户/撤销/来源 allowlist；tenant/owner 默认拒绝边界确认（查询强制 caller 租户、重算字段白名单）。
- 验证（JDK 25）：analytics `29/0/0/0`；privacy-analytics-audit contract PASS。
- Batch 3 完成（notification 76 / commerce 72 / analytics 29）；下一步 Batch 4 gamification-service。

## 2026-09-11 M2-003 Batch 4：gamification-service（11/11 服务完成）

- 头拒绝 5→13 并新增参数拒绝；`GamificationPrincipalResolver` 统一强制显式 platform 租户（缺 401/异租户 403）；新增 filter/resolver/owner 策略测试。
- 验证（JDK 25）：gamification `35/0/0/0`；gamification-social contract PASS。
- M2-003 实施批次完成，共 11 服务；下一步 M2-003 运行证据 + 最终独立复审 + manifest。

## 2026-09-11 M2-003 Batch 5：IAM 信封 JWKS 兼容修复（learning 原型）

- 运行冒烟发现关键集成缺陷：领域服务标准 `withJwkSetUri` 无法解析 IAM 的 `{"data":{"keys":[...]}}` 信封 JWKS → 真实令牌全部 401（仅 Gateway 有信封感知源）。
- learning 原型：新增 `IamEnvelopedJwkSource`（信封/裸 Set、TTL 缓存、失败关闭）+ `decoder(...)`；4 项单测；真实进程冒烟：缺/篡改 401、伪造头 403、合法令牌不再 401（404 属 jdbc 控制器未激活预期）。
- 验证（JDK 25）：learning `125/0/0/0`。
- 推广计划：其余 10 服务 + service-template 分批复制并加解析单测，然后重做运行证据与复审。

## 2026-09-11 M2-003 Batch 5 推广①：assessment / content / learner / media

- 四服务复制 `IamEnvelopedJwkSource` 并替换 decoder；各 +4 项单测。
- 验证（JDK 25）：assessment 41、content 117、learner 34、media 55，全 `0 failures / 0 errors`。
- 剩余：推广② social/admin-ops/notification/commerce；③ analytics/gamification/service-template。

## 2026-09-11 M2-003 Batch 5 推广②：social / admin-ops / notification / commerce

- 四服务复制 `IamEnvelopedJwkSource` 并替换 decoder（跨包 import 补齐）；各 +4 项单测。
- 验证（JDK 25）：social 52、admin-ops 48、notification 80、commerce 76，全通过。
- 剩余：推广③ analytics/gamification/service-template。

## 2026-09-11 M2-003 Batch 5 推广③：analytics / gamification / service-template（推广完成）

- 三服务复制 `IamEnvelopedJwkSource` 并替换 decoder；各 +4 项单测。
- 验证（JDK 25）：analytics 33、gamification 39、service-template 16，全通过。
- 11 领域服务 + 模板信封 JWKS 对齐完成；下一步跨服务运行证据 + 最终复审 + manifest。

## 2026-09-11 M2-003 Batch 6：验收证据归档

- 证据：`evidence/p1r/m2/P1R-M2-003/runtime-evidence-2026-09-11.json`（sourceCommit `5a7a67e`）；11 服务矩阵合计 700（0/0/0）+ 模板 16；learning 真实进程冒烟（401/401/403/合法令牌通过 JWKS/伪造租户头 403）。
- 已知边界：PDP 事实源、端点级 @PreAuthorize 矩阵、schema/Flyway/跨租户守卫（M2-004）。
- 下一步：最终独立只读复审 → manifest → ACCEPTED。

## 2026-09-11 M2-003 Batch 7：终审判定 REWORK 与返工计划

- 独立只读终审（`ses_f6c3e93edffeynLy2zpSvtGdTm`）判定 `REWORK`（P1=3/P2=1/P3=4）：基线可复现（700/0/0/0）、信封解码器 12 份同源，但 PDP fail-closed 未交付、每服务 JWT 负例缺失、phase/consent/rights 入口未默认拒绝；另死配置与 P3 若干。
- 返工批次：7a 每服务 JWT 负例（本地 JWKS 夹具）→ 7b fail-closed PDP/策略缓存与入口守卫 → 7c 死配置/tenant 严格性/显式接线/超限单测/证据元数据 → 7d 重跑矩阵与终审。
- 任务保持 `IN_PROGRESS / NOT_RUNTIME_VERIFIED`。

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
