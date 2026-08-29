# B26 Kafka、跨服务旅程与浏览器测试验证

> 验证日期：2026-08-24  
> 范围：`V2-B26-EVT-001` 至 `V2-B26-BRW-006`  
> 方式：代码、契约、静态回放、四端本地浏览器检查；真实认证后运行证据仍待验收

## 结论

B26 的代码和静态验收基础已完成：Kafka/Outbox 可靠性边界、跨服务十步学习旅程、浏览器/H5 测试矩阵、证据契约和回归测试均已落地。B26 的运行 Gate 尚未关闭，不能把静态 preview、未登录页面或本地 HTTP 200 解释为真实数据测试通过。

当前仍缺少自有 IAM JWT/JWKS 和有效 JWT 下的 Gateway→服务→MySQL→API 回放、Kafka Topic/Outbox/消费者 offset 证据、DB/Kafka 对账以及 P0/P1 缺陷闭环。因此当前状态是：**B26 代码/静态完成，真实运行和正式测试验收待完成。**

## 任务状态

| 任务 | 代码/静态状态 | 运行态剩余 |
|---|---|---|
| EVT-001 | 六个 Topic、固定 Kafka 端口 `19092`、aggregateId 分区、14 个 consumer group、ACL、retention 和健康边界已配置 | 创建 Topic、producer/consumer、权限、重启和健康证据 |
| EVT-002 | Outbox、至少一次、幂等、retry/DLQ/replay、乱序、Saga 补偿和人工恢复策略已配置并测试 | 真实 publish/consume、重复投递、失败重试、DLQ 回放和 offset 对账 |
| EVT-003 | 十步旅程静态回放和 owner/schema/table/API/DB/Kafka 对账点已实现 | 有效 JWT 下跨进程执行并核对 MySQL 与事件事实 |
| BRW-004 | 四端真实入口矩阵和认证后完整旅程契约已实现 | 注册、登录、成人 Gate、内容读取、练习写入、刷新、登出和重新登录 |
| BRW-005 | 4 个应用、3 个场景、4 个 viewport、8 个状态和证据契约已实现 | Chrome/Edge/Firefox、弱网、主题、国际化、键盘/触摸和深链正式回归 |
| BRW-006 | 证据目录、错误阻断规则和缺陷回归入口已实现 | 截图/录像、Network/trace、服务日志、DB/Kafka 对账和 P0/P1 台账 |

## 可复核验证

| 命令/检查 | 结果 |
|---|---|
| `pnpm b26:static` | PASS；浏览器矩阵、事件基线、旅程预览、B26 测试、契约、端口、B25 静态前置和基础设施静态校验全部通过 |
| `pnpm test:b26` | PASS；20/20 |
| `node scripts/runtime/validate-b26-event-runtime.mjs` | PASS；6 topics、7 events、7 payload schemas、14 consumer groups；`runtimeStatus=pending` |
| `node scripts/runtime/validate-b26-browser-test.mjs` | PASS；4 applications、3 scenarios、4 viewports；runtime evidence blocked |
| `node scripts/runtime/replay-b26-journey.mjs --mode=preview --summary` | PASS；10 steps、4 planned events，network/database/Kafka effects 均为 0，`decision=DENY_RUNTIME_CLAIM` |
| `pnpm contracts:merge` / `contracts:validate` / `contracts:generate` | PASS；14 event fragments、154 events、110 event payload schemas、427 operations、479 OpenAPI schemas、5 generated files |
| 本地浏览器页面检查 | 四端固定端口均 HTTP 200；learner-web、admin-web、Mobile H5 未登录进入登录边界，official-site 公开页/课程页可访问；浏览器 Console/页面错误为 0 |
| Mobile H5 `390×844` 检查 | PASS；登录边界、页面标题和无 Console/页面错误均符合矩阵 |

Official Site 的 Nuxt 开发终端曾出现一次 `#app-manifest` pre-transform warning，随后页面完成 Nitro 构建并 HTTP 200，浏览器 Console/页面错误未复现；正式运行前仍应以生产构建和服务启动日志再次确认。

## 运行阻断项

1. B25 的真实 IAM JWT/JWKS、有效 JWT 和 API→DB→API Gate 尚未通过；当前四端检查只验证了 fail-closed 登录/公开边界。
2. 当前没有 B26 的真实 Kafka Topic 创建、Outbox 发布、消费者处理、重试/DLQ/回放和 offset 重启对账证据。
3. 尚未形成认证后浏览器 Network、服务日志、MySQL owner rows 和 Kafka eventId/dedupeKey 的同一 `runId/traceId` 证据链。
4. 尚未形成 P0/P1 缺陷台账、复测结果和独立测试人员交接签收。

## 下一步运行验收顺序

1. 先关闭 B25：启动平台自有 IAM JWT/JWKS，取得真实 JWT，完成 Gateway→服务→MySQL→API 的注册、登录、onboarding 和学习写链回放。
2. 在固定 Kafka `19092` 上创建 B26 Topic 和 ACL，执行 Outbox 发布、重复消费、失败重试、DLQ、回放、乱序和消费者重启对账。
3. 使用同一合成账号和 `runId/traceId` 执行浏览器/H5 十步旅程，收集 Network、服务日志、MySQL owner rows、Kafka eventId/dedupeKey 和截图/录像。
4. 关闭或批准 P0/P1，完成复测后，才可把 B26 交给独立测试/验收人员；B27 的真机、RC 和上线交接仍在 B26 之后。

## 关键文件

- [B26 浏览器测试矩阵](../../config/b26-browser-test.json)
- [B26 Kafka/Outbox 运行基线](../../config/b26-event-runtime.json)
- [B26 十步旅程配置](../../config/b26-journey.json)
- [B26 事件契约](../../packages/contracts/events/v1/fragments/b26-reliability.events.json)
- [B26 静态引导](../../scripts/runtime/b26-bootstrap.mjs)
- [B26 浏览器契约测试](../../tests/b26/b26-browser-contract.test.mjs)
- [B26 事件可靠性测试](../../tests/b26/b26-event-runtime.test.mjs)
- [B26 旅程测试](../../tests/b26/b26-journey.test.mjs)
