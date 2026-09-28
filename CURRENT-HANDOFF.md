# CURRENT-HANDOFF —— 语学星 Phase 1 重基线（P1R）

> 本文件是**跨会话交接**的入口，记录"当前在哪、下一步做什么、谁在等谁"。
> 最后更新：**2026-09-28（口径同步）**：补入两套 56 页台账的并列说明，不改变任何行级判定；测试结论本身仍以 2026-09-26 14:46 CST 的[接手报告](artifacts/uat-2026-09-26/README.md)和[56 项覆盖台账](artifacts/uat-2026-09-23/coverage-ledger.md)为准，代理侧三态复核另见[56 PAGE-P1 三态总表](docs/07-operations/page-push-ledger-2026-09-26.md)；P1R 任务状态仍以编号任务台账为准。历史完整度源码检查绑定 `2c2cfa2e`，详见[完整度梳理日志](requirements/backlog/v2-phase1-rebaseline/execution/COMPLETENESS-AUDIT-2026-09-20.md)。
> **§0 顶部与 §6 的 2026-09-26 接手顺序是当前交接；其余带日期的记录均保留原验证范围，不作为当前环境全绿结论。**

---

## 0. 检查点

**2026-09-26 四端测试接手**：[完整接手报告](artifacts/uat-2026-09-26/README.md)已汇总环境、正向证据、失败和下一轮顺序。当前工作区源码在本机以 16 个 Java 主机进程和四个前端开发服务供测试；14:46 CST 只读复核确认 Gateway/IAM、四端固定入口在监听，5 个基础设施容器 healthy。旧私有 UAT 的 26 个容器已停止，不能沿用 9 月 25 日 Batch24 的 19/19 健康结论描述当前环境。Chromium 已实测合成成人账号 Web 注册/登录/首次设置与 Mobile H5 登录，但学习首页 `503 STORE_FAILURE`；登录态阅读列表遭 Gateway 预检 403、普通 GET 404，技能相关路由也有同类断路。管理端本轮只测登录页。本报告（严格整页业务验收）口径下，最近完整 56 项 PAGE-P1 台账仍 **PASS 0 / PARTIAL 29 / BLOCKED 27 / NOT_TESTED 0**，整页验收完成 0/56；不能把检查覆盖 56/56 或局部登录成功折算为业务完成。**并列口径（2026-09-28 同步）**：另一套[56 PAGE-P1 三态总表](docs/07-operations/page-push-ledger-2026-09-26.md)（代理侧复核，v10，证据根 `evidence/live/2026-09-26` 至 `2026-09-28`）为 **PASS 40 / HONEST-EMPTY 16 / BLOCKED 0**，其 PASS 判据是"关键动作+落库+恢复均有本轮证据"、设计性空态可判 HONEST-EMPTY，与本报告的隔离环境整页闭环不是同一判定规则，**两组数字不可互相换算、互不替代，也不得单方面引用其中一组代表整体页面状态**；行级 canonical 状态变更权归 QA。证据见[本机交接](artifacts/uat-2026-09-26/local-latest-runtime/operational-handoff.md)、[登录冒烟](artifacts/uat-2026-09-26/local-latest-runtime/login-smoke/summary.md)和[阅读诊断](artifacts/uat-2026-09-26/local-latest-runtime/reading-diagnosis/summary.md)。

**本机真实运行验证（2026-09-22，T1–T21）+ 与三端 UI 交付合并**：在真实 MySQL/Redis/Kafka/MinIO + 固定端口服务上把 21 项本地可做任务逐项跑通并修复。**关键结论：运行测试抓出 17 项静态门禁与内存单测都抓不到的缺陷**（403 被伪装成 400、契约版本字段被忽略、分页跨页丢行、定时批次中断、假 APPLIED 补偿、真实 MySQL `event_name` 列缺失等），全部已修并复验。新打通两条此前没有运行证据的链路：**content outbox → Kafka**、**learning outbox → Kafka → gamification 结算**。详见[本机真实运行验证](docs/07-operations/local-runtime-verification-2026-09-21.md)。**注意与下方 UI 记录的口径差异**：下方管理端记录写"真实 Gateway 本轮不可达"，那是 UI 那一轮的环境；本轮 6 个服务（IAM/网关/learner/content/learning/assessment）连同 audit/workflow/social/notification/gamification 都在本地起过并跑通真实链路。P1R 台账状态、manifest、证据绑定**均未改动**；未闭合项（M1014 具名残留、content 入站消费者断言、learner-web 完整首日旅程、`contracts:validate` 的 IAM 旧失败）逐条列在验证快照 §4。

**本轮与 UI 交付的合并（2026-09-22）**：`origin/dev` 的前端统一交付（`2e373f96`）与本轮 T1–T21 在同一批前端文件上分叉，22 个冲突文件已全部解决——管理端 view/组件取新 UI，数据层 i18n（api/store/auth）保留，`AdminLearnerView` 重新接回契约包络；学习端保留本轮的 offline 分支与登出导航修复。**T12 的 admin-web 全量抽取被 UI 交付取代**（同一目标改走共享包 `@englishflow/i18n/admin-experience`）。合并后需 `pnpm install`（新 UI 新增 workspace 依赖 `@englishflow/performance`）。

**三端 UI 统一提交（2026-09-22）**：用户已授权将工作区 `admin-web`、`learner-web`、`mobile` 及相关共享包、资源、测试与文档一并提交至 `origin/dev`。范围分别为管理端 14 页、Web 学习端 35 个页面组件、移动端 31 个注册页面。见[统一交付、验证和下一步](docs/06-design/v2-980plus/frontend-ui-delivery-2026-09-22.md)。共享类型检查、管理端与学习端构建、移动端类型检查及 28/5/40 项定向回归完成复核；此前共享 i18n 重复键阻断已关闭。原 UI 浏览器证据保留合成数据边界，不升级 P1R 状态或业务 UAT。语学星本地后端当前未启动，下一步应在独立环境联调，不影响启达容器；此次不部署。

**移动端 UI（2026-09-22）**：官网风格覆盖当前 31 页、登录/注册/重置、学习练习、成长与个人服务；H5 固定 18183。类型、生产构建、40 项回归、155 组布局/主题与 14 类交互检查通过，详见[移动端记录](docs/06-design/v2-980plus/mobile-experience-2026-09-22/README.md)。浏览器使用受控接口数据，真实 IAM、领域写入与原生真机未验收。

**Web 学习端 UI 改造（2026-09-22）**：按已批准官网风格更新 `apps/learner-web` 现有 35 个页面组件，覆盖当前 29 个路由组件及兼容页。真实入口固定 18180；开发环境的 `design-review.html?theme=dark#/home` 使用相同组件和明确标注的示例数据供视觉审阅。类型、构建、28 项定向测试通过，31 个入口三档宽度及主题/导航/世界分栏等局部交互完成检查。详见[页面清单、截图、验证与未关闭范围](docs/06-design/v2-980plus/learner-experience-2026-09-22/README.md)。并行期间出现的 learner-experience 文案重复键已修复，共享 design-tokens/i18n 类型检查重新通过；这不替代其他端自己的最终复核。后端业务未联验，不改变 P1R 状态；现已按用户授权纳入三端统一交付，范围见本节上方记录。

**管理端 UI/UX（2026-09-22）**：官网风格已实施到 `apps/admin-web` 现有 14 页，覆盖登录、导航、业务表单与手机布局；正式入口 `http://127.0.0.1:18181/login`。构建、25 项浏览器检查、168 组布局、2 个编辑器保护场景、15 组文字对比度通过。真实 Gateway 本轮不可达，截图使用浏览器独立合成数据；当时并行学习端 i18n 文件的重复属性曾导致全包复核失败，统一提交前已确认修复并重新通过。详见[实现与剩余边界](docs/06-design/v2-980plus/admin-experience-2026-09-22/README.md)及[全页截图](docs/06-design/v2-980plus/admin-experience-2026-09-22/index.html)。不修改 P1R 状态，不覆盖并行 learner-web/mobile 源码，不自动部署。

**官网正式前端实现（2026-09-21）**：用户已批准将提案 06 落入 `apps/official-site`。现已更新十四类页面、十九个公开内容地址、免费入口、手机导航、学习空间/角色墙/拼句、双主题与动效控制，本地固定 18182 运行。见[实现日志与验证](docs/06-design/v2-980plus/official-site-experience-proposal-2026-09-21/implementation/README.md)。18185 仍是原型；下方“未改正式应用”是之前原型轮次的范围，不描述当前官网。官网构建、类型与 UI 检查通过；公开后端当前不可用，未执行注册/学习业务验收，P1R 状态不变。

**官网 UI/UX 提案（2026-09-21）**：[官网提案 06](docs/06-design/v2-980plus/official-site-experience-proposal-2026-09-21/README.md)。按用户要求，以初期免费、第一阶段功能、简短介绍和手机访问为重点，覆盖十四类公开页面；本轮修正页脚遮挡，新增规则拼句、2D/立体空间、角色墙与动效控制；共享预览 18185 的 `/official/`，原移动稿仍在根路径。设计与内容承接见提案说明；未改动正式应用、商业权益或 P1R 状态。

**本轮 UI/UX 交付入口（2026-09-20）**：[设计、统计与恢复说明](docs/06-design/v2-980plus/mobile-experience-proposal-2026-09-20/DELIVERY-2026-09-20.md)。当前最新版是提案 04：同十个手机界面重排操作路径、统一图标插画，支持撤销续学、薄弱词巩固、一键专注/暂停与拼句即时反馈；保留现有深紫白字和双主题。详见[第四轮修订与后端承接](docs/06-design/v2-980plus/mobile-experience-proposal-2026-09-20/EXPERIENCE-V4-2026-09-20.md)。四端规划仍约 165 个主要界面，倍数估算继续绑定提案 03 深度。尚未开展正式前端重写，不改变下方 P1R 状态；旧紫红尝试不作为当前配色。

> **本表不写会随每次提交变化的值。** 它此前写着 `HEAD` 与轮次，两处都在几天内过期，而**陈旧的交接文档会被当作现状读** —— 这正是它要防的毛病。要得到当下值，跑下面的命令；**不要把这些数字抄回本文档**。

```bash
git rev-parse --short HEAD          # 当前提交
git status --porcelain              # 空即为 clean
git rev-list --count origin/dev..HEAD   # 领先 origin 多少（推送后应为 0）
```

| 项 | 值（缓慢变化，或附取得方式） |
|---|---|
| 计划进度 | **81/108 ACCEPTED = 75%**（M0 7/8、M1 18/18、M2 5/10、M3 9/10、M4 7/10、M5 11/14、M6 11/11、M7 8/11、M8 5/16；其余 27 项为 `DEV_DONE`，状态以 [02-编号任务台账](requirements/backlog/v2-phase1-rebaseline/02-编号任务台账.md) 为准） |
| 27 项 DEV_DONE 的去向 | 09-17 分诊按 11 个 M8-*、9 个 M8 波次、5 项基建、M0-006、M4-008 分类；09-20 审计确认仍包含实现和复验工作，不能概括为只差外部环境或本地队列清空。具体承接与关闭条件见梳理日志 §4 |
| `P1R-M0-006` | `DEV_DONE` —— 留独立验收（BOM/version catalog/依赖锁/SBOM；资产验证列已标 `已验-可用`） |
| `P1R-M2-004` | **`ACCEPTED`**（2026-09-14 前后多轮 REWORK 后闭合；历史见 §2 与 `evidence/p1r/m2/P1R-M2-004/manifest.json`） |
| 后续工作入口 | 台账无 `PLANNED/READY` 不代表无工作可做；在既有 P1R owner 范围修复契约、跨服务链路与证据漂移，再推进未闭合的 M8 验收。部分 ACCEPTED 任务也保留具名残留，本次不改变状态 |

**当前判断**：Phase 1 主体功能与服务基础已形成，任务验收比例为 75%；当前源码契约检查失败，补偿、口语入口与跨服务隐私处理等仍有实际缺口。尚未取得完整 D4/D5 证据，不能判定发布 GO；先修复当前基线与链路，再完成 M8 和独立验收。

---

## 1. 本次源码审计检查（2026-09-20，基线 `2c2cfa2e`）

| 命令 | 期望 | 本次结果 |
|---|---|---|
| `node scripts/audit/p1r-evidence-gate.mjs --json` | PASS | 180 秒未完成后停止，无最终报告，不判 PASS |
| `node scripts/audit/verify-phase1-rebaseline-plan.mjs` | PASS | PASS，108 项、81/27 |
| `node scripts/dev/run-node-tests.mjs tests/p1r` | 全部通过 | 未完成，至少 2 项失败；最后输出到第 180 项，不是 180 项通过 |
| `node scripts/audit/p1r-stale-claims-check.mjs` | PASS | PASS，1395 files；不保证语义一致 |
| `node scripts/audit/doc-audit.mjs` | PASS | PASS，0 死链、52 孤儿文档提示 |
| `node scripts/audit/p1r-gateway-contract-check.mjs` | PASS | FAIL，18 条错误 |
| `node scripts/contracts/validate-contracts.mjs` | PASS | FAIL，账号删除接口缺少幂等声明 |
| Java 25 Gateway 测试、全栈与浏览器 | 适用范围全部通过 | 本轮未执行，历史测试数不能继承 |

**工具链**：项目要求 Node 20.19.5、Java 25；本次当前会话 Node 为 20.19.5（nvm4w），默认 Java 为 21、Maven 为 3.9.12。Java 检查/启动前须选择实际存在的 Java 25 并运行工具链诊断。旧会话的 Administrator Node 路径、DSH pnpm 和 JDK 路径属于机器快照，不能直接当作本机配置。

**证据绑定**：按 Git HEAD blob 复核确认 18 个任务的 19 条摘要引用漂移，涉及 3 个文件。修复源码并完成适用回归/复核后再更新绑定，不能仅刷新摘要。详细方法见梳理日志 §5。

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

## 5. 阻塞与边界（2026-09-20 历史审计；最新测试见 §0 和 §6）

| 事项 | 状态 |
|---|---|
| `M2-004` 的 `ACCEPTED` | 该任务已验收；不等于 M2 整体闭合，M2 尚有 5 项 DEV_DONE |
| **评审期间冻结** | 历史上多轮违反；**仍需 CI 强制**（如"存在 `PENDING` 评审轮即拒绝提交"）。判定序列与轮数以 `review-history.json` 为准 |
| 契约与证据基线 | 当前契约检查失败、摘要绑定有漂移；完整 P1R 与 Evidence Gate 未取得本次通过结论 |
| 补偿与跨服务处理 | M2-006 缺真实 owner 补偿调用并有成功状态误记风险；M6-007/008 manifest 留有跨 owner 导出/匿名化 worker 缺口，不能统一归为环境限制 |
| 口语入口 | M5-005 证据仍注明网关 owner 冲突与服务直连验证；需按架构确定 owner 并完成正常入口链路 |
| 事件、集群、观测与 CI | 原分诊保留作线索；本轮未全面复验各 owner transport 或主机 API，需区分缺实现和缺外部运行证据 |
| 真机、staging、容灾、制品与独立 Go/No-Go | 本轮未验证，需对应环境与独立验收；不能把某会话不可用写成永久不可能 |

---

## 6. 测试接手顺序（2026-09-26）

1. 从[9 月 26 日接手报告](artifacts/uat-2026-09-26/README.md)进入，先核对当前源码、固定端口、服务健康和数据源；保留工作区已有未提交改动与私有数据卷。9 月 25 日私有容器报告是历史环境证据，不代表当前源码已容器化复验。
2. 在合法本地合成成人登录态复现首页 `503 STORE_FAILURE`，追踪确认目标、learning owner 的计划引用及 learner 首页投影；以真实任务事实复测，不能补假 READY/任务。
3. 按契约与 owner 边界处理阅读、语法练习/掌握度、写作提示、听力素材的 Gateway 路由和预检拒绝；重建 Gateway 后在浏览器登录态复测 GET/OPTIONS、错误提示与服务侧鉴权。[阅读诊断](artifacts/uat-2026-09-26/local-latest-runtime/reading-diagnosis/summary.md)给出 9 条路径及源码定位。
4. 继续首日目标→canonical 定级→计划/今日→可信内容/判分/复习/报告，并单独验证管理授权、双审发布、官网投影及跨端读回。正式文书、版权、审核员及题源缺事实时保持阻断；原生 App/iPad/小程序另列环境。
5. 对每项修复记录页面、请求、Gateway、owner 持久化、失败恢复与跨端证据，再更新[PAGE-P1 台账](artifacts/uat-2026-09-23/coverage-ledger.md)的具体行和判定。构建、健康、HTTP 200 或局部测试不能直接升 PASS；P1R 状态另走任务台账与 Evidence Gate。

### 2026-09-22 历史计划（保留当时范围）

1. 在现有任务范围修复契约/路由/生成物不一致，复跑失败用例及适用回归，再补完整 Evidence Gate；按验证结果更新证据绑定。**已知剩余契约失败 1 条**：`POST /api/v1/iam/account-deletions` 缺 `x-idempotency` 声明（旧失败，非本轮引入）。
2. **（2026-09-22 收窄）** 真实补偿已改为「无 transport 即 `COMPENSATION_FAILED`」不再假成功，owner 真调用仍待接；事件处理已打通 content→Kafka 与 learning→Kafka→gamification 两条链路。**仍未闭合**：M1014 载荷缺 `rootEventId`/`contentPin`/`rulePin.ruleDigest`（需内容快照事实）、content 入站消费者 `cg.content-from-iam.v1` 无端到端断言、口语正常入口、跨服务导出/匿名化。
3. 完成当前源码跨端业务闭环及异常路径，再推进 M8 真机、性能、安全、staging、容灾、回滚、制品和独立 Go/No-Go；保留 M0-006 独立验收及 M4-008 具名残留。
4. **（2026-09-22 已复核，结论修正）** 官网 privacy/terms/minors/status 四页源码存在**且本轮已运行验收**（12 页 200、零控制台错误）。批量导入 `import/batch` 行为已实际复核：逐行隔离、非对象条目计入 failed、批量 UPSERT 已接版本锁；**但 content 写侧乐观锁仍是「调用方观测值检查 + 存储盲写」**，不是存储层 CAS，并发竞态属 M3-002 本体改造，不能沿用「已复核=已解决」的读法。
5. 评审期间源码冻结与真实 CI 阻断仍需验证。本地启动入口见根 README；启动前核对工具链、固定端口、进程和资源归属，保护既有工作与其他项目运行环境。**本机 Maven 会吃掉带点号的 `-D` 键**（如 `-Dlearning.relay.integration=true` 会被当成生命周期阶段），opt-in 集成测试请改用 `JAVA_TOOL_OPTIONS` 或环境变量。**拉取新增依赖的提交后必须 `pnpm install`**（本次 UI 交付引入 `@englishflow/performance`，否则 admin-web 类型检查报 TS2307）。

---

## 7. 本次状态记录（2026-09-28，环境让步，两步走已定）

> 本节只记交接事实，不改任何 PASS/PARTIAL/BLOCKED 行级判定，不替代 QA 终审。

* **HEAD**：`ca8509e1e`（`dev`，与 `origin/dev` 同步）。工作区有 6 个已改未提交文档（`CHANGELOG/CURRENT-HANDOFF/README` + `artifacts/uat-2026-09-23/README` + `artifacts/uat-2026-09-26/README` + `docs/07-operations/README`），内容是 `LEDGER-CALIBER-SYNC-20260928` 两套 56 页台账口径并列说明；`B4-multilingual-plan.md` 仍按既有决议保留本地未跟踪，不纳入本次提交。
* **本机环境（2026-09-28 实测，冷态）**：Java 进程 0 个；`18070/18080/18087/18180-18183/13306/16379/19000-19001` 全 CLOSED（`pnpm ports:check` 全 FREE）；Docker Desktop 未启动，MySQL/Redis/Kafka/MinIO 均不可达；默认 Node v24.9.0（项目要 20.19.5，nvm 已有）、默认 Java 21（项目要 25，`C:\Program Files\Java\jdk-25` 已有）。**第一步/第二步本地可做，但必须先烧环境，不能直接修。**
* **门禁快照**：`doc-audit` PASS（死链 0、孤儿 58 为信息项）；`p1r-stale-claims-check` PASS（1860 files）。两套台账数字仍并列：严格口径 `PASS 0 / PARTIAL 29 / BLOCKED 27`，代理侧 v10 `PASS 40 / HONEST-EMPTY 16 / BLOCKED 0`，不可互换。
* **用户决策**：第一步（修首页 503 + 阅读/写作 403/404）与第二步（本地可闭环收口：词汇正典、听力练题口、离线下载、客服原文等）可立即执行；第三步（线上环境 + 第三方法务/版权/支付/推送资源）暂时无法提供，先冻结。计划是**本地能测的全验收通过 → 发线上 → 再补需线上环境的功能**。用户曾选“直接覆盖老判定”，**本次未执行**（canonical 变更权归 QA，直接翻 PASS 会造假账并触发门禁告警）；合规做法是加注对照 + 逐行重跑取证 + QA 签字，已留待下轮。
* **换电脑接手**：切到 `dev` 并 `git pull`；`nvm use 20.19.5`、`JAVA_HOME` 指到 `jdk-25`；启动 Docker Desktop 等 infra healthy；`pnpm install`（有 `@englishflow/performance` 新增依赖）；`pnpm ports:check` 全 FREE 才能起 16 后端 + 4 前端；按 §6 顺序先复现首页 503 与阅读诊断 9 条路径。

---

## 8. test 发版成功（2026-09-28，clyunedev，`af4ea883`）

> 服务器实测：旧版 `5c5dc319`（9-21）→ 本轮 `af4ea883`；只记事实，不改行级判定。

* **基线**：23 容器 Up 7 天但 tag 混杂（`7b754b74`/`193567ff`/`5c5dc3191a48`）；14 个 owner schema 全在但**无一有 `p1r_schema_history`**（Flyway 时代库）；全库约 170 行测试数；`RELEASE_TAG=5c5dc3191a48`；备份 `/srv/cloudstudy/backup-2026-09-28-0539.sql.gz`（874K）+ 运行留底已存。
* **执行**：`git fetch/checkout af4ea883` → `RELEASE_TAG=af4ea883` → 补 `SOCIAL_MODERATION_CURSOR_KEY`/`ADMIN_OPS_AUDIT_CURSOR_KEY`（各 32 字节，只存服务器 env）→ `config --quiet` OK → `--verify` 被拦（learner 无 p1r 账本，符合预期）→ 确认 170 行可丢 → 开双门 → **删 14 个业务库重建** → 装 Node 20.19.2（脚本 prerequisite）→ `deploy-full.sh` 全自动重建成功 → 双门关回 false。
* **验收**：19 个应用容器全 `af4ea883`；13 个外部 owner `p1r_schema_history` 齐（content 27 / learning 11 / learner 12 / notif 8 / adminops 6，IAM Flyway 18）；网关 UP、JWKS 出 RSA key、官网 200。
* **待办（Phase 4）**：种子脚本全锁 `127.0.0.1:13306`，需 `--target=test` 适配补丁（待备）；5 个 test 号（2 学员 + 1 只读 + 2 审核）待建，注册保持关闭走服务端直写；旧镜像 7 个 tag 暂不清，等新版跑稳按“最多留两个”清理。
* **2026-09-28 04:16 UTC 后续**：浏览器注册 503 定性为缺已发布同意文档（`iam.consent.version_unavailable`，设计门非故障；网关日志 `ConnectException` 只是 OTLP 无 collector 噪音）。已发布 5 类 **test 专用**同意文档（`test-doc-v1/test-policy-v1`，绝不充当正式法务文档），直调网关注冊 201 取 token 成功（`probe2@test.invalid`，learner 角），test 注册链路开通；公网 503 待浏览器复验。下一步：批量建 5 个号（成人 gate + 三同意）→ 种子适配补丁 → 造数。
* **2026-09-28 04:30 UTC，5 个 test 号建成**：`t-learner-01/02`（learner 全套 canonical 权限，门 APPROVED + 三同意 GRANTED）、`t-staff-ro`（`admin.projection.read,audit.read,support.ticket.read`）、`t-reviewer-l1`（`+content.edit,review.l1`）、`t-reviewer-l2`（`+review.l2,publish`）。成人门走 DB 批（等同本地自证，`b30-adult-v1`）；幂等键须 16~128 字符，`Idempotency-Key` 头大小写不敏感；占位号已清理。密码只存 test 机 env/操作记录，不进 Git。待办：种子（题库/B3/词汇/目录）→ 首日旅程验证。
* **UX 债（用户 2026-09-28 提出）**：成人门未过时整页 403 卡死、无友好提示，看着像服务器错误。应改为提交后放行进入系统（学习能力置灰提示“身份确认中”），服务端批后再解锁；前端把 `trusted_age_required` 翻成人话。后端 fail-closed 不变，只加等待态。记入 `PAGE-P1-ADULT-CONSENT` 后续。
* **前端写死同意版本（2026-09-28 test 实测）**：`apps/learner-web/src/api/learner-content.ts` 的 `saveOnboarding` 把三同意的 `version` 写死为 `b30-consent-v1`；test 机发布的是 `test-doc-v1` 时直接 409 版本冲突。已在 test 机追加发布 `b30-consent-v1`（test 档 digest）解围。正式修法：前端先读已发布版本再提交，不写死。记入 `PAGE-P1-AUTH-REGISTER-RESET`/`ONB-GOAL` 后续。
* **2026-09-28 test 开荒结论（重要）：`af4ea883` 部署成功、业务验收未通过，严格台账保持 0/56。** 当日工作： consent 5 类 test 文档发布 → 注册 201（幂等键须 16~128 字符）→ 6 个号（2 学员 + 3 staff + 1 种子号 + 用户 Gmail 号，门全 APPROVED、三同意 GRANTED）→ 种子（题库 10、B3 绑定 5、词汇 747、目录 6；world 种子因通知表 V8 改列失败未跑）→ 浏览器注册/登录/目标保存通。三个具名缺陷：①前端调旧 B25 开题口，新库无 `course-b25-basics` 规则，**任何新装环境定级全死**（旧数据盖住了）；②前端写死 `b30-consent-v1`；③成人门无自助通道（只能 DB 批）。方法论教训：代理侧 40 PASS 全是在长期脏库（陈年种子/B25 规则/旧同意文档）上跑的，从没在干净部署上验证过，等于只证了代码路，没证部署物；以后 E2E 必须绑定干净库重放。world 种子与 B25 规则待修后再补。
