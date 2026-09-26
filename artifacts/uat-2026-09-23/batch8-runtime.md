# 第八批本地运行复测（2026-09-23）

## 更新范围

16:57 CST 集中重启本机 16 个 Java 服务，更新 IAM 和 assessment 两个 JAR。重启前仅备份这两个旧 JAR 至 `C:\Temp\cloudstudy-uat-batch8-jar-backup-20260923`；未停止五个 Docker 基础设施容器或四端前端开发服务，未执行数据库迁移。旧 JAR SHA-256：IAM `802340A43D67B0B44960E24813A7B68A907942FEAFB64812B471F8A2AC97B438`，assessment `E8A115C76D5137329D6B20E6532E0B2BCDD5D9D849F84B3362BAC1BDA20B9D4E`。新 JAR SHA-256：IAM `5AC8FB36F29BA18FE7D49FB0FDD33BD91EBF6F522823BD5BB3A7D26901C21058`，assessment `1E6D78E22A697805897644084BA1C6E811613F77E6DC732C72FFD54A627FFB38`。

按 `config/v2-runtime-services.json` 各自健康路径检查，16/16 固定端口 HTTP 200，包括 core-api 的 `/api/v1/actuator/health`。这只证明本地 Java 进程可用，不能外推到 Docker 全栈或四端完整业务。

## 真实 Gateway / owner 回归

- [评测断点边界](p1-checkpoint-boundary/mudua6d9-0dcc97a5/README.md)在新 assessment JAR 上以两名新合成成人主体重跑，26 项检查无失败；历史 B10 同键同体 200 同 session，同键异 mode **409**。正式十题题源仍 503，canonical session checkpoint 仍 404，浏览器仍显示历史两题，因此页面继续 `BLOCKED`。
- [账号删除安全边界](iam-account-deletion-runtime-batch8.md)在新 IAM JAR 上以两名新合成成人主体进行 29 项 Gateway / IAM / MySQL 检查：匿名申请 401，登录后申请和同键重试 503，删除单新增 0，账号/会话状态未变；新建的历史测试行仅本人可读/撤回，重放保持撤回状态。历史撤回没有核验合成二次认证引用；正式删除仍 `BLOCKED`，内部执行和跨 owner 回执另待验。
- 两项脚本均在 `finally` 清理本轮合成主体及相关运行数据，并把清理结果写入证据。没有借这些安全拒绝将账号删除或正式定级判为功能通过。

第八批 Docker 镜像另行集中构建。容器内 Gateway 到 owner、业务数据库、前端浏览器和 native 设备仍未因本地 JAR 验证而自动通过。
