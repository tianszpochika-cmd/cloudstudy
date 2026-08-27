# B30 本地 Keycloak/OIDC 运行契约切片验证

> 日期：2026-08-24  
> 范围：本地 OIDC/Keycloak 配置、四个 public client、MCP 浏览器注册登录、IAM/MySQL 事实、Gateway/服务侧拒绝边界和会话登出  
> 结论：B30 的标准 IdP、JWKS、IAM、PEP、会话 API/DB 生命周期和故障恢复运行 Gate 已通过；Browser MCP 已进入真实 Keycloak 登录页，但注册、登录、回调和认证后页面旅程尚未提交，因此本章仍等待最终浏览器确认。

## 固定运行契约

- Provider：官方 `quay.io/keycloak/keycloak:26.7.1`，仅用于本地测试。
- Host/port：`http://127.0.0.1:18099`，realm 为 `yuxuexing-local`；端口事实源为 `config/local-ports.json`。
- Issuer：`http://127.0.0.1:18099/realms/yuxuexing-local`。
- Discovery、authorization、token、userinfo、logout 和 JWKS 地址以 `config/local-oidc.json` 为唯一契约。
- API audience：`yuxuexing-api`，由 Realm 的 `yuxuexing-api-audience`（Keycloak 26 的 `oidc-audience-mapper`）写入 access token 的 `aud`；客户端权限仍由服务端 IAM/PEP 决定。
- Principal 绑定：四个本地客户端默认附加 `yuxuexing-identity` scope，由 Keycloak `oidc-sub-mapper` 写入 access token 的标准 `sub`，IAM 只用 `iss+sub` 查找自己的 MySQL 映射事实。
- 客户端全部为 public authorization-code client，无 client secret，强制 PKCE `S256`，implicit/direct-access/service-account grant 均关闭。

| Client | 固定回调 | Web origin | logout 回调 |
|---|---|---|---|
| `yuxuexing-learner-web` | `http://127.0.0.1:18180/auth/callback` | `http://127.0.0.1:18180` | `http://127.0.0.1:18180/` |
| `yuxuexing-admin-web` | `http://127.0.0.1:18181/auth/callback` | `http://127.0.0.1:18181` | `http://127.0.0.1:18181/` |
| `yuxuexing-mobile-h5` | `http://127.0.0.1:18183/auth/callback` | `http://127.0.0.1:18183` | `http://127.0.0.1:18183/` |
| `yuxuexing-mobile-app` | `englishflow://auth/callback` | 空 | `englishflow://auth/callback` |

回调和 logout allowlist 都是 exact match；不接受 `/*`、fragment、query、跨 client 复用或未登记 origin。Realm 注册策略允许本地合成用户自助注册，关闭动态 client 注册、邮件验证、密码重置和用户名修改；密码策略为 `length(12) and notUsername`。任何测试密码只能由未提交的本地环境提供。

## 可重复验证

在仓库根目录执行：

```powershell
node scripts/runtime/b30-bootstrap.mjs --static-only
node --test tests/b30/*.test.mjs
node scripts/runtime/local-oidc-idp.mjs up

$env:B30_RUNTIME_EVIDENCE_FILE = Join-Path $env:TEMP ("b30-oidc-{0}.json" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))
node scripts/runtime/b30-bootstrap.mjs --require-runtime
Remove-Item Env:B30_RUNTIME_EVIDENCE_FILE
```

`b30-static-check.mjs` 只读取固定配置、端口登记和 Realm 文件，不访问网络。`b30-runtime-probe.mjs` 只访问当前运行中的 Keycloak public discovery/JWKS/authorization/logout endpoints：

- 检查 discovery issuer、六个 endpoint、`authorization_code`、`code` 和 `S256`；
- 检查 JWKS 至少有带 `kid` 的 public `RS256` signing key，且没有 private JWK members；
- 对四个 client 访问精确 callback，确认能到 Keycloak login/registration 页面；
- 分别提交缺少 PKCE、`plain` PKCE 和未登记 callback，确认均被 Keycloak 拒绝；
- 对四个 logout callback 做 exact/未登记负例；
- 访问动态 client registration endpoint 时不携带凭据，确认不会公开创建 client；
- 不调用 token endpoint，不生成或收集 JWT、authorization code、refresh token 或密码。

如需保存本次运行的 JSON 证据，使用上面的 `B30_RUNTIME_EVIDENCE_FILE` 指向临时目录；不要把包含本地运行信息的证据文件提交到仓库。停止 IdP 时使用 `node scripts/runtime/local-oidc-idp.mjs down`，该命令保留 Keycloak volume。

## 本次证据

| 验证 | 结果 |
|---|---|
| `node scripts/runtime/b30-bootstrap.mjs --static-only` | PASS，48/48 静态检查 |
| `node --test tests/b30/*.test.mjs` | PASS，6/6 |
| `node scripts/runtime/b30-runtime-probe.mjs` | PASS，9/9 运行检查、4/4 client；`tokenEndpointCalled=false` |
| `pnpm b30:lifecycle-runtime` | PASS，授权码登录、principal/me、refresh rotation/replay、logout、explicit revoke、wrong password、IdP outage/recovery；10/10 检查 |
| `node scripts/database/reconcile-iam-schema.mjs --apply` | PASS，IAM owner schema 12 张表，`b30-rbac-v1/rbac/ACTIVE` 策略事实存在 |
| `pnpm contracts:validate` | PASS，427 operations、479 OpenAPI schemas、154 events |
| IAM `mvn -q test` | PASS |
| Discovery/JWKS | 当前 Keycloak 返回 issuer 与配置一致；JWKS 有 `RS256` signing key 和 `kid` |
| PKCE/redirect | 四个 client 的 S256 精确回调通过；plain、缺失 challenge、未登记 callback/logout 均拒绝 |
| registration | MCP 浏览器从学习端登录页进入 Keycloak 登录/注册页；未代填密码或提交账号，待用户确认 |

运行探针前，现有 disposable Keycloak volume 中的 client post-logout 属性曾保留旧的 `/*` 配置。本次在不删除 volume/账号、不落盘凭据的情况下通过 Keycloak 管理接口同步为上述四个 exact URI，随后重新执行真实探针并通过。当前本地合成账号只用于本机验证，最终清理应在 B30/B36 收口时执行。

## 本轮 MCP 浏览器与 MySQL 真实证据

以下证据只记录结果，不记录用户名、密码、authorization code、access token、refresh token 或浏览器存储内容。认证后的条目是待执行项，不在本轮未获用户确认时计为通过：

| 场景 | 浏览器结果 | 持久化/安全结果 |
|---|---|---|
| 干净学习端会话 → Keycloak 注册 | 登录页和 Keycloak Register 可达；未提交账号 | 不产生认证后浏览器事实，避免伪造完成 |
| 登录深链 `returnTo=/onboarding` | 未登录深链被送至登录门禁；回调后跳转待执行 | 服务端 returnTo 校验由 API/静态边界覆盖 |
| 成人 Gate、同意、目标/时长 | 认证前不可操作 | 由 B34/B36 认证后 Browser MCP 继续 |
| 登出、刷新、撤销与重载 | API/DB 生命周期脚本通过；浏览器操作待执行 | `b30-lifecycle-20260825021018` 已对账 |
| 未认证/伪造 authority | Gateway 与服务侧保护接口拒绝 | 返回 401，伪造角色/租户头未获得业务响应 |
| 浏览器错误/恢复态 | Mobile H5 的 Gateway 中断与恢复已通过 | learner-web/admin/完整认证旅程仍需正式回归 |

本轮 `assessment` 页可以打开题目壳，但因当前只运行 Gateway、IAM、learner、content 四个 B30 聚焦服务，页面同时正确显示“学习服务暂时不可用”；这不是静态假数据通过，而是 B32 assessment/learning 服务尚未加入本轮运行集的明确降级状态。

## B30 生命周期与审计对账

最近一次生命周期运行：

- `runId`：`b30-lifecycle-20260825021018`；本次证据不输出敏感 token 值；
- 授权码 + PKCE、有效 `/api/v1/iam/principal/me`、服务端 `policyVersion=b30-rbac-v1` 由生命周期运行脚本通过；Browser MCP 只到达 Keycloak 登录页；
- 重复 callback 返回 `409`，旧 refresh replay 和登出/显式撤销后的 refresh 均返回 `401`；
- 错误密码被 Keycloak 拒绝；停止本地 Keycloak 后 callback 返回 `503`，没有生成会话；恢复 Keycloak 后可重新建立会话；
- IAM MySQL 对账：`auditRowsCorrelated=9`、`revokedSessions=2`、`externalIdentities=1`、`policyVersions=1`；审计行按本次请求的 `runId-*` 与同一 `traceId` 可查询；
- `tokenValuesEmitted=false`、`credentialsPersisted=false`、`jwtCreated=false`。测试用户名、密码、authorization code、access/refresh token 均只在进程内使用，未写入仓库或证据文件。

为使策略版本成为真实 owner fact，IAM 增加了 `V3__seed_b30_policy_version.sql`，并由 `reconcile-iam-schema.mjs` 在本地 owner schema 幂等应用；`JdbcAuditFactPort` 也改为写入当前 `b30-rbac-v1`，不再使用历史 `b23-local` 标记。

## 完成边界

B30 的 IdP/IAM/PEP/生命周期 API/DB Gate 已通过并可移交后续章节；Browser MCP 注册、登录、回调和认证后旅程仍是 B34/B36 的未关闭条件。B31/B32 的真实内容与学习领域证据已分别记录在对应验证文档，最终 Web/H5 全链路仍需 B34–B36 收口。
