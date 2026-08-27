# B17 领域服务与事件运行态开发/验证记录

> 记录日期：2026-08-23  
> 范围：Phase 1 领域服务独立运行边界、核心学习读写链、事件可靠性、跨域投影和合成旅程代码层验证  
> 结论：B17 代码、静态门禁和合成旅程回归已完成；真实 Java 25、数据库、Kafka、Gateway 跨进程运行证据仍需在运行环境就绪后取得。

## 1. 本轮目标

B17 承接 B15 的运行清单和 B16 的安全边界，围绕 `learner → content → learning` 读链、`assessment → learning` 写链、独立服务 schema/进程、Outbox/Kafka/DLQ/Saga 和平台投影建立可审计的代码边界。B17 不允许通过目录、内存 fixture 或静态端口登记冒充真实跨进程运行完成。

## 2. 交付清单

- `config/b17-runtime-services.json`：服务 owner、独立 schema、端口/readiness、事件 namespace、依赖和回滚责任清单。
- `config/b17-platform-boundaries.json`：media/notification/offline、gamification/social、commerce/admin/analytics 的事实 owner、投影消费者、可信事件 allowlist 和禁止跨域写入矩阵。
- `scripts/runtime/b17-synthetic-journey.mjs`：无外部副作用的学习闭环合成旅程，覆盖版本/版权、幂等、判分摘要、mastery 投影、通知、奖励和 Saga 补偿。
- `services/*`：B17 领域链和事件可靠性端口/实现，分别保留服务 owner，不共享 ORM/entity/table。
- `tests/b17`：运行清单、平台边界、核心学习链、事件可靠性和合成旅程回归。
- `scripts/runtime/b17-bootstrap.mjs`：静态门禁和真实运行前置条件检查；缺条件时失败，不伪造成功。

## 3. 代码层验收证据

| 命令 | 结果 |
|---|---|
| `pnpm test:b17` | 17/17 pass |
| `pnpm b17:static` | PASS；11 个独立 Phase 1 领域服务、17 个 B17 测试、契约、固定端口和 v2 runtime manifest 全部通过 |
| `node scripts/runtime/b17-synthetic-journey.mjs` | PASS；读链 READY，服务端判分写链 COMPLETED/PROJECTED，生成 6 个安全 canonical event envelope |
| `pnpm contracts:validate` | PASS；402 operations、476 OpenAPI schemas、144 events、100 event payload schemas、4 JSON Schemas |
| `pnpm tasks:v2:check` | PASS；103 项 B7–B22 任务计数和 Phase 1 边界通过，B18–B22 剩余 28 项待开发 |
| `pnpm dod:check --strict` | PASS；5 pass、0 warn、0 fail |
| `javac --release 24` + B17 pure-Java smoke | PASS；integration contract smoke、reliability smoke 均通过；仅验证无框架边界，不替代真实 Java 25 运行态 |
| `pnpm b17:bootstrap` | 按设计 FAIL；静态部分通过，运行前置检查明确报告 Java 24/Maven unavailable/Docker unavailable、B16 IdP 与 Kafka 变量缺失；未伪造服务或基础设施成功 |

## 4. 当前运行态边界

以下证据必须在 Java 25、Maven、Docker/等价容器、MySQL、Redis、Kafka 和 B16 测试 IdP 就绪后取得：

- 11 个领域服务独立进程、独立 schema/凭据、readiness、故障隔离和回滚；
- Gateway→learner/content/learning/assessment 的真实认证、PEP、owner/tenant/版权拒绝；
- assessment submit → authoritative assessment → learning mastery/SRS 的跨进程幂等和断点恢复；
- Kafka 至少一次投递、按 aggregate 保序、消费者去重、重试、毒消息 DLQ、回放和 Saga 补偿；
- media 授权/撤回、notification offline cursor、可信成长/社群投影、commerce entitlement、admin 命令转发和 analytics 脱敏落盘。

当前环境仍存在：Java 24 而非 Java 25、Maven 不可用、Docker 不可用、B16 测试 IdP 未注入；因此 B17 不能宣告真实后端集群、Kafka、数据库、Gateway 或跨服务 E2E 已运行通过。
