# B12 代码层开发与逻辑测试交接

> 执行日期：2026-08-22  
> 范围：游戏化、学习社群、可信通知消费、治理恢复、B4 兼容迁移、四端代码边界和契约/迁移/逻辑测试；不等同于真实微服务运行态、生产迁移或浏览器/设备签收。

## 结论

B12 的 7 项任务已经形成可进入第一轮测试的代码层切片。成长服务只接受可信学习事件并由服务端维护账本、等级、Streak、奖励和赛季事实；社群服务维护自习室席位租约、可见性、排行榜和受控举报；通知服务维护模板化通知、偏好过滤、重试、DLQ、人工恢复和审计。前端不提交 XP、积分、余额、租约事实或自由文本，管理员命令经过权限、幂等和审计边界。

不能据此宣称 Java 25/Spring Boot 完整构建、真实 Gateway→服务链路、自有 JWT 登录/JWKS、RBAC/ABAC 运行态、MySQL/Kafka/Workflow/推送供应商、浏览器/小程序/原生设备交互或生产迁移已经完成。

## 任务交付

| 任务 | 代码层交付 | 测试阶段剩余 |
|---|---|---|
| `V2-B12-GAM-001` | `services/gamification-service`：可信学习事件 allowlist、event/dedupe receipt、server score/currency ledger、level/Streak/season、奖励 grant/claim/probability 和 flag-off 边界 | Maven/Java 25/Spring HTTP、Kafka/Outbox、MySQL 独立 schema、时区矩阵和重复事件压测 |
| `V2-B12-SOC-002` | `services/social-service`：房间、席位租约、断线/过期/恢复、焦点会话、预设互动、可见性、排行榜、举报和治理状态机 | Maven/Java 25/Spring HTTP、WebSocket/实时 transport、租约并发、跨租户和真实持久化 |
| `V2-B12-INF-003` | `services/notification-service`：可信事件消费、模板属性 allowlist、偏好/同意过滤、延迟、重试预算、DLQ、人工恢复和 audit | Kafka/Workflow durable worker、推送供应商、延迟时钟、真实恢复和审计查询 |
| `V2-B12-FE-004` | learner-web/mobile：成长世界/奖励入口已切换到 B12 `/gamification/me` 契约，展示免费非现金规则、服务端概率、重复点击保护、空/离线/权限/恢复和性能降级状态 | 浏览器、App/小程序条件编译、真机性能/无障碍/视觉回归 |
| `V2-B12-FE-005` | learner-web/mobile：通过 B12 `/social`、`/notifications` 契约实现排行榜、房间选择、预设举报、通知偏好；admin-web：举报审核、恢复任务、权限和幂等命令 | Gateway 登录会话、浏览器交互、权限矩阵、断线恢复和运营签收 |
| `V2-B12-MIG-006` | Java 17 `B12CompatibilityAdapter`：旧事实 shadow hash、可信事件 replay/dedupe、MATCH 对账、TARGET/FALLBACK route、rollback、`domainFactsUntouched` | 双读与持久化 adapter ledger、真实回放/回滚、旧客户端兼容窗口 |
| `V2-B12-TEST-007` | `tests/b12`：契约、事件 envelope、V0020、兼容只读、跨服务回放和三端前端边界测试 | 容器化跨服务、浏览器、设备、Kafka/Workflow/MySQL 集成矩阵 |

## 契约和数据边界

- B12 OpenAPI 以 `packages/contracts/fragments/b12/b12-gamification-social-notification.openapi.json` 为源，所有内部接口使用 `B8WorkloadIdentity`，写操作声明 `Idempotency-Key` 和 `x-idempotency`；外部客户端仍只访问 Gateway。Gateway 已登记 gamification/social/notification 的 B12 路由，并在边界移除客户端角色、租户和 owner 头。
- B12 AsyncAPI 事件以 `packages/contracts/events/v1/fragments/b12-gamification-social-notification.events.json` 为源，使用平台 envelope、eventId/dedupeKey、严格闭合 payload 和 additive 兼容策略。
- `V0020__create_growth_social_notification_b12.sql` 仅增加服务事实、workflow 任务和 `cmp_b12_*` 兼容证据表；兼容表强制 `read_only=1`、`domain_facts_untouched=1`，没有 DROP/TRUNCATE。
- 旧 B4 领域事实仍是迁移输入，`core-api` 适配器不写 `gam_*`、`soc_*` 或通知领域表，不接受客户端积分/余额/奖励结算字段。
- 社群只接受分类码、预设互动和服务端引用；通知只接受模板 ID、locale、channel 和 allowlisted attributes，不接收自由消息正文。
- UI `uiLocale` 与内容语言分离；B12 入口继续消费 `packages/i18n` 和 `packages/design-tokens` 适配变量，颜色不是状态唯一信号，低画质/静态模式仍可完成核心操作。

## 已执行验证

| 命令/检查 | 结果 |
|---|---|
| `pnpm contracts:merge` | 通过；18 个 OpenAPI fragments、12 个 event fragments，合并源 362 routes / 141 events |
| `pnpm contracts:validate` | 通过；389 operations、443 OpenAPI schemas、141 events、92 event payload schemas |
| `pnpm db:validate` | 通过；20 个迁移和 fixture 静态校验通过，V0020 已登记 |
| `node --test tests/b12/*.test.mjs` | 7/7 通过 |
| `node --test apps/learner-web/tests/b12-boundaries.test.mjs apps/mobile/tests/b12/b12-mobile-contract.test.mjs apps/admin-web/tests/b12-boundaries.test.mjs` | 8/8 通过 |
| `pnpm --filter @englishflow/learner-web typecheck` / `pnpm --filter @englishflow/learner-web build` / `pnpm --filter @englishflow/admin-web build` / `pnpm --filter @englishflow/mobile exec tsc --noEmit` | 通过；仅保留既有 Vite/Sass 警告 |
| `pnpm --filter @englishflow/mobile build:h5` / `build:app` / `build:mp-weixin` | 三种目标均构建完成；未替代真机、微信开发者工具和 App 容器验收 |
| gamification pure-Java smoke | `gamification-service B12-GAM-001 smoke: PASS` |
| notification pure-Java smoke | `notification-service B12-INF-003 smoke: PASS`；B11 与 Workflow smoke 同时通过 |
| core-api B12 adapter smoke | Java 17 source boundary smoke：`core-api B12-MIG-006 compatibility smoke: PASS` |
| social-service delegated smoke | 子 Agent 报告 Java 25 Maven 8/8、JAR health/401/伪造 userId 403 通过；主工作站需复验 |

## 测试阶段入口

1. 准备 JDK 25、Maven、测试 IAM JWT 认证中心/JWKS、MySQL/Redis/Kafka/Workflow 和通知 provider 替身；先执行 `pnpm ports:check`。
2. 通过 Gateway 验证学习完成事件的可信来源、成长服务去重/账本守恒、通知模板/偏好/重试/DLQ 和社群可见性；验证服务侧 PEP、tenant/owner、401/403、trace/requestId 和审计事实。
3. 对房间执行入房、断线、租约到期、恢复、并发续租、空房和举报幂等；对通知执行延迟、重复、乱序、退订、重试预算、DLQ replay 和人工恢复。
4. 执行 learner-web、Mobile H5/App/微信小程序条件编译、admin-web 浏览器矩阵，覆盖 loading/empty/error/permission/offline/recovery、主题、国际化、键盘/触控、响应式和四级性能降级。
5. 执行 B4→B12 shadow read、hash 对账、可信事件 replay、TARGET/FALLBACK 切换和 rollback 演练，确认旧领域事实没有被修改。

当前工作站只有 Java 24 且没有 Maven；因此主 Agent 只执行了依赖无关 Java smoke、Node 契约/迁移/逻辑测试和前端静态边界检查。Java 25/Maven、真实 Gateway/IAM JWT 认证中心、数据库/事件平台、浏览器和设备验收留待测试阶段，不把 B12 代码层交付误报为生产运行态完成。
