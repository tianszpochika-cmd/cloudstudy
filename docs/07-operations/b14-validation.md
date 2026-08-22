# B14 Phase 1 收敛与代码级回归交接

> 执行日期：2026-08-22。范围：Phase 1 v2 代码层收敛、Strangler 兼容路由、服务安全扫描、事件可靠性回放、四端入口和全链路逻辑回归。本文不等同于生产迁移、真实基础设施、支付、媒体/RTC 或真机验收。

## 结论边界

B14 的目标是让 Phase 1 v2 代码具备逐域切换、只读影子、对账、失败补偿、兼容回退和可回放逻辑。完成后可以进入运行态/设备测试准备；不得据此宣称生产数据迁移完成、`core-api` 已删除、真实支付/媒体/RTC 已上线或灾备演练已签收。

## 任务交付

| 任务 | 代码层交付 | 逻辑证据 | 测试阶段剩余 |
|---|---|---|---|
| `V2-B14-MIG-001` | Java 17 `core-api` 的逐域迁移批次、版本/摘要对账、只读 shadow、重复幂等、失败补偿和 fallback read 适配器；覆盖 learner/content/learning/assessment/media/gamification/social/commerce | `B14MigrationCompatibilityAdapterSmoke`；不写目标域事实 | MySQL 实迁、断点续传、备份恢复、双读性能和生产回退演练 |
| `V2-B14-GW-002` | Gateway B14 route matrix、目标服务路由、兼容 GET/HEAD 窗口、`Deprecation`/`Sunset`、可配置 route mode 和伪造 authority 清理 | `tests/b14/b14-strangler-security.test.mjs` | Java 25/Maven、真实 Gateway/IdP、跨进程路由、直连网络策略 |
| `V2-B14-SEC-003` | 服务 owner/PEP/TenantScope/秘密/事件 payload/跨服务 SQL 的静态扫描；默认拒绝检查 | `scripts/security/verify-b14-boundaries.mjs` | CI 运行镜像、真实 JWKS、数据库权限、KMS/secret manager |
| `V2-B14-CROSS-004` | 可复用可靠性账本：eventId/schemaVersion/partition、consumer dedupe、乱序游标、有限重试、DLQ、replay、Saga compensation/manual recovery | `B14ReliabilityLedgerSmoke` | Kafka/Outbox durable adapter、worker、DLQ 运维和真实人工恢复 |
| `V2-B14-FE-005` | 四端统一 Gateway base URL、深链安全回跳、八态、Feature/Phase Gate、locale/theme 恢复和官网公开只读边界 | `tests/b14/b14-phase1-regression.test.mjs` 与四端构建 | 浏览器、PWA/Windows、App/小程序/iPad、无障碍/弱网/主题 locale 矩阵 |
| `V2-B14-TEST-006` | Phase 1 synthetic chain fixture、B14 静态回归包和本交接证据索引 | `pnpm test:b14`；与 B12/B13 回归组合执行 | 容器化跨进程旅程和真实基础设施，不替代运行态验收 |

## 兼容与安全原则

- `core-api` 仅保留迁移反腐层和显式 GET/HEAD 兼容窗口；B14 不新增跨域写入。
- 目标服务仍是领域事实、schema、凭据、Outbox 和发布责任的 owner；迁移适配器只能写迁移/对账/回放账本。
- route mode 只来自受控配置，客户端不能提交 tenant、owner、role 或权限事实；服务侧 PEP 仍是最终鉴权边界。
- 事件只保存规范化 envelope、不可逆引用和状态摘要；原始答案、原始音频、支付凭证、token 和自由文本不进入回放账本。
- 官网只读公开投影，不创建订单、不提交支付、不读取登录后业务 API。

## 已执行验证（2026-08-22）

| 验证项 | 结果 |
|---|---|
| `pnpm test:b14` | 6/6 通过 |
| `pnpm security:b14` | 通过：12 个服务、551 个源码文件、13 个事件片段 |
| 迁移适配器纯 Java smoke | 通过：`B14MigrationCompatibilityAdapterSmoke`；按 Java 17 目标编译 |
| 可靠性账本纯 Java smoke | 通过：`B14ReliabilityLedgerSmoke`；`-Xlint:all -Werror` 编译通过 |
| `pnpm test:b12` / `pnpm test:b13` | B12 7/7、B13 12/12 通过 |
| 契约、数据库、配置、端口、任务基线 | `contracts:validate`、`contracts:compatibility`（0 breaking）、`db:validate`（21 个迁移）、`config:check`、`ports:check`、`tasks:v2:check` 全部通过 |
| 四个前端构建 | learner-web、admin-web、official-site、mobile H5/App/微信小程序条件编译全部通过 |

前端构建仍有既有的依赖弃用、动态导入和大 chunk 警告，但没有编译失败。当前主机为 Java 24 且未安装 Maven，因此没有把 Java 25/Spring Boot 运行态构建写入完成结论。

## 建议验证命令

```powershell
pnpm security:b14
pnpm test:b14
pnpm test:b13
pnpm test:b12
pnpm contracts:validate
pnpm contracts:compatibility
pnpm db:validate
pnpm tasks:v2:check
```

当前工作站的 Java/Maven 限制、OIDC/JWKS、Kafka/MySQL、真实 Gateway、支付、媒体/RTC、浏览器和设备测试仍属于下一阶段，不在 B14 代码层完成定义内。
