# R1-002 开工准备包（PLANNED revision 27，不申请 READY，不实施业务差量）

> 状态基线 `[实测]`：`dev-plan-R1.status.json` revision 27；R1-001 ACCEPTED（`approve-8.json` decision ACCEPTED，三 TC PASS，主审独立重跑 11/152/exit0）；R1-002/003/004/005 均为 PLANNED；HEAD `3d11be33` 未变；本组零业务改动、零后台启动、零 DB 写入。
> 差异声明：与任务提示一致——R1-001 确为 ACCEPTED revision 27，无状态/证据变化；R1-002 仍 PLANNED。

## 1. 范围与已有实现（任务1）

- 卡片 `[读取]`（`tasks/R1-002.md`）：目标 IAM 公开注册真实创建+受限会话+安全拒绝，201 仅表示账号/会话建立；唯一 owner `iam-service`；主父 P1R-M2-002；BC-002/IC-002/IC-052；依赖 R1-001（已 ACCEPTED）；契约动作 implement（identifier/password/device，必填 Idempotency-Key，默认 WEB_COOKIE）；修改边界 4 文件（BoundaryController / PasswordAccountService / SessionService / 并发安全测试）；禁止 core-api 写入、手改生成类型、共享库清库、凭据入 Git。
- 可复用 `[读取]`（当前源码）：
  - `IamProviderBoundaryController:121-138` register 已实现（Idempotency-Key 必填校验、transport 解析、fingerprint、幂等边界、device 校验、已发布政策门槛、`ClientAuthorityClaims.none()`、201 建立）。
  - `PasswordAccountService:91-110` register（client override 拒绝、归一化、密码校验、并发锁、冲突不枚举、BCrypt 哈希、ACTIVE 新账号、审计）。
  - `SessionService:44-55` open（受限 scope 上下文、refresh 会话、确定性 replay seed、审计）；`JwtTokenService` 签发（需核 claims 剥离，见缺口 G2）。
  - `PasswordAccountConcurrencySecurityTest` 并发/安全基线（BCrypt cost12、非枚举、竞态拒绝）。
- 缺失/待核（不自行改动，交主审裁定）：
  - G1：注册 201 后 principal/permissions 是否确无学习权限（`tokenAccount` 剥离逻辑待逐行核对；当前仅读到 `tokenAccount(account)` 调用，未展开）。
  - G2：`SessionService.open` 的 `ServerPrincipalContext` scope 是否已为受限（未评估成人门/同意仅受限 scope），需对照 Jwt claims（adult_gate NOT_EVALUATED/consent UNKNOWN）核对。
  - G3：并发测试是否覆盖“同键重放同一结果”（R1-003 范畴，本卡仅确认 register 幂等边界存在，不提前实施）。
  - 本组未改任何业务文件；dirty 树中无 R1-002 filePlan 文件改动。

## 2. 隔离验收环境（任务2，只读核查）

- IAM schema/身份/迁移 `[读取]`：`application.yaml:97-102` persistence 默认关闭（`IAM_PERSISTENCE_ENABLED:false`），schema `iam_service`；`run-v2-services.mjs:137-146` runner 绑定 `svc_iam` + `mysqlUrl('iam_service')` + Flyway true；migration V1,V3-V18（无 V2，属正常跳号）；`b17` owner 清单含 iam 依赖边；`reconcile-owner-schemas` 预应用迁移、DML-only 凭据（与 R1-001 content/commerce 同模式）。
- 端口/版本 `[实测]`：18087/18070 CLOSED（FREE），13306/16379/19092 LISTENING；Node v20.19.5、pnpm 10.19.0、Java 25.0.4.1；iam jar 未核（缺口 E1：`services/iam-service/target/*.jar` 存在性/哈希未采，需补）。
- 密钥/启动 `[读取]`：`application.yaml:72-89` RS256（issuer `http://127.0.0.1:18087`，aud `yuxuexing-api`，key-id `iam-local-2026-08`，私钥仅 `IAM_JWT_PRIVATE_KEY_PEM/FILE` 注入，ephemeral 默认 false，Secure 默认 true）；runner `:167-172` 用 `secrets/iam-rsa-private.pem` 或 ephemeral 回退；replay/fingerprint secret 必填（非 local/test）；refresh cookie 名 `yuxuexing_refresh`，HttpOnly+Lax+`/api/v1/auth`。
- 缺口与最小补齐：
  - E1（主审/owner）：确认 iam jar 构建状态与哈希；若缺失由 owner 构建，不自行改源码构建。
  - E2（主审/owner）：IAM 专用验收 schema+最小权限身份尚未建立（不得复用 R1-001 的 `r1_001_empty_*` content 库，不得用共享 `iam_service` 做注册写入）；最小方案：参照 R1-001 prep9 模式新建 `r1_002_iam_<suffix>` 空 schema（结构 LIKE、零行）+ SELECT/INSERT 最小身份，或由 owner 指定隔离实例；凭据仅子进程注入。
  - E3（主审）：合成 identifier/password/device fixture 与 adult-gate/consent 未评估基线确认（R1-002-TC01 要求无成人/同意）。
  - 本组未清库、未改权限、未重启共享服务、未启动后台。

## 3. 契约与安全边界（任务3）

- register `[读取]`（`b8-auth-iam.openapi.json:272-391`）：`POST /api/v1/auth/register`，security 空（公开），`x-idempotency required/keyHeader`，transport 双态（WEB_COOKIE 默认：refresh 仅 Set-Cookie；NATIVE 需显式，refresh 进 JSON）；request `B8RegisterRequest`（identifier 3…128、password 12…128 writeOnly、`additionalProperties:false`、`x-client-authority-fields:[]`）；201 + Set-Cookie/X-Request-Id/X-Trace-Id/Cache-Control；400/409/429；审计 `auth.account.registered.v1`（redacted password/accessToken/refreshToken）。
- principal/permissions `[读取]`（`:1153-1268`）：`GET /api/v1/iam/principal|permissions`，bearerAuth，200/401；服务端派生，不接受客户端 tenant/role/owner。
- 安全语义 `[读取]`：201 仅账号+受限会话（description `:279` 学习访问须服务端 adult Gate 通过后）；Access 内存、Refresh HttpOnly/Secure/SameSite（Web）或 Keychain/Keystore（移动）；`ClientAuthorityClaims.hasOverride()` 拒绝 tenant/owner/roles（实现 `:91-95` + 控制器 `:134` 传 none）；无 OIDC/第三方；无完整生日采集（adult Gate 服务端判定）；不手改 `generated/openapi.ts`。
- 冲突检查：未发现卡片/契约/实现硬冲突；`password minLength 12`（契约）与实现 `validatePassword` 待终验时逐断言核对（缺口 C1，不自行改实现）。

## 4. TC 输入/动作/预期/读回/采集（现行卡片）

- TC01 integration：隔离空 schema + 合成 identifier（无成人/同意）→ POST 注册 → GET principal → GET learning/today；预期 201 一账号/会话、学习 403、账号服务可读；owner 读回 iam_account/iam_session/iam_principal；BFF/浏览器不适用（API 卡）。
- TC02 security：合法请求加 role/tenant/owner 或密码日志钩子 → POST → 预期 authority 拒绝、日志/证据无密码/refresh；读回不变 + 审计拒绝事件。
- TC03 recovery：事务注入 DB/Outbox 写失败 → 注册失败后同键重试 + owner 读回；预期非 201、回滚无孤儿、恢复仅建一次。
- 采集：脱敏 trace/request（X-Request-Id/X-Trace-Id）、HTTP 回执、owner 前后读回、Outbox/audit 关联；命令 `pnpm p1r:auth-contract:check`（主审编排，不运行）、`mvn -Dtest=PasswordAccountConcurrencySecurityTest test`（G-ENV 确认后）。

## 5. 条件与停止点

- 已具备：R1-001 ACCEPTED 依赖；register 实现骨架；契约/源码只读核对；端口/依赖服务 LISTENING；密钥注入路径明确。
- 缺失（P1R-M2-002 owner/主审补齐）：E1 jar 身份、E2 IAM 隔离 schema+身份、E3 合成 fixture 基线、C1 密码/claims 逐断言、G1/G2 受限语义终核（终验时）。
- 最小解阻：owner 提供 E1+E2+E3；主审签 READY 后实施 R1-002 并交 REVIEW；002 ACCEPTED 后才解锁 003/004，004 后才解锁 005；不跳卡、不进 R1-006。
- 本包仅准备，不作验收；`source-and-inputs.json` 见同目录；无密码/Token/私钥/真实用户信息。
