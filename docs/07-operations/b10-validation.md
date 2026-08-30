# B10 静态候选与 P1R 验收边界

> B10 原始交接日期：2026-08-22
> P1R 口径更新：2026-08-30
> 范围：历史代码候选、静态契约和逻辑测试；不等同于真实微服务、数据库、事件总线、Gateway/PEP 或端到端运行验收。

## 当前结论

B10 留下了 `learning-service`、`assessment-service`、契约、迁移、兼容适配和学习端页面的代码层候选。这些资产可以作为 P1R 实现参考，但不能因为目录、Flyway 文件、smoke 程序或内存测试存在，就宣称 owner schema、真实持久化、Outbox/Kafka、Saga 或服务侧授权已运行。

P1R 按编号任务重新验收：

- `P1R-M1-008` 固定内容版本和 assessment pin 边界；
- `P1R-M1-009` 固定媒体、录音与 shadowing 安全引用边界；
- `P1R-M1-010` 固定 assessment session、提交前 checkpoint、attempt、确定性判分摘要和 assessment report；
- `P1R-M1-012/013` 后续分别负责 placement→plan 和 assessment→learning/mastery/SRS/聚合报告；
- `P1R-M2-004/005/006` 才负责真实 owner schema/grant、Outbox/Kafka 和 Saga 运行证据。

## M1-010 静态契约口径

| 范围 | canonical 口径 | 仍待运行验证 |
|---|---|---|
| Session | `CREATED/IN_PROGRESS/INTERRUPTED/SUBMITTING/COMPLETED/AUTO_SUBMITTED/CANCELLED/EXPIRED`；开始时固定 content/rule/completion pin | Java 25 服务实现、MySQL 持久化、超时与并发运行回放 |
| Checkpoint | canonical 为 session-scoped、提交前受保护草稿；`baseStateVersion/checkpointVersion/clientEventId/clientSeq/checkpointDigest`；冲突 409 | 断网、多 tab、杀进程、并发写入和真实恢复 |
| Attempt | `submissionId/submissionDigest/attemptVersion`；同键同摘要返回原结果，同键异摘要 409 | 耐久幂等表、事务、自动提交与重试故障注入 |
| 判分 | 服务端按固定规则确定性判分；事件/日志只带 learner-safe 摘要，不带原始作答、答案密钥或规则正文 | 真实规则引擎、性能、回放一致性和受保护数据访问 |
| Assessment report | 绑定 session/attempt/submission、content/rule/assessment/report 版本、`asOf/assessmentFactWatermark`；不写 mastery/SRS | 真实报告任务、DLQ/replay、本人越权和延迟状态 |
| 事件 | submitted/assessed 仅补安全 payload，仍为 historical candidate | AsyncAPI/Kafka/consumer binding 仍为 `EVENT-GAP-BIND-ASM-001`，由 M1-013/M2 后续闭合 |

Phase 1 不生成权威作弊结论，切屏/失焦历史字段不得驱动分数、奖励、封禁或报告事实。报告不得声称官方题库、官方认证、全国百分位或 AI/mastery 权威。

<a id="legacy-adapter-retirement"></a>

## 旧兼容入口退役边界

B2 assessment、B2 exam 和旧 B10 attempt-scoped checkpoint 入口只保留为兼容适配器。它们从 2026-08-30 起标记 deprecated，但 sunset 尚未排期；只有声明的 canonical replacement 或未来 exam migration 完成真实 owner 数据迁移、调用方切换、对账、回滚和运行 Gate 后，才能给出退役日期。适配器不得绕过 B10 的内容/规则 pin、服务侧 PEP、幂等摘要或报告版本边界，也不得把非权威 exam 设备元数据升级为评分、奖励或封禁事实。

## 静态 Evidence 与历史记录

M1-010 的最终静态 Evidence 以对应 manifest 绑定的 source commit、当次门禁输出和独立 Review 为准；本文不复制会随 HEAD 变化的测试计数。

2026-08-22 的 B10 交接曾记录 Java smoke、前端构建、契约合并和数据库静态校验通过。这些是当时代码层历史记录，不是当前 HEAD 的可运行证明，也不替代 JDK 25、真实 MySQL/Kafka/IAM/Gateway 和浏览器/设备签收。

## 后续运行验收入口

1. 准备 JDK 25、可用的统一依赖工具链、测试 IAM/JWKS 和本地数据/事件基础设施；先执行端口和环境检查。
2. 以独立 schema/凭据启动 Gateway、content、assessment、learning 和必需平台服务，验证服务侧 PEP、tenant/owner、版本 pin、checkpoint 并发冲突和 trace 关联。
3. 对 Outbox/Kafka 执行至少一次、重复、乱序、DLQ replay 和 Saga 恢复；确认不产生跨服务直表写或重复 mastery/奖励。
4. 执行 learner-web、Mobile H5、iPad/小程序条件编译和交互矩阵，覆盖键盘/触控、弱网、离线、多 tab、主题、国际化和性能降级。
