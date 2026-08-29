# B5 代码层交付与验证记录

> 历史执行记录：本验证基于 v1 Java 17/`core-api` 兼容实现。它只证明 B5 旧任务的代码/静态证据，不证明 v2 Gateway、IAM/RBAC 或微服务迁移已完成；v2 验收须另按 `ARCH-*` 能力和新任务证据执行。

## 范围口径

B5 是跨第 09、10、11、12 章的执行批次，共 22 项任务：

- `DEV-09-011`：客服纠错工单、附件/消息 hash 引用、脱敏视图和 SLA 状态；
- `DEV-10-001~010`：SKU/价格/订单、微信/支付宝/Apple sandbox 边界、回调幂等、权益、家庭组、激活码、退款/人工调整、账单/对账、学习端结算页和支付发布闸门；
- `DEV-11-001~010`：Admin 登录/RBAC 菜单、CMS 内容编辑/导入/双审/版本、运营指标、Feature Flag、商业化查询、风险、工单、审计导出；
- `DEV-12-002`：Vue 3 + Element Plus 管理后台壳、路由守卫和角色菜单。

因此本轮明确包含前端页面开发：`learner-web` 的商业化结算入口、uni-app 的 B5 权益页，以及 `admin-web` 的中台壳、运营总览、内容双审、商业化/风控和审计页。

## 已完成的代码层

- `packages/contracts/`：B5 OpenAPI、事件增量目录和生成的 TypeScript 类型；所有写接口声明 `Idempotency-Key` 和重放策略，回调只接收 `payloadHash`/引用，不接收支付签名原文；
- `database/mysql/migrations/V0014__create_commerce_cms_operations_b5.sql`：SKU、订单、支付回调、Apple 交易、订阅、权益、激活码、家庭组、退款、发票、对账、CMS 版本/双审/导入/敏感命中/纠错工单、风控、指标、Flag 和审计表；
- Core API：商业化订单与权益状态机、sandbox callback 验签/金额校验/重复回调、Apple Sandbox 交易去重、家庭组 3 人上限、激活码一次性兑换、退款申请/人工权益调整；
- Core API Admin：内容草稿、结构校验、敏感 fail-closed、一级/二级不同角色审核、发布/回滚、批量导入、风险 TTL、聚合指标完整性、对账差异、Feature Flag 默认关闭和脱敏审计；
- Web/uni-app：SKU/订单/权益/激活码/支付恢复状态展示，支付关闭时明确提示，不在客户端伪造支付成功；
- Admin Web：Element Plus shell、session/route guard、菜单、B5 运营总览、CMS 双审工作台、风险/对账页、审计查询和脱敏导出入口；
- 测试：B5 Node 静态门禁、Core API B5 单元测试，覆盖金额快照、支付闸门、回调幂等、Apple replay、家庭人数、激活码一次性、CMS 双审、敏感拦截、风险 TTL 和工单脱敏。

## 已执行验证

| 验证项 | 结果 |
| --- | --- |
| `pnpm test:b5` | 4/4 通过 |
| Core API B5 单元测试 | 通过 |
| Core API Maven 全量测试 | 34/34 通过 |
| `pnpm contracts:validate` | 281 operations、234 OpenAPI schemas、87 events、45 payload schemas |
| `pnpm contracts:generate` | 4 个生成文件通过 |
| `pnpm db:validate` | 14 个迁移及 fixture 安全检查通过 |
| admin-web typecheck/build | 通过 |
| learner-web typecheck/build | 通过 |
| mobile TypeScript 检查 | 通过 |

## 测试阶段仍需验证的运行态

代码层已具备进入测试阶段的条件，但以下项目不能凭静态代码宣称完成：

1. 微信支付 V3、支付宝 RSA2、Apple StoreKit 2/JWS 的真实 sandbox SDK、证书链、KMS 密钥轮换和回调重试；当前实现是 provider boundary + sandbox/fail-closed 状态机，支付通道默认关闭；
2. MySQL/Redis 事务、锁、Outbox、幂等记录和跨进程恢复；RabbitMQ/Redis Streams 仅属于 v1 `core-api` 的历史验证范围，v2 运行态只验证 Kafka + Outbox 的投递、幂等、重试、死信和恢复；
3. S3 账单/媒体对象存储、真实对账文件导入、10 万行任务恢复和权限隔离；
4. 真实 SSO/RBAC/权限中心、浏览器 E2E、iOS/Android/iPad/微信小程序真机结算和弱网恢复；
5. Admin 生产环境的审计保留/删除证明、导出限额、水印和合规审批。

所以 B5 可以标记为“代码开发完成，进入测试阶段”，不应提前标记为“支付/运行态验收完成”。
