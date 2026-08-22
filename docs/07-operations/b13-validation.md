# B13 代码层开发与逻辑测试交接

> 执行日期：2026-08-22。范围：商业化、运营后台、客服工单、脱敏分析、官网转化、Gateway 接线和四端代码边界；不等同于真实微服务运行态、生产支付或浏览器/设备签收。

## 结论

B13 的 8 项代码目标已形成可进入第一轮测试的切片。`commerce-service` 拥有订单/权益/支付回调事实；`admin-ops-service` 只读聚合并转发经过权限、审批、幂等和审计的命令；`analytics-service` 只消费显式 allowlist 的脱敏事件并提供版本化投影/重算；官网不持有业务会话，也不写订单、支付或权益。

支付 Gate、真实 OIDC、Kafka、MySQL、外部 provider、浏览器和真机仍是测试阶段工作，不在本轮代码完成结论内。

## 任务交付

| 任务 | 代码层交付 | 测试阶段剩余 |
|---|---|---|
| `V2-B13-COM-001/002` | SKU/价格快照/订单/权益/激活码/退款/对账；Provider port、签名/金额/币种/订单绑定、回放去重、恢复/取消和默认关闭 Gate | Java 25/Maven/Spring HTTP、MySQL/Flyway、真实支付 provider、Kafka Outbox 和并发压测 |
| `V2-B13-ADM-003` | 只读投影、权限/租户 PEP、作者与操作者分离、审批二次确认、命令幂等和 append-only 审计 | OIDC/JWKS、领域命令真实 adapter、持久化、跨服务审计查询 |
| `V2-B13-ANL-004` | B10/B12/B13 事件 allowlist、隐私字段拒绝、dedupe、指标投影、空/错误态、回放重算、`Idempotency-Key` | Kafka consumer、durable journal、worker 调度、指标时区/规模压测 |
| `V2-B13-SUP-005` | 工单/SLA/脱敏视图、MediaObjectRef 引用权限、通知命令 seam、恢复和审计 | media/notification 真实联调、附件授权、SLA 时钟和通知供应商 |
| `V2-B13-OFS-006` | 公开价格/权益/活动投影、SSR fallback、UTM 保留、allowlist 回跳、登录/结算安全跳转 | Gateway 公开投影、OIDC、CDN 缓存、搜索抓取和真实应用商店链接 |
| `V2-B13-FE-007` | learner-web/mobile 使用 Gateway `/commerce` 与 `/payment-intents`；admin-web 使用 `/admin/ops` 脱敏投影和命令；loading/empty/error/权限状态保留 | 浏览器键盘/触控、App/小程序/Windows/PWA、主题/locale/响应式和无障碍矩阵 |
| `V2-B13-TEST-008` | `tests/b13` 12 项契约、迁移、服务安全、四端边界逻辑测试 | 跨进程旅程：官网 → 登录 → 结算意图 → 权益投影 → 后台审计；不触发真实支付 |

## 契约、数据和 Gateway 边界

- OpenAPI 源：[B13 Commerce/Admin/Analytics fragment](../../packages/contracts/fragments/b13/b13-commerce-admin-analytics.openapi.json)；公开官网入口为 `/api/v1/public/commerce/catalog`，学习端商业入口为 Gateway `/api/v1/commerce/**`，后台为 `/api/v1/admin/ops/**`。
- AsyncAPI 源：[B13 event fragment](../../packages/contracts/events/v1/fragments/b13-commerce-admin-analytics.events.json)；事件只发布状态摘要、价格快照引用、脱敏指标和重算事实，不发布 provider 原文、签名、凭证、答案文本或音频。
- `V0021__create_commerce_admin_analytics_b13.sql` 为根迁移事实，登记于 `migration-manifest.json`；服务 schema/写权限仍按服务独立，admin-ops 不跨域双写。
- Gateway 已登记 commerce `18096`、admin-ops `18097`、analytics `18098`，并清理客户端角色、租户、owner 伪造头。服务侧仍必须验证 JWT/workload；Gateway 不是唯一 PEP。
- 前端的 UI `locale` 与 `contentLocale` 分离；B13 页面继续通过共享 i18n、design token 和服务器状态表达 loading/empty/error/disabled，不把颜色作为唯一状态信号。

## 已执行验证

| 命令/检查 | 结果 |
|---|---|
| `pnpm contracts:merge` | 通过；19 个 OpenAPI fragments、13 个 event fragments，canonical 374 routes / 144 events |
| `pnpm contracts:validate` | 通过；402 operations、476 OpenAPI schemas、144 events、100 event payload schemas |
| `pnpm contracts:compatibility` | 通过；0 breaking changes |
| `pnpm db:validate` | 通过；21 个迁移，V0021 manifest/hash/fixture 静态检查通过 |
| `pnpm ports:check` / `pnpm config:check` | 通过；B13 服务固定端口空闲，运行配置安全 Gate 通过 |
| `pnpm test:b13` | 12/12 通过 |
| commerce pure-Java smoke | `commerce-service B13-COM-001/002 smoke: PASS` |
| admin-ops pure-Java smoke | `admin-ops-service B13 ADM-003/SUP-005 pure Java smoke: PASS` |
| analytics pure-Java smoke | `analytics-service B13-ANL-004 smoke: PASS` |
| learner-web / admin-web build | 通过；仅保留既有 Vite chunk/deprecation 警告 |
| mobile `pnpm build:h5` | 通过；仅保留 uni-app/Sass 既有提示 |
| official-site `pnpm build` | 通过；Nuxt SSR/SSG 预渲染 8 个页面路由 |

## 测试阶段入口

1. 使用 JDK 25、Maven、测试 IdP/JWKS、MySQL/Redis/Kafka/Workflow 和支付 provider 替身，先执行 `pnpm ports:check`。
2. 通过 Gateway 验证公开目录、学习端订单/权益、payment-intent、回调 workload、管理员投影和 analytics ingest 的 401/403、tenant/owner、trace/requestId、幂等和审计。
3. 验证价格快照不可变、支付 Gate 关闭、签名/金额/币种/订单绑定、重复回调、失败恢复、退款补偿和对账只读重放；确认不触发真实渠道。
4. 验证 admin 审批二次确认、作者不能审自己、工单附件引用权限、SLA/恢复、脱敏导出和通知命令；确认 admin-ops 不写领域事实表。
5. 执行官网 → 登录 → 结算意图 → 权益投影 → 后台审计模拟旅程，以及 learner-web、Mobile H5/App/微信小程序、PWA/Windows 的加载/空/错误/权限/主题/locale/响应式/无障碍矩阵。

当前工作站只有 Java 24 且没有 Maven；因此主 Agent 只执行依赖无关 Java smoke、Node 契约/迁移/边界测试和前端构建。Java 25/Spring Boot 4.1 运行态、真实 Gateway/IdP、数据库/事件平台、支付、浏览器和设备验收留待测试阶段。
