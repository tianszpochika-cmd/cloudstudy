# R1-003 / R1-004 / R1-005 / R1-006 / R1-008 交付物独立终审审查报告 (Independent Final Review)

> **审查员**：Luna（独立终审审查员，Independent Reviewer）  
> **审查日期**：2026-10-09  
> **源码分支**：`dev-redesign`  
> **工作区基线**：`/Users/Admin/Desktop/work/cloudstudy`  
> **终审判定结论**：**`ACCEPTED_CARD_SCOPE / R1_003_004_005_006_008_ACCEPTANCE_PASS`**  
> **状态标记**：**`SAFELY_PAUSED`**（五卡验收通过，自有子进程已安全退出，端口 18087 已完全释放，宿主机与容器环境安全无损）

---

## 一、 审查背景与任务范围

根据 `AGENTS.md`（§0、§2.2、§2.3、§3、§4 DoD）以及 `dev-plan-R1.md` 的计划约定，独立终审审查员对迭代 2（Redesign）中 L1 注册入门环的五张核心卡交付物进行最高严谨度独立终审：

1. **R1-003（BC-003 / IC-002, IC-052）**：注册幂等回放（同键同结果，绝不建立第二账号，拒绝冲突并拒绝缺失键）。
2. **R1-004（BC-004 / IC-002, IC-053）**：登录 / 刷新 / 撤销全套生命周期（CAS 轮换、令牌族重放清理、登出全失效、Cookie 属性与禁止明文 Token 泄漏）。
3. **R1-005（BC-005 / IC-002, IC-008, IC-035）**：多设备列表识别与踢出（服务端令牌判定当前设备，客户端伪造防御，被踢设备令牌及 Refresh 全 401 失效，主调设备不受影响）。
4. **R1-006（BC-006 / IC-003, IC-055）**：成人门提交双路径落库与审计（PASSED 与 REJECTED 双路径 200 返回与数据库落库、审计 ALLOW/DENY 落库、拒绝路径会话保持 ACTIVE 不杀会话防闪退、幂等回放一致性无 503）。
5. **R1-008（BC-008 / IC-004, IC-056）**：三同意动态版读取与签署及409拒绝自愈（先读已发布版本再签，换版本不卡死；服务端对过期版本严格 409 拒绝；Web/Mobile 双端实现 409 动态嗅探重试自愈机制、并发 `refreshPromise` 合并与版本缓存）。

---

## 二、 独立复核与执行验证事实

### 1. 真实运行收据审查（Clean DB Runtime Receipts）

审查员独立调阅了物理运行证据与各项数据收据：
- **最新全链路通过收据**：[`runtime-results-1b88d9e1df09.json`](runtime-results-1b88d9e1df09.json)
  - 专属隔离库：`r1_iam_lifecycle_20261009_1b88d9e1df09`
  - 专属账号：`r1_iam_1b88d9e1df09`
  - Flyway 迁移：17 项版本迁移成功，0 失败，最大版本 18。
  - 初始干净度验证：六类核心业务计数（`principals`, `accounts`, `sessions`, `devices`, `audits`, `completedIdempotency`）**全为 0**。
  - 执行结果：**`STATUS: PASS / exit 0`**，全部 **76 项断言 100% 通过**：
    - R1-003: 12/12 PASS
    - R1-004: 14/14 PASS
    - R1-005: 14/14 PASS
    - R1-006: 19/19 PASS
    - **R1-008: 17/17 PASS**
- **最新独立准备收据**：[`prepared-1b88d9e1df09.json`](prepared-1b88d9e1df09.json)
  - 绑定宿主目录模式 `0700`、私钥与密钥库模式 `0600`，UID 502 匹配，无软链接，自签名证书 SAN 严格绑定 `127.0.0.1` 与 `localhost`。
- **排错与问题闭环原件完整保留（事实链条可追溯）**：
  - R1-008 初跑排错原件：[`runtime-results-b5d84884182f.json`](runtime-results-b5d84884182f.json)、[`prepared-b5d84884182f.json`](prepared-b5d84884182f.json)（保留原件记录：`requiredPurposesValid` 初始检查因领域目的名 `ACCOUNT_TERMS` / `PRIVACY_NOTICE` / `ADULT_LEARNING_ELIGIBILITY` 校验缺失而报 false，对齐后在干净库完全重跑至全绿）。
  - R1-003~006 四卡通过收据：[`runtime-results-2adfe7d7cd74.json`](runtime-results-2adfe7d7cd74.json)、[`prepared-2adfe7d7cd74.json`](prepared-2adfe7d7cd74.json)。
  - R1-003~005 三卡通过收据：[`runtime-results-ff793b6aaaa9.json`](runtime-results-ff793b6aaaa9.json)、[`prepared-ff793b6aaaa9.json`](prepared-ff793b6aaaa9.json)。
  - 第一轮排错失败收据：[`runtime-results-1d060bf4f8e7.json`](runtime-results-1d060bf4f8e7.json)（登出与踢出后刷新误报 404）。
  - 第二轮排错失败收据：[`runtime-results-a90b07771211.json`](runtime-results-a90b07771211.json)（被踢设备刷新误报 404）。
  - 历史原件完整保留，未掩盖缺陷，事实链条真实透明。

### 2. 基础设施、端口与凭证防泄漏独立复查

审查员在宿主机环境上独立执行系统、端口与网络安全检查：
1. **端口 18087 释放核验**：
   - 执行 `lsof -i :18087`，退出码为 1，无任何残留监听（端口完全 FREE）。
   - 收据标记 `cleanup.port18087Released: true` 与 `cleanup.iamStopped: true` 经独立系统命令核实为真实。
2. **Docker 容器隔离核验**：
   - 执行 `docker ps -a` 核查，本项目官方容器 `yuxuexing-local-mysql-1`（容器 ID: `db8739202039...`）健康运行 30 小时。
   - 宿主机上并存的其他项目第三方容器（`qida-dev-tsz-*` 30+ 容器，`qida-clm-*` 等）已连续运行 28 小时以上，状态保持一致 healthy，**未发生 Docker 重启、未执行 compose down/prune、未触碰任何第三方容器**。
3. **安全与隐私防泄漏核验**：
   - 运行测试材料均存放于 Git 外部 `0700` 目录，收据中的私密目录路径均已被脱敏为 `<PRIVATE_MATERIAL_DIR>`，密码与原始 Token 均脱敏为 `<REDACTED_SECRET>`。
   - 全局扫描 Git 工作区状态，**无任何真实私钥、公私密钥对、密码或生产 JWT 令牌泄漏至 Git 仓库**。

### 3. R1-008 核心防线与前后端架构审查

审查员对 `services/iam-service` 服务端与 `apps/learner-web`、`apps/mobile` 双端源码变更进行逐行深度审计：

1. **服务端动态同意版本校验与 409 拒绝**：
   - 端点 `PUT /api/v1/iam/consents` 严格基于当前已发布政策版本校验：若客户端提交版本过期或不匹配（如 `stale-version-999`），服务端拒绝并返回 HTTP 409（`CONSENT_VERSION_MISMATCH`），杜绝脏写。
   - 必填头校验：缺少 `Idempotency-Key` 头部返回 HTTP 400；非法 `decision` 值返回 HTTP 400；支持同键幂等重放返回 HTTP 200。
2. **客户端双端 409 动态嗅探重试自愈机制**：
   - 在 `apps/learner-web/src/api/learner-content.ts` 与 `apps/mobile/src/api/learner-content.ts` 中实现了一致的自愈模式：
     - **乐观默认版本**：先使用本地缓存或初始版本（`b30-consent-v1`）发起请求；
     - **409 捕获与自愈**：捕获 409 错误时，调用 `refreshActiveConsentVersion()` 向 `/iam/principal/me` 动态嗅探最新激活版本；
     - **并发请求 Promise 合并**：多类型同意（`PRIVACY`, `TERMS`, `ADULT_LEARNING`）并发签署时，共享同一个 `consentRefreshPromise`，杜绝重复网络请求与并发竞争；
     - **模块级版本缓存**：自愈成功后更新 `cachedActiveConsentVersion`，后续签署操作直接复用新版本；
     - **状态码透传修复**：修复了 `toReadModelError` 丢失 409 HTTP 状态码的缺陷，确保 409 能精确到达重试分支；
     - **回退容错**：若 `/iam/principal/me` 不可达，优雅回退到默认版本，避免前端页面卡死。

### 4. 自动化测试与覆盖率复验

审查员独立运行以下所有相关测试套件：

1. **双端动态同意版本单测（`consent-dynamic-version`）**：
   - 独立运行 `node --test apps/learner-web/tests/consent-dynamic-version.test.mjs apps/mobile/tests/mobile-consent-dynamic-version.test.mjs`：
     - Web 测试 1: 捕获 409 CONSENT_VERSION_MISMATCH，重新拉取最新版本并重试成功
     - Web 测试 2: 缓存新版本用于后续保存，直接以新版本签署
     - Web 测试 3: /iam/principal/me 不可达时优雅回退到默认版本
     - Mobile 测试 1: 移动端捕获 409 并使用刷新后的同意版本重试成功
     - Mobile 测试 2: 移动端缓存新版本用于后续保存
     - Mobile 测试 3: 移动端在接口不可用时优雅回退
     - 结果：**6/6 全部 PASS（0 Failures, 耗时 ~458ms）**。
2. **脱机全套生命周期断言套件（`iam-lifecycle-runtime.test.mjs`）**：
   - 独立运行 `node --test scripts/redesign/r1-iam-lifecycle/iam-lifecycle-runtime.test.mjs`：
     - 涵盖 R1-003、R1-004、R1-005、R1-006 以及新增的 **R1-008 断言评估套件（含前置版本读取、动态签署、DB 落库 3 条 GRANTED、审计事实、409 冲突及 5 项负向异常防线）**。
     - 结果：**14/14 全部 PASS（0 Failures, 耗时 ~943ms）**。
3. **IAM 服务端 Java 核心控制器集成测试**：
   - 独立运行 `mvn test -pl services/iam-service -Dtest=IamDeviceListCurrentControllerTest,IamAdultGateControllerTest`：
     - Adult Gate Controller 集成测试：9 项测试全部 PASS
     - Device List Current Controller 测试：5 项测试全部 PASS
     - 结果：**14/14 全部 PASS（0 Failures, 0 Errors, BUILD SUCCESS）**。

---

## 三、 逐卡验收判定表

| 卡号 | 对应链 | 验收项与断言依据 | 独立复核结果 | 判定 |
|---|---|---|---|---|
| **R1-003** | **BC-003** 注册幂等回放 | 1. 干净库初始为 0；<br>2. 首次注册 201 建立账号、主体、会话与设备；<br>3. 同键同请求体重放返回完全相同的 201、sessionId 与 deviceId；<br>4. 数据库读回账号数仍为 1，完成态幂等记录为 1（不建第二账号）；<br>5. 同键不同请求体返回 409 拒绝且不建第二账号；<br>6. 缺少幂等键返回 400。 | 12 项断言全部 PASS，单账号保证与冲突防御成立 | **PASS** |
| **R1-004** | **BC-004** 登录/刷新/撤销全套 | 1. 账号登录 200，下发 Access Token 与安全 Cookie（HttpOnly, Secure, SameSite=Lax, Path=/api/v1/auth）；<br>2. 响应体不含明文 refreshToken；<br>3. 携带 Cookie 刷新 200，新 refreshToken 与旧 token 不同（CAS 轮换成功）；<br>4. 重放旧 refreshToken 返回 401 并触发会话 REVOKED（令牌族撤销）；<br>5. 重新登录并登出 200，会话标记 REVOKED；<br>6. 登出后旧 Access Token 与 Refresh Token 再次请求均返回 401。 | 14 项断言全部 PASS，历史 404 缺陷已排查修复并保留原件 | **PASS** |
| **R1-005** | **BC-005** 设备列表与踢出 | 1. 同账号两台设备登录成功；<br>2. 设备 A 请求设备列表，仅设备 A 为 `isCurrent=true`；<br>3. 设备 B 请求设备列表，仅设备 B 为 `isCurrent=true`；<br>4. 客户端伪造 Header/参数无法篡改当前设备；<br>5. 设备 A 踢出设备 B 返回 200；<br>6. 设备 B 旧 Access Token 与 Refresh Token 均返回 401；<br>7. 主调设备 A 状态 ACTIVE 且保持有效（200）。 | 14 项断言全部 PASS，设备注销 401 语义与前后端同步已成立 | **PASS** |
| **R1-006** | **BC-006** 成人门提交落库审计 | 1. 成年人提交 200，返回 PASSED / ELIGIBLE / SERVER_VERIFIED；<br>2. 数据库落库 APPROVED 且 verifiedAt 存在，审计记录 ALLOW / adult_gate_allowed；<br>3. 成年人同键重放一致返回 200 PASSED；<br>4. 未成年人提交 200，返回 REJECTED / RESTRICTED / REJECTED；<br>5. 数据库落库 REJECTED 且 verifiedAt 为 NULL，审计记录 DENY / ADULT_AGE_BELOW_MINIMUM；<br>6. **防线确认**：未成年人当前 Session 保持 ACTIVE，访问 `/api/v1/iam/principal/me` 依然为 200；<br>7. 未成年人同键重放一致返回 200 REJECTED（无 503）；<br>8. 同键不同请求体返回 409；<br>9. 缺 confirmed 返回 403，缺幂等键返回 400。 | 19 项断言全部 PASS，双路径落库、审计与不杀会话防线成立 | **PASS** |
| **R1-008** | **BC-008** 三同意动态版与409自愈 | 1. 签署前 `/iam/principal/me` 动态带出版本且标识 `required=true`, `accepted=false`；<br>2. 必须目的列表准确包含 `PRIVACY`, `TERMS`, `ADULT_LEARNING`（或领域对应项）；<br>3. 动态签署 3 项同意均返回 200 ACCEPTED；<br>4. 签署后主体状态变为 `accepted=true`，结合成人门学习权限翻转为 `ELIGIBLE`，账号状态变为 `ACTIVE`；<br>5. 数据库 `iam_consent` 精确落库 3 条 `status=GRANTED` 记录；<br>6. 审计流水包含 `consent_recorded`；<br>7. 过期版本（`stale-version-999`）提交返回 409，不脏写；<br>8. 缺幂等键返回 400，非法 decision 返回 400；<br>9. 同键同体重放返回 200 一致响应；<br>10. Web/Mobile 双端遇到 409 自动嗅探最新版本并重试成功，并发 Promise 合并。 | 17 项断言全部 PASS，双端 409 嗅探重试自愈机制成立 | **PASS** |

---

## 四、 边界声明与未决事项（Guardrails & Non-Goals）

为恪守 `AGENTS.md` 规则，防止范围蔓延或虚假宣称，本终审明确作出如下边界限定：

1. **卡级范围限定（Card-Scope Only）**：
   - 本签收结论严格仅适用于 **R1-003、R1-004、R1-005、R1-006、R1-008** 五张业务卡。
   - **不代表全量 114 卡墙恢复**（GAP-WALL-114 仍保持 OPEN）。
   - **不代表原 R1-001 完整原件恢复**（官网当前源仍为 SCOPED 交付，原件缺口仍保持记录）。
2. **IT-1 站点尚未出站（Station IT-1 Not Exited）**：
   - 根据 `dev-plan-R1.md`，IT-1 入门站包含 L1 完整的 17 张卡（R1-001 ～ R1-017）。
   - 截至目前，后续核心卡（包括但不限于 **R1-009 撤回回收**、**R1-010 画像保存**、**R1-011 向导进度**、**R1-012 重置不枚举**、**R1-013 门被拒清理与重进**、**R1-014 L1 全链干净库重放** 等）尚未完成开发验收。
   - 只有当 L1 全 17 卡在干净库中全绿且获得独立签收后，IT-1 方可出站。
3. **严禁越站跳入 IT-2（No Station Skipping）**：
   - 尽管已有 L2（R1-018 ～ R1-029）的设计与计划，但在 IT-1 签收出站之前，**严禁开工 IT-2 定级环开发**。
4. **基础设施无损保持**：
   - 测试数据库 `r1_iam_lifecycle_20261009_1b88d9e1df09` 保留作为物理证据，未执行破坏性 DROP。后续环境维护可依据 `cleanup-plan` 脚本受控执行。

---

## 五、 终审结论与签字

**终审结论**：**`ACCEPTED_CARD_SCOPE / R1_003_004_005_006_008_ACCEPTANCE_PASS`**  
**状态标记**：**`SAFELY_PAUSED`**  

**后续步骤建议**：
1. 保持安全暂停状态（`SAFELY_PAUSED`），将本轮工作区差量与终审报告妥善同步；
2. 等待后续具名调度指令推进下一卡项：**R1-009（BC-009 撤回回收，撤回即回收，相关能力 403 阻断）**。

*审查员签字：Luna（Independent Reviewer）*  
*日期：2026-10-09*
