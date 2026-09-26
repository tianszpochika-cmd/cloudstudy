# 管理端内容工作台实测（2026-09-23）

`PAGE-P1-ADMIN-CONTENT` 判定为 **PARTIAL**。首轮真实浏览器发现过期保存误被接受和多页列表偶发 503；第五批修复后已沿 Gateway 重测，过期保存 409、列表两页均 200。仍未验收内容导入、独立双审、发布或真实版权授权。

## 第五批修复后复测

新的 `content-service` 已在本地执行 V22 并投入运行。[14 项真实 Gateway 回归](content-cas-runtime.json)覆盖合成 staff 的草稿创建、版本 2 保存、同键同体回放、同键异体 409、过期 `SAVE_DRAFT` 409、owner 版本和散列独立性，以及 100+3 两页列表 200。所有本次草稿、版本及回执精确清理，库复核为 103 条定义、101 条版本和 8 条无版本定义；账号已停用。独立只读 Review 未发现 V22/CAS/Hikari 的批次部署阻断，但其他非草稿生命周期命令的跨进程冷重放仍可能返回 503。[第五批部署边界](batch5-runtime.md)说明迁移、JAR 与容器状态。

## 运行证据

- 只读页面：内容列表从 Gateway 两页读回 106 条定义，筛选、详情、无匹配、故障恢复与 1280/390px 布局已测。第一次合成草稿创建后的第二页 GET 出现一次 503；之后创建和刷新多次返回 200。主任务从 13:18 Java runner 日志定位到 `JdbcContentRepository.findAll` 第二页 N+1 查询经 `DriverManagerDataSource` 反复建立新 socket，底层 `BindException: Address already in use: connect`；这是多页大列表的运行风险，已转给 content owner 处理连接池。见 [只读记录](admin-content-readonly/evidence.json)、[1280 截图](admin-content-readonly/content-1280.png)、[390 截图](admin-content-readonly/content-390.png)。
- 草稿写链：独立合成 staff 经 UI POST `CREATE_DRAFT` 得 202，owner 生成 version 1；经 UI POST `SAVE_DRAFT` 得 202，owner 生成 version 2。两版均为 `DRAFT`、rights `PENDING`、`allowsLearning=false`，无授权证据、审核员、发布者或发布指针。发布按钮禁用，公开投影 0。随后经 Gateway 发送 `expectedStateVersion=1`、`targetVersionNumber=1` 的过期 `SAVE_DRAFT`，当时最新已是 version 2；服务端仍返回 **202** 并落库 version 3。这是可复现的 CAS 缺口。见 [写链证据](admin-content-readonly/draft-evidence.json)。
- 测试数据：三个合成版本、唯一定义和对应幂等记录在确认无公开投影、排期、outbox 及学习/评测/媒体引用后备份并精确删除；合成 staff 已禁用、清空权限并撤销活动会话。备份仅保留在本地验收目录，供本轮核查。
- 无版本旧数据：owner 库有 11 条 `content_definition` 没有 `content_version`。原 owner 列表仍给出 `latestStatus=DRAFT`；管理端现将其显示为“版本缺失/需修复”，禁用编辑、校验、提交和发布，避免误作真实草稿。`bulk-course-0085` 经浏览器核查，390px 无页面横向溢出、Console 无错误。见 [无版本证据](admin-content-readonly/versionless-evidence.json)、[1280 截图](admin-content-readonly/versionless-1280.png)、[390 截图](admin-content-readonly/versionless-390.png)。旧行未改动。

## 改动与验证

- `apps/admin-web/src/api/content-service-command-adapter.ts`：按 B9 `data` 数组和游标读取完整列表；无版本定义不映射为可编辑草稿，适配器也拒绝对其保存、校验和提交。
- `apps/admin-web/src/views/AdminContentView.vue`：修复列表空态/分页；创建成功后清除未保存标记；无版本内容显示修复提示并禁用相关输入和动作。
- `pnpm --filter @englishflow/admin-web exec vue-tsc --noEmit`、`pnpm --filter @englishflow/admin-web build` 和定向 `git diff --check` 均通过。新 UI 改动由本机前端开发服务热更新后浏览器核查；尚无本轮容器镜像复测。

## 未闭环

过期草稿保存与两页读的本地回归已通过；并发高负载及跨进程重放仍需独立验证。批量导入、预览、双独立审核、版权证据和发布/回滚仍需独立验收。旧无版本定义现剩 8 条，其中有外部关联，需逐项核对后处理。
