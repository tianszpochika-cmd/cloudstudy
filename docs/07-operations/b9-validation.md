# B9 代码层开发与逻辑测试交接

> 执行日期：2026-08-22
> 范围：代码层开发、契约、领域规则、前端页面接入和逻辑/构建测试；不等同于真实微服务运行态、生产迁移或浏览器/设备签收。

## 结论

B9 的 7 项任务均已形成代码、契约、迁移、前端入口或静态逻辑测试切片，可以进入测试阶段。Learner、Content、Admin、学习端和官网已经按 v2 的服务 owner、Gateway、公开投影、locale/theme 和答案规则边界接入；当前不能把 Java 25/Maven Spring Boot 运行态、真实 Gateway→服务链路、MySQL/Kafka/IAM JWT 认证中心、浏览器或真机验收描述为完成。

## 任务交付状态

| 任务 | 本轮代码层结果 | 测试阶段仍需签收 |
|---|---|---|
| `V2-B9-LRN-001` | `services/learner-service` 独立 Java 25 POM、profile/goal/preferences/first-day domain/application、tenant/owner 默认拒绝、幂等/Outbox port、旧资料只读 shadow adapter、服务 Flyway V1 | Java 25 + Maven + Spring Boot、MySQL durable adapter、跨进程 PEP、legacy 对账运行态 |
| `V2-B9-CNT-002` | `services/content-service` 独立 Java 25 POM、定义/版本/版权、双审状态机、发布/下线/回滚、公开/学习者/assessment projection、答案规则过滤、Outbox/idempotency/cache ports | Java 25 + Maven、内容 controller/repository、真实版权数据、Kafka Outbox/DLQ 和策略故障注入 |
| `V2-B9-CNT-003` | B9 public/learner/internal OpenAPI、content epoch/cache invalidation、version pin/downline recovery、Gateway 相对路径和官网公开投影接入；public/learner projection 不含 answer rules | Gateway/Content 跨进程、ETag/缓存一致性、下线恢复和真实公开字段回放 |
| `V2-B9-ADM-004` | Admin 内容工作区改为 `/admin/content-commands` 单一意图命令入口，后台状态列表/审核节点由 B9 contract 投影派生；服务端负责双审、作者自审拒绝和状态版本冲突 | admin-ops 聚合服务、服务端权限矩阵、真实冲突/审计回放和浏览器交互 |
| `V2-B9-ONB-005` | learner-web/mobile 的 onboarding、assessment、home、today 接入 learner/content read model；Loading/Empty/Unavailable/Forbidden/恢复、本地快照、任务幂等、UI locale 与 contentLocale 分离和共享主题 seam 已接入 | Gateway session、浏览器/App/iPad/小程序、弱网/离线真实续学和无障碍/主题真机回归 |
| `V2-B9-OFS-006` | official-site 的首页、价格、下载、合规和公告使用 SSR public projection；canonical `/public/site/projection`、`uiLocale`、内存 stale fallback、download-disabled 和公开字段边界已接入 | 真实 Gateway/内容投影、SSR 缓存/CDN、SEO 线上验证和未发布价格/下载渠道回放 |
| `V2-B9-TEST-007` | `tests/b9` 覆盖服务边界、答案规则不泄露、契约/事件/迁移、固定端口、四端 locale/theme、官网只读和 Admin canonical command seam | 浏览器模拟完整“官网→登录→Onboarding→Home”、跨进程 trace/audit、真实设备矩阵 |

## 关键变更

- 新增 [learner-service](../../services/learner-service/README.md)（18088）和 [content-service](../../services/content-service/README.md)（18089）独立服务边界；`core-api` 仍只是 v1 迁移/回滚边界。
- 新增 `packages/contracts/fragments/b9/` 的 learner/content/shared OpenAPI 和 B9 learner/content event fragment；增加后台内容状态列表和 `B9ExpectedStateVersion`，允许新聚合用 expected version `0`，服务端返回版本从 `1` 开始。
- 新增 `database/mysql/migrations/V0017__create_learner_content_public_projection_b9.sql` 及 manifest 记录；root 迁移是本地兼容 fixture，生产 Flyway 仍由各服务独占 schema 执行。
- Admin adapter 不再使用 B5 的多条旧内容写入口；B9 代码路径统一为 Gateway 的 `/admin/content-commands`，旧 `apps/admin-web/src/api/b5.ts` 只保留历史兼容语义，不被 B9 内容视图调用。
- 官网 BFF 默认路径从历史 `public/site-projection` 对齐到契约的 `/public/site/projection`，并将 UI 语言作为 `uiLocale` 发送；官网不持有登录会话或学习事实。

## 已执行验证

| 命令/检查 | 结果 |
|---|---|
| `pnpm test:b9` | 6/6 通过；新增 Java Outbox canonical event-name、numeric contentVersionId 与 envelope 边界检查 |
| `pnpm test:b1`、`test:b3`、`test:b4`、`test:b5`、`test:b6`、`test:b7`、`test:b8` | 7/7、17/17、6/6、4/4、4/4、28/28、28/28 通过 |
| `pnpm test:b2` | 14 通过、3 TODO（既有运行态/环境 TODO），无失败 |
| `pnpm contracts:merge` / `contracts:validate` / `contracts:generate` | 通过；309 routes、333 operations、332 OpenAPI schemas、112 events |
| `pnpm contracts:compatibility` | 通过，0 breaking change |
| `pnpm db:validate` | 通过，17 个迁移和 fixture 静态校验 |
| `pnpm ports:check` | 通过，B9 18088/18089 及全表固定端口均空闲 |
| `pnpm --dir apps/learner-web build` | 通过；仅 Vite dynamic import/chunk 提示 |
| `pnpm --dir apps/admin-web build` | 通过；仅 Vite/Element Plus chunk 提示 |
| `pnpm --dir apps/official-site build` | 通过；Nuxt SSR、Nitro server 和 14 个 prerender route 完成，仅依赖 deprecation 提示 |
| `pnpm --dir apps/mobile build:h5` | 通过；仅 uni-app/Sass 更新提示 |
| `pnpm --dir packages/api-client typecheck`、`contracts`、`i18n`、`design-tokens`、`performance` | 全部通过 |
| Java learner/content `javac --release 24` 领域编译 | 通过；learner pure Java compile PASS，ContentDomainSmoke PASS |
| Java 25/Maven/Spring Boot 完整构建 | 未执行：当前机器为 Java 24 且无 Maven |

## 测试阶段入口

先准备 Java 25 + Maven、IAM JWT 认证中心/JWKS、Gateway/learner/content/admin-ops 跨进程环境，再执行服务测试和浏览器/设备矩阵。JWT runtime Gate 未通过前不得把本地测试替身当作生产身份系统；任何权限、版权、投影或 Outbox 异常都必须保持拒绝/降级/可恢复语义。
