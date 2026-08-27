# B10 代码层开发与逻辑测试交接

> 执行日期：2026-08-22  
> 范围：代码层开发、契约、迁移、领域规则、兼容适配、学习端页面和逻辑/构建测试；不等同于真实微服务运行态、生产迁移或浏览器/设备签收。

## 结论

B10 的 8 项任务已经形成可测试的代码层切片，可以进入测试阶段：`learning-service` 和 `assessment-service` 已按独立数据 owner 建立，内容快照通过只读端口进入判分，`attempt.submitted → assessed → mastery.projected` 的事件和可靠性边界已经进入契约/迁移/内存测试夹具，learner-web/mobile 已接入词汇、SRS、阅读、基础练习、错题、报告、语法树、长难句/X-ray、仿写、病句改错和规则写作反馈。

不能据此宣称 Java 25/Maven/Spring Boot 完整构建、真实 Gateway→服务链路、MySQL/Kafka/IdP、浏览器/真机/小程序、生产迁移或 Phase 1 运行态已经完成。

## 任务交付

| 任务 | 代码层交付 | 测试阶段剩余 |
|---|---|---|
| `V2-B10-LRN-001` | `services/learning-service`：计划/任务/进度、SM-2 `SM2_Q03_V1`、时区复习队列、mastery projection、幂等和 tenant/owner 默认拒绝 | Java 25/Maven、Spring HTTP、MySQL durable adapter、PEP/DST/故障注入 |
| `V2-B10-ASM-002` | `services/assessment-service`：session/attempt/checkpoint、服务端权威规则判分、超时自动提交、错因和不可变报告快照 | Java 25/Maven、controller、MySQL/Flyway、恢复/重复提交/超时运行态 |
| `V2-B10-CNT-003` | B10 OpenAPI 的内容快照/assessment snapshot、`ContentSnapshotPort`、版本 pin 和答案规则保护 | content-service 跨进程快照、下线/版本失效和权限回放 |
| `V2-B10-EVT-004` | B10 AsyncAPI、V0018 outbox/dedupe/DLQ/Saga 表、内存 Outbox 和安全 envelope | Kafka/worker、乱序/断点/DLQ 人工恢复和 trace 运行态 |
| `V2-B10-FE-005` | learner-web/mobile 词汇/SRS、阅读、练习、错题、报告，含幂等、离线和恢复状态 | 浏览器/App/iPad/小程序、弱网、无障碍和会话恢复 |
| `V2-B10-FE-006` | learner-web/mobile 语法树、X-ray、仿写、病句改错、规则写作反馈，含键盘/拖拽和 Performance 降级 | 浏览器组件回放、触控/键盘和真实内容版本验收 |
| `V2-B10-MIG-007` | `core-api` B10 compatibility adapter、只读 shadow/对账/route/rollback 状态机、`cmp_b10_*` adapter ledger | legacy/target 双读源、真实对账、Gateway 渐进切换和故障回退 |
| `V2-B10-TEST-008` | root B10 静态边界、两端 B10 测试、两个领域 smoke、兼容 adapter smoke 和 fixture | 浏览器/跨进程/数据库/Kafka/IdP/设备全链路 |

## 关键边界

- `learning-service` 固定端口 `18090`，`assessment-service` 固定端口 `18091`；客户端只使用 Gateway 相对路径，不直连服务。
- `assessment-service` 只通过 `ContentSnapshotPort` 读取冻结内容快照；客户端、Outbox 和学习投影不得获得 `answerKey`、原始答案或答案规则。
- B10 事件 envelope 保留 `eventId`、`schema`、`version`、`occurredAt`、`aggregateId`、`traceId`、`requestId`、`schemaVersion` 和 `dedupeKey`；事件只携带安全的计数、版本和派生摘要。
- `V0018__create_learning_assessment_event_reliability_b10.sql` 是增量、可重放的仓库级迁移基线；领域表按服务前缀隔离，`cmp_b10_*` 只记录兼容适配事实。
- 兼容回滚只改变 adapter route-control/rollback ledger，`domainFactsMutated=false`；不得删除或重写历史 attempt、报告、内容 pin、SRS 或 mastery 事实。
- UI `uiLocale` 与内容 `contentLocale` 分离；页面保留 loading、empty、error、forbidden、offline、stale、recovering 和性能降级语义，状态不能只依靠颜色表达。

## 已执行验证

| 命令/检查 | 结果 |
|---|---|
| `pnpm test:b10` | 7/7 通过 |
| `pnpm --dir apps/learner-web exec node --test tests/b10-boundaries.test.mjs` | 4/4 通过 |
| `pnpm --dir apps/mobile run test:b10` | 4/4 通过 |
| learning-service `javac --release 24` + `LearningDomainSmoke` | 通过；输出 `learning-service B10-LRN-001 smoke: PASS` |
| assessment-service `javac --release 24` + `AssessmentDomainSmoke` | 通过；输出 `assessment-service B10 smoke: PASS` |
| core-api B10 compatibility adapter `javac --release 17` + smoke | 通过；输出 `core-api B10 compatibility adapter smoke: PASS` |
| `pnpm --dir apps/learner-web run typecheck` | 通过 |
| `pnpm --dir packages/api-client run typecheck`、`i18n`、`design-tokens`、`performance` typecheck | 全部通过 |
| `pnpm --dir apps/learner-web run build` | 通过；仅 Vite dynamic-import 提示 |
| `pnpm --dir apps/mobile run build:h5` | 通过；仅 uni-app/Sass 更新提示 |
| `pnpm test:b1`、`test:b3`、`test:b4`、`test:b5`、`test:b6`、`test:b7`、`test:b8`、`test:b9` | 7/7、17/17、6/6、4/4、4/4、28/28、28/28、6/6 通过 |
| `pnpm test:b2` | 14 通过、3 个既有运行态 TODO，无失败 |
| `pnpm contracts:merge` / `contracts:validate` / `contracts:generate` | 通过；322 routes、346 operations、383 schemas、119 events、5 个生成文件 |
| `pnpm contracts:compatibility` | 通过，0 breaking change |
| `pnpm db:validate` | 通过，18 个迁移和 fixture 静态校验通过 |
| `pnpm ports:check` | 通过；18090/18091 及全表固定端口均空闲 |
| `pnpm tasks:v2:check` / `pnpm dod:check` | 执行当时均通过；旧 B7–B16 共 69 项任务、DoD 5/5；当前任务基线已重设为 B7–B22 共 103 项 |

## 测试阶段入口

1. 准备 JDK 25、Maven、测试 IdP/JWKS 和本地数据库/事件基础设施；先执行 `pnpm ports:check`。
2. 以独立 schema/凭据启动 Gateway、learner/content/learning/assessment 和兼容适配边界，验证服务侧 PEP、tenant/owner、版本 pin 和 trace 关联。
3. 对事件执行至少一次、重复、乱序、DLQ replay、Saga compensation 和 target 不可用回退；确认不产生跨服务直表写入。
4. 执行 learner-web、Mobile H5、iPad/小程序条件编译和浏览器交互矩阵，覆盖键盘/触控、弱网、离线、主题、国际化和四级性能降级。

当前工作站只有 Java 24 且没有 Maven，因此 Java 25/Spring Boot 完整构建留到测试环境执行；B10 代码层达到交接条件，但不替代上述运行态验收。
