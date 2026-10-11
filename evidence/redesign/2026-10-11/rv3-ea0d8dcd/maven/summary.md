# rv3 全量 Maven

命令：`mvn -B -ntp -f pom.xml test`。结束：2026-10-11T13:43:59+08。结果：BUILD SUCCESS。总时间：02:20 min（2 分 20 秒）。合计 1681 项、0 失败、0 错误、0 跳过。

数据库测试指向隔离库，不写共享 owner schema。IAM Spring 用 `rv3_mvn_iam`，并且 `iam.persistence.schema` 同为 `rv3_mvn_iam`。V13 用 `iam_v13_test_rv3round`。workflow JDBC 用 `rv3_mvn_workflow`。learning relay 用已迁移的 `rv3_mvn_learning`。Flyway 与租户测试自己建库并在 finally 删除。租户测试的管理员 URL 是 `jdbc:mysql://127.0.0.1:13306/`。没有设置 `MEDIA_TEST_MINIO_*`。本地 MinIO `127.0.0.1:19000` 在开跑前已监听，本轮没有启动或停止它。

| 模块 | 运行 | 失败 | 错误 | 跳过 |
|---|---:|---:|---:|---:|
| api-gateway | 115 | 0 | 0 | 0 |
| iam-service | 154 | 0 | 0 | 0 |
| learner-service | 91 | 0 | 0 | 0 |
| content-service | 268 | 0 | 0 | 0 |
| learning-service | 199 | 0 | 0 | 0 |
| assessment-service | 153 | 0 | 0 | 0 |
| media-service | 82 | 0 | 0 | 0 |
| notification-service | 119 | 0 | 0 | 0 |
| gamification-service | 69 | 0 | 0 | 0 |
| social-service | 86 | 0 | 0 | 0 |
| commerce-service | 93 | 0 | 0 | 0 |
| admin-ops-service | 93 | 0 | 0 | 0 |
| analytics-service | 51 | 0 | 0 | 0 |
| audit-service | 27 | 0 | 0 | 0 |
| workflow-service | 58 | 0 | 0 | 0 |
| service-template | 23 | 0 | 0 | 0 |
| 合计 | 1681 | 0 | 0 | 0 |

api-gateway 比 rv2 的 114 多 1。多出的是证据 profile 与生产默认 `high-risk-admin` 30 的隔离断言。media-service 仍是 82 项，跳过从 1 变成 0：`MinioObjectStorePortReadOnlyIntegrationTest` 跑了 1 项、0 失败、0 跳过，用时 0.223 秒。断言仍包含 206 的单字节范围和 403 的错误范围。

learning-service 199 项、0 失败、0 跳过。assessment-service 153 项、0 失败、0 跳过。admin-ops 收口工作室 9 项、重启 2 项，0 失败。workflow-service 58 项、0 失败、0 跳过。

14 个共享 schema 的表数与开跑前一致：admin_ops_service 9，analytics_service 5，assessment_service 26，audit_service 4，commerce_service 14，content_service 25，gamification_service 12，iam_service 24，learner_service 14，learning_service 24，media_service 6，notification_service 20，social_service 10，workflow_service 9。

`rv3_mvn_iam`、`rv3_mvn_workflow`、`rv3_mvn_learning`、`iam_v13_test_rv3round` 已删除。两个保留库 `r1_it1_browser_20261010_iam_5d9f4b7e` 与 `r1_it1_browser_20261010_cnt_5d9f4b7e` 仍在。qida 名称计数前后都是 46。本轮没有对 qida 容器执行 stop 或 start。固定端口无监听。
