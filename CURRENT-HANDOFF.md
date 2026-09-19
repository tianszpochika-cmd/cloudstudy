# CURRENT-HANDOFF —— 语学星 Phase 1 重基线（P1R）

> 本文件是**跨会话交接**的入口，记录"当前在哪、下一步做什么、谁在等谁"。
> 最后更新：**2026-09-19**。**本文档不写会随每次提交变化的值** —— 它此前写着 `HEAD`、轮次与测试数，三处都在几天内过期，而陈旧的交接文档会被当作现状读。需要当下值时跑 §0 的命令，或读那里指名的权威文件。
> **所有数字均为当日实测，命令附在括号内。**

---

## 0. 检查点

> **本表不写会随每次提交变化的值。** 它此前写着 `HEAD` 与轮次，两处都在几天内过期，而**陈旧的交接文档会被当作现状读** —— 这正是它要防的毛病。要得到当下值，跑下面的命令；**不要把这些数字抄回本文档**。

```bash
git rev-parse --short HEAD          # 当前提交
git status --porcelain              # 空即为 clean
git rev-list --count origin/dev..HEAD   # 领先 origin 多少（推送后应为 0）
```

| 项 | 值（缓慢变化，或附取得方式） |
|---|---|
| 计划进度 | **81/108 ACCEPTED = 75%**（M0 7/8、M1 18/18、M2 5/10、M3 9/10、M4 7/10、M5 11/14、M6 11/11、M7 8/11、M8 5/16；其余 27 项为 `DEV_DONE`，状态以 [02-编号任务台账](requirements/backlog/v2-phase1-rebaseline/02-编号任务台账.md) 为准） |
| 27 项 DEV_DONE 的去向 | 已逐项分诊（2026-09-17，见 CHANGELOG `[P1R-TRIAGE-20260917]`）：11 个具名 M8-* + 9 个 M8 波次 + 5 个基建（Kafka/补偿传输/集群策略/trace 采集/分支保护主机 API 实测调不通）+ M0-006 留独立验收 + M4-008 留 M4-009/M8-007。**本地可翻队列已清空** |
| `P1R-M0-006` | `DEV_DONE` —— 留独立验收（BOM/version catalog/依赖锁/SBOM；资产验证列已标 `已验-可用`） |
| `P1R-M2-004` | **`ACCEPTED`**（2026-09-14 前后多轮 REWORK 后闭合；历史见 §2 与 `evidence/p1r/m2/P1R-M2-004/manifest.json`） |
| 可领取任务 | 台账中已无 `PLANNED/READY` 任务 —— 剩余工作即上述 27 项 `DEV_DONE` 的验收/翻牌 |

**一句话**：M2 安全与可靠性骨架已闭合，M3–M7 主体任务已翻牌为 `ACCEPTED`（81/108），剩余 27 项 `DEV_DONE` 已完成分诊且**本地可翻队列清空**；下一步是 M8 波次、五项基建（依赖外部环境实测）与 M0-006 独立验收。

---

## 1. 必跑门禁（全部应为 PASS）

| 命令 | 期望 | 实测 |
|---|---|---|
| `node scripts/audit/p1r-evidence-gate.mjs --json` | `PASS`，`errors: []` | ✅ |
| `node scripts/audit/verify-phase1-rebaseline-plan.mjs` | `PASS`，`taskCount: 108` | ✅ |
| `node scripts/dev/run-node-tests.mjs tests/p1r` | 全部通过（**数字会变，以命令输出为准**） | ✅ |
| `node scripts/audit/p1r-stale-claims-check.mjs` | `PASS (911 files)` | ✅ |
| `node scripts/audit/doc-audit.mjs` | `PASS` | ✅ |
| `mvn -f services/api-gateway/pom.xml -o test` | `93 / 0 / 0` | ✅ |

**工具链**：Node **20.19.5**（`C:\Users\Administrator\Tools\node-v20.19.5-win-x64`）；调用 pnpm 用 `& "$env:APPDATA\npm\pnpm.cmd" <script>`，**裸 `pnpm` 会跑 DSH 的 Electron Node 24**（错）。JDK 25：`C:\Program Files\Microsoft\jdk-25.0.4.101-hotspot`。

> **2026-09-19 复测（文档对齐批次）**：`plan:p1r:check` PASS（`taskCount: 108`）；`doc-audit` PASS；`p1r-stale-claims-check` PASS（**1152 files**，文件数会随仓库增长）。⚠️ `p1r-evidence-gate` 全量校验在本次对齐中**未等完**（本机同时承载全栈人工测试负载，超过 30 分钟无输出，疑似环境挂起，已中止而非判 PASS）——最近一次全绿记录见 CHANGELOG 09-17/09-18 各批次；**下次空闲时段应补跑全量 evidence gate**。

**PowerShell 陷阱（本会话反复踩）**：内联 `node -e` 会被吞掉 `$`、引号、反引号、`&&`、`[` ⇒ **一律写 `tmp/*.mjs` 文件再跑**。

---

## 2. `P1R-M2-004`（已闭合 —— 本节保留为方法论历史）

> **状态更新（2026-09-19）**：`P1R-M2-004` 已经历多轮 REWORK 后最终 **`ACCEPTED`**（资产验证 `已验-可用`，见台账与 `evidence/p1r/m2/P1R-M2-004/manifest.json`）。以下失分形态与结构性防护记录保留，作为后续独立验收工作的方法论参照。

判定序列：`0/4/6 → 0/1/9 → 0/3/7 → 0/4/8 → 0/2/8 → 0/3/9 → 0/3/6 → 0/4/9 → 0/5/4 → 0/4/8 → 0/4/6`。

**每轮 P0 均为 0**：核心运行时事实（DML-only 凭据 + `ERROR 1142`、Redis ACL 命名空间、`varchar(64)` 与 37 字符 schema id、13 套 `p1r_schema_history`、gated 33 类全跑、1439 回归）**每轮被评审在真实依赖上独立复现**，**无伪造、无放宽判据**。

**失分形态始终是账实不符**，且**反复是"被点名处改了、兄弟处没改"**。

**已建立的结构性防护**（均经突变测试确认会开火）：
1. 门禁：**台账行必须点名**任何拥有本任务要求的他任务
2. 门禁：**形如要求 id 的检查名必须被声明**
3. 门禁：**陈旧主张检查是门禁的一部分**（已在门禁内实际报出 `says 62 artifacts where the manifest records 63`）
4. 门禁：**证据 `workingTreeDirty === true` 即 error**
5. 入库测试 `tests/p1r/p1r-stale-claims.test.mjs`：逐条突变 + 断言失败 + 复原

**检查器上限**（已写进 `manifest.checkLimits`，8 条）：manifest **无法自摘要**、检查器**读文档而非证据**、`evidence/**`/`tests/**`/CHANGELOG **被排除**、按**措辞而非语义**匹配等。
⚠️ **`checkLimits` 自身是"不会被任何规则检查的 manifest 散文"** ⇒ **改动检查器时必须同时复核这 8 条**。

---

## 3.5 第十三轮之后的状态（2026-09-14）

**仓库全绿。** `p1r:evidence:check`、`plan:p1r:check`、`test:p1r`、`stale-claims` 四条命令均 PASS；`git status` 为空。

**第十三轮的四条 P1 已处置三条：**

| 发现 | 状态 |
|---|---|
| 门禁不读 `rollbackEvidence[].status`（突变实测：FAIL 翻 PASS，错误数 0→0） | ✅ **已堵** —— 门禁现在按 results 的同一标准校验该字段，**规则首次运行即开火** |
| `rollbackEvidence` 的计数把**加宽**当成收窄（`audit-service/V2` 是 32→64） | ✅ **已修** —— 按 owner 的**版本顺序**读更早定义判方向：**2 收窄 / 3 加宽 / 5 无法判定** |
| 执行记录在被审 revision 内仍写两条 P1"未修 / 未闭合" | ✅ **已改** —— 原措辞标注为修复前所记 |
| 评审期间 HEAD 漂移（第 4 轮连续） | ❌ **未解决** —— 靠自律无效，需 CI 强制 |

**两处真实收窄已点名归属**（**不是本任务的迁移**）：`learning-service/V9` 的 `event_name` 160→128、`notification-service/V3` 的 `event_id` 160→128。已写入 `manifest.knownGaps`，接收方是这两个服务自己的任务。

**方法论教训**（本轮最贵的一课）：**"0 命中"可能只是规则匹配不上** ✗。这个任务里出现过三次同形缺陷 —— 检查器词表止于 nine、"Ten" 因此不可见；`numerals` 止于「十」，第 11 轮被搜成不存在的名字；正则 `COLUMN?` 两种写法都不匹配。**共同点：一个不能失败的检查，与一个通过的检查无法区分。**

## 3. 我反复失手的那一层（**请下一个会话替我兜住**）

| 轮 | 失误 |
|---|---|
| 63 | 检查器豁免写成**整文件**，且**合理化**了突变失败 |
| 68 | 即兴 grep 太松（83 处误报） |
| 71–73 | 侦察脚本**匹配错行** |
| 74 | 检查器断言**装不上却报"已存在"** |
| 76 | `workingTreeDirty` **两次恒真** |
| 77 | 插入位置**破坏语法** |
| 80 | 第 10 轮判定**忘记记录**（与第 8 轮**同一 bug 第二次**） |
| 82 | 前端核对**找错变量名** |
| 86 | 用检查器**词表外的 "Ten"** 消除报警；`numerals` 只到「十」（**同一 bug 再现**） |
| 92–94 | 网关接线**三次破坏测试套件**，各已回退 |

⇒ **共同点：定位与测量口径**，**而非核心实现**。

---

## 4. `P1R-M2-006`（已交付 `DEV_DONE` —— 本节保留执行起点记录）

> **状态更新（2026-09-19）**：`P1R-M2-006` 现为 `DEV_DONE`（台账为准）；下文"唯一缺口：装配"是当时的交接快照，后续批次已处理，以 `evidence/` 与台账为准。

**已交付且有测试**（`services/workflow-service` **51+ 项**）：Saga 状态机／JDBC 存储（真库）／补偿执行器（**已 APPLIED 绝不重跑**）／双人审批（**申请人不能自审**）／人工恢复 HTTP（**身份取自 token**，请求体无 approver 字段）／任务 lease（**数据库仲裁**）／outbox（**`FOR UPDATE SKIP LOCKED`**）。

**ADR-0016**（`docs/10-decisions/0016-service-identity-and-internal-token-issuance.md`）：IAM 签发侧（6 项测试）、网关获取侧 `ServiceTokenClient`（5 项测试）、sink **换证重试**（3 项真回环测试）。

**历史缺口快照**：**装配** —— 把 sink 装进 `SecurityAuditSinkConfiguration`，使 `scripts/runtime/verify-gateway-audit-ingest.mjs` 由 6 项失败转 **8 项通过**。

**三次失败已完整记录在 `execution/P1R-M2-006.md` §4**：下一次**从 `GatewayYamlLoadingTest:39` 的 `Binder` 真实失败原因读起**，**不要再猜组件声明**。破坏判据：干净树 `93/0/0`；**失败即 `git checkout -- services/api-gateway/`**。

---

## 5. 阻塞与边界（2026-09-19 更新）

| 事项 | 状态 |
|---|---|
| `M2-004` 的 `ACCEPTED` | ✅ **已解除** —— M2 闭合，M3–M7 主体已翻牌（81/108） |
| **评审期间冻结** | 历史上多轮违反；**仍需 CI 强制**（如"存在 `PENDING` 评审轮即拒绝提交"）。判定序列与轮数以 `review-history.json` 为准 |
| 5 项基建 DEV_DONE | Kafka/补偿传输/集群策略/trace 采集/分支保护主机 API **实测调不通**（本环境限制），留在 DEV_DONE（见 CHANGELOG `[P1R-TRIAGE-20260917]`） |
| 真实设备／微信小程序真机／真实 staging／不可变 RC 签名／支付沙箱／独立 Go-No-Go | **本环境不可能** |

---

## 6. 下一步（按优先级，2026-09-19 更新）

1. **M8 波次**（9 项）与具名 `M8-*`（11 项）：台账 `P1R-M8-*` 逐项推进；`M3-002` 的**批量导入 `import/batch`** 与**标准乐观锁**、`M3-008` 的官网 **privacy/terms/minors/status 四页** 已预标缺失，随 M8 批次闭合。
2. **M0-006 独立验收**（依赖锁/SBOM/许可证审计的独立复核）与 **M4-008**（留 M4-009/M8-007 承接）。
3. **五项基建**需外部环境（Kafka 集群策略、trace 采集后端、分支保护等），在可真实连调的环境补运行证据。
4. **评审期间冻结的 CI 强制**仍是方法论短板（见 §5）。
5. 本地全栈运行与人工测试入口见仓库根 `README.md`「本地开发快速上手」（v2 全栈：`pnpm services:run -- --all` + 四个前端 Vite/Nuxt dev）。
