# R1-003 / R1-004 / R1-005 / R1-006 交付物独立终审审查报告 (Independent Final Review)

> **审查员**：Luna（独立终审审查员，Independent Reviewer）  
> **审查日期**：2026-10-09  
> **源码分支**：`dev-redesign`  
> **工作区基线**：`/Users/Admin/Desktop/work/cloudstudy`  
> **终审判定结论**：**`ACCEPTED_CARD_SCOPE / R1_003_004_005_006_ACCEPTANCE_PASS`**  
> **状态标记**：**`SAFELY_PAUSED`**（四卡验收通过，自有子进程已安全退出，端口 18087 已释放，宿主机与容器环境安全无损）

---

## 一、 审查背景与任务范围

根据 `AGENTS.md`（§0、§2.2、§2.3、§3、§4 DoD）以及 `dev-plan-R1.md` 的计划约定，独立终审审查员对迭代 2（Redesign）中 L1 注册入门环的连续四张核心卡及其交付物进行最高严谨度独立终审：

1. **R1-003（BC-003 / IC-002, IC-052）**：注册幂等回放（同键同结果，绝不建立第二账号，拒绝冲突并拒绝缺失键）。
2. **R1-004（BC-004 / IC-002, IC-053）**：登录 / 刷新 / 撤销全套生命周期（CAS 轮换、令牌族重放清理、登出全失效、Cookie 属性与禁止明文 Token 泄漏）。
3. **R1-005（BC-005 / IC-002, IC-008, IC-035）**：多设备列表识别与踢出（服务端令牌判定当前设备，客户端伪造防御，被踢设备令牌及 Refresh 全 401 失效，主调设备不受影响）。
4. **R1-006（BC-006 / IC-003, IC-055）**：成人门提交双路径落库与审计（PASSED 与 REJECTED 双路径 200 返回与数据库落库、审计 ALLOW/DENY 落库、拒绝路径会话保持 ACTIVE 不杀会话防闪退、幂等回放一致性无 503）。

---

## 二、 独立复核与执行验证事实

### 1. 真实运行收据审查（Clean DB Runtime Receipts）

审查员独立调阅了物理运行证据与各项数据收据：
- **最新全链路通过收据**：[`runtime-results-2adfe7d7cd74.json`](runtime-results-2adfe7d7cd74.json)
  - 专属隔离库：`r1_iam_lifecycle_20261009_2adfe7d7cd74`
  - 专属账号：`r1_iam_2adfe7d7cd74`
  - Flyway 迁移：17 项版本迁移成功，0 失败，最大版本 18。
  - 初始干净度验证：六类核心业务计数（`principals`, `accounts`, `sessions`, `devices`, `audits`, `completedIdempotency`）**全为 0**。
  - 执行结果：**`STATUS: PASS / exit 0`**，全部 **59 项断言 100% 通过**：
    - R1-003: 12/12 PASS
    - R1-004: 14/14 PASS
    - R1-005: 14/14 PASS
    - **R1-006: 19/19 PASS**
- **最新独立准备收据**：[`prepared-2adfe7d7cd74.json`](prepared-2adfe7d7cd74.json)
  - 绑定宿主目录模式 `0700`、私钥与密钥库模式 `0600`，UID 502 匹配，无软链接，自签名证书 SAN 严格绑定 `127.0.0.1` 与 `localhost`。
- **保留的历史运行原件**：
  - R1-003~005 三卡通过收据：[`runtime-results-ff793b6aaaa9.json`](runtime-results-ff793b6aaaa9.json)、[`prepared-ff793b6aaaa9.json`](prepared-ff793b6aaaa9.json)（保留原件备查）。
  - 第一轮排错失败收据：[`runtime-results-1d060bf4f8e7.json`](runtime-results-1d060bf4f8e7.json)（登出与踢出后刷新误报 404）。
  - 第二轮排错失败收据：[`runtime-results-a90b07771211.json`](runtime-results-a90b07771211.json)（被踢设备刷新误报 404）。
  - 历史原件完整保留，未掩盖缺陷，事实链条真实透明。

### 2. 基础设施与端口安全独立复查

审查员在宿主机环境上独立执行系统、端口与网络安全检查：
1. **端口 18087 释放核验**：
   - 执行 `lsof -i :18087`，退出码为 1，无任何残留监听。
   - 收据标记 `cleanup.port18087Released: true` 与 `cleanup.iamStopped: true` 经独立系统命令核实为真实。
2. **Docker 容器隔离核验**：
   - 执行 `docker ps` 核查，本项目官方容器 `yuxuexing-local-mysql-1`（容器 ID: `db8739202039...`）健康运行 25 小时以上。
   - 宿主机上并存的其他项目第三方容器（`qida-dev-tsz-*` 30+ 容器，`qida-clm-*` 等）已连续运行 22-23 小时以上，状态保持一致健康，**未发生 Docker 重启、未执行 compose down/prune、未触碰任何第三方容器**。
3. **安全与隐私防泄漏核验**：
   - 运行测试材料均存放于 Git 外部 `0700` 目录，收据中的私密目录路径均已被脱敏为 `<PRIVATE_MATERIAL_DIR>`，密码与原始 Token 均脱敏为 `<REDACTED_SECRET>`。
   - 全局扫描 Git 工作区，**无任何真实私钥、公私密钥对、密码或生产 JWT 令牌泄漏至 Git 仓库**。

### 3. R1-006 源码核心防线与架构审查

审查员对 `services/iam-service/src/main/java/com/englishflow/iam/web/IamProviderBoundaryController.java` 等源码变更进行逐行深度审计：

1. **双路径落库与业务语义规范（200 OK，而非 403 异常）**：
   ```java
   AdultGateFact fact = !result.allowed()
           ? adultGateFacts.invalidate(principal, "b30-adult-v1", result.auditDecision().occurredAt())
           : adultGateFacts.approve(principal, "b30-adult-v1", result.auditDecision().occurredAt());
   ResponseEntity<ApiSuccessEnvelope<AdultGateResponse>> response = success(HttpStatus.OK,
           adultGateResponse(fact), CacheControl.noStore());
   return executed(response, principal.toString());
   ```
   - **成年人路径**：返回 HTTP 200，`data.status: PASSED`，`data.learningAccess: ELIGIBLE`，`evidenceStatus: SERVER_VERIFIED`；数据库 `iam_principal` 落库 `adult_gate_status = APPROVED` 且 `adult_verified_at` 记入时间戳；`iam_decision_audit` 记录 `ALLOW`，`reason_code = adult_gate_allowed`。
   - **未成年人路径**：返回 HTTP 200（业务评估正常完成），`data.status: REJECTED`，`data.learningAccess: RESTRICTED`，`evidenceStatus: REJECTED`；数据库 `iam_principal` 落库 `adult_gate_status = REJECTED` 且 `adult_verified_at = NULL`；`iam_decision_audit` 记录 `DENY`，`reason_code = ADULT_AGE_BELOW_MINIMUM`。
2. **会话保持核心防线（拒绝时不杀会话，保护受限浏览态）**：
   - 彻底废弃历史代码中直接抛出异常乃至破坏 Session 的行为。未成年人被拒时，Session 绝对**不执行 `sessions.revoke(...)`**。
   - 验证收据显示：未成年人提交被拒后，数据库读回 `session.status` 保持为 **`ACTIVE`**，`revoked_at` 为空；其 Access Token 访问 `/api/v1/iam/principal/me` 返回 **HTTP 200**。此举严格保障了客户端可以平滑进入 Phase 1 的未成年人受限说明页（人话解释+正常退出通道），绝不会产生无故 401 闪退或锁死。
3. **幂等回放修复（修复被拒重放误抛 503 问题）**：
   ```java
   private ResponseEntity<ApiSuccessEnvelope<AdultGateResponse>> replayAdultGate(PrincipalId principal) {
       AdultGateFact fact = adultGateFacts.find(principal, Instant.now(clock));
       if ("PENDING".equals(fact.status())) throw new IamPolicyException(IamDecisionCode.IDEMPOTENCY_RESULT_UNAVAILABLE,
               "iam.idempotency.result_unavailable");
       return success(HttpStatus.OK, adultGateResponse(fact), CacheControl.noStore());
   }
   ```
   - 历史缺陷：原逻辑判断 `if (!"APPROVED".equals(fact.status()))`，导致未成年人被拒的记录在幂等重放时被误判为未完成而抛出 503 `IDEMPOTENCY_RESULT_UNAVAILABLE`。
   - 修复确认：仅在 `PENDING`（真正未决）时阻断，已完成判定的 `APPROVED` 和 `REJECTED` 均能 100% 幂等回放，返回 HTTP 200 与相同响应体。
4. **输入防御与空指针安全**：
   - 将 `AdultGateRequest` 的字段升级为包装类型 `Boolean confirmed, Integer birthYear`，并通过 `Boolean.TRUE.equals(request.confirmed())` 判定，杜绝反序列化为 null 时的拆箱 NPE。
   - 增加 `request.birthYear() == null` 校验与 `[0, 150]` 年龄合法区间防御，杜绝 500 内部错误。

### 4. 自动化测试与覆盖率复验

1. **R1-006 专项集成测试（`IamAdultGateControllerTest.java`）**：
   - 审查员独立运行 `mvn test -Dtest=IamAdultGateControllerTest`：
     - 测试 1: 成年提交返回 200 PASSED / ELIGIBLE，factStore 记 APPROVED，审计记 ALLOW
     - 测试 2: 未成年提交返回 200 REJECTED / RESTRICTED，factStore 记 REJECTED，审计记 DENY，会话保持 ACTIVE
     - 测试 3: 成年提交同键幂等重放返回相同 200 结果
     - 测试 4: 未成年提交同键幂等重放返回相同 200 结果（不再抛 503）
     - 测试 5: 未成年提交后，同键不同请求体返回 409 IDEMPOTENCY_CONFLICT
     - 测试 6: 缺 confirmed 或 confirmed=false 抛 403
     - 测试 7: policyVersion 错误抛 403
     - 测试 8: birthYear 异常抛 403
     - 测试 9: 缺 Idempotency-Key 或键非法抛 400
     - 结果：**9/9 全部 PASS（0 Failures, 0 Errors, 0 Skipped）**。
2. **IAM 服务全套测试**：
   - 审查员独立运行 `mvn test "-Dtest=Iam*Test"`，共计 **85 项测试全部通过**（64 PASS, 21 正常跳过的 DB 上下文测试, 0 Failures, 0 Errors）。
3. **脱机断言测试套件（`iam-lifecycle-runtime.test.mjs`）**：
   - 审查员独立运行 `node --test scripts/redesign/r1-iam-lifecycle/iam-lifecycle-runtime.test.mjs`：
     - 涵盖 R1-006 完整 24 项负向断言防线（覆盖成年/未成年状态篡改、数据库状态不一致、审计不一致、会话被杀、重放不一致、冲突漏防、参数缺失等）。
     - 结果：**13/13 全部 PASS**。

---

## 三、 逐卡验收判定表

| 卡号 | 对应链 | 验收项与断言依据 | 独立复核结果 | 判定 |
|---|---|---|---|---|
| **R1-003** | **BC-003** 注册幂等回放 | 1. 干净库初始为 0；<br>2. 首次注册 201 建立账号、主体、会话与设备；<br>3. 同键同请求体重放返回完全相同的 201、sessionId 与 deviceId；<br>4. 数据库读回账号数仍为 1，完成态幂等记录为 1（不建第二账号）；<br>5. 同键不同请求体返回 409 拒绝且不建第二账号；<br>6. 缺少幂等键返回 400。 | 12 项断言全部 PASS，单账号保证与冲突防御成立 | **PASS** |
| **R1-004** | **BC-004** 登录/刷新/撤销全套 | 1. 账号登录 200，下发 Access Token 与安全 Cookie（HttpOnly, Secure, SameSite=Lax, Path=/api/v1/auth）；<br>2. 响应体不含明文 refreshToken；<br>3. 携带 Cookie 刷新 200，新 refreshToken 与旧 token 不同（CAS 轮换成功）；<br>4. 重放旧 refreshToken 返回 401 并触发会话 REVOKED（令牌族撤销）；<br>5. 重新登录并登出 200，会话标记 REVOKED；<br>6. 登出后旧 Access Token 与 Refresh Token 再次请求均返回 401。 | 14 项断言全部 PASS，历史 404 缺陷已排查修复并保留原件 | **PASS** |
| **R1-005** | **BC-005** 设备列表与踢出 | 1. 同账号两台设备登录成功；<br>2. 设备 A 请求设备列表，仅设备 A 为 `isCurrent=true`；<br>3. 设备 B 请求设备列表，仅设备 B 为 `isCurrent=true`；<br>4. 客户端伪造 Header/参数无法篡改当前设备；<br>5. 设备 A 踢出设备 B 返回 200；<br>6. 设备 B 旧 Access Token 与 Refresh Token 均返回 401；<br>7. 主调设备 A 状态 ACTIVE 且保持有效（200）。 | 14 项断言全部 PASS，设备注销 401 语义与前后端同步已成立 | **PASS** |
| **R1-006** | **BC-006** 成人门提交落库审计 | 1. 成年人提交 200，返回 PASSED / ELIGIBLE / SERVER_VERIFIED；<br>2. 数据库落库 APPROVED 且 verifiedAt 存在，审计记录 ALLOW / adult_gate_allowed；<br>3. 成年人同键重放一致返回 200 PASSED；<br>4. 未成年人提交 200，返回 REJECTED / RESTRICTED / REJECTED；<br>5. 数据库落库 REJECTED 且 verifiedAt 为 NULL，审计记录 DENY / ADULT_AGE_BELOW_MINIMUM；<br>6. **防线确认**：未成年人当前 Session 保持 ACTIVE，访问 `/api/v1/iam/principal/me` 依然为 200；<br>7. 未成年人同键重放一致返回 200 REJECTED（无 503）；<br>8. 同键不同请求体返回 409；<br>9. 缺 confirmed 返回 403，缺幂等键返回 400。 | 19 项断言全部 PASS，双路径落库、审计与不杀会话防线成立 | **PASS** |

---

## 四、 边界声明与未决事项（Guardrails & Non-Goals）

为恪守 `AGENTS.md` 规则，防止范围蔓延或虚假宣称，本终审明确作出如下边界限定：

1. **卡级范围限定（Card-Scope Only）**：
   - 本签收结论严格仅适用于 **R1-003、R1-004、R1-005、R1-006** 四张业务卡。
   - **不代表全量 114 卡墙恢复**（GAP-WALL-114 仍保持 OPEN）。
   - **不代表原 R1-001 完整原件恢复**（官网当前源仍为 SCOPED 交付，原件缺口仍保持记录）。
2. **IT-1 站点尚未出站（Station IT-1 Not Exited）**：
   - 根据 `dev-plan-R1.md`，IT-1 入门站包含 L1 完整的 17 张卡（R1-001 ～ R1-017）。
   - 截至目前，后续核心卡（包括但不限于 **R1-007 门未过等待态**、**R1-008 三同意动态版**、**R1-009 撤回回收**、**R1-010 画像保存**、**R1-011 向导进度**、**R1-014 L1 全链干净库重放** 等）尚未完成开发验收。
   - 只有当 L1 全 17 卡在干净库中全绿且获得独立签收后，IT-1 方可出站。
3. **严禁越站跳入 IT-2（No Station Skipping）**：
   - 尽管已有 L2（R1-018 ～ R1-029）的设计与计划，但在 IT-1 签收出站之前，**严禁开工 IT-2 定级环开发**。
4. **基础设施无损保持**：
   - 测试数据库 `r1_iam_lifecycle_20261009_2adfe7d7cd74` 保留作为物理证据，未执行破坏性 DROP。后续环境维护可依据 `cleanup-plan` 脚本受控执行。

---

## 五、 终审结论与签字

**终审结论**：**`ACCEPTED_CARD_SCOPE / R1_003_004_005_006_ACCEPTANCE_PASS`**  
**状态标记**：**`SAFELY_PAUSED`**  

**后续步骤建议**：
1. 本轮工作区差量与证据提交入库；
2. 保持安全暂停状态（`SAFELY_PAUSED`），等待用户具名指令推进下一任务：**R1-007（BC-007 门未过等待态，前端受限页展示与退出通道）**。

*审查员签字：Luna（Independent Reviewer）*  
*日期：2026-10-09*
