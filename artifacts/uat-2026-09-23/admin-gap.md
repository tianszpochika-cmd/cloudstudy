# 管理端服务缺口诊断与本地验收数据修复

日期：2026-09-23。范围：Admin Web 的客服工单、学员 360°、审计导出和治理队列。业务数据修复只定位本机 `bulk-100x` 合成行；回归复用了本次合成测试账号，完成后撤销全部会话并再次禁用，未查看或输出凭据、令牌。

| 项目 | 原始运行证据 | 定位 | 本轮处理与复核 | 剩余状态 |
| --- | --- | --- | --- | --- |
| 客服工单读取 | 登录后 `GET /api/v1/admin/ops/tickets?limit=50&includeAll=true` 原返回 500，客服页及商业页工单区都失败 | `JdbcAdminOpsAdapters.SupportTickets.map` 对 `category`、`priority`、`ticket_status` 使用 `Enum.valueOf`，并将 `attachments_json` 解析为数组。本机 `admin_ops_service.support_ticket` 有 55 条 `bulk-100x` 合成行，分类和优先级是非法枚举，附件 JSON 是对象 | 只对同时匹配 `bulk-100x-category-%`、`bulk-100x-priority-%`、`bulk-100x-support_ticket-%` 且附件为对象的 55 条行规范化：按序号分配六种合法分类及四档优先级，空附件改为 `[]`。复核总共 101 条工单，分类非法 0、优先级非法 0、状态非法 0、附件非数组 0。真实授权 Gateway 回归返回 **200 / 101 条**，Admin Web `/support` 首屏显示 10 条 | **读取 PASS**；解决命令及其他写入未在只读账号下执行 |
| 学员资料读取 | `GET /api/v1/admin/learners/{subjectId}/profile` 原返回 503，原因 `learner first-day projection version does not match profile` | `JdbcLearnerProfileStore.findFirstDay` 要求首日投影的 `profile_id` 和版本与画像完全一致。本机 46 组 `bulk-100x` 合成数据的 ID 不一致，版本相同；目标 ID 无冲突 | 只对画像 ID 与投影 ID 均为 `bulk-100x`、同租户/owner 且版本相同的 46 条投影，将 `profile_id` 对齐画像。复核当前 114 组画像/首日投影，ID 不一致 0、版本不一致 0、完成率越界 0。真实授权检索返回 **200 / 1 条**，该合成学员资料返回 **200**，Admin Web 详情页成功打开 | **所测资料读取 PASS**；学习/测评分服务权限及资料修改未在只读账号下执行 |
| 审计导出 | 页面点“创建脱敏导出”后 `POST /api/v1/admin/ops/commands` 返回 404 `ADMIN_RESOURCE_NOT_FOUND` | `apps/admin-web/src/api/b5.ts` 用 `SUPPORT/audit-export/AUDIT_EXPORT` 命令；`AdminOpsService.authorize` 必须先找到对应 SUPPORT 投影，本机不存在。新的 M1-017 契约仅定义 `/internal/v1/audit/exports`，`externalExposure=DENY`、`runtimeStatus=NOT_RUNTIME_VERIFIED` | 未伪造 SUPPORT 投影，未暴露内部接口。管理端已将 404 显示为简短未接通提示 | **BLOCKED**：需确定并实现 admin-ops 到 audit-service 的正式导出编排、外部契约及端到端验收 |
| 治理队列 | `GET /api/v1/admin/moderation/reports` 与 `GET /api/v1/admin/recovery/tasks` 浏览器请求失败 | Admin Web 的 `api/b12.ts` 仍调用旧 B12 路由。当前 Gateway `GatewayRouteExecutionPolicy` 没有这些映射；只保留 `/api/v1/admin/recovery/recoveries` 和 `/sagas` 规范路由。Social local-real 有旧 moderation 读取/写入实现，但 recovery/tasks 没有对应当前 owner 路由，旧写命令也未形成可直接暴露的正式治理链条 | 未绕过 Gateway 或开放旧写接口。前端已把连接失败改为简短提示 | **BLOCKED**：需按 Phase 1 业务设计确定治理模块的服务 owner、Gateway/契约、安全与恢复命令，再联调 |

## 验证边界

- 本次实际修复的是本机合成数据，服务代码与契约没有改动。集中重启后，以真实登录、只读权限回归了修复过的客服和学员读取链：页面宽度 390px，无横向溢出、无浏览器脚本错误。未把读取 PASS 扩大到写入链。
- 回归结束调用真实 `/api/v1/auth/logout` 的 `allDevices=true`，返回 200；本次账号随后恢复为 `DISABLED`、权限为空，数据库核验 `ACTIVE` 会话数为 0。
- 本地 `bulk-100x` 海量种子不在仓库内；若从旧种子重建数据库，这两类坏值可能重现。后续种子生成应改用合法枚举、附件数组和同一画像 ID。
- 审计导出和治理属于跨服务契约与安全边界问题，不能将前端友好提示计为功能完成。

## 后续客服数据来源复验（同日）

上表的 101 条是此前原始平台列表的历史快照。随后按[客服工单来源审计与隔离](support-ticket-provenance-quarantine.md)备份并精确隔离其中 74 条可证明的本地演示工单；新合成 staff 经 Gateway 实测列表 **200 / 27**、本人列表 **200 / 0**，fixture 详情 404，平台工单详情 200。平台余下 27 条仍是本地 owner/UAT 记录，并非真实用户投诉。管理客服消息与处置命令尚未闭合，页面族仍为 `PARTIAL`。
