# R1-003 / R1-004 / R1-005 干净专库生命周期全链路运行报告

日期：2026-10-09；源码分支：`dev-redesign`。  
覆盖卡项与范围：
- **R1-003**（BC-003）：注册幂等回放（同键同结果，不建第二账号）
- **R1-004**（BC-004）：登录/刷新/撤销全套（轮换+撤销+重放清理）
- **R1-005**（BC-005）：多设备列表+踢出（标当前设备，被踢 401）

本报告为当前运行执行事实与测试收据，待独立终审与根审签收，不自行跨站升级 IT-2。

---

## 一、 核心执行结论与收据

* 最终全链路真实运行结果：**[runtime-results-ff793b6aaaa9.json](runtime-results-ff793b6aaaa9.json)** — **STATUS: PASS / exit 0**。
* 独立准备材料：**[prepared-ff793b6aaaa9.json](prepared-ff793b6aaaa9.json)**（绑定 Git 外部 0700 目录、专用自签名 TLS SAN 127.0.0.1、专属库 `r1_iam_lifecycle_20261009_ff793b6aaaa9` 及专属账号 `r1_iam_ff793b6aaaa9`）。
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

---

## 三、 排错与问题闭环记录（保留失败原件）

本轮生命周期测试完整保留了前两轮排错原件，不掩盖历史缺陷：
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
3. **最终轮次 [runtime-results-ff793b6aaaa9.json](runtime-results-ff793b6aaaa9.json)**：
   - 在新干净库 `r1_iam_lifecycle_20261009_ff793b6aaaa9` 上完整重跑，全部 40 项逐条断言 100% PASS。

---

## 四、 源码与契约变动清单

1. **契约层**：
   - `packages/contracts/fragments/b8/b8-auth-iam.openapi.json`：`B8Device` 新增必填字段 `isCurrent: boolean`（服务端由已验证令牌判定，不接受客户端声明）。
   - `packages/contracts/openapi/v1/openapi.json`：重新合并完成。
   - `packages/contracts/generated/openapi.ts`：重新生成类型定义。
2. **服务端**：
   - `services/iam-service/src/main/java/com/englishflow/iam/web/IamProviderBoundaryController.java`：
     - `DeviceResponse` 增加 `boolean isCurrent`；
     - `deviceList` 端点使用已验证 JWT 的 `device_id` claim（缺省时降级按 `session_id` 查会话表）判定 `isCurrent`，不接受客户端篡改；
     - 修复非活跃会话与被踢设备的 401 语义。
   - `services/iam-service/src/main/java/com/englishflow/iam/domain/IdempotencyService.java`：增加 `DEVICE_REVOKED` 映射。
   - `services/iam-service/src/test/java/com/englishflow/iam/web/IamDeviceListCurrentControllerTest.java`：新增 5 项专项单元测试。
3. **前端层**：
   - `apps/learner-web` 与 `apps/mobile`：设备列表均优先消费服务端的 `isCurrent`，并保留本地比对兜底，通过全量 typecheck 与单元测试。
