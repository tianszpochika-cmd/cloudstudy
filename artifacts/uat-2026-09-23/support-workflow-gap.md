# 管理端客服工单操作链验收（2026-09-23）

## 实际结果

| 环节 | 当前证据 | 结论 |
| --- | --- | --- |
| 脱敏工单列表 | 历史授权读取为 200 / 101；[数据来源隔离](support-ticket-provenance-quarantine.md)后新合成 staff 经 Gate、同意、权限登录，Gateway 列表 200 / 27、本人 200 / 0，fixture 详情 404；匿名 401、无权 403 | 当前平台读取和隔离已复验；27 条仍是本地 owner/UAT 记录，未验证授权写入 |
| 接单、回复、升级、解决、关闭 | 当前 Gateway 对 `/api/v1/admin/ops/tickets/{ticketId}/messages`、`/commands`、旧 `/transitions` 的匿名 POST 均为 404；静态执行策略也未投影这些路径。旧 `/admin/ops/commands/prepare` 匿名 POST 为 401，但只生成通用转发命令 | **BLOCKED**：未形成可公开执行的客服处理链 |
| 状态与并发 | Phase 1 设计及 M1-016 契约要求七态、七类、`expectedVersion`、独立 assignment/SLA/retention、内容引用与 owner reconciliation receipt；当前 `SupportTicketService` 仍为旧六态、六类，`B13AdminCommandRequest` 将 expectedVersion 固定为 null | **BLOCKED**：不能把旧泛命令或内部旧状态迁移当成正式工单解决 |
| 审计与二次确认 | 旧泛命令虽可准备一次性确认并写转发审计，返回 `FORWARDED` 不代表 `support_ticket` 状态变化；当前内部旧 transition 也未在 Gateway 开放 | 二次确认和转发审计不足以证明结案 |

## 本轮修复

- 管理端客服页和商业页不再提供“提交解决”假成功按钮；客服页明确提示当前只可查看脱敏工单，分类、优先级、状态和时效改为简短中文。
- 旧泛 `SUPPORT_RESOLVE/CLOSE` 在 `AdminOpsService` 的 prepare/execute 入口明确返回 `503 ADMIN_SUPPORT_COMMAND_UNAVAILABLE`，且无转发和审计副作用；权限检查仍先执行。
- B13 通用命令契约补充该运行边界说明。真正的 M1-016 owner 命令仍为 `D2_CONTRACT_READY / NOT_RUNTIME_VERIFIED`，未提高验收状态。

## 验证与部署边界

- `pnpm --filter @englishflow/admin-web build` 通过，包含 Vue 类型检查和 Vite 生产构建。
- `mvn -f services/admin-ops-service/pom.xml test`：66 tests，0 failures，0 errors，2 skipped；新增守卫测试验证旧泛命令 prepare/execute 都拒绝且无转发/审计。
- B18 + M1-016 Node 契约测试 91/91，Admin B12 测试 2/2，OpenAPI JSON 解析及 `git diff --check` 通过。
- 隔离 Boot JAR：`C:\Temp\cloudstudy-uat-adminops-20260923\target\admin-ops-service-0.1.0-SNAPSHOT.jar`，SHA256 `30836234C44F6156C9A2E45F1FC39573A2934C0AF776ABDCFC6B870856E109B6`。2026-09-23 10:37 CST 集中重启已将相同字节部署至本地 admin-ops-service，健康检查通过；由于公开客服七态命令仍为 404，且没有授权 staff 写入 E2E，503 守卫仅有测试与源码证据，不代表完整处理链可用。前端生产构建已生成，Docker 应用镜像尚未重建。
- 未对真实联系人、自由文本或真实工单做读取/写入；没有授权 staff 写入 E2E，不能声明客服业务完成。

## 后续关闭条件

按 M1-016 在 `admin-ops-service.support` 单一 owner 实现七态 CAS 命令、消息内容引用、assignment/SLA/retention、owner 回执和审计；同步 Gateway 公共路由、前后端契约与权限，再用合成 staff 与学员分别回归接单、回复、升级、解决、确认/超时关闭、重开、重复/过期版本及跨租户拒绝。
