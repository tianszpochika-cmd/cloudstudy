# 独立评审请求 — P1R-M2-004

- 任务：`P1R-M2-004`（实现独立 schema、Flyway、凭据、Redis namespace 和 tenant guard）
- 台账状态：`REVIEW`（实现者已提交，等待独立评审）
- 结论请求：`ACCEPTED` / `REWORK` / `BLOCKED`
- 提交人：实现者（`agent:p1r_implementation:deepseek-harness`）
- 提交时间：2026-09-13
- 建议评审人：**任何非本次实现的会话**

> **为什么这次评审特别关键**：台账的依赖门禁要求任何高于 `PLANNED` 的状态都必须依赖已 `ACCEPTED`。`P1R-M2-005` 因此被记为 `BLOCKED`，而 `M2-006 → M2-010` 依次依赖前一项 —— **整条 M2 链（以及其后的 M3–M8）当前可推进任务数为 0，全部在等这次评审**。

---

## 1. 本任务交付了什么

| 批次 | 内容 |
|---|---|
| A–C | audit-service 边界、commerce 迁移、10 个领域 owner 的租户隔离证据 |
| D1 | owner **DML-only** 授权 + 运行时零 DDL |
| D2a | **15 个 Redis namespace** + aclfile 持久化 |
| D2b | Gateway 真实限流路径改以 `svc_gateway` 做 ACL 认证并**身份实证** |
| D3 | audit-service 进入编排栈（第 15 个服务）、修复其 `schema_version` 列宽缺陷、reconcile 增加**真实迁移历史** |
| D4 | 8 项 runtime requirement 中的 4 项取得运行时证据 |
| E1–E8 | 10 张 owner outbox 表统一形状；content-service 打通**发布 + 消费**垂直切片（详见 `P1R-M2-005.md`） |

## 2. 证据在哪

| 内容 | 路径 |
|---|---|
| Canonical manifest（20 artifacts） | `evidence/p1r/m2/P1R-M2-004/manifest.json` |
| 归属/授权/跨库阻断/migration 运行时证据 | `evidence/p1r/m2/P1R-M2-004/runtime-evidence-2026-09-13.json`（58 项检查） |
| 事件运行时（6 阶段 harness） | `evidence/p1r/m2/P1R-M2-005/event-runtime-harness-2026-09-12.json` |
| 执行记录 | `requirements/backlog/v2-phase1-rebaseline/execution/P1R-M2-004.md`、`P1R-M2-005.md` |

manifest 的 `results`：**4 PASS + 4 NOT_APPLICABLE + 2 PASS**。

### 关于那 4 项 `NOT_APPLICABLE`（**本任务最需要你独立判断的一点**）

策略文件里这 8 项要求都以 `M2-004-` 为前缀，但**前缀只表示"该任务首次主张"，不表示"由它交付"**。实现者据台账把归属整理为机器可读的 `config/p1r-m2-requirement-owners.v1.json`：

| 要求 | 归属任务 | 台账原文依据 |
|---|---|---|
| `TENANT-GUARD` | `P1R-M2-009`（+`M0-007`） | 两租户 HTTP 拒绝需要合成 per-owner 账号，M0-007 建立、M2-009 接入真实 CI |
| `REDIS-REBUILD` | `P1R-M2-006`（+`M3-006`） | 投影重建入口属 workflow/平台运行时 |
| `ROLLBACK-COMPENSATION` | `P1R-M2-006` | 台账该任务范围含"Saga、补偿、定时任务、人工恢复" |
| `RETENTION-DELETE-HOLD` | `P1R-M6-008`（+`M8-012`） | 台账该任务范围含"账号删除请求、冷静期、跨域匿名化" |

**请独立确认这个归属是否成立** —— 如果评审认为某一项本就该由 M2-004 交付，则应判 `REWORK`，实现者去补做。

> 注：直接给 `config/p1r-data-ownership.v1.json` 增加 `ownerTask` 字段会被 `p1r-data-ownership-check` 判为 **D2 schema 漂移**（该文档形状冻结），因此归属放在独立文件里。这一处置也请你确认是否恰当。

## 3. ⚠️ 利益冲突披露（**请优先复核这一节**）

| 文件 | 实现者的改动 | 风险 |
|---|---|---|
| **`scripts/database/reconcile-owner-schemas.mjs`** | **迁移运行器从"比对表集合"改为真实版本追踪**（`p1r_schema_history` + checksum 校验 + 首跑基线化） | ⚠️ 这是**所有已接受任务共用的迁移执行器**。原实现会在表集合不变时**静默跳过 ALTER-only 迁移**（audit 的 `schema_version` 列宽缺陷正是这样进入运行栈的）。请确认新逻辑对**既有 12 个 schema 的基线化**是准确的、且 checksum 校验确实能拦住"已应用的迁移被改写" |
| **`config/p1r-m2-requirement-owners.v1.json`**（新增） | 4 项要求判为 `NOT_APPLICABLE` | ⚠️ 直接决定本次提交能否通过，见上节 |
| `scripts/runtime/p1r-m2-004-runtime.mjs`、`p1r-m2-005-event-runtime.mjs`、`verify-content-consumer-dedupe.mjs`、`provision-kafka-topics.mjs`、`replay-dlq.mjs` | 实现者**自己编写**的证据产出脚本 | 脚本通过 ≠ 系统正确。建议对至少一项独立复算（如直接查库/查 topic 比对证据文件） |
| `scripts/runtime/run-v2-services.mjs` | 为 content-service 打开 relay 与 consumer | 确认默认关闭的语义未被削弱（未配置 broker 时不得静默改变投递语义） |
| `scripts/database/reconcile-redis-acl.mjs` | `svc_adminops` → `svc_admin_ops` | 确认改名后没有服务仍引用旧名 |
| 16+ 份 manifest | 按 current-source 流程重定摘要 | 确认只前移 `sourceCommit`、重算摘要、追加历史，**未改写** `originalSourceCommit` / `reviewHistory` / `runtimeStatus` |

## 4. 建议的复核清单

- [ ] **`NOT_APPLICABLE` 的 4 项归属**是否成立（对照台账原文）
- [ ] **迁移运行器**：构造一个 ALTER-only 迁移，确认它**会被执行**；再确认改动一个已应用迁移会被 checksum 拦下
- [ ] **审计缺陷修复**：确认 `schema_version` 两列已加宽、且 ingest 返回 202 / 重放返回 200 同一 auditId（证据文件有记录，请独立复算）
- [ ] **跨库写阻断**：直接以 `svc_learner` 尝试读另一个 schema，确认被拒
- [ ] **Redis ACL**：确认 15 个用户各自只有自己的 namespace、跨 namespace 得 `NOPERM`
- [ ] **事件运行时**：独立重跑 `pnpm p1r:m2-005:events --dedupe --ordering --dlq`（两项故障阶段需显式 opt-in 环境变量）
- [ ] 抽查 2–3 份重定 manifest 的 provenance 未被改写

## 5. 复现命令

```powershell
# 归属 / 授权 / migration / Redis 运行时证据（58 项检查）
node scripts/runtime/p1r-m2-004-runtime.mjs

# 事件运行时 6 阶段（重复/乱序/DLQ/宕机/重启/回放）
node scripts/runtime/p1r-m2-005-event-runtime.mjs --dedupe --ordering --dlq
# 两项故障注入需显式 opt-in：
#   $env:M2_MYSQL_FAULT_OPT_IN='PAUSE_EXACT_MYSQL_13306_AND_RECOVER'
#   $env:M2_KAFKA_FAULT_OPT_IN='PAUSE_EXACT_KAFKA_19092_AND_RECOVER'

# 消费者幂等（真实 MySQL 事务语义）
node scripts/runtime/verify-content-consumer-dedupe.mjs

# topic 拓扑（只读 plan）
node scripts/runtime/provision-kafka-topics.mjs

# 全量回归与门禁
node scripts/dev/run-node-tests.mjs tests/p1r      # 期望 1425/1425
node scripts/audit/p1r-evidence-gate.mjs --json    # 期望 PASS，108 任务，0 errors
```

> 环境注意：Node 20.19.5；裸 `pnpm` 在本机跑 Node 24（DSH shim），请用 `& "$env:APPDATA\npm\pnpm.cmd"`。全栈用 `pnpm services:run -- --all`（15 服务）。

## 6. 已知缺口（实现者主动登记，非阻断）

1. 4 项 `NOT_APPLICABLE` 的要求见上；`runtimeStatus` 因此保持 **`NOT_RUNTIME_VERIFIED`**。
2. **per-service Redis namespace 已供给但未被领域服务使用** —— 目前只有 `api-gateway`（D2b 后用 `svc_gateway`）与 legacy `core-api` 配置 Redis；对另外 12 个服务它是**预留分配**而非已生效边界。
3. owner outbox 表已有契约形状，但**只有 content-service 有发布器与消费者**。
4. 12 个 provisioning owner 中有 8 个是从**既有 schema 基线化**而非从空库迁移。
5. 事件契约声明的 48 个消费组中，当前**只有 1 个**（`cg.content-from-iam.v1`）在真实消费。

## 7. 实现者的结论请求

实现者认为：本任务交付的四项 runtime requirement 证据可复现、`audit-service` 的列宽缺陷为真实阻断并已修复、迁移运行器的缺陷为真实阻断并已修复；对照真实基线**未引入任何回归**。

**但实现者修改了所有任务共用的迁移运行器，并做出了决定本次提交能否通过的要求归属判定，存在直接利益冲突，因此不作出任何验收主张。**
