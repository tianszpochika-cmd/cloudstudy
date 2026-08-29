# B35 异常、重启、一致性与缺陷回归证据

> 执行时间：2026-08-25（本机）  
> 范围：`V2-B35-REG-001` 至 `V2-B35-FIX-005`

## 自动化运行证据

| 证据 | 结果 | 运行标识/摘要 |
|---|---|---|
| `pnpm test:b35` | PASS | 4/4 B35/B36 结构与证据约束测试通过 |
| `pnpm b35:regression-runtime` | PASS | `b35-2026082515`；14 readiness、8 个认证负例、Gateway→content-service 真实投影、5 个本地基础设施容器、Redis PONG、Kafka 7 topics、MinIO ready |
| `pnpm b35:authz-runtime` | PASS | `b35-authz-2026082514b`；两个真实 IAM JWT 会话、跨用户 profile/target 隔离、有效学习者访问后台 403、伪造 owner/tenant/role 头无效，MySQL owner 对账通过；需按新链路复测 |
| `pnpm b35:persistence-runtime` | PASS | `b35-persistence-2026082513`；完整 Java 服务重启后 IAM、content、SRS、assessment report、notification owner facts 仍存在 |
| B30 生命周期复测 | 待重新验收 | 新自有 JWT 生命周期证据待生成；登录、刷新重放、logout/revoke、IAM 故障恢复 |
| B31 内容复测 | PASS | `b31-content-2026082513`；MySQL definition/version/outbox/idempotency、发布→读取→下线 404 |
| B32 领域复测 | PASS | `b32-2026082513`；assessment、learning/SRS、notification 15/15 HTTP checks 与 MySQL 事实 |
| B32 Kafka 复测 | PASS | `b32-kafka-2026082513`；6 topics、重复投递去重、DLQ `SCHEMA_INVALID`、lag 0、源 outbox 未被修改 |
| B32 Redis 复测 | PASS | `b32-redis-2026082513`；MySQL source、重建、重复回放稳定、Redis 重启恢复、TTL 86400 |

## Browser MCP 核心旅程复测

| 场景 | 结果 | 证据 |
|---|---|---|
| learner-web 认证后核心链路 | 待重新验收 | 新自有 JWT 账号密码登录后的成人 Gate/同意、目标、测评答题与报告、今日任务、课程详情、断点保存和任务完成 |
| Mobile H5 认证后核心链路 | 待重新验收 | 新自有 JWT 登录后的目标/成人同意、练习报告读取、报告→今日任务、真实任务首页和 B31 MySQL 内容详情 |
| learner-web `/practice` 旧接口缺陷回归 | CODE/BUILD PASS；Browser 待复测 | `b36-web-practice-switch-20260826`；入口已从旧 `/assessment/sessions` 切换到 B25 placement 真实读写链路，learner-web build/typecheck、B33、G 通过；当前会话过期，认证后题目/报告 UI 待复测 |
| 浏览器认证负例全量回归 | PARTIAL | 未登录门禁、Gateway 故障恢复和 API 401/403 已有证据；退出/撤销、跨用户页面隔离和所有受保护页面的 MCP 负例仍需独立复测 |

## 负例与恢复

`b35-regression-runtime` 对以下 Gateway 路径均验证未认证返回 401，并检查了 `X-Request-Id`/`X-Trace-Id`：IAM principal、IAM permissions、learner home、learning stream、assessment start、admin content command。额外发送 `X-B5-Role`、`X-Role`、`X-Tenant-Id`、`X-Owner-Id` 伪造头仍为 401；伪造 Bearer 仍为 401。

`b35-authz-runtime` 的历史授权运行使用两个独立会话验证了主体边界；该结果只能作为安全测试背景。新的验收必须改用两个由 IAM 账号密码登录签发的 JWT：Alice 写入 profile/target 后，Bob 读取不到 Alice 的 target（404），profile 返回 Bob 自己的主体且不继承 Alice 的偏好；Bob 携带 Alice 的 owner、攻击者 tenant 和 admin role 头仍只得到 Bob 自己的资源；Bob 访问后台内容命令返回 403。

随后停止全部 14 个 Java 进程，用 Browser MCP 访问 Mobile H5，页面出现可见的网络错误态；再按运行脚本重新启动全部 14 个服务，14 个 readiness 重新通过，浏览器刷新后恢复到“身份服务已就绪”。这证明错误状态和恢复路径真实存在，未使用静态成功页。

## 缺陷台账

| 缺陷 | 等级 | 处理 | 回归 |
|---|---|---|---|
| Mobile H5 登录页依赖远程登录链接时没有表单 | P1（本地测试阻断） | 已修复：账号密码表单始终显示、H5 `onMounted` 兜底、请求超时和可重试错误态、中英文文案 | Browser MCP 在 390x844 下确认自有登录表单、IAM/Gateway outage/recovery；Mobile H5 build PASS |

本轮扫描最初将 B25 owner JDBC 适配器误报为禁止持久化，已修正 `scripts/security/verify-b14-boundaries.mjs` 的 owner persistence allowlist，并重新运行 `pnpm security:b14` 通过（12 services、682 source files、14 event fragments）。本轮已修复并复测 IAM consent 重复提交、learning continue-context 迁移、Web/H5 内容详情和任务路由，以及 Mobile H5 练习入口调用未接通 B10 session API 导致的 404：local-real 正常入口现在使用已有 MySQL placement/服务端判分链路，报告可读回并回到今日任务。2026-08-26 又修复 learner-web `/practice` 仍调用旧 `/assessment/sessions` 的同类缺陷，已通过 learner-web build/typecheck、B33 和 G 回归；认证后 Browser MCP 复测尚待新会话。自动化扫描观察到的 P0/P1 缺陷为 0；听力、个人设置、H5 新鲜任务提交/报告和 Admin 发布后的跨前端页面可见性尚未全量回归，不能把核心切片通过扩大为全量业务通过。

## B35 结论

自动化异常、未认证与有效会话权限、owner 隔离、重启、持久化、幂等、Kafka 重投/DLQ 和 Redis 重建均已通过；Browser MCP 已补齐 Web/H5 的核心真实数据链路，并修复 H5 练习入口 404。Web `/practice` 的旧接口调用已在代码和构建层修复，认证后页面复测仍待新会话完成。B35 的全量认证负例、H5 新鲜任务答题提交、剩余页面矩阵仍需继续回归，因此本章总体保持部分完成。
