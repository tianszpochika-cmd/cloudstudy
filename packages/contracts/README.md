# contracts

API、事件、JSON Schema、AI 输入输出和内容 schema 的共享契约。修改这里通常需要同步服务、客户端和测试。

认证契约的唯一正式方案是 `fragments/b8/b8-auth-iam.openapi.json` 中的自有 JWT 认证中心：`iam-service` 校验账号密码、在 Phase 1 签发 RS256 Access Token、发布 RSA JWKS，并轮换/撤销不透明 Refresh Token。ES256 只能在新增 ADR、同步更新契约与 JWKS key schema、密钥管理和运行实现并通过验证后扩展。正式契约不包含 OIDC/OAuth、Keycloak、第三方身份提供方、授权码或外部浏览器认证往返路由；官网不保存业务 Token。

### P1R-M1-002 认证传输 profile

- `X-Auth-Transport` 只选择凭据传输，不是授权事实；省略时兼容默认 `WEB_COOKIE`，`NATIVE_SECURE_STORAGE` 必须显式选择，并由 IAM 按设备类型/可信客户端上下文交叉校验、失配 fail closed。
- Web/H5 使用 `WEB_COOKIE`：Access Token 只在内存；Refresh Token 只由 `yuxuexing_refresh` 的 `HttpOnly; Secure; SameSite=Lax; Path=/api/v1/auth` Cookie 发送和轮换，JSON `data` 永不返回 `refreshToken`。
- iOS、Android 与原生 iPad 使用 `NATIVE_SECURE_STORAGE`：JSON `data.refreshToken` 为必填，且只能保存到 Keychain/Keystore；禁止 localStorage、sessionStorage、uni-app 普通 storage 或明文 fallback。原生 refresh body 显式携带该值，且不接收 `Set-Cookie`。
- 注册、登录和刷新共享公开 endpoint，但响应 `data.authTransport` discriminator 和具名 Web/Native schema 使生成客户端能静态区分 variant；不得重新引入可选 `refreshToken` 的混合成功响应。
- logout、密码重置与适用的会话撤销撤销相应 token family/session：Web 返回同名同 Path 的清 Cookie（`Max-Age=0`/过去 `Expires`），原生端不发 Cookie、只清理 Keychain/Keystore。CORS、CSRF、Origin/Referer 与跨站凭据策略属于 P1R-M1-004。

OpenAPI、事件目录和 JSON Schema 分别位于 `openapi/`、`events/` 与 `schemas/`；生成物位于 `generated/`。兼容性检查使用 `scripts/contracts/compatibility-diff.mjs`，删除既有路由/事件/字段、增加必填字段、收窄枚举或改变类型都会被视为破坏性变更。

```powershell
pnpm contracts:validate
node scripts/contracts/merge-b1-fragments.mjs
node scripts/contracts/generate-contracts.mjs --check

# Explicit write commands; do not use these merely to validate drift.
pnpm contracts:merge
pnpm contracts:generate
pnpm contracts:compatibility -- --kind openapi --baseline <old-openapi.json> --current packages/contracts/openapi/v1/openapi.json
pnpm contracts:compatibility -- --kind events --baseline <old-events.json> --current packages/contracts/events/v1/catalog.json
pnpm contracts:compatibility -- --kind schema --baseline <old-registry.json> --current packages/contracts/schemas/v1/registry.json
pnpm contracts:compatibility:git -- --ref <older-accepted-commit> --kind all
```

`contracts:compatibility:git` directly reads immutable contract blobs from the specified Git commit and compares them with the working tree. It rejects a clean `HEAD` self-comparison; use the last accepted contract commit as `--ref`.

无写入的 merge 与 generate check 会比较内存预期结果和磁盘 canonical/生成物；任何漂移都会失败。兼容性比较必须显式提供独立的 `--baseline` 与 `--current`，禁止把当前文件与自身比较。

所有外部客户端仍只能通过 Gateway 的 `/api/v1` 边界访问；`packages/api-client/src/gateway-test-double.ts` 供四端契约/交互测试使用，不替代真实 Gateway 运行态。

## P1R API foundation

`fragments/p1r-api-foundation.openapi.json` 是 P1R-M1-001 的唯一公共 API 基座 fragment，定义 canonical 成功、游标分页和错误 envelope，以及 HTTP 400/401/403/404/409/422/429/5xx 的标准响应、关联与弃用 headers。合并后的 `openapi/v1/openapi.json` 顶层 `x-p1r-api-governance` 是供自动检查读取的治理投影；所有外部操作的 JSON 2xx 响应必须引用 canonical 成功/分页 envelope，任何已声明的标准错误响应必须直接引用对应 `Api*` response component。

既有 B1-B13 域 envelope 仅可作为迁移输入，并以 `x-superseded-by` 指向 canonical 类型；不得继续作为 `/api/v1` operation 的 success/error envelope。所有外部 `list*` 操作以及任何声明游标的操作必须同时引用 canonical `Cursor`、`PageSize`、`ApiCursorPageEnvelope` 与 `ApiCursorPageMeta`，并声明 `x-pagination.mode=cursor`；游标状态只能位于 `meta`，不得继续留在 `data`。所有 `/api/v1` 写操作必须声明 `x-idempotency`：持久化写入绑定 required `Idempotency-Key`，唯一安全例外是 `POST /api/v1/content/media/{mediaAssetId}/signed-access`，它不创建持久领域事实且必须携带完整的 `x-p1r-idempotency-exception`。

只更新本包生成物时使用：

```powershell
node scripts/contracts/generate-contracts.mjs --contracts-only
node scripts/contracts/generate-contracts.mjs --contracts-only --check
```
