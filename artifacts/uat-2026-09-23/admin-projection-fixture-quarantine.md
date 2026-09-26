# 管理端固定演示投影隔离（2026-09-23）

订单页原显示 `phase1-foundations / PAID`，同时提示“真实支付尚未开放”；该行来自 `seed-local-real-admin-analytics.mjs` 的固定本地演示投影，不是成交或支付回调。核对 `admin_ops_service.admin_projection` 后，五条固定 ID 分别属于 CONTENT、COMMERCE、LEARNER、NOTIFICATION、MEDIA，均有 `ownerSubjectId=local-fixture` 和 `tenantId=platform`，无数据库外键引用。没有修改其他 `bulk-100x` 或学习类行。

先在 `C:\Temp\cloudstudy-uat-admin-order-fixture-20260923` 分别保存订单投影和其他四条的原始 SQL：订单备份 1 行、508 字节、SHA-256 `2fb152fdbeae9d2db9df68b442428e6ce035591eeff910654ea43241c4a9b201`；其余四条备份 4 行、1,486 字节、SHA-256 `8be69baeed80c35a35193794e6547df6ebb89989dcab7be04014e6580863456d`。通过唯一 ID、owner、水印和原租户约束，在两个事务中把五条投影的 JSON `tenantId` 改为 `local-admin-fixture`，保留行及其他字段。源种子中的五条也同步写入隔离租户，避免重跑后回流平台。

真实合成 staff 重新登录管理 Web，Gateway `/api/v1/admin/ops/commerce/orders` 两次均 200/0 行，页面显示“暂无符合条件的记录”，1280/390px 无横向溢出，页面异常 0；只读身份没有退款入口，浏览器错误态探针显示预期提示。证据见[浏览器记录](admin-two-pages-after-order-quarantine/evidence.json)及[390px 截图](admin-two-pages-after-order-quarantine/commerce-390.png)。账号已停用、权限清空、会话/设备/角色均无活动记录。固定五条已全部处于隔离租户，平台 COMMERCE 投影为 0。

这只修正固定演示投影的可见性。`admin_projection` 还有 100 条 `bulk-100x-*` 与 10 条 `LEARNING` 本地夹具，`support_ticket` 仍有演示和批量造数；它们的来源与引用需继续逐项核验。订单空态不证明真实支付、退款、对账或权益闭环。
