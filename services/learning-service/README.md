# learning-service

B10-LRN-001 的代码层切片，面向 Java 25 + Spring Boot 4.1.x 目标运行时。该服务只拥有学习事实：

- `learning_plan`、`learning_task`、`learning_progress`
- `srs_state`、`review_event`、`mastery_projection`
- `idempotency_record`、`outbox_event`

Learner 与 content 的数据只能通过 `LearnerTargetPort`、`PublishedContentPort` 等只读 port/contract 进入；本服务不跨服务读表、不维护题库或用户主表。`LearningAccessPolicy` 对 tenant、owner、phase、consent、role、permission 和客户端伪造 authority 默认拒绝。

当前代码切片包含：

- 计划创建/恢复、唯一 planning key、任务状态迁移和单调进度；
- `SM2_Q03_V1`、本地日历时区排程、复习队列和重复写幂等；
- assessment evidence 到 `mastery_projection` 的规则投影与事件 replay 去重；
- 内存 fact-store 作为纯 Java 测试夹具，以及 `LearningDomainSmoke`。

## 纯 Java 验证

在仓库根目录执行：

```powershell
$out = 'services/learning-service/.compile-check'
New-Item -ItemType Directory -Force $out | Out-Null
$files = @(rg --files services/learning-service/src/main/java services/learning-service/src/test/java |
  Where-Object { $_ -notmatch 'LearningServiceApplication\.java|[\\/]config[\\/]' })
javac --release 24 -encoding UTF-8 -d $out $files
java -cp $out com.englishflow.learning.LearningDomainSmoke
```

验证结果应为 `learning-service B10-LRN-001 smoke: PASS`。工作站当前使用 Java 24 且没有 Maven，因此本轮不声称 Spring、MySQL、Kafka、Gateway、OIDC 或生产部署运行态已经完成；Java 25 编译和真实持久化适配仍需目标工具链/运行环境验收。
