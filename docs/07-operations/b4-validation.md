# B4 代码层交付与验证记录

> 历史执行记录：本验证基于 v1 Java 17/`core-api` 兼容实现。它只证明 B4 旧任务的代码/静态证据，不证明 v2 Gateway、IAM/RBAC 或微服务迁移已完成；v2 验收须另按 `ARCH-*` 能力和新任务证据执行。

## 范围口径

B4 不是 7 个章节，而是跨第 08 章和第 09 章的一个执行批次，共 16 个任务：

- `DEV-08-001~009`：游戏化星系、XP、Streak、奖励经济、六类游戏、Avatar、开箱和成长闭环；
- `DEV-09-001~005`、`DEV-09-010`、`DEV-09-012`：自习室、实时社群协议、番茄专注、低 UGC、治理、离线包和学习端页面。

因此本轮明确包含前端页面开发。`DEV-08-005` 要求六类游戏客户端交互、暂停/恢复和低配降级，`DEV-09-012` 要求自习室、通知、离线客户端页面与 Web/H5/移动端适配。

## 已完成的代码层

- `packages/contracts/`：B4 OpenAPI、事件目录、生成类型和通知/离线/治理契约；
- `database/mysql/migrations/V0013__create_gamification_social_offline_b4.sql`：成长、游戏、自习室、通知、治理、离线和同步事实表；
- Core API：XP/等级/账本/Streak/任务/赛季/游戏/Avatar/开箱/星系，以及自习室/专注/互动/治理/通知/离线下载/同步状态机；
- Web：`apps/learner-web/src/pages/B4WorldPage.vue` 及 B4 API/domain/store/offline 适配；
- uni-app：成长世界、游戏、自习室、Avatar、离线包页面及四档性能降级入口；
- 服务端权威边界：客户端不提交分数、XP、星币或服务端时长；游戏题目 token、itemCode、专注时长和离线分片状态均以服务端返回为准；
- B4 静态测试、Core API 单元测试和客户端契约检查。

## 已执行验证

| 验证项 | 结果 |
| --- | --- |
| `pnpm test:b4` | 6/6 通过 |
| `pnpm test:b1` | 7/7 通过 |
| Core API Maven 测试 | 26/26 通过 |
| `pnpm contracts:validate` | 229 operations、208 OpenAPI schemas、73 events、44 payload schemas |
| `pnpm db:validate` | 13 个迁移及 fixture 安全检查通过 |
| `pnpm redis:validate` | Redis 7.x keyspace 检查通过 |
| `pnpm config:check` | 7 个运行配置检查通过 |
| learner-web typecheck/build | 通过 |
| mobile TypeScript/H5 build | 通过 |

## 测试阶段仍需验证的运行态

代码层已具备进入测试阶段的条件，但以下项目不能仅凭静态检查宣称完成：

1. `DEV-09-002` 的真实 WSS `/api/v1/social/ws` transport、Redis presence、广播、心跳和断线重连；当前代码已完成协议/状态机/REST ticket 边界，尚未接入 Spring WebSocket runtime handler。
2. 真实 MySQL/Redis 多实例、事务/锁、outbox 和跨进程恢复。
3. S3 兼容对象存储的真实签名分片、Range/ETag、空间不足恢复、整包 SHA-256/签名校验。
4. 浏览器 E2E、真实 iOS/Android/iPad/微信小程序以及弱网、后台恢复和低端设备画质降级。

所以 B4 可以标记为“代码开发完成，进入测试阶段”，不应提前标记为“运行态验收完成”。
