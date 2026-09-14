# 独立评审请求 — P1R-M2-004（**第十二轮**）

- 任务：`P1R-M2-004`（实现独立 schema、Flyway、凭据、Redis namespace 和 tenant guard）
- 台账状态：`REVIEW`（实现者已提交，等待独立评审）
- 结论请求：`ACCEPTED` / `REWORK` / `BLOCKED`
- 提交人：实现者（`agent:p1r_implementation:deepseek-harness`）
- 提交时间：2026-09-14（第十二轮）
- 建议评审人：**任何非本次实现的会话**
- 前 12 轮结论：**均为 `REWORK`**（P0/P1/P2 = 0/4/6 → 0/1/9 → 0/3/7 → 0/4/8 → 0/2/8 → 0/3/9 → 0/3/6 → 0/4/9 → 0/5/4 → 0/4/8 → 0/4/6 → 0/2/4）。**12 轮 P0 全部为 0**，每轮的核心运行时事实都被评审独立复现；失分形态始终是「账实不符」。12 轮判定与计数记入 `evidence/p1r/m2/P1R-M2-004/review-history.json` 与台账日期条目。
- 第四轮动作清单 9 项的处理：其中「生成器硬编码 PASS」「散文数字」「gated 硬编码服务列表」「先提交再重跑 harness」「文档一致性」「命令补 opt-in」「措辞同步」「REDIS-REBUILD 归属」已处理，处理方式是**结构性**的：生成器现在把每个数字与归属都从数据推导，门禁新增「config 判给本任务却报 NOT_APPLICABLE 即 error」的交叉校验（已做突变测试）。

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
| Canonical manifest（63 artifacts） | `evidence/p1r/m2/P1R-M2-004/manifest.json` |
| 归属/授权/跨库阻断/migration 运行时证据 | `evidence/p1r/m2/P1R-M2-004/runtime-evidence-2026-09-13.json`（91 项检查） |
| 事件运行时（6 阶段 harness） | `evidence/p1r/m2/P1R-M2-005/event-runtime-harness-2026-09-12.json` |
| 执行记录 | `requirements/backlog/v2-phase1-rebaseline/execution/P1R-M2-004.md`、`P1R-M2-005.md` |

manifest 的 `results`：**9 PASS + 3 NOT_APPLICABLE**。下面这张表的数字抄自 manifest（本次核对：artifacts、检查数、PASS/NA 计数逐项比对），**但本文档尚无生成脚本**，所以请以 manifest 本身为准。

### 关于那 3 项 `NOT_APPLICABLE`（**本任务最需要你独立判断的一点**）

策略文件里这些要求都以 `M2-004-` 为前缀，但**前缀只表示「该任务首次主张」，不表示「由它交付」**。归属记在机器可读的 `config/p1r-m2-requirement-owners.v1.json` 里，且该文件本身是本 manifest 的摘要制品之一。

| 要求 | manifest 的处置 |
|---|---|
| `OWNER-SCHEMA-GRANTS` | `PASS`，由本任务交付 |
| `CROSS-OWNER-DENY` | `PASS`，由本任务交付 |
| `REDIS-NAMESPACE-ACL` | `PASS`，由本任务交付 |
| `FLYWAY-EMPTY-AND-EXISTING` | `PASS`，由本任务交付 |
| `TENANT-GUARD` | `PASS`，由本任务交付 |
| `FLYWAY-OWNER-COVERAGE` | `PASS`，由本任务交付 |
| `REDIS-REBUILD` | `NOT_APPLICABLE`，归属 P1R-M3-006 |
| `ROLLBACK-COMPENSATION` | `NOT_APPLICABLE`，归属 P1R-M2-006 |
| `RETENTION-DELETE-HOLD` | `NOT_APPLICABLE`，归属 P1R-M6-008 |

**请独立确认这些归属是否成立** —— 若评审认为某一项本就该由 M2-004 交付，应判 `REWORK`。

> 注：第五轮评审指出「回滚/补偿测试」在**本任务内没有真实交付物**（原先交付的 drift-refusal 检查既无回滚动作、也无 owner 补偿与 receipt），据此**已改判 `P1R-M2-006` 并同步修改了台账第 76 行**。这不是为了让状态好看，而是该任务的范围确实含 Saga 补偿、人工恢复与 receipt 表，且那里已交付了补偿执行器、双人审批与 recovery receipt。

> 注：直接给 `config/p1r-data-ownership.v1.json` 增加 `ownerTask` 字段会被 `p1r-data-ownership-check` 判为 **D2 schema 漂移**（该文档形状冻结），因此归属放在独立文件里。这一处置也请你确认是否恰当。

**请独立确认这个归属是否成立** —— 如果评审认为某一项本就该由 M2-004 交付，则应判 `REWORK`，实现者去补做。


## 3. ⚠️ 利益冲突披露（**请优先复核这一节**）

| 文件 | 实现者的改动 | 风险 |
|---|---|---|
| **`scripts/database/reconcile-owner-schemas.mjs`** | **迁移运行器从"比对表集合"改为真实版本追踪**（`p1r_schema_history` + checksum 校验 + 首跑基线化） | ⚠️ 这是**所有已接受任务共用的迁移执行器**。原实现会在表集合不变时**静默跳过 ALTER-only 迁移**（audit 的 `schema_version` 列宽缺陷正是这样进入运行栈的）。请确认新逻辑对**既有 12 个 schema 的基线化**是准确的、且 checksum 校验确实能拦住"已应用的迁移被改写" |
| **`config/p1r-m2-requirement-owners.v1.json`**（新增） | 3 项要求判为 `NOT_APPLICABLE` | ⚠️ 直接决定本次提交能否通过，见上节 |
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
# 归属 / 授权 / migration / Redis 运行时证据（91 项检查）
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
node scripts/dev/run-node-tests.mjs tests/p1r      # 期望 1439/1439（此前本文写 1425，已随第三轮返工更正）
node scripts/audit/p1r-evidence-gate.mjs --json    # 期望 PASS，108 任务，0 errors
```

> ⚠️ **请勿运行下列命令，它们会写文件**（评审要求只读；本清单由第三轮返工补充，因为上一轮评审运行其中一条后弄脏了工作区）：
>
> - `& "$env:APPDATA\npm\pnpm.cmd" p1r:devex:evidence` —— 会**重写** `evidence/p1r/m0/devex/devex-verification.json`（该文件是生成物，第三轮返工时我随其他改动一并提交却未点名，故在此显式登记）
> - `node scripts/database/reconcile-redis-acl.mjs` —— 会**供给并剪枝** Redis ACL 用户
> - `node scripts/database/reconcile-owner-schemas.mjs --apply`
> - `node scripts/runtime/run-gated-db-tests.mjs --write` —— 只读评审请去掉 `--write`
>
> 只读的等价形式：`node scripts/runtime/run-gated-db-tests.mjs`（不加 `--write` 即不落盘）。

> 环境注意：Node 20.19.5；裸 `pnpm` 在本机跑 Node 24（DSH shim），请用 `& "$env:APPDATA\npm\pnpm.cmd"`。全栈用 `pnpm services:run -- --all`（15 服务）。

## 6. 已知缺口（实现者主动登记，非阻断）

以下 10 条**逐字**取自 manifest 的 `knownGaps`，本节不再另行改写：

1. The tenant guard is delivered at the storage layer through 10 passing *TenantIsolationTest classes, each running against a real MySQL and its own owner's schema. They write with a JdbcTemplate rather than through a service repository. 9 of the 10 instantiate an imported production class and 1 do not (NotificationTenantIsolationTest), and the classes do not all assert the same thing: most assert that a foreign tenant's rows are not returned, while at least one asserts only that a guarded column has no default and that the schema credential cannot write another owner's tables. So this is evidence about schema-level isolation, not about every service's request path, and the policy line asking for a server-derived TenantScope on a request path is not measured here. The HTTP-level two-tenant negative remains open and is handed to P1R-M2-009: it needs a synthetic per-owner account, which P1R-M0-007 builds and P1R-M2-009 wires into real CI. P1R-M2-009's ledger scope does not itself name tenant guard, so this is a residual gap recorded against this task rather than a reassignment of the requirement.
2. The per-service Redis namespaces and ACLs are provisioned and probed for every namespaced owner, but no domain service uses Redis yet: only api-gateway and the legacy core-api configure it, so for the 14 domain owners the namespace is a reserved allocation rather than an enforced boundary in a live path. The Redis default user is still reachable without a password, so the namespace boundary does not constrain an unauthenticated client; that is a property of the local container rather than of this task's ACLs, and it is registered here rather than left implicit.
3. The owner outbox tables now carry the contract shape, but only content-service has a publisher and a consumer; the other owners still append rows that nothing publishes.
4. Some provisioning owners were baselined from an existing schema rather than migrated from empty, so their migration history records what was already applied rather than a replay from scratch. How many is NOT VERIFIED: the reconcile output reports the state per owner but no tracked record counts them, so a figure is not given here rather than repeated from an earlier run. The empty-database drill is covered by the Flyway tests above rather than by those baselines.
5. p1r_schema_history, written by scripts/database/reconcile-owner-schemas.mjs, is authoritative for the 13 externally migrated owners and records the version and checksum the reconcile runner applied. flyway_schema_history belongs to the service that runs Flyway at startup, which is iam-service today, and to the service-owned tests. They are not interchangeable: the reconcile history is what the platform asserts, and a Flyway history exists only where a service or its tests actually ran Flyway.
6. The gated test families in this task are unchanged in themselves; what changed is that they are now run on purpose. A default `mvn test` still reports them as skipped, so any future evidence that cites them has to run scripts/runtime/run-gated-db-tests.mjs, which discovers 33 classes across the repository and reports the ones it could not run.
7. This task changed a value in the frozen D2 data-ownership policy and the assertion that enforced it in the same commit: the api-gateway Redis namespace moved from gateway to englishflow:gateway so that the policy, the ACL provisioning script and the running Gateway agree. It is registered here because changing a policy and the check that guards it together is a conflict of interest, and leaving it to the commit message is not a record. The evidence for the change is in the harness: a probe against the bare gateway namespace is refused by Redis while englishflow:gateway is accepted.
8. The workflow-service built under P1R-M2-006 is a provisioned owner, so the counts here include it: 14 owners in total and 13 externally migrated. Its schema, credential and migration are delivered by that task, and its tenant guard and gated coverage are not part of this snapshot, which is why the gated class count is 33 while the Flyway coverage check covers 13 services.
9. The Redis default user is still enabled without a password, so the namespace boundary this task provisions does not constrain a client that never authenticates. That is a property of the local container rather than of these ACLs, and it is recorded because a reader could otherwise take "per-service Redis namespaces" for a complete boundary.
10. Overall phase remains D2_CONTRACT_READY / NOT_RUNTIME_VERIFIED.

## 7. 实现者的结论请求

实现者认为：本任务交付的四项 runtime requirement 证据可复现、`audit-service` 的列宽缺陷为真实阻断并已修复、迁移运行器的缺陷为真实阻断并已修复；对照真实基线**未引入任何回归**。

**但实现者修改了所有任务共用的迁移运行器，并做出了决定本次提交能否通过的要求归属判定，存在直接利益冲突，因此不作出任何验收主张。**
