# `admin-content-publish-tasks` 精确 GET 路由运行验收

**结论：PASS（仅此 GET 详情路由）。** 2026-09-23 08:39 UTC 在当前本地 Gateway `127.0.0.1:18070` 与 content owner `127.0.0.1:18089` 上完成真实 HTTP、权限和 MySQL owner 数据验证。没有重启、打包或修改 Gateway/content-service 源码。

## 运行结果

| 场景 | Gateway 实测 | content owner / 数据核对 |
| --- | --- | --- |
| 匿名读随机不存在的 task | `401` | 请求被认证边界拒绝。 |
| 合成普通学习账号读随机不存在的 task | `403 CONTENT_ADMIN_REQUIRED` | content owner 管理读取权限先于任务查询生效。 |
| 合成 content staff 读随机不存在的 task | `404 SCHEDULE_NOT_FOUND` | 直连 owner 同一内部路径也是 `404 SCHEDULE_NOT_FOUND`。 |
| 合成 content staff 读仅属于本次草稿的远期任务 | `200`，`taskId`、`packCode`、`targetType=PACK`、`targetRef`、`status=SCHEDULED`、`createdBy` 正确，响应含 request/trace ID | 直连 owner `200` 字段一致；`content_service.scheduled_publish_task` 中 `tenant=platform`、pack、target、status、creator 均匹配。 |

Gateway 使用精确 `GET /api/v1/admin/content-publish-tasks/{taskId}` 映射到 content owner `GET /internal/v1/content/admin-commands/publish-tasks/{taskId}`。本次实测的 404 领域码、200 task 字段与直连 owner 相同，证实当前运行实例的 Gateway→owner 读取链路可用。源代码静态定位见 `GatewayRouteExecutionPolicy.java:682-683` 与 `B9ContentAdminController.java:785-793`；契约见 `packages/contracts/fragments/b9/b9-content.openapi.json:861`。

## 测试数据与清理

- 使用一次性 `uat-publish-*@local.invalid` 合成账号；仅给该账号临时授予 `staff,content-editor,content-publisher` 角色和 `content:write,content:publish,admin.content.read` 权限，再通过真实 IAM 登录获得 JWT。此权限授予是本地 UAT 准备步骤，未验证正式后台授权流程。
- 经 Gateway 新建只属于该账号的**未发布**草稿，并创建 `2035-01-01T00:00:00Z` 远期发布任务；任务 `spt_73e0dadc7656`、草稿 `uat-publish-muduqg75aa24d7`。正向 GET 前核对 content owner 持久行。
- 随即按任务 ID、草稿 code、owner principal 和状态精确删除：1 条任务、1 条草稿版本、1 条草稿定义、4 条该合成账号的幂等记录；停用合成账号并撤销活动会话。清理后合成任务/草稿余量 `0`、活动会话 `0`。原有发布任务数运行前后均为 `2`，没有触碰旧任务。
- 账号记录保留为 `DISABLED`，用于审计追溯。脚本不保存密码或 JWT。

## 证据与边界

- [机器可读运行结果](admin-content-publish-task-runtime.json)：14 项检查全通过，含各状态码、task 字段、owner 持久事实和清理计数。
- [可重复探针](admin-content-publish-task-probe.mjs)：`node --check` 通过；单次运行成功，使用 `finally` 清理合成数据。
- 本结论只证明**详情读取**的 Gateway→content owner、权限和数据一致性；不扩展到管理端 UI、定时执行、发布状态机或正式角色授予流程。以上其他功能仍需各自验收。
