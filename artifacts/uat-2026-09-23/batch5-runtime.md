# 第五批本地集中部署与运行回归（2026-09-23）

本批在本任务的本地运行栈更新 Gateway、IAM、content、assessment 四个 Java 服务。先备份 16 个旧 JAR 至 `C:\Temp\cloudstudy-uat-runtime-backup-20260923-batch5`，再将 `content_service`、`assessment_service`、`iam_service` 的迁移前数据备份至 `C:\Temp\cloudstudy-uat-db-backup-20260923-batch5\content-assessment-iam-before.sql`（10,111,740 字节；SHA-256 `853e654c2166ca09038d58636cca0c29c6a009e8e6dac55613dafd795a88e8dd`）。旧 16 服务由本任务 runner 统一停止；五个 Docker 基础设施容器与四个前端开发服务未停止。

`content-service` 独立 `p1r_schema_history` 从 V21 升至 V22，`assessment-service` 从 V7 升至 V8；迁移计划无 checksum 漂移，使用管理凭据执行并核实两条历史、`content_definition.state_version`、内容版本 ID 序列表和五张定级 owner 表。IAM 自迁移 Flyway 从 V15 到 V16，成功记录为 `success=1`。随后四个 JAR 集中构建成功，14:20 CST 新 runner PID **16348** 报告 16/16 Java 服务就绪；其中旧 `core-api` 的健康路径是 `/api/v1/actuator/health`，不是统一的 `/actuator/health/readiness`。四个更新 JAR 的 SHA-256：

| 服务 | SHA-256 |
| --- | --- |
| Gateway | `f6d512b773bae02673e862d797d4e534e2c23c0f8c20de25bf13f2d80a5c2772` |
| IAM | `802340a43d67b0b44960e24813a7b68a907942feafb64812b471f8a2ac97b438` |
| content | `8e62f86800cf9169f3a50f9b56ae85ad9c70e335b9508d250ef580277b85133b` |
| assessment | `e8a115c76d5137329d6b20e6532e0b2bcdd5d9d849f84b3362bac1bda20b9d4e` |

## 真正经过 Gateway 的回归

- [内容 CAS 原始证据](content-cas-runtime.json)：独立合成 staff 注册/登录，100 条第一页与剩余 3 条第二页均 200；创建草稿和新版本均 202。创建同键同体重放返回相同业务回执，同键异体 409 `IDEMPOTENCY_KEY_REUSE`；旧 `expectedStateVersion=1` 再保存返回 409 `VERSION_CONFLICT`。数据库确认两版版本号与内容散列彼此独立，定义 `state_version=2` 且未发布。14 项检查通过；测试草稿、两版和 5 条精确幂等记录已删除，账号停用且活动会话 0，回归后仍为 103 条定义、101 条版本、8 条无版本历史定义。首次测试只比较 JSON 序列化文本，因字段顺序差异误报重放失败；[首次记录](content-cas-runtime-initial.json)保留，随后按业务回执字段核对并通过。
- [定级五路由真实矩阵](p1-placement-live/report.md)：匿名五路由均 401；成人 Gate、必需同意或五项精确权限缺失均 403；合规成人创建会话和跳过在缺少正式十题题源时均 503，缺失的会话/报告读与答题为 404。该合成 principal 的五张 P1 owner 表与完成事件 outbox 前后均 0，账号已停用。五条路由已不再是旧进程的 404；十题正向业务链仍 **BLOCKED**，不得从拒绝矩阵推断测评已可用。
- [管理指标隔离](analytics-fixture-quarantine.md)：400 条可归因的本地合成行已迁至隔离租户，平台指标历史/近 30 天查询现为 200/真实空态；管理工作台 1280/390px 无页面异常和溢出。真实事件到投影链路尚未验收。

`pnpm contracts:merge` 和 `contracts:merge:check` 已覆盖本批五条定级路由并通过；全量 `contracts:validate` 仍首先卡在 Saga 补偿接口缺实际幂等声明，其余六项见[幂等缺口](contracts-idempotency-gate-gap.md)。本批是本地 JAR 和开发前端联调；此前 19 个 Docker 应用镜像仍是旧源码，容器内四端和服务没有通过本批复测。
