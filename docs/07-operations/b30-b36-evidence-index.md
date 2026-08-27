# B30–B36 本机真实全栈证据索引

> 日期：2026-08-25  
> 适用范围：Phase 1 本机 Web/H5 + 真实本地数据目标  
> 当前交接：`LOCAL-TEST-NO-PASS`

## 章节证据

| 章节 | 运行标识 | 结果 | 说明 |
|---|---|---|---|
| B30 | `b30-oidc-20260825025900` / `b30-check-2026082507` / `b36-browser-2026082516` | 自动化 PASS；Browser 核心认证通过 | OIDC/JWKS、IAM、刷新/撤销/回调重放、错误密码、IdP 故障恢复和 MySQL 审计通过；Browser 已完成本地注册/登录和核心回调，退出/清会话重登仍待复测 |
| B31 | `b31-content-2026082513` / `b31-learner-2026082513` / `b36-browser-2026082516` | API/DB PASS；核心页面通过 | 内容发布、成人 Gate、同意、目标、偏好、课程详情、断点和任务完成均有真实 API/DB 或 Browser 核心证据；剩余页面矩阵待回归 |
| B32 | `b32-2026082513` / `b32-kafka-2026082513` / `b32-redis-2026082513` / `b36-browser-2026082516` | 领域自动化 PASS；页面核心切片通过 | 学习/测评/SRS/报告/通知、Kafka 重投/DLQ/lag、Redis 重建/重启/TTL 通过；Web 测评/任务核心页面通过，H5 完整测评报告待回归 |
| B33 | `b33-fe-2026082513` / `b36-browser-2026082516` / `b36-web-practice-switch-20260826` | 核心交互通过；全量页面待回归 | 四端构建、固定端口、Gateway-only、官网真实公开投影、Web/H5 B31 内容联动和 H5 目标入口通过；Web `/practice` 已切换到 B25 placement 真实链路，认证后 UI 待复测 |
| B34 | `b36-browser-2026082516` | 部分通过 | 已完成真实认证和 Web/H5 核心真实数据操作；完整页面、退出/重登、后台发布联动仍待 MCP |
| B35 | `b35-2026082515` / `b35-authz-2026082514b` / `b35-persistence-2026082513` / `b36-browser-2026082516` / `b36-web-practice-switch-20260826` | 自动化 PASS；Browser 负例部分通过 | 未认证/有效会话权限、跨用户 owner 隔离、异常恢复、重启持久化、幂等、Kafka/Redis 对账和 Web/H5 核心缺陷修复通过；Web `/practice` 旧接口调用已代码/构建修复，认证后 UI 复测和全量页面负例待回归 |
| B36 | `b36-20260825154433` / `b36-browser-2026082516` / `b36-web-practice-switch-20260826` | 部分通过 | 最新两轮全栈 readiness/smoke、质量门禁和 Web/H5 核心真实旅程通过；Web 练习旧接口已修复但认证后新入口未复测，H5 全旅程及剩余页面未闭环，故 NO-PASS |

## 质量与安全命令

| 命令 | 结果 |
|---|---|
| `pnpm test:b30` | 8/8 PASS |
| `pnpm test:b31` | 4/4 PASS |
| `pnpm test:b32` | 2/2 PASS |
| `pnpm test:b33` | 1/1 PASS |
| `pnpm test:b35` | 4/4 PASS |
| `pnpm contracts:validate` | 427 operations、479 OpenAPI schemas、154 events、110 payload schemas PASS |
| `pnpm db:validate` | 23 migrations PASS |
| `pnpm redis:validate` | 29 registry entries、8 synthetic samples PASS |
| `pnpm config:check` | Phase 1 safety switches closed PASS |
| `pnpm security:b14` | 12 services、682 source files、14 event fragments PASS |
| `pnpm dod:check` | 5/5 PASS |
| 四前端生产构建 | learner/admin/official/mobile H5 PASS |
| `pnpm ports:check -- --registry-only` / `pnpm infra:check` | 固定端口注册表、6 项本地依赖和 8 个绑定 PASS；运行态端口占用由 B36 readiness 负责 |
| B34/B36 Browser MCP 认证后复核 | `b36-browser-2026082516`；Web 测评/课程/断点/任务完成，H5 目标/同意/真实课程内容 PASS（核心切片）；Web `/practice` 新入口已构建切换但待认证复测，H5 完整测评、后台发布联动和剩余页面待回归 |

## 结论规则

自动化 API、SQL、Kafka 或静态构建结果不能替代 B34/B36 的 Browser MCP 页面操作。只有在 learner-web 和 Mobile H5 都完成“注册/登录 → 成人 Gate → 目标 → 课程 → 练习/测评 → 判分 → SRS/报告/通知 → 刷新/退出/重新登录”，并且浏览器结果与 MySQL owner 事实对账后，才可以把 `LOCAL-TEST-NO-PASS` 改为 `LOCAL-TEST-PASS`。
