# commerce-service

独立的 Java 25 / Spring Boot 4.1.x 商业域服务，负责 B13-COM-001/002 的 SKU、不可变价格快照、订单、支付尝试、权益、激活码、退款、对账和支付 provider 边界。`core-api` 的 B5 commerce 仅是迁移参考，不是 v2 事实源。

## 代码边界

- `CommerceApplicationService` 只从已验证 `CommercePrincipal` 派生 tenant/subject；命令没有客户端 `userId`、`tenantId`、owner 或金额事实。
- SKU 价格通过版本新增，订单、激活码和退款都保存 `PriceSnapshot`；历史订单不会被目录价格变更改写。
- `PaymentProviderPort` 是支付 SDK/HTTP 的替换端口。当前只有 sandbox HMAC provider，真实微信、支付宝、Apple 默认关闭，不代表真实渠道接入或上线。
- 回调顺序是 provider allowlist → canonical payload binding → signature → provider event 去重 → 金额/币种/订单/attempt 状态 → 本地事实、Audit、Outbox。已配置 provider 时必须完成签名绑定；真实 provider 未配置且 Gate 关闭时只记录拒绝事实，不伪造验证或结算。重复同 hash 回放，换 payload 的同 event 拒绝。
- `PaymentGate.disabled()` 下合法回调只记录 `GATE_REJECTED`，绝不进入 `PAID` 或激活权益；该收据不是结算事实，Gate 打开后同一事件仍可重试。支付尝试仍可恢复或取消，失败退款可重新请求。
- 激活码只保存 SHA-256 hash，明文只在签发返回值中出现；`sourceType + sourceRef` 保证权益幂等。
- Audit/Outbox/Idempotency/CommerceStore 都是 application ports；生产适配器必须在 commerce 自己的 schema/事务中实现，不能跨服务写表。

## 状态机

```text
Order:          CREATED -> PAYMENT_PENDING -> PAID
                CREATED/PAYMENT_PENDING/PAYMENT_FAILED -> CANCELLED
                PAID -> REFUND_PENDING -> REFUNDED | REFUND_FAILED
                REFUND_FAILED -> REFUND_PENDING | CANCELLED

PaymentAttempt: DISABLED -> PENDING -> SUCCEEDED | FAILED | CANCELLED
                FAILED -> PENDING
Refund:         REQUESTED -> PROCESSING -> COMPLETED | FAILED
                FAILED -> PROCESSING | CANCELLED
Entitlement:    PENDING -> ACTIVE | REVOKED
                ACTIVE -> GRACE | EXPIRED | REVOKED
ActivationCode: AVAILABLE -> REDEEMED | EXPIRED | REVOKED
Reconciliation: PENDING -> MATCH | MISMATCH -> REPAIR_PENDING | RESOLVED
```

## HTTP 与安全

服务默认拒绝，业务路由使用 `/internal/v1/commerce/**`。业务请求要求 Resource Server JWT，tenant 从 `tenant_id`/`tenant` claim、subject 从 token subject 派生；`X-Role`、`X-B5-Role`、`X-Tenant-Id`、`X-Owner-Id` 等客户端头会被隐藏。provider callback 使用 workload JWT 边界加 provider 签名校验（不接受终端用户身份）；真实 provider 未配置时由关闭的 Gate 安全拒绝。回调体不能提交 tenant/owner。

## Schema 与验证

`src/main/resources/db/migration/V1__create_commerce_own_schema.sql` 是服务自己的 schema 边界，包含 SKU 版本、订单、payment attempt/callback、权益、激活码、退款/callback、幂等、审计、对账和 outbox 表；本轮按用户约束没有修改根 `database/` 清单或 Gateway。

Java 24 依赖无关 smoke 命令（在本目录执行）：

```powershell
$out = Join-Path ([IO.Path]::GetTempPath()) ('commerce-b13-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory $out | Out-Null
$main = rg --files src/main/java | ? { $_ -notmatch 'CommerceServiceApplication\.java$' -and $_ -notmatch 'adapter\\http\\' -and $_ -notmatch 'config\\' }
javac --release 24 -encoding UTF-8 -d $out $main (rg --files src/test/java)
java -cp $out com.englishflow.commerce.CommerceServiceSmoke
```

预期输出：`commerce-service B13-COM-001/002 smoke: PASS`。本机没有 Maven/JDK 25 时，不得声称 Maven/Java 25 构建通过；真实 OIDC/JWKS、MySQL、Kafka、KMS、provider sandbox/资质和浏览器/HTTP 运行态仍需测试环境验收。
