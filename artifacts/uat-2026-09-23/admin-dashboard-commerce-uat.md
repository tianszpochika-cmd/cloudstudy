# 管理 Web：工作台与订单退款页定向 UAT

日期：2026-09-23。本批仅测 `/dashboard`、`/commerce`；没有创建订单、支付、退款或修改业务数据，也没有重启或打包服务。真实浏览器使用本地 Chromium 和运行中的 Web/Gateway/owner 服务；未拦截或伪造正常成功响应。浏览器断网探针只用于检查错误态。

## 身份与边界

浏览器从深链进入时，匿名访问最终跳到 `/login`。本批通过公开注册创建仅供本次使用的 `@local.invalid` 合成账号，完成成人准入与必要同意后，授予 `staff` 角色和四项最小读取权限：`admin.dashboard.read`、`admin.commerce.read`、`admin.projection.read`、`analytics.read`。口令和令牌仅在脚本内存中，不写证据或截图。每次试验的 `finally` 都按精确生成标识清理；最终 SQL 核验账号及主体均 `DISABLED`、角色/权限字段清空、活动 session/device/principal-role 全为 0。三轮试验均完成清理。

## 浏览器结果

| 页面与状态 | 证据 | 结果 |
| --- | --- | --- |
| 工作台入口与加载 | 真实登录后进入 `/dashboard`；延迟实际 GET 500ms 时出现 skeleton，响应后消失 | PASS（展示链） |
| 工作台指标与刷新 | `/api/v1/admin/ops/metrics` 多次返回 HTTP 200，`meta.service=analytics-service`，0 行；刷新触发新 GET，页面显示“暂无可展示的运营指标” | 读通，指标数据闭环 **GAP** |
| 工作台错误 | 浏览器对指标 GET 临时断网，显示不可用告警；仅该探针产生预期 `net::ERR_FAILED` | PASS（浏览器网络错误态），未验证 owner 5xx |
| 订单页入口与加载 | 从工作台进入 `/commerce`；实际订单 GET 延迟期间有 skeleton，完成后消失 | PASS（展示链） |
| 订单读取与筛选 | `/api/v1/admin/ops/commerce/orders` HTTP 200，`meta.service=admin-ops-service`，1 条脱敏投影；用该行订单引用筛选后显示 1 行 | PASS（只读筛选） |
| 订单页错误 | 浏览器仅对订单 GET 临时断网，显示错误告警与刷新入口 | PASS（浏览器网络错误态），未验证 owner 5xx |
| 窄屏与 Console | 1280、390 两档的两页 `document.scrollWidth` 等于 viewport；正常读取阶段无 pageerror 或 console error | PASS（本批视口） |
| 写命令隔离 | 本批页面交互中的 `/admin/ops` 命令请求数为 0；只读账号无 `commerce.refund` | 未测退款业务链，符合本批只读边界 |

截图：[工作台 1280](admin-two-pages/dashboard-1280.png)、[工作台 390](admin-two-pages/dashboard-390.png)、[订单页 1280](admin-two-pages/commerce-1280.png)、[订单页 390](admin-two-pages/commerce-390.png)。机器可读结果见 [evidence.json](admin-two-pages/evidence.json)，可复跑脚本见 [admin-dashboard-commerce-live.mjs](admin-dashboard-commerce-live.mjs)。

## 发现与本批修复

`AdminCommerceView.vue` 先前向只有读取权限的 staff 展示“申请退款”列与退款表单。现在两处均要求服务端权限快照中的 `commerce.refund`；这只改变界面可见性，后端权限仍是最终边界。没有工单读取权限时不再显示工单统计卡。无指标时不再并排出现空表的 “No Data” 与空态插画，空态标签改成“只读”，支付提示及退款说明也已缩短。

两个页面的指标表原读取 `metricId`/`totalValue`，而当前 analytics owner 返回 `metricCode`/`value`。现按 owner 字段优先显示，并保留旧字段 fallback。当前运行时指标为空，故**新字段的可见正向行尚未获得浏览器证据**；已通过 Vue 类型检查。

## 数据真实性与业务闭环 GAP

- 浏览器默认近 30 天的指标 GET 为 HTTP 200/0 行；同一台本地 MySQL 的 `analytics_service.analytics_metric_projection` 在 `UTC_DATE()-30 DAY` 到当天有 **37 条 READY**，总计 100 条。Gateway 指向 analytics-service，18098 运行进程使用 `v2,local-real` JDBC profile。授权 Gateway 定向查询 2026-08-26～27 返回 24 行，查询 2026-09-18～23 返回误导性的 200/0；精确筛选一条早期指标返回 2 行，精确筛选一条后期 `bulk-100x` 指标返回 200/0，证明是同一运行 owner 的部分行导致查询崩塌。只读 SQL 核对后期有 **6 条 `bulk-100x-*` 合成行**同时满足 `projection_state='READY' AND error_code IS NOT NULL`，其中错误码不属于 `AnalyticsErrorCode`。`JdbcAnalyticsProjectionStore.projection()` 无条件 enum 解析，遇到这些行抛出异常；`AnalyticsQueryService` 将查询异常变成 ERROR/空行，旧 `AnalyticsController` 只输出行数组，故形成误导性的 HTTP 200/0。这是本地矛盾的根因，不能把其余合成 READY 行当成经营指标。
- 唯一订单投影 `phase1-foundations` 是 `seed-local-real-admin-analytics.mjs` 写入的 `local-fixture`，金额/`PAID` 是演示投影，不能作为真实成交、支付回调或对账证据。页面提示真实支付尚未开放，但当前返回模型没有可辨认的 fixture provenance；上线前需在 owner 数据与展示层明确隔离测试订单。
- 设计登记册 `PAGE-P1-ADMIN-DASHBOARD` 还要求健康/待办、时间范围和业务钻取；当前页面主要是指标只读表、快捷入口与静态流程。`PAGE-P1-ADMIN-COMMERCE` 还要求 SKU/权益、回调、对账与退款闭环；本批只验证订单投影及筛选，未验证这些写入和外部支付环节。两页可访问不等于业务闭环完成。

## 验证与限制

- `pnpm --filter @englishflow/admin-web exec vue-tsc --noEmit`：通过。
- `git diff --check`（仅本批两个 Admin view）：通过；UAT 脚本 `node --check`：通过。
- 运行时 GET 的 `meta.service` 分别指向 analytics-service、admin-ops-service，与 Gateway 精确路由及 owner 代码一致；未把 HTTP 200/0 行记为指标 PASS。
- 错误态的两条 Console `ERR_FAILED` 来自受控浏览器断网；正常页面 Console 与 pageerror 为 0。未执行支付、退款预检、退款命令或任何业务写入。

## analytics owner 修复与部署边界

已在 `AnalyticsController` 让查询状态 ERROR 映射到明确错误：投影读取失败为 HTTP 503 / `PROJECTION_READ_FAILED`，不支持的指标版本为 HTTP 422；真正空查询仍为成功空列表。`AnalyticsMetricsQueryStateTest` 覆盖这三种分支，并模拟损坏的存储投影抛错，定向测试 2/2 通过。完整 analytics-service 测试共 46 个、失败 0、错误 1、跳过 2；唯一错误是既有 `AnalyticsJwtDecoderNegativeTest` 在当前 Windows JDK 上创建本地 JWKS HTTP server 时 `PipeImpl` 无法建立 loopback，单独重试仍复现，与本批改动无关。

首次浏览器批次没有重启/打包，因此当时运行服务仍返回旧 200/0。随后在 13:12 CST [第四批集中部署](batch4-runtime.md)后，独立合成 staff 的 Gateway 定向请求已证实近 30 天、指定异常指标均返回 HTTP 503 / `PROJECTION_READ_FAILED`；早期可读区间仍为 HTTP 200 / 24 行。真实浏览器工作台显示“暂时无法读取数据”与刷新入口，1280/390 无横向溢出，pageerror 为 0；证据见[第四批浏览器结果](admin-two-pages-batch4/evidence.json)。六条畸形合成行仍未清理，真实指标恢复仍需可回滚数据修复、投影 provenance 与真实事件重算；不能将 `bulk-100x` 或 `local-real` 的 READY 状态当作真实运营数据。

公开 B13 指标契约后来已补 422/503，聚合 OpenAPI 合并检查通过；200 的分页 envelope 与 owner 返回形状仍需核对。

## 合成指标隔离后复测

随后对四张 analytics owner 表中 400 条可归因的本地合成行做完整备份，并在一个事务内迁至 `local-analytics-fixture` 测试租户；平台四表各为 0。使用独立合成 staff 的真实 Gateway/浏览器复测，历史区间、近 30 天和指定指标查询现在均 **HTTP 200 / 0 行**，工作台显示诚实空态，刷新可用，1280/390px 无溢出和页面异常。[隔离与前后态](analytics-fixture-quarantine.md)、[当前浏览器证据](admin-two-pages-after-analytics-quarantine/evidence.json)。本节覆盖上方旧 503 现场的**当前状态**；真实事件生产、投影重算与指标正确性仍未通过。唯一 `local-fixture` 订单仍不能作真实成交证据。

之后将五条固定 `local-fixture` 管理投影备份并迁至专用测试租户，其中包括上述 `PAID` 演示订单。再次用独立账号经真实 Gateway/浏览器复测，订单 GET 两次均 200/0，筛选与空态、加载及受控错误、1280/390px 布局正常；账号精确清理。[隔离记录](admin-projection-fixture-quarantine.md)、[最新两页浏览器结果](admin-two-pages-after-order-quarantine/evidence.json)。当前平台订单为空，不代表真实支付/退款闭环。
