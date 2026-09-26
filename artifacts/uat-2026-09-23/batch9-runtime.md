# 第九批本地运行与镜像复验（2026-09-23）

本批只处理第八批之后发现的内容命令权限、管理端状态文案和移动社群网络状态误报。仍使用现有五个基础设施容器与四个固定端口前端开发服务；仅停止、重启了本轮自己启动的 16 个 Java 进程。没有操作共享 Docker 基础设施或把镜像部署到公网。

| 项目 | 实际证据 |
| --- | --- |
| content 权限 | `REVIEW_FIRST`、`REVIEW_FINAL`、`PUBLISH`、`UNPUBLISH`、`ROLLBACK` 在读取内容定义前先检查权限；无权用户对不存在的编码也得到 403，不再由 404 泄露资源存在性。新增五命令聚焦回归。 |
| content 源码测试 | 35 个 suite、222 个 test，0 failure、0 error、2 skipped。首次完整测试受本机默认临时目录 loopback 错误影响，未改代码，以 `TEMP=TMP=C:\Temp` 重试完整套件通过；这是环境错误，不计作产品成功。 |
| 本地 JAR | 原 content JAR 已备份于 `C:\Temp\cloudstudy-uat-batch9-jar-backup-20260923`，原 SHA-256 `5C377DA4D9FD9E29C5AABC63002C3812B5C662FE174B39BB2E6E7051D4846541`；新 SHA-256 `B2A0096D17418C98ED6A76E5C9FB808BECACFDF7A628F1BF0E1405667DFE2F1D`。集中重启后按 core-api 特有健康路径检查 **16/16 HTTP 200**。 |
| 管理端命令复测 | [双审发布边界脚本](admin-review-publish-boundary.mjs)将无权伪造角色且目标不存在时的断言收紧为精确 403；新运行 **23/23** 通过。未授权/自审/越级审核/无权发布等边界均无意外写入，临时草稿、回执和两个 `.invalid` 账号按脚本精确清理。没有取得合法版权批准，正向双审发布仍未验收。[结果](admin-review-publish-boundary.md) |
| 移动社群 | 13 个并行读取中离线包接口失败时，已成功的 owner 读取不再被错误标为整页断网。移动 TypeScript 检查通过；新账号 320/390px 实际浏览器复测 **35/35**，房间 200/空数组、无水平溢出、无 JS pageerror。离线包路径仍 404 且有 CORS Console 错误，整页仍为 PARTIAL。[报告与截图](social-empty-after-quarantine.md) |
| Docker 镜像 | 标签 `583ab627-uat-batch9-202609231740` 下 20/20 镜像存在：content、admin Web、mobile H5 三个重新构建，其余 17 个沿用第八批镜像。core+full Compose 配置解析通过。**镜像构建和首页可达不代表容器内业务通过**；独立全栈容器实测另列。 |

管理端 `/release` 的空表与状态已改成中文，浏览器 390px 由专项 Agent 验过；本批 admin 镜像包含这项改动。发布按钮仅在服务端所表达的最终独立审核完成后启用，原先要求同一条任务同时出现两个互斥审核状态的条件已修正。缺真实版权权利事实，不能凭按钮状态将发布链标成 PASS。

本批没有更改 Gateway 路由或版权流程。`/api/v1/sync/offline-packages` 在浏览器和 Gateway 的缺失边界仍需按契约补 owner 路由或明确不可用响应，不能把 `404` 当作正常空列表。
