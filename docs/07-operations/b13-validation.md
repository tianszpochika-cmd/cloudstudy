# B13 代码层开发与逻辑测试交接

> 执行日期：2026-08-22。范围：商业化、运营后台、客服工单、脱敏分析、官网转化、Gateway 接线和四端代码边界；不等同于真实微服务运行态、生产支付或浏览器/设备签收。

## 结论

B13 的 8 项代码目标已形成可进入第一轮测试的切片。`commerce-service` 拥有订单/权益/支付回调事实；`admin-ops-service` 只读聚合并转发经过权限、审批、幂等和审计的命令；`analytics-service` 只消费显式 allowlist 的脱敏事件并提供版本化投影/重算；官网不持有业务会话，也不写订单、支付或权益。

支付 Gate、真实 自有 JWT 登录、Kafka、MySQL、外部 provider、浏览器和真机仍是测试阶段工作，不在本轮代码完成结论内。

## 任务交付

| 任务 | 代码层交付 | 测试阶段剩余 |
|---|---|---|
| `V2-B13-COM-001/002` | SKU/价格快照/订单/权益/激活码/退款/对账；Provider port、签名/金额/币种/订单绑定、回放去重、恢复/取消和默认关闭 Gate | Java 25/Maven/Spring HTTP、MySQL/Flyway、真实支付 provider、Kafka Outbox 和并发压测 |
| `V2-B13-ADM-003` | 只读投影、权限/租户 PEP、作者与操作者分离、审批二次确认、命令幂等和 append-only 审计 | 自有 JWT 登录/JWKS、领域命令真实 adapter、持久化、跨服务审计查询 |
| `V2-B13-ANL-004` | B10/B12/B13 事件 allowlist、隐私字段拒绝、dedupe、指标投影、空/错误态、回放重算、`Idempotency-Key` | Kafka consumer、durable journal、worker 调度、指标时区/规模压测 |
| `V2-B13-SUP-005` | 工单/SLA/脱敏视图、MediaObjectRef 引用权限、通知命令 seam、恢复和审计 | media/notification 真实联调、附件授权、SLA 时钟和通知供应商 |
| `V2-B13-OFS-006` | 公开价格/权益/活动投影、SSR fallback、UTM 保留、allowlist 回跳、登录/结算安全跳转 | Gateway 公开投影、自有 JWT 登录、CDN 缓存、搜索抓取和真实应用商店链接 |
| `V2-B13-FE-007` | learner-web/mobile 使用 Gateway `/commerce` 与 `/payment-intents`；admin-web 使用 `/admin/ops` 脱敏投影和命令；loading/empty/error/权限状态保留 | 浏览器键盘/触控、App/小程序/Windows/PWA、主题/locale/响应式和无障碍矩阵 |
| `V2-B13-TEST-008` | `tests/b13` 12 项契约、迁移、服务安全、四端边界逻辑测试 | 跨进程旅程：官网 → 登录 → 结算意图 → 权益投影 → 后台审计；不触发真实支付 |

## 契约、数据和 Gateway 边界

- OpenAPI 源：[B13 Commerce/Admin/Analytics fragment](../../packages/contracts/fragments/b13/b13-commerce-admin-analytics.openapi.json)；其升级后的 `M1015` commerce 操作是当前 canonical OpenAPI，公开官网入口为 `/api/v1/public/commerce/catalog`，学习端商业入口为 Gateway `/api/v1/commerce/**`，后台为 `/api/v1/admin/ops/**`。
- AsyncAPI 源：[M1-015 commerce v2 event fragment](../../packages/contracts/events/v1/fragments/m1-015-commerce-v2.events.json)；B13 v1 的 commerce event 语义只保留 historical input。事件只发布状态摘要、价格快照引用、脱敏指标和重算事实，不发布 provider 原文、签名、凭证、raw transaction id、激活码 secret、答案文本或音频。
- `V0021__create_commerce_admin_analytics_b13.sql` 为根迁移事实，登记于 `migration-manifest.json`；服务 schema/写权限仍按服务独立，admin-ops 不跨域双写。
- Gateway 已登记 commerce `18096`、admin-ops `18097`、analytics `18098`，并清理客户端角色、租户、owner 伪造头。服务侧仍必须验证 JWT/workload；Gateway 不是唯一 PEP。
- 前端的 UI `locale` 与 `contentLocale` 分离；B13 页面继续通过共享 i18n、design token 和服务器状态表达 loading/empty/error/disabled，不把颜色作为唯一状态信号。

## B13 原始验收快照（历史，不是当前 canonical 计数）

下表保留 2026-08-22 的 B13 原始验收来源，便于追溯旧实现；其中 fragment、route、operation、schema 与 event 数量已被后续 M1 契约任务取代，不能用于当前 HEAD 验收，也不能据此推导 M1-015 已具备运行能力。

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

## P1R-M1-015 当前静态验收摘要

| 命令/检查 | 当前结果 |
|---|---|
| `pnpm contracts:merge:check` | 通过；23 个 OpenAPI fragments、17 个 event fragments，canonical 372 routes / 175 events |
| `pnpm contracts:validate` | 通过；403 operations、706 OpenAPI schemas、175 events、125 event payload schemas、34 AsyncAPI channels / 122 operations、13 JSON schemas |
| `pnpm p1r:commerce:check -- --json` | 通过；`D2_CONTRACT_READY / NOT_RUNTIME_VERIFIED`，仅 `SANDBOX_HMAC` 静态候选 |
| `node --test tests/p1r/p1r-commerce-contract.test.mjs tests/p1r/p1r-commerce-generated-types.test.mjs` | 通过；含 provider、callback、entitlement、refund、reconciliation、readiness 与生成类型负例 |

上述数字必须随最终提交重新生成和核验；它们只描述静态契约投影，不是 broker、数据库、真实 provider 或客户端运行证据。

## P1R-M1-015 D2 static validation 与运行边界

| 范围 | 当前冻结结论 | 不可推导的运行结论／后续 owner |
|---|---|---|
| commerce 契约 | `D2_CONTRACT_READY / NOT_RUNTIME_VERIFIED`；静态投影冻结 13 个 B13/M1015 operationId、SKU/price snapshot、activation、order、payment attempt、callback receipt、entitlement ledger/snapshot、refund、reconciliation 的独立状态机和 fail-closed authority。 | 不能由 OpenAPI、policy、pure-Java smoke 或静态 checker 推导为 MySQL/Flyway、Gateway/JWT/PEP、Redis cache、Outbox/Kafka、consumer、DLQ/replay 或人工恢复已运行；这些由 `P1R-M2-003/004/005/006` 实现/运行验证。 |
| commerce v2 events | 仅 `commerce.order.created.v2`、`commerce.payment.requested.v2`、`commerce.payment.callback_received.v2`、`commerce.payment.verified.v2`、`commerce.entitlement.activated.v2`、`commerce.entitlement.revoked.v2`、`commerce.refund.settled.v2`、`commerce.reconciliation.discrepancy_recorded.v2`、`commerce.reconciliation.recovery_receipted.v2` 可作为 M1-015 canonical；统一 `platform.commerce.v1`、`aggregateId`、`.v1` consumer group 语义。 | B5/B13 v1 不双发，只是 historical input；B26 static binding 不表示 topic/ACL、producer、consumer 或 replay 已在 broker 上验证。 |
| provider 与敏感数据 | 唯一 active provider 为 `SANDBOX_HMAC`；`productionPaymentEnabled=false`、`autoRenewalEnabled=false`、`liveProviders=[]`。callback 有 workload 身份和 HMAC 第二层校验，activation 是 digest-only；raw callback、签名、真实凭据、raw transaction id、activation secret 禁入事件/审计。 | 不启用微信、支付宝、Apple IAP 或任何真实凭据、route、traffic；sandbox runtime、退款、对账、撤销、财务审计与安全验证仍属 `P1R-M7-006…011`。 |
| B20/B21/B26 Gate | B20 只可引用 static fixture/Gate，runtime 保持 `BLOCKED`；B21 继续 `NO-GO`；B26 继续 `pending`。 | 不能把 B20 synthetic fixture、B13 Java smoke 或 B26 static binding 作为支付、回调、权益或恢复的 runtime Evidence；`P1R-M8-005` 继续负责真实 E2E/质量/发布前验收。 |

### 字段映射与服务端派生上下文

- 对账策略中的 `reconciliationId` 对应 wire contract 的 `reconciliationCaseRef`；策略的单一绑定项 `sourceFactDigest` 由 wire contract 的 `sourceFactDigests[]` 规范化排序后计算。`closureReceiptId` 是 owner 内部不可变收据标识，外部/事件只传 `recoveryReceiptRef` 或 `closureReceiptRef`；三者不得互换，也不得由客户端自造。
- `approvalRefs[]` 只引用 IAM 已解析的 ACTIVE approval receipt。两个 receipt 必须绑定同一 reconciliation case/version、remediation plan、precondition、source facts 与 policy version，并解析为两个不同且具备财务审批权限的 principal；principal id 不进入 commerce wire/event。
- 权益 snapshot resolve 请求只接收 `minimumPolicyVersion` 与 `expectedInvalidationVersion`。tenant、subject、resource、contentVersion、consumer workload 与 owner 均由已认证 workload、路由资源和服务端本地事实派生，并由领域服务 PEP 校验；缺失、冲突或无法解析时 fail closed，客户端字段没有授权效力。

### Callback key rotation 的 D2 边界

M1-015 只冻结 `ATOMIC_SINGLE_ACTIVE`、仅 ACTIVE key、unknown/revoked/expired/overlap 全拒绝、审计与 rotation receipt 必需、key material 禁入 contract/log/event 的规则。Secret manager 接入、实际轮换操作、轮换收据存储、故障演练和生产 Evidence 仍由 M2/M7 任务完成；本文不宣称 key rotation runtime 已验证。

## 测试阶段入口

1. 使用 JDK 25、Maven、测试 IAM JWT 认证中心/JWKS、MySQL/Redis/Kafka/Workflow 和支付 provider 替身，先执行 `pnpm ports:check`。
2. 通过 Gateway 验证公开目录、学习端订单/权益、payment-intent、回调 workload、管理员投影和 analytics ingest 的 401/403、tenant/owner、trace/requestId、幂等和审计。
3. 仅以 `SANDBOX_HMAC` 替身验证价格快照不可变、支付 Gate 关闭、HMAC/金额/币种/订单绑定、重复/冲突回调、失败恢复、`FULL_ONLY` settled refund→revoke、人工 hold/双审批与 `MATCHED_AFTER_RECOVERY` 对账关闭；确认不触发真实渠道、真实凭据、route 或 traffic。
4. 验证 admin 审批二次确认、作者不能审自己、工单附件引用权限、SLA/恢复、脱敏导出和通知命令；确认 admin-ops 不写领域事实表。
5. 执行官网 → 登录 → 结算意图 → 权益投影 → 后台审计模拟旅程，以及 learner-web、Mobile H5/App/微信小程序、PWA/Windows 的加载/空/错误/权限/主题/locale/响应式/无障碍矩阵。

当前工作站只有 Java 24 且没有 Maven；因此主 Agent 只执行依赖无关 Java smoke、Node 契约/迁移/边界测试和前端构建。Java 25/Spring Boot 4.1 运行态、真实 Gateway/IAM JWT 认证中心、数据库/事件平台、支付、浏览器和设备验收留待测试阶段。
