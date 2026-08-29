# contracts

API、事件、JSON Schema、AI 输入输出和内容 schema 的共享契约。修改这里通常需要同步服务、客户端和测试。

认证契约的唯一正式方案是 `fragments/b8/b8-auth-iam.openapi.json` 中的自有 JWT 认证中心：`iam-service` 校验账号密码、在 Phase 1 签发 RS256 Access Token、发布 RSA JWKS，并轮换/撤销不透明 Refresh Token。ES256 只能在新增 ADR、同步更新契约与 JWKS key schema、密钥管理和运行实现并通过验证后扩展。正式契约不包含 OIDC/OAuth、Keycloak、第三方身份提供方、授权码或外部浏览器认证往返路由；官网不保存业务 Token。

### P1R-M1-002 认证传输 profile

- `X-Auth-Transport` 只选择凭据传输，不是授权事实；省略时兼容默认 `WEB_COOKIE`，`NATIVE_SECURE_STORAGE` 必须显式选择，并由 IAM 按设备类型/可信客户端上下文交叉校验、失配 fail closed。
- Web/H5 使用 `WEB_COOKIE`：Access Token 只在内存；Refresh Token 只由 `yuxuexing_refresh` 的 `HttpOnly; Secure; SameSite=Lax; Path=/api/v1/auth` Cookie 发送和轮换，JSON `data` 永不返回 `refreshToken`。
- iOS、Android 与原生 iPad 使用 `NATIVE_SECURE_STORAGE`：JSON `data.refreshToken` 为必填，且只能保存到 Keychain/Keystore；禁止 localStorage、sessionStorage、uni-app 普通 storage 或明文 fallback。原生 refresh body 显式携带该值，且不接收 `Set-Cookie`。
- 注册、登录和刷新共享公开 endpoint，但响应 `data.authTransport` discriminator 和具名 Web/Native schema 使生成客户端能静态区分 variant；不得重新引入可选 `refreshToken` 的混合成功响应。
- logout、密码重置与适用的会话撤销撤销相应 token family/session：Web 返回同名同 Path 的清 Cookie（`Max-Age=0`/过去 `Expires`），原生端不发 Cookie、只清理 Keychain/Keystore。CORS、CSRF、Origin/Referer 与跨站凭据策略属于 P1R-M1-004。

### P1R-M1-003 授权与政策 profile

- B8 principal 只投影 IAM 的服务端事实；subject、Phase 1 tenant、角色/权限绑定、成人/同意、设备和 policy version 必须带可验证来源。客户端 role/permission/tenant/owner header 或 body 字段不具有 authority。
- 成人 Gate 由 IAM 按当前政策与服务端时间判定，客户端生日/确认只是申请输入；required consent 绑定 purpose、文档 version/digest、授予/撤回与重验证。缺失、过期、撤回或来源不可信均拒绝受保护动作。
- RBAC 只给出候选权限集合；ABAC 决策还必须绑定可信 principal、调用服务身份、本地 resource/owner/tenant/content rights、phase、device trust、consent 和 policy version。关键事实缺失、策略过期、撤销不确定、PDP 不可用时一律 DENY。
- 正常热路径是领域服务本地 PEP + 已验证 JWT + 本地资源事实 + 版本化策略包/短时安全缓存。只有高风险、动态策略或安全缓存未命中才调用内部 IAM PDP；外部客户端不得直连内部 decision endpoint。
- admin policy 是不可变版本控制面：draft、submit、独立第二人 approve、activate、revoke 均需要稳定命令、幂等、requestId/traceId/auditId、职责分离和 cache invalidation；历史版本可审计，不能删除后失去回放能力。
- 本 profile 只冻结 D2 契约。IAM/成人/同意/策略真实持久化属于 P1R-M2-002，领域服务 PEP/PDP 运行实现属于 P1R-M2-003，权限后台页面属于 P1R-M6-009。

### P1R-M1-004 Gateway 边界 profile

- `fragments/p1r-gateway-boundary.openapi.json` 的 `x-p1r-gateway-boundary` 是 Gateway D2 单一事实源。每个 active `/api/v1` operation 必须命中唯一最高优先级 route rule 并映射到唯一 service owner；未覆盖、等优先级歧义、未知 owner、外部 `/internal/v1` 和新 `core-api` 写入均 fail closed。
- learner-web、admin-web、mobile H5、official-site 和原生端分别使用具名 origin/transport profile。credentialed CORS 只允许精确 origin，禁止 wildcard；官网只做具名公开读取且不建立业务会话；原生端不得发送或接收 Cookie。
- Web Cookie 非安全方法必须精确验证 `Origin`；只有没有 `Origin` 时才允许精确 `Referer` origin 回退。缺失、不受信或冲突使用 canonical 403。原生 `NATIVE_SECURE_STORAGE` 不适用 Cookie CSRF，但必须与可信客户端/设备上下文交叉校验。
- JWT 预检固定 RS256/JWKS/issuer/audience/time/token type/scope，不能仅凭 `Authorization` 头存在或客户端 authority 头建立身份，也不能替代服务 PEP。具名 route class 绑定限流，429 必带 `Retry-After`，受保护/高风险策略的限流后端异常返回 canonical 503。
- requestId/traceId、写入幂等键、统一错误、脱敏边界审计和 direct-connect deny 都由同一 profile 约束；应用层拒绝 `/internal/v1` 不替代网络层隔离。
- 本 profile 只冻结 D2 合同。Java Gateway、真实 CORS/CSRF、Redis/JWKS、Ingress/NetworkPolicy、浏览器与跨进程 Evidence 属于 P1R-M2-001。

### P1R-M1-006 事件治理 profile

- `events/v1/catalog.json` 是事件状态、producer/data owner、consumer group、topic、partition、schema 与兼容策略的唯一治理源；其中 `fragmentInventory` 冻结 14 个 fragments 及各自的有序事件清单。fragment 删除、重复、未知文件或顺序漂移都会失败；fragments 只能贡献事件和 payload 语义，不得手工声明 `status`、`x-p1r-governance`、`x-kafka` 或 AsyncAPI。
- 154 个目录条目全部显式分类。当前只有 7 个已具备可信 B26 静态绑定的 workflow reliability 事件进入 `CANONICAL_D2`；其余 147 个保持 `HISTORICAL_CANDIDATE`，在对应领域契约任务签收前不会进入 canonical AsyncAPI，也不能由生成器补默认 owner/consumer。
- canonical AsyncAPI 3.0 从 catalog 确定性投影为 7 个 channel、7 个 `send` 和 14 个 `receive` operation；Kafka topic、binding `0.5.0`、producer、data owner 与每个 consumer group 必须精确匹配。任何第二事实源、重复 ID、漂移或缺失 receive 都失败关闭。
- `envelope.schema=platform.event.v1` 标识共享信封契约本身；每条目录记录的 `event.schema` 标识该事件 schema version。生成的 `PlatformEventEnvelope<TPayload,TEventSchema>` 与每个事件接口保留后者的字面量类型，避免把两者误合并。
- `pnpm p1r:event-governance:check` 验证治理源、B26 静态 seed、fragment 边界和 AsyncAPI exact projection。它只证明 `D2_CONTRACT_READY` / `NOT_RUNTIME_VERIFIED`；真实 broker/topic/ACL/投递属于 M2-005，完整 Outbox/dedupe/retry/DLQ/replay/Saga 合同属于 M1-007。

### P1R-M1-007 事件可靠性与恢复 profile

- `events/v1/reliability-policy.json` 是 Outbox、consumer dedupe、重试、DLQ、replay、聚合顺序与回执的 D2 单一事实源；它引用而不改写 M1-006 的 catalog/AsyncAPI。`rootEventId`、`causationEventId` 和 `aggregateVersion` 由 owner 在 Outbox 边界写入补充可靠性记录，原始事实必须满足 `rootEventId=eventId`，重试和回放不得改写源事件身份。
- owner 的领域事实与不可变 Outbox 记录同事务提交；Outbox 绑定事件 payload digest、owner、topic、聚合版本和完整因果链，只有 broker ack 后才能标记 `PUBLISHED`。consumer 以 `(consumerGroup,eventId)` 唯一去重，领域 effect 与 receipt 同 owner 事务提交，offset 只能随后提交。投递保持至少一次，不声明 exactly-once。
- 重试预算固定为含首次投递最多 5 次、指数退避加 jitter、1–60 秒；未知错误失败关闭。预算耗尽进入不可变 DLQ，回放保留事件/root/聚合/schema/dedupe/topic/payload digest，使用新的 `replayRunId` 和控制事件 ID，且必须走原 consumer group/path、继续启用去重/顺序检查并经过不同人员审批。
- `config/p1r-saga-recovery.v1.json` 冻结 workflow Saga、版本化幂等补偿、对账、请求者与独立审批者职责分离、人工恢复状态机和关闭 receipt。workflow/audit 只写各自 schema；领域补偿只能由目标 owner 通过版本化 API 或 canonical event 执行。
- 8 个新增 JSON Schema 分别约束可靠性上下文、owner-local Outbox record、publish/consumer/DLQ/replay/recovery task/closure receipt，全部拒绝未知字段和敏感凭据字段。`pnpm p1r:event-reliability:check` 与 `pnpm p1r:saga-recovery:check` 只证明 `D2_CONTRACT_READY` / `NOT_RUNTIME_VERIFIED`。真实 owner 事务/lease 属于 M2-004，Kafka/Outbox/consumer/DLQ/replay 属于 M2-005，Saga/审批/人工恢复运行闭环属于 M2-006；B26 继续为 `static-only` / `pending` / `NO-GO`。

OpenAPI、事件目录和 JSON Schema 分别位于 `openapi/`、`events/` 与 `schemas/`；生成物位于 `generated/`。兼容性检查使用 `scripts/contracts/compatibility-diff.mjs`，删除既有路由/事件/字段、增加必填字段、收窄枚举或改变类型都会被视为破坏性变更。

```powershell
pnpm contracts:validate
pnpm p1r:event-governance:check
pnpm p1r:event-reliability:check
pnpm p1r:saga-recovery:check
pnpm contracts:merge:check
pnpm contracts:generate:check

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
