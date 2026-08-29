# B36 本机全栈终验与测试交接

> 日期：2026-08-25  
> 范围：`V2-B36-GATE-001` 至 `V2-B36-HANDOFF-005`  
> 当前结论：`LOCAL-TEST-NO-PASS`

## 终验运行证据

| Gate | 结果 | 证据 |
|---|---|---|
| GATE-001 干净启动终验 | PASS | `b36-20260825154433`（最新）；停止 Java 服务后重新启动/检查 14 个后端和四个前端，连续两轮 readiness/smoke 通过 |
| GATE-002 双端完整旅程 | PARTIAL | 已完成 Web 的认证到测评报告/任务完成核心链路，以及 H5 的认证、目标同意、规则测评入口和真实内容链路；2026-08-26 已修复 Web `/practice` 旧 B10 接口调用，但认证后新入口复测仍待进行；H5 新鲜任务完整答题到报告、退出/重登和全页面矩阵仍未完成 |
| GATE-003 数据与事件终验 | PARTIAL | Web 核心页面与 learner/learning MySQL 事实已对账，H5 显示同一 B31 内容投影；Admin 发布联动、H5 完整测评事件和全页面数据对账仍待补 |
| GATE-004 质量与缺陷终验 | PASS | 四端构建、契约、迁移、Redis、配置、端口、安全扫描和 B30–B35 自动化回归通过；当前已知 P0/P1 缺陷为 0 |
| HANDOFF-005 交接结论 | NO-PASS | 认证阻断已解除；H5 完整测评、剩余页面矩阵、退出/重登和 Admin 发布联动仍未关闭 |

## 已验证范围

- `pnpm b36:gate-runtime`：最新 `b36-20260825154433` 两轮均检查 14 个后端 readiness、四个前端固定端口和官网 Gateway 真实投影，结果 PASS；脚本自身的认证旅程字段仍按 fail-closed 规则为 `WAITING_USER_CONFIRMATION`，认证后页面证据由 `b36-browser-2026082516` 单独记录。
- `pnpm b35:regression-runtime`：未认证 401、伪造角色/租户/所有者头拒绝、Gateway→content-service MySQL 投影、MySQL/Redis/Kafka/MinIO 运行状态通过；新的 IAM JWT 认证后回归待复测；
- `pnpm b31:learner-runtime`：历史会话结果不计入当前验收；需用 IAM 账号密码登录重新验证成人 Gate、同意、目标、偏好写入/重放/读回和 IAM/learner MySQL 对账；
- `pnpm b35:persistence-runtime`：`b35-persistence-2026082513`；完整 Java 服务重启后 IAM、内容、SRS、assessment report 和 notification owner facts 仍可读；
- `pnpm test:b35`：4/4 通过；`pnpm b35:authz-runtime`：`b35-authz-2026082514b`，有效会话 403、跨用户 owner 隔离和伪造 authority 头回归通过；`pnpm contracts:validate`、`pnpm db:validate`、`pnpm redis:validate`、`pnpm config:check`、`pnpm security:b14`、`pnpm ports:check -- --registry-only` 和 `pnpm dod:check` 通过；
- learner-web、admin-web、official-site 和 Mobile H5 构建通过；Mobile H5 在 `390x844` 下的登录入口、Gateway 中断错误态和恢复态已有 Browser MCP 截图/DOM 证据。
- Browser MCP 认证后核心复测：`b36-browser-2026082516`；Web 显示真实测评报告、今日任务、B31 内容详情、断点保存和任务完成；H5 显示真实目标/成人同意、练习报告、报告→今日任务、B31 `COURSE_UNIT` 和 `MySQL 内容投影`。
- Web 练习入口修复证据：`b36-web-practice-switch-20260826`；`apps/learner-web/src/pages/B2PracticePage.vue` 已切换到 learner-content B25 placement 读写链路，旧 `/assessment/sessions` 调用不再由 `/practice` 触发；learner-web build/typecheck、`pnpm test:b33`、`pnpm test:g` 和 `git diff --check` 通过。当前浏览器会话过期，认证后题目/报告的 MCP 复测待继续。
- MySQL 对账：`learning_service.b25_learning_continue_context` 已存在并有 1 条 ACTIVE 断点；`learner_service.b25_learner_daily_task` 为 `AVAILABLE=1`、`COMPLETED=1`；Web 测评报告为服务端完成态 `C2/1.0`。未使用前端静态数据作为事实源。
- 最新质量复核：`pnpm -r --if-present build`（设置 `NUXT_IGNORE_LOCK=1`）与 `pnpm --filter @englishflow/mobile build:h5` 均 PASS；`pnpm ports:check -- --registry-only`、`pnpm infra:check`、`pnpm test:b30` 8/8、`pnpm test:b31` 4/4、`pnpm test:b32` 2/2、`pnpm test:b33` 1/1、`pnpm test:b35` 4/4、`pnpm test:g` 41/41、`pnpm contracts:validate` 和 `pnpm db:validate` 均 PASS。构建输出仅有依赖弃用、动态导入和 chunk size 警告。

## 本轮已完成的真实浏览器步骤

当前没有可用于重新完成认证后浏览器验收的测试凭据；密码不得由 Agent 读取或代填。手动提供合成账号后，密码只应在 Browser MCP 的自有登录表单中即时使用，不写入仓库、日志、证据或浏览器存储读取结果。

1. learner-web：新的账号密码注册/登录、会话恢复、成人 Gate、同意、目标/时长、规则测评答题与服务端报告、今日任务、课程详情、断点保存和任务完成待 Browser MCP 重新执行；`/practice` 旧接口切换已完成代码/构建验证；
2. Mobile H5：新的账号密码登录、目标与成人同意、真实练习报告读取、报告→今日任务、真实首页任务和 B31 MySQL 课程详情待重新执行；
3. 数据证据：Web 页面结果与 learner/learning MySQL 事实一致，H5 读取同一内容投影；
4. 尚未关闭：H5 新鲜任务从答题到报告的完整链路、退出/清会话后重新登录、Admin 发布后 Web/H5 可见性、SRS/通知/个人设置/听力等剩余页面逐项 MCP 验收。

因此当前仍保持 `LOCAL-TEST-NO-PASS`，但阻断项已从“无法认证”收窄为“全量页面和双端完整旅程尚未完成”。

## 启动与恢复

```powershell
pnpm ports:check
pnpm infra:up
$env:B30_REAL_JWT = 'true'
pnpm services:run -- --all --timeout-ms 90000
pnpm frontend:run -- --all
pnpm b36:gate-runtime
```

测试期间只使用本地合成账号和内容。不要将密码、JWT、Refresh Token、Cookie、重置凭证或真实个人数据写入仓库。
