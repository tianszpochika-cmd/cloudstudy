# assessment-service

B10-ASM-002 的代码层切片。服务拥有 assessment session、attempt、checkpoint、服务端规则评分、错因和不可变报告快照；题目事实与答案规则通过 `ContentSnapshotPort` 读取，不在本服务维护题库主表，也不向 learner-facing view 下发答案规则。

## 当前切片

- Java 25 + Spring Boot 4.1.1 目标骨架；`core-api` 不作为父工程或领域依赖。
- `AssessmentPrincipal` 是唯一的服务侧主体输入；session/report/mistake 读取和写入都绑定可信 tenant/owner，匿名和越权默认拒绝。
- `AssessmentCommandService` 覆盖 `CREATED/IN_PROGRESS/INTERRUPTED/SUBMITTING/COMPLETED/AUTO_SUBMITTED/CANCELLED/EXPIRED` 状态迁移、服务端时钟、checkpoint 序列冲突、重复提交、请求幂等和超时自动提交。
- `RuleScoringEngine` 只消费冻结的版本化 `ContentSnapshot`，支持 B2 八类题型的 Phase 1 规则判分；客户端不能提交 score、isCorrect、correctOption 或答案规则。
- `AssessmentOutboxPort` 预留 durable outbox 接口；当前 `InMemoryAssessmentOutbox` 只用于 smoke，按 dedupe key 抑制重复事件，不代表 MySQL/Kafka 已接通。
- Outbox 只允许安全的聚合元数据、版本、计数、派生结果摘要和追踪字段，禁止 raw answer、expected answer、answer rule、token、audio 等内容。

## 最小验证

在仓库根目录执行（当前开发机 JDK 最高为 24，服务目标仍锁定 Java 25）：

```powershell
$out = 'services/assessment-service/.compile-check-b10-smoke'
New-Item -ItemType Directory -Force $out | Out-Null
$main = @(rg --files services/assessment-service/src/main/java | Where-Object { $_ -notmatch 'AssessmentServiceApplication\.java$' })
$test = @(rg --files services/assessment-service/src/test/java)
javac --release 24 -Xlint:all -d $out $main $test
java -cp $out com.englishflow.assessment.AssessmentDomainSmoke
```

真实 Spring 启动、HTTP controller、MySQL/Flyway、Redis、Kafka、Gateway、跨进程恢复和持久化故障注入不在本代码切片验证范围内；这些属于后续 adapter/integration 任务。
