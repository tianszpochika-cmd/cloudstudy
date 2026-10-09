# R1-IAM-Lifecycle 干净专库运行验证工具 (R1-003 / R1-004 / R1-005 / R1-006 / R1-008)

本工具为语学星平台 Phase 1 迭代 2（Redesign）的 **R1-003**、**R1-004**、**R1-005**、**R1-006** 与 **R1-008** 五张业务卡提供「干净专库、单 IAM 服务、全生命周期运行验证」支撑。

> **安全准则**：本工具仅供受控离线实现与测试。未经根审签发具名 `run-approval.json` 前，严禁真正启动服务或向数据库执行写入。默认模式为严格只读审计模式（0 进程、0 写入、0 网络请求、0 Docker 命令）。

---

## 1. 对应业务卡与 BC/IC 验收映射

| 卡号 | 业务链 (BC) | 交互链 (IC) | 验收目标与断言句 |
|---|---|---|---|
| **R1-003** | **BC-003** (注册幂等回放) | IC-002 / IC-052 | 1. 首次注册返回 HTTP 201，生成会话并下发受限凭据。<br>2. **同一幂等键 + 同一请求体重放**：返回相同结果（同一 sessionId、同一 deviceId），SQL 读回账号数/主体数/设备数/会话数仍为 1，完成态幂等记录为 1，**绝不建立第二账号**。<br>3. **同键不同请求体**：返回 409 Conflict（或 400 Validation Error），SQL 读回账号数依然为 1，**拒绝冲突且不建第二账号**。<br>4. **缺失幂等键**：返回 HTTP 400，拒绝注册。 |
| **R1-004** | **BC-004** (登录/刷新/撤销全套) | IC-002 / IC-053 | 1. 新独立账号注册后登录：HTTP 200，下发 Cookie 与 Access Token，建立活动会话。<br>2. **刷新轮换**：携带合法 refresh cookie 请求刷新，返回 HTTP 200，**新 refresh token 替代旧 token**；Cookie 严格具备 `HttpOnly`、`Secure`、`SameSite=Lax`、`Path=/api/v1/auth`，且响应体**绝不包含明文 refreshToken**。<br>3. **旧 refresh token 重放**：使用轮换前的旧 refresh token 再次刷新，返回 HTTP 401（`AUTH_REFRESH_REUSE_DETECTED`），**触发令牌族撤销**，SQL 读回该 session 状态为 `REVOKED`。<br>4. **登出与失效令牌**：重新登录后执行 logout，返回 HTTP 200，SQL 读回 session 为 `REVOKED`；被撤销 session 的旧 access token 与 refresh token 再次使用均返回 HTTP 401。 |
| **R1-005** | **BC-005** (设备列表与踢出) | IC-002 / IC-008 / IC-035 | 1. 同一账号分别以设备 A 和设备 B 成功登录，生成两个活跃会话。<br>2. **设备识别**：携带设备 A 令牌请求 `GET /api/v1/iam/devices`，设备列表中**恰有一个 `isCurrent=true` 且其 deviceId 为 A**；携带设备 B 令牌请求时，**恰有一个 `isCurrent=true` 且其 deviceId 为 B**。<br>3. **踢出操作**：设备 A 调用 `POST /api/v1/iam/devices/{deviceIdB}/kickout`，返回 HTTP 200。<br>4. **被踢令牌失效**：设备 B 的旧 Access Token 请求受保护接口返回 HTTP 401；设备 B 的 Refresh Token 刷新返回 HTTP 401；SQL 读回设备 B 的会话状态为 `REVOKED`。<br>5. **主调设备不受影响**：设备 A 的凭据继续保持有效（HTTP 200），SQL 读回设备 A 会话仍为 `ACTIVE`。 |
| **R1-006** | **BC-006** (成人门双路径与审计) | IC-002 / IC-037 | 1. **成年人路径**：有效账号提交 adult-gate（birthYear 1995），返回 HTTP 200，status 为 `PASSED`、learningAccess 为 `ELIGIBLE`、evidenceStatus 为 `SERVER_VERIFIED`；SQL 读回 principal 表 adult_gate_status 为 `APPROVED` 且 adult_verified_at 非空；审计表记入 decision `ALLOW`，reason_code 为 `adult_gate_allowed`；幂等重放返回一致结果。<br>2. **未成年人路径**：全新注册账号提交 adult-gate（birthYear 2015），返回 HTTP 200，status 为 `REJECTED`、learningAccess 为 `RESTRICTED`、evidenceStatus 为 `REJECTED`；SQL 读回 principal 表 adult_gate_status 为 `REJECTED` 且 adult_verified_at 为 NULL；审计表记入 decision `DENY`，reason_code 为 `ADULT_AGE_BELOW_MINIMUM`；会话保持 `ACTIVE`，受限态可访问 `/api/v1/iam/principal/me`（HTTP 200）；幂等重放返回一致结果。<br>3. **同键参数冲突与边界拒绝**：同键不同参数重放返回 HTTP 409；缺失 confirmed 确认返回 HTTP 403；缺失 Idempotency-Key 头部返回 HTTP 400。 |
| **R1-008** | **BC-008** (三同意动态版读取与签署及409拒绝) | IC-002 / IC-054 | 1. **前置读取激活版本**：请求 `GET /api/v1/iam/principal/me` 提取动态 `consentState.version`（非写死）；<br>2. **三项动态签署**：分别对 `PRIVACY`、`TERMS`、`ADULT_LEARNING` 携带激活版本发起 `PUT /api/v1/iam/consents` 签署，均返回 HTTP 200（`decision=ACCEPTED`）；<br>3. **落库与资格翻转**：SQL 查回 `iam_consent` 表包含 3 条 `status=GRANTED` 记录；审计表记录 `consent_recorded`；再次调用 `GET /api/v1/iam/principal/me` 验证 `consentState.accepted=true` 且 `learningAccess=ELIGIBLE`，账号状态为 `ACTIVE`；<br>4. **409 版本冲突**：提交过时/无效版本（如 `stale-version-999`）返回 HTTP 409（`CONSENT_VERSION_MISMATCH`），不造成脏写入；<br>5. **边界与幂等**：缺失 `Idempotency-Key` 返回 400；非法 decision 返回 400；同键同体重放返回一致 200。 |

---

## 2. 工具架构与模块复用说明

本工具目录结构：
- `assertions.mjs`：纯断言判定、Cookie 校验、设备列表归一化判定、脱敏过滤、审批校验与参数解析。纯逻辑模块，支持无网络/无容器脱机单测。
- `iam-lifecycle-runtime.mjs`：执行器与 CLI 主入口。受控编排 IAM 进程生命周期、TLS 材料绑定与逐卡场景。
- `iam-lifecycle-runtime.test.mjs`：离线单元测试，覆盖 13 项纯逻辑规则。
- `README.md`：本规范文档。

### 复用 `scripts/redesign/r1-002/` 已签收模块：
1. **`prepare.mjs`**：
   - `root`：平台项目根目录。
   - `sha256`：统一安全哈希。
   - `assertExternalDirectory`：强制校验 Git 仓库外部父目录且必须为当前用户拥有之 `0700` 目录（防止私密材料落入仓库）。
   - `checkPrivateMetadata` & `verifyPrivateMaterialPermissions`：严格校验私钥、PKCS12 密钥库与运行时配置的宿主权限（`0600` / `0700`），拒绝软链接。
   - `certificateFacts`：离线解析 X.509 证书 SAN 绑定（`127.0.0.1` / `localhost`）与有效期。
   - `javaArgument`：Java `@argfile` 参数防注入安全转义。
2. **`process-identity.mjs`**：
   - `readProcessIdentity` & `compareProcessIdentity`：基于 macOS libproc / Linux procfs 校验子进程 PID、PPID、CWD 与启动时间戳，严禁收养孤儿进程或跨进程误发信号。
3. **`lifecycle.mjs`**：
   - `registeredPorts`：读取 `config/local-ports.json` 端口策略。
   - `inspectFixedPorts`：只读 `lsof` 侦测端口监听情况，严禁盲目绑定或自动递增端口。
4. **`business-runtime.mjs`**：
   - `validateCookie`：复用既有全套浏览器 Cookie 安全属性校验（HttpOnly, Secure, SameSite, MaxAge, Path, 禁止 body 泄露）。

### 本目录独立重写最小等价逻辑之原因：
1. **Schema 与 User 命名命名空间**：`r1-002` 的 `databaseGrantScope` 与 `assertSchema` 内嵌了 `r1_002_` 硬编码正则；本工具将命名空间收紧为 `r1_iam_lifecycle_YYYYMMDD_<12hex>` 与 `r1_iam_<12hex>`，并在 `assertions.mjs` 中提供匹配的 `databaseGrantScope`（同样严谨支持 `partial_revokes` 下划线转义）。
2. **服务拓扑与端口**：`r1-002` 同时编排 Gateway (18070)、IAM (18087) 与 Learner (18088)；而 R1-003/004/005 三卡为 IAM 原生直连契约，无需拉起 Gateway 或 Learner，因此执行器只管理唯一的 18087 IAM 进程，环境更加纯粹轻量。

---

## 3. 子命令使用说明

```sh
# 1. 运行离线单元测试（只测纯逻辑，不依赖 Docker/MySQL/网络）
node --test scripts/redesign/r1-iam-lifecycle/iam-lifecycle-runtime.test.mjs

# 2. 语法静态检查
node --check scripts/redesign/r1-iam-lifecycle/assertions.mjs
node --check scripts/redesign/r1-iam-lifecycle/iam-lifecycle-runtime.mjs
node --check scripts/redesign/r1-iam-lifecycle/iam-lifecycle-runtime.test.mjs

# 3. 默认模式：只读审计模式（不启动任何进程、不连接数据库）
node scripts/redesign/r1-iam-lifecycle/iam-lifecycle-runtime.mjs
# 或显式指定
node scripts/redesign/r1-iam-lifecycle/iam-lifecycle-runtime.mjs --mode inspect

# 4. 准备模式：生成专属私密材料与干净专库（需要 Git 外 0700 目录）
node scripts/redesign/r1-iam-lifecycle/iam-lifecycle-runtime.mjs --mode prepare --private-parent /absolute/protected/external/dir

# 5. 运行模式：受控执行 R1-003/004/005 运行验证（需要根审批准文件）
node scripts/redesign/r1-iam-lifecycle/iam-lifecycle-runtime.mjs --mode run --config-dir /absolute/protected/material/dir --approval /path/to/run-approval.json

# 6. 清理建议模式：只输出建议 DROP 语句，不自动执行
node scripts/redesign/r1-iam-lifecycle/iam-lifecycle-runtime.mjs --mode cleanup-plan --config-dir /absolute/protected/material/dir
```

---

## 4. 运行批准文件格式 (`run-approval.json`)

`run` 模式启动前必须读取并强校验外部批准文件。若字段不匹配或已过期，执行器将立即拒绝并抛出异常，绝不盲目开跑：

```json
{
  "kind": "ROOT_APPROVED_R1_IAM_LIFECYCLE_RUNTIME",
  "scriptSha256": "4a1b...",
  "schema": "r1_iam_lifecycle_20261009_a1b2c3d4e5f6",
  "mysqlId": "c5d8...",
  "cards": ["R1-003", "R1-004", "R1-005", "R1-006"],
  "expiresAt": "2026-10-09T18:00:00Z",
  "approvedBy": "system-root-audit"
}
```

校验项：
- `kind` 必须严格等于 `ROOT_APPROVED_R1_IAM_LIFECYCLE_RUNTIME`；
- `scriptSha256` 必须精确匹配当前 `iam-lifecycle-runtime.mjs` 的 SHA-256；
- `schema` 必须精确匹配 `runtime.json` 中的专属测试库名；
- `mysqlId` 必须精确匹配当前 `yuxuexing-local-mysql-1` 容器的真实完整容器 ID；
- `expiresAt` 必须为未来时间戳（ISO 8601）。

---

## 5. 运行结果输出结构 (`iam-lifecycle-results.json`)

运行产物输出到私密目录（或指定的 `--out` 路径），所有敏感信息（密码、私钥、原始 Token、Cookie、真实私密路径）均已完成不可逆脱敏过滤：

```json
{
  "kind": "R1_IAM_LIFECYCLE_EXECUTION_RESULTS",
  "status": "PASS",
  "executedAt": "2026-10-09T10:15:00.000Z",
  "schema": "r1_iam_lifecycle_20261009_a1b2c3d4e5f6",
  "user": "r1_iam_a1b2c3d4e5f6",
  "results": {
    "r1003": {
      "card": "R1-003",
      "chain": "BC-003",
      "summary": "注册幂等回放验证",
      "passed": true,
      "assertions": {
        "initialCleanDb": true,
        "firstRegistrationStatus201": true,
        "firstRegistrationHasSession": true,
        "firstRegistrationHasDevice": true,
        "replayStatusConsistent": true,
        "replaySessionConsistent": true,
        "replayDeviceConsistent": true,
        "replayNoSecondAccount": true,
        "replayCompletedIdempotencyCount": true,
        "conflictRejected": true,
        "conflictActualStatus": 409,
        "conflictNoSecondAccount": true,
        "missingKeyRejected": true,
        "missingKeyActualStatus": 400,
        "passed": true
      }
    },
    "r1004": {
      "card": "R1-004",
      "chain": "BC-004",
      "summary": "登录/刷新/撤销全套生命周期验证",
      "passed": true,
      "assertions": {
        "registrationStatus201": true,
        "loginStatus200": true,
        "loginHasSession": true,
        "refreshStatus200": true,
        "refreshRotatedNewTokenDifferent": true,
        "refreshCookieSecurity": true,
        "refreshBodyNoPlaintextToken": true,
        "replayOldRefreshRejected": true,
        "replayOldRefreshActualStatus": 401,
        "replayOldRefreshSessionRevoked": true,
        "reloginStatus200": true,
        "logoutStatus200": true,
        "logoutSessionRevoked": true,
        "postLogoutAccessRejected401": true,
        "postLogoutAccessActualStatus": 401,
        "postLogoutRefreshRejected401": true,
        "postLogoutRefreshActualStatus": 401,
        "passed": true
      }
    },
    "r1005": {
      "card": "R1-005",
      "chain": "BC-005",
      "summary": "多设备列表识别与踢出验证",
      "passed": true,
      "assertions": {
        "loginAStatus200": true,
        "loginBStatus200": true,
        "devicesFromAStatus200": true,
        "devicesFromAHasSingleCurrent": true,
        "devicesFromAIsCurrentDeviceIdA": true,
        "devicesFromBStatus200": true,
        "devicesFromBHasSingleCurrent": true,
        "devicesFromBIsCurrentDeviceIdB": true,
        "kickoutStatus200": true,
        "kickedDeviceAccessRejected401": true,
        "kickedDeviceAccessActualStatus": 401,
        "kickedDeviceRefreshRejected401": true,
        "kickedDeviceRefreshActualStatus": 401,
        "deviceARemainsValid200": true,
        "sessionStatusBRevoked": true,
        "sessionStatusAActive": true,
        "passed": true
      }
    },
    "r1006": {
      "card": "R1-006",
      "chain": "BC-006",
      "summary": "成人门提交双路径落库与审计验证",
      "passed": true,
      "assertions": {
        "adultSubmitStatus200": true,
        "adultGateStatusPassed": true,
        "adultLearningAccessEligible": true,
        "adultEvidenceVerified": true,
        "dbAdultGateStatusApproved": true,
        "dbAdultAuditAllow": true,
        "adultReplayConsistent": true,
        "minorSubmitStatus200": true,
        "minorGateStatusRejected": true,
        "minorLearningAccessRestricted": true,
        "minorEvidenceRejected": true,
        "dbMinorGateStatusRejected": true,
        "dbMinorAuditDeny": true,
        "minorSessionActive": true,
        "minorPostAccess200": true,
        "minorReplayConsistent": true,
        "minorConflict409": true,
        "missingConfirmation403": true,
        "missingIdempotencyKey400": true,
        "passed": true
      }
    }
  },
  "checks": {
    "flyway": {
      "successfulVersions": 17,
      "failed": 0,
      "maxVersion": 18
    },
    "initialCleanCounts": {
      "principals": 0,
      "accounts": 0,
      "sessions": 0,
      "devices": 0,
      "audits": 0,
      "completedIdempotency": 0
    }
  },
  "cleanup": {
    "iamStopped": true,
    "port18087Released": true,
    "cleanupErrors": []
  }
}
```

---

## 6. 安全红线与防护策略

1. **容器隔离保护**：严格限制仅允许探测 `yuxuexing-local-mysql-1` 容器，严禁触碰任何非 `yuxuexing-local-*` 容器（包括外部项目的 `qida-*` 容器）；
2. **零命令副作用**：严禁执行 `docker restart`、`docker compose down`、`docker prune` 等任何容器重启/清理命令；
3. **固定端口严守**：IAM 固定监听 `127.0.0.1:18087`。若端口被占用，立即报告并安全退出，严禁使用 kill-port 强杀进程，严禁切换端口；
4. **子进程防假死与身份核验**：由当前进程 spawn 的子进程在关闭时严格校验 native handle 与出生时间戳，不收养孤儿 PID；
5. **凭证脱敏与审计**：严禁向控制台、环境变量、日志或 JSON 报告打印 `MYSQL_ROOT_PASSWORD`、私钥、明文密码或用户 Token。
