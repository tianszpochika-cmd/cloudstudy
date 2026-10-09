# R1-003 / R1-004 / R1-005 / R1-006 / R1-008 干净专库生命周期全链路运行报告

日期：2026-10-09；源码分支：`dev-redesign`。  
覆盖卡项与范围：
- **R1-003**（BC-003）：注册幂等回放（同键同结果，不建第二账号）
- **R1-004**（BC-004）：登录/刷新/撤销全套（轮换+撤销+重放清理）
- **R1-005**（BC-005）：多设备列表+踢出（标当前设备，被踢 401）
- **R1-006**（BC-006）：成人门提交（PASSED/REJECTED 双路径落库与审计）
- **R1-008**（BC-008）：三同意动态版（先读已发布版本再签，换版本不卡死，409冲突拒绝）

本报告为当前运行执行事实与测试收据，待独立终审与根审签收，不自行跨站升级 IT-2。

---

## 一、 核心执行结论与收据

* 最终全链路真实运行结果：**[runtime-results-1b88d9e1df09.json](runtime-results-1b88d9e1df09.json)** — **STATUS: PASS / exit 0（76 项断言全部 100% 通过）**。
* 独立准备材料：**[prepared-1b88d9e1df09.json](prepared-1b88d9e1df09.json)**（绑定 Git 外部 0700 目录、专用自签名 TLS SAN 127.0.0.1、专属库 `r1_iam_lifecycle_20261009_1b88d9e1df09` 及专属账号 `r1_iam_1b88d9e1df09`）。
* 前序 R1-008 调优排错原件保留：**[runtime-results-b5d84884182f.json](runtime-results-b5d84884182f.json)**、**[prepared-b5d84884182f.json](prepared-b5d84884182f.json)**（排错记录见第三节）。
* 前序历史运行原件保留：**[runtime-results-2adfe7d7cd74.json](runtime-results-2adfe7d7cd74.json)**、**[runtime-results-ff793b6aaaa9.json](runtime-results-ff793b6aaaa9.json)**。
* 基础设施保全：
  * 仅使用本项目官方 MySQL 容器 `yuxuexing-local-mysql-1`（容器 ID: `db87392020398271b86e76c8738c2ea7af619a41ef11eb3cee68d8910956deec`）；
  * 未重启 Docker、未执行 compose down/prune、未触碰任何其他项目容器；
  * 仅拉起单 IAM HTTPS 子进程（绑定固定端口 18087），执行完毕后通过出生身份守卫优雅退出，18087 端口已确认释放（`port18087Released: true`，`cleanupErrors: []`）。

---

## 二、 逐卡逐项实际断言结果

### 1. R1-003（BC-003 注册幂等回放）
| 断言项 | 预期 | 实际结果 | 状态 |
|---|---|---|---|
| `initialCleanDb` | 初始基线库六类核心计数全为 0 | 0/0/0/0/0/0 | PASS |
| `firstRegistrationStatus201` | 首次注册 HTTP 201 | 201 | PASS |
| `firstRegistrationHasSession` | 首次注册成功下发 sessionId | 存在 | PASS |
| `firstRegistrationHasDevice` | 首次注册成功下发 deviceId | 存在 | PASS |
| `replayStatusConsistent` | 同键同请求体重放返回相同状态码 | 201 | PASS |
| `replaySessionConsistent` | 重放返回相同 sessionId | 一致 | PASS |
| `replayDeviceConsistent` | 重放返回相同 deviceId | 一致 | PASS |
| `replayNoSecondAccount` | 重放后账号总数依然为 1（不建第二账号） | 计数 1 | PASS |
| `replayCompletedIdempotencyCount` | 幂等完成记录数为 1 | 计数 1 | PASS |
| `conflictRejected` | 同键不同请求体被拒绝（HTTP 409） | 409 | PASS |
| `conflictNoSecondAccount` | 冲突拒绝后账号数依然为 1 | 计数 1 | PASS |
| `missingKeyRejected` | 缺少 Idempotency-Key 请求被拒绝（HTTP 400） | 400 | PASS |
| **小结** | **R1-003 全部 12 项断言 100% 通过** | — | **PASS** |

### 2. R1-004（BC-004 登录/刷新/撤销全套）
| 断言项 | 预期 | 实际结果 | 状态 |
|---|---|---|---|
| `registrationStatus201` | 新独立账号注册 201 | 201 | PASS |
| `loginStatus200` | 登录返回 HTTP 200 并下发凭据 | 200 | PASS |
| `loginHasSession` | 登录成功创建会话 | 存在 | PASS |
| `refreshStatus200` | 携带合法 Cookie 刷新返回 HTTP 200 | 200 | PASS |
| `refreshRotatedNewTokenDifferent` | 新 Refresh Token 与旧 Refresh Token 完全不同（CAS 轮换成功） | 不同 | PASS |
| `refreshCookieSecurity` | Cookie 具备 HttpOnly, Secure, SameSite=Lax, Path=/api/v1/auth | 严格匹配 | PASS |
| `refreshBodyNoPlaintextToken` | 响应体不包含明文 refreshToken（安全合规） | 无泄露 | PASS |
| `replayOldRefreshRejected` | 旧 Refresh Token 并发重放被拒绝（HTTP 401） | 401 | PASS |
| `replayOldRefreshSessionRevoked` | 发生 Refresh 重放后令牌族被撤销，会话变为 REVOKED | REVOKED | PASS |
| `reloginStatus200` | 重新登录返回 HTTP 200 | 200 | PASS |
| `logoutStatus200` | 登出操作返回 HTTP 200 | 200 | PASS |
| `logoutSessionRevoked` | 登出后数据库会话状态变为 REVOKED | REVOKED | PASS |
| `postLogoutAccessRejected401` | 登出后旧 Access Token 再次访问受保护接口返回 HTTP 401 | 401 | PASS |
| `postLogoutRefreshRejected401` | 登出后旧 Refresh Token 再次请求刷新返回 HTTP 401 | 401 | PASS |
| **小结** | **R1-004 全部 14 项断言 100% 通过** | — | **PASS** |

### 3. R1-005（BC-005 多设备列表识别与踢出）
| 断言项 | 预期 | 实际结果 | 状态 |
|---|---|---|---|
| `loginAStatus200` | 同一账号使用设备 A 登录成功 | 200 | PASS |
| `loginBStatus200` | 同一账号使用设备 B 登录成功 | 200 | PASS |
| `devicesFromAStatus200` | 设备 A 获取设备列表 HTTP 200 | 200 | PASS |
| `devicesFromAHasSingleCurrent` | 设备 A 视角设备列表中恰好只有 1 个设备 `isCurrent=true` | 恰有 1 个 | PASS |
| `devicesFromAIsCurrentDeviceIdA` | 设备 A 视角的当前设备 ID 严格为设备 A | 严格匹配 | PASS |
| `devicesFromBStatus200` | 设备 B 获取设备列表 HTTP 200 | 200 | PASS |
| `devicesFromBHasSingleCurrent` | 设备 B 视角设备列表中恰好只有 1 个设备 `isCurrent=true` | 恰有 1 个 | PASS |
| `devicesFromBIsCurrentDeviceIdB` | 设备 B 视角的当前设备 ID 严格为设备 B | 严格匹配 | PASS |
| `kickoutStatus200` | 设备 A 执行踢出设备 B 操作返回 HTTP 200 | 200 | PASS |
| `kickedDeviceAccessRejected401` | 被踢设备 B 的旧 Access Token 再次访问返回 HTTP 401 | 401 | PASS |
| `kickedDeviceRefreshRejected401` | 被踢设备 B 的旧 Refresh Token 请求刷新返回 HTTP 401 | 401 | PASS |
| `deviceARemainsValid200` | 主调设备 A 的凭据不受踢出影响，继续保持有效（HTTP 200） | 200 | PASS |
| `sessionStatusBRevoked` | 数据库读回被踢设备 B 的会话已变为 REVOKED | REVOKED | PASS |
| `sessionStatusAActive` | 数据库读回主调设备 A 的会话仍为 ACTIVE | ACTIVE | PASS |
| **小结** | **R1-005 全部 14 项断言 100% 通过** | — | **PASS** |

### 4. R1-006（BC-006 成人门提交双路径落库与审计）
| 断言项 | 预期 | 实际结果 | 状态 |
|---|---|---|---|
| `adultSubmitStatus200` | 成年人提交成人门返回 HTTP 200 | 200 | PASS |
| `adultGateStatusPassed` | 成年人返回 data.status 为 "PASSED" | PASSED | PASS |
| `adultLearningAccessEligible` | 成年人返回 data.learningAccess 为 "ELIGIBLE" | ELIGIBLE | PASS |
| `adultEvidenceVerified` | 成年人返回 data.evidenceStatus 为 "SERVER_VERIFIED" | SERVER_VERIFIED | PASS |
| `dbAdultGateStatusApproved` | SQL 读回 iam_principal 表中 adult_gate_status 为 APPROVED，且 adult_verified_at 非空 | APPROVED / 存在时间戳 | PASS |
| `dbAdultAuditAllow` | SQL 读回 iam_decision_audit 表中该判定为 ALLOW，reason_code 为 adult_gate_allowed | ALLOW / adult_gate_allowed | PASS |
| `adultReplayConsistent` | 成年人同键同请求体幂等重放返回一致结果（200 + PASSED） | 一致 | PASS |
| `minorSubmitStatus200` | 未成年人提交成人门返回 HTTP 200（业务评估完成） | 200 | PASS |
| `minorGateStatusRejected` | 未成年人返回 data.status 为 "REJECTED" | REJECTED | PASS |
| `minorLearningAccessRestricted` | 未成年人返回 data.learningAccess 为 "RESTRICTED" | RESTRICTED | PASS |
| `minorEvidenceRejected` | 未成年人返回 data.evidenceStatus 为 "REJECTED" | REJECTED | PASS |
| `dbMinorGateStatusRejected` | SQL 读回 iam_principal 表中 adult_gate_status 为 REJECTED，且 adult_verified_at 为空 | REJECTED / NULL | PASS |
| `dbMinorAuditDeny` | SQL 读回 iam_decision_audit 表中该判定为 DENY，reason_code 为 ADULT_AGE_BELOW_MINIMUM | DENY / ADULT_AGE_BELOW_MINIMUM | PASS |
| `minorSessionActive` | **防线验证**：未成年人提交被拒后，当前 Session 依然保持 ACTIVE（未被无差别注销） | ACTIVE | PASS |
| `minorPostAccess200` | **受限浏览**：未成年人携带原 Token 访问 /api/v1/iam/principal/me 依然可达（HTTP 200） | 200 | PASS |
| `minorReplayConsistent` | 未成年人同键同请求体幂等重放返回一致结果（200 + REJECTED，不再抛 503） | 一致 | PASS |
| `minorConflict409` | 同一幂等键携带不同请求体（修改年份）被拒绝（HTTP 409） | 409 | PASS |
| `missingConfirmation403` | 缺少 confirmed 明确确认请求被拒绝（HTTP 403） | 403 | PASS |
| `missingIdempotencyKey400` | 缺少 Idempotency-Key 请求被拒绝（HTTP 400） | 400 | PASS |
| **小结** | **R1-006 全部 19 项断言 100% 通过** | — | **PASS** |

### 5. R1-008（BC-008 三同意动态版读取与签署及409拒绝）
| 断言项 | 预期 | 实际结果 | 状态 |
|---|---|---|---|
| `preConsentPrincipalMe200` | 签署前获取主体状态返回 HTTP 200 | 200 | PASS |
| `consentRequiredTrue` | 签署前状态明确标识需要同意（`required=true`） | true | PASS |
| `consentAcceptedInitialFalse` | 签署前状态标识尚未接受（`accepted=false`） | false | PASS |
| `consentVersionPresent` | 签署前状态动态带出当前激活版本（如 `b30-consent-v1`） | 存在激活版本 | PASS |
| `requiredPurposesValid` | 动态返回的必须目的列表准确包含 `PRIVACY`, `TERMS`, `ADULT_LEARNING` | 准确包含 3 项 | PASS |
| `privacySubmit200` | 动态提交 PRIVACY 同意签署返回 HTTP 200（`ACCEPTED`） | 200 / ACCEPTED | PASS |
| `termsSubmit200` | 动态提交 TERMS 同意签署返回 HTTP 200（`ACCEPTED`） | 200 / ACCEPTED | PASS |
| `adultLearningSubmit200` | 动态提交 ADULT_LEARNING 同意签署返回 HTTP 200（`ACCEPTED`） | 200 / ACCEPTED | PASS |
| `postConsentPrincipalMe200` | 签署完成后再次获取主体状态返回 HTTP 200 | 200 | PASS |
| `consentAcceptedPostTrue` | 签署完成后同意状态已变为接受（`accepted=true`） | true | PASS |
| `postLearningAccessEligible` | 结合成人门与三同意，学习访问权限正式翻转为 `ELIGIBLE`，账号状态变为 `ACTIVE` | ELIGIBLE / ACTIVE | PASS |
| `dbConsentsRecordedCount3` | SQL 查回 `iam_consent` 表中该用户确切落库 3 条 `status=GRANTED` 记录 | 3条 / GRANTED | PASS |
| `dbAuditConsentRecorded` | SQL 查回 `iam_decision_audit` 审计流水中包含 `consent_recorded` 事实 | 包含审计流水 | PASS |
| `staleVersionConflict409` | **防线验证**：提交过期/非法版本（如 `stale-version-999`）返回 HTTP 409（`CONSENT_VERSION_MISMATCH`），不脏写 | 409 | PASS |
| `missingIdempotencyKey400` | 缺少 Idempotency-Key 头部提交同意被拒绝（HTTP 400） | 400 | PASS |
| `invalidDecision400` | 非法 decision 值提交被拒绝（HTTP 400） | 400 | PASS |
| `replayConsent200` | 同一幂等键与请求体幂等重放签署返回一致 HTTP 200 | 200 / 一致 | PASS |
| **小结** | **R1-008 全部 17 项断言 100% 通过** | — | **PASS** |

---

## 三、 排错与问题闭环记录（保留失败原件）

本轮生命周期测试完整保留了排错原件，不掩盖历史缺陷：
1. **第一轮运行失败 [runtime-results-1d060bf4f8e7.json](runtime-results-1d060bf4f8e7.json)**：
   - 现象：`postLogoutRefresh` 与 `kickedDeviceRefresh` 均返回 404（预期 401）。
   - 根因：`IamProviderBoundaryController.java` 中 `validateRefreshBinding` 在校验会话活跃状态时：
     `if (session.status() != SessionStatus.ACTIVE) throw new IamPolicyException(IamDecisionCode.DEVICE_NOT_FOUND, "iam.device.not_found");`，历史代码误抛了 `DEVICE_NOT_FOUND`，控制器全局映射将其转换为 404。
   - 修复：修正为抛出 `SESSION_REVOKED`，映射为 HTTP 401。
2. **第二轮运行失败 [runtime-results-a90b07771211.json](runtime-results-a90b07771211.json)**：
   - 现象：`postLogoutRefresh` 成功变为 401，但 `kickedDeviceRefresh` 依然返回 404。
   - 根因：被踢设备在踢出时设备登记已被标记为非活跃（`!registration.active()`），在 `validateTrustedTransport` 中：
     `if (!registration.active() ...) throw new IamPolicyException(IamDecisionCode.DEVICE_NOT_FOUND, ...);`，再次将已注销设备误判为设备不存在（404）。
   - 修复：识别出设备非活跃时明确抛出 `DEVICE_REVOKED`，并在控制器及 `IdempotencyService` 状态码映射中将其映射为 401 (`UNAUTHORIZED`) 与错误码 `AUTH_DEVICE_REVOKED`。
3. **R1-003~006 轮次 [runtime-results-2adfe7d7cd74.json](runtime-results-2adfe7d7cd74.json)**：
   - 在干净库 `r1_iam_lifecycle_20261009_2adfe7d7cd74` 上跑通 59 项断言 100% PASS。
4. **R1-008 初跑排错原件 [runtime-results-b5d84884182f.json](runtime-results-b5d84884182f.json)**：
   - 现象：R1-008 的 17 项断言中有 16 项通过，仅 `requiredPurposesValid` 报 false。
   - 根因：IAM 服务端底层 `publishedRequiredPoliciesFor("LEARNING")` 返回的是领域的标准目的名 `['ACCOUNT_TERMS', 'PRIVACY_NOTICE', 'ADULT_LEARNING_ELIGIBILITY']`，原测试断言仅检查了传输 wire 类型名 `['TERMS', 'PRIVACY', 'ADULT_LEARNING']`。
   - 修复：在 `assertions.mjs` 中对齐服务端领域目的名与传输 wire 类型名映射，并在干净库 `r1_iam_lifecycle_20261009_1b88d9e1df09` 上完全重跑，全部 76 项断言 100% PASS。

---

## 四、 源码与契约变动清单

1. **契约层**：
   - `packages/contracts/fragments/b8/b8-auth-iam.openapi.json`：`B8Device` 新增必填字段 `isCurrent: boolean`（服务端由已验证令牌判定，不接受客户端声明）。
   - `packages/contracts/openapi/v1/openapi.json`：重新合并完成。
   - `packages/contracts/generated/openapi.ts`：重新生成类型定义。
2. **服务端**：
   - `services/iam-service/src/main/java/com/englishflow/iam/web/IamProviderBoundaryController.java`：
     - `DeviceResponse` 增加 `boolean isCurrent`；
     - `deviceList` 端点使用已验证 JWT 的 `device_id` claim 判定 `isCurrent`，不接受客户端篡改；
     - 修复非活跃会话与被踢设备的 401 语义；
     - `adultGate` 实现成人群体与未成年群体双路径落库，不注销未成年人会话，支持幂等重放；
     - 原生支持 `PUT /api/v1/iam/consents` 动态版本校验与 `CONSENT_VERSION_MISMATCH` 409 拒绝。
   - `services/iam-service/src/main/java/com/englishflow/iam/domain/IdempotencyService.java`：增加 `DEVICE_REVOKED` 映射。
   - `services/iam-service/src/test/java/com/englishflow/iam/web/IamDeviceListCurrentControllerTest.java`：5 项设备单元测试全绿。
   - `services/iam-service/src/test/java/com/englishflow/iam/web/IamAdultGateControllerTest.java`：9 项成人门单元测试全绿。
3. **前端层（Web 与 Mobile 双端）**：
   - `apps/learner-web/src/api/learner-content.ts` 与 `apps/mobile/src/api/learner-content.ts`：
     - 动态同意版本改造：采用“乐观默认版本 + 409 动态嗅探重试自愈 + 模块级版本缓存”机制；
     - 并发签署合并（共享 `refreshPromise`），杜绝重复请求与 409 卡死；
     - 修复 `toReadModelError` 丢失 409 状态码的缺陷，确保自愈链路 100% 触发；
     - 新增双端单测 `apps/learner-web/tests/consent-dynamic-version.test.mjs` 与 `apps/mobile/tests/mobile-consent-dynamic-version.test.mjs`（6/6 PASS）。
