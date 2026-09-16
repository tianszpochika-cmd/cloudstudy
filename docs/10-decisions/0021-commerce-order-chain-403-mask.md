# ADR-0021：commerce 订单链 403 的真相——outbox 列漂移 + `/error` denyAll 假面（P1-LIVE-007 结案）

- 状态：已接受（人类负责人全权委托执行，2026-09-16）
- 日期：2026-09-16
- 相关任务：`P1R-M7`（商业沙箱链）、`P1R-M2-005`（outbox 形状）
- 缺陷：P1-LIVE-007（已关闭）

## 现象

`POST /orders|/payment-intents|/refunds` 在 Spring 层 403（`commerce policy denied this operation`），而同服务同 token 的 GET/redeem/cancel 全通。

## 排查中被证伪的理论（记录下来避免后人重走）

CSRF（字节码证伪：已 disable，且 redeem 同过滤器通过）、第二条链（单链已确认）、方法级规则（配置无）、进程错位（PID 已确认）、MvcRequestMatcher handler 缺失（字节码映射齐全）、`@ResponseStatus` 相关性（巧合：三个方法恰好都是写 outbox 的方法）。

## 真相（Spring Security TRACE 实证）

1. `/** → authenticated()` 正常匹配，JWT 验证通过（含 `commerce:order:write`）。
2. `RequestMappingHandlerMapping` 正常映射到 `createOrder` 并执行。
3. `createOrder` 内部 `INSERT INTO commerce_outbox_event` 用**旧 12 列形状**，`event_name NOT NULL` 回滚（与 P1-LIVE-005 learner 同物种；commerce 写侧漏改）。
4. 异常转发 `/error`；`/error` 无规则命中 → `anyRequest().denyAll()` → 403。**403 是假面，真正的状态码应该是 500。**

## 决策

1. `JdbcCommerceOutboxPort` 补齐 `event_name`（=eventType，沿用迁移 backfill 惯例）、`dedupe_key`（=SHA256(eventId)，沿用惯例）、`occurred_at`；全仓其余 5 家写侧已核对无掉队。
2. `/error` 保持 denyAll（不暴露内部异常细节给未认证客户端）；诊断 recipe（开 security TRACE 一次看清）记入本 ADR。
3. W3 终态：创单 201、支付意向 202、未支付订单退款 409（`REFUND_ORDER_NOT_REFUNDABLE` 守卫活验证）；PAID→退款 happy path 需 workload 回调凭证，本地未配给（刻意边界，M7 后续）。

## 后果

- commerce 92/0/0；W3 **19/19**；证据 `evidence/live/2026-09-16/w3-live-evidence.json`。
