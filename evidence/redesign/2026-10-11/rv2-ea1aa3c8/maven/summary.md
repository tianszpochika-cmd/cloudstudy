# rv2 全量 Maven

命令：`mvn -B -ntp -f pom.xml test`。结束：2026-10-11T11:35:14+08。结果：BUILD SUCCESS。总时间：02:15 min（2 分 15 秒）。

数据库测试指向隔离库，不写共享 owner schema。IAM Spring 用 `rv2_mvn_iam`，并且 `iam.persistence.schema` 同为 `rv2_mvn_iam`。V13 用 `iam_v13_test_rv2round`。workflow JDBC 用 `rv2_mvn_workflow`，`WORKFLOW_SCHEMA` 允许 `rv2_` 前缀。learning relay 用已迁移的 `rv2_mvn_learning`。Flyway 与租户测试自己建库并在 finally 删除。租户测试的管理员 URL 是 `jdbc:mysql://127.0.0.1:13306/`，测试把库名接在这个地址后面。没有设置 `MEDIA_TEST_MINIO_*`。

| 模块 | 运行 | 失败 | 错误 | 跳过 |
|---|---:|---:|---:|---:|
| api-gateway | 114 | 0 | 0 | 0 |
| iam-service | 154 | 0 | 0 | 0 |
| learner-service | 91 | 0 | 0 | 0 |
| content-service | 268 | 0 | 0 | 0 |
| learning-service | 199 | 0 | 0 | 0 |
| assessment-service | 153 | 0 | 0 | 0 |
| media-service | 82 | 0 | 0 | 1 |
| notification-service | 119 | 0 | 0 | 0 |
| gamification-service | 69 | 0 | 0 | 0 |
| social-service | 86 | 0 | 0 | 0 |
| commerce-service | 93 | 0 | 0 | 0 |
| admin-ops-service | 93 | 0 | 0 | 0 |
| analytics-service | 51 | 0 | 0 | 0 |
| audit-service | 27 | 0 | 0 | 0 |
| workflow-service | 58 | 0 | 0 | 0 |
| service-template | 23 | 0 | 0 | 0 |
| 合计 | 1680 | 0 | 0 | 1 |

IAM JDBC 上下文 9 项、同意 JDBC 4 项、策略 JDBC 1 项、V13 迁移 1 项、Flyway 迁移 1 项，都是 0 失败。content 租户隔离 1 项、0 失败。learning 租户隔离 1 项、relay 1 项，0 失败。`ContentReleaseStudioTest` 15 项、`ContentReleaseStudioRestartTest` 3 项，0 失败。admin-ops 收口工作室 9 项、重启 2 项，0 失败。workflow-service 58 项、0 失败、0 跳过。

唯一跳过是 `MinioObjectStorePortReadOnlyIntegrationTest`。它假定已有私有对象和 `MEDIA_TEST_MINIO_*`，用 Assumptions 跳过，不连 MySQL。

14 个共享 schema 的表数与开跑前一致：admin_ops_service 9，analytics_service 5，assessment_service 26，audit_service 4，commerce_service 14，content_service 25，gamification_service 12，iam_service 24，learner_service 14，learning_service 24，media_service 6，notification_service 20，social_service 10，workflow_service 9。

`rv2_mvn_iam`、`rv2_mvn_workflow`、`rv2_mvn_learning`、`iam_v13_test_rv2round` 及对应用户已删除。两个保留库仍在。qida 名称计数前后都是 50。固定端口无监听。
