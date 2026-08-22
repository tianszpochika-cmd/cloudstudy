# B8 代码层开发与逻辑测试交接

> 执行日期：2026-08-22
> 范围：代码层开发、契约/规则/组件逻辑和构建验证；不等同于真实 IdP、生产安全或真机运行态验收。

## 结论

B8 的 7 项任务均已形成对应的代码切片、契约或测试边界，可以进入下一阶段的安全、浏览器、设备和运行态测试。当前不能把 B8 标记为生产完成：ADR-0011 的 G-IDP 尚未通过，真实 OIDC provider/JWKS、Java 25 + Maven 运行态、跨进程 Gateway→IAM→PEP、浏览器/App/小程序和 durable audit/PDP 仍待测试阶段签收。

## 任务交付状态

| 任务 | 本轮代码层结果 | 当前未签收项 |
|---|---|---|
| `V2-B8-IAM-001` | `services/iam-service` 建立 provider-neutral OIDC/OAuth 2.1 端口；服务端生成 state/nonce/code verifier，S256 PKCE、redirect allow-list、JWKS/refresh/revoke/workload identity seam 已定义 | G-IDP、真实 provider、JWKS rotation、部署身份和 Java 25/Maven 运行态 |
| `V2-B8-IAM-002` | principal immutable mapping、服务端 `platform` tenant、设备/会话/同意/成人 Gate/结构化审计事实；V0016 独占迁移 | durable repository、跨进程 session、真实审计回放和删除/恢复运行态 |
| `V2-B8-IAM-003` | `service-template` 提供 Resource Server/JWKS seam、VerifiedPrincipal、RBAC+ABAC 本地策略、短 TTL policy cache、PDP/PEP 和异常 fail-closed | 复制到各领域服务、真实策略发布/撤销、PDP 故障注入和跨租户运行态 |
| `V2-B8-GW-004` | Gateway 18070→IAM 18087 路由、旧 auth 兼容改写、伪造权限头清理、条件 Resource Server、401/403、边界审计和 core-api 反腐入口 | G-IDP 后启用 JWT/JWKS、真实限流、Gateway 运行态、直连阻断和回滚演练 |
| `V2-B8-USR-005` | Phase 1 成人 Gate、客户端年龄/tenant/owner/role 拒绝、无 child/guardian/K12/minor-payment 事实边界 | 注册/恢复 HTTP 流程、真实年龄证明、隐私/删除运行态和审计回放 |
| `V2-B8-FE-006` | learner-web、mobile、admin-web 接入 Gateway 会话/刷新/登出/权限/403/深链恢复；official-site 只生成公开登录深链；共享 locale/theme 保留 | 真实浏览器、App/iPad/小程序回调、弱网、无障碍和真实 IdP 联调 |
| `V2-B8-TEST-007` | B8 静态安全套件覆盖契约、迁移、IAM、Gateway、PEP 和四端 canonical 会话边界 | 浏览器模拟完整安全旅程、跨进程/真机/故障注入和行为兼容夹具回放 |

## 关键变更

- `packages/contracts/fragments/b8/` 是 B8 OpenAPI/AsyncAPI 源事实；四端使用 `standard-oidc` 的 canonical OIDC/IAM 路径，callback 只接受 `code/state/redirectUri`，`nonce/codeVerifier/transactionId` 由 IAM 事务存储控制，避免客户端提交 PKCE 信任事实。
- `B8PermissionsResponse`、嵌套 `session` 回调解析、服务端成人 Gate 请求字段已与前端适配器同步；旧 `/auth/refresh`、`/auth/logout` 和 session revoke 仍仅作为 Gateway 兼容入口。
- `config/local-ports.json` 登记 `iam-service=18087`；Gateway 默认只允许健康检查和显式公开 OIDC/刷新入口，其余路径在 Resource Server 未启用时默认拒绝。
- `database/mysql/migrations/V0016__create_iam_control_plane_b8.sql` 只存 hash/状态/审计事实，不存 access/refresh token 明文或 provider secret。

## 已执行验证

| 命令 | 结果 |
|---|---|
| `pnpm test:b8` | 28/28 通过 |
| `pnpm contracts:merge` | 通过，294 路由/103 事件合并 |
| `pnpm contracts:validate` | 通过，314 operations、268 schemas、103 events、53 payload schemas、4 JSON Schemas |
| `pnpm contracts:generate` | 通过，contracts 与 api-client 生成文件同步 |
| OpenAPI/事件/JSON Schema compatibility | 通过，0 breaking change |
| `pnpm --dir apps/learner-web build` | 通过；仅有 Vite chunk/dynamic import 提示 |
| `pnpm --dir apps/admin-web build` | 通过；仅有 Element Plus bundle/chunk 提示 |
| `pnpm --dir apps/official-site build` | 通过；仅有 Nuxt/Nitro 依赖和 Node deprecation 提示 |
| `pnpm --dir apps/mobile build:h5` | 通过；仅有 uni-app/Sass 更新提示 |
| `pnpm --dir packages/i18n typecheck` | 通过 |
| `pnpm --dir packages/design-tokens typecheck` | 通过 |
| `pnpm --dir packages/api-client typecheck` | 通过 |
| `pnpm test:b7` / `pnpm test:b6` | 28/28、4/4 通过 |
| `pnpm db:validate` / `pnpm redis:validate` / `pnpm ports:check` | 16 个迁移、Redis 28 entries、固定端口全部通过 |
| `node scripts/check-dod.mjs --strict` | 通过，5/5 checks |
| Java IAM 领域纯源码 `javac --release 24` | 通过；当前机器没有 Java 25/Maven，不能替代目标构建 |

## 测试阶段入口

测试阶段首先准备测试 IdP/fake adapter、签名 JWT/JWKS rotation fixture、Gateway/IAM/PEP 跨进程环境和四端浏览器/设备矩阵；通过 ADR-0011 后才允许注入真实 issuer、启用 `GATEWAY_RESOURCE_SERVER_ENABLED=true` 或将真实 provider 进入默认路由。任何 provider、策略、撤销或审计异常必须保持 401/403/fail-closed，不得退回匿名或客户端角色头授权。
