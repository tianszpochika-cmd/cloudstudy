# 文档体系审计报告

> 审计日期：2026-09-10
> 审计对象：仓库全部 Markdown 文档（458 个，不含 `node_modules`）
> 审计依据：`docs/00-vision/document-governance.md`（v2.3，文档治理规则）
> 审计方式：全量静态扫描 + 官方检查器复跑，未修改任何被审文档

## 一、结论摘要

| 维度 | 结果 |
|---|---|
| 官方 DoD 检查器 `scripts/check-dod.mjs` | **PASS（5/5，0 warn / 0 fail）** |
| 内部链接有效性 | **PASS（1486 个内部链接，0 死链）** |
| 编码/乱码 | **PASS（0 处替换字符）** |
| 结构一致性 | **FAIL：发现 9 项问题**（1 高 / 5 中 / 3 低） |

整体判断：**文档的"链接与编码"质量优秀，"结构与状态一致性"存在需要修复的问题。** 官方检查器不覆盖目录索引、命名规范、状态计数一致性，因此这些是本次审计的增量发现。

## 二、不合格项清单

### 高优先级

**H-1｜计划入口文档状态计数过期，与台账矛盾**

- 文件：`requirements/backlog/v2-phase1-rebaseline/README.md` 第 5 行
- 该文写：`25 ACCEPTED（M0 7 项、M1 18 项）、1 项 BLOCKED、0 项 IN_PROGRESS、其余 82 项为 PLANNED`
- 台账 `02-编号任务台账.md` 写：`25 ACCEPTED / 1 BLOCKED / 2 IN_PROGRESS / 80 PLANNED`
- 事实（本次核查 HEAD `80fdffd`）：`2 IN_PROGRESS / 80 PLANNED`
- 影响：该 README 是 `AGENTS.md` 第 1 句指定、`document-governance.md` 第 1 节第 8 优先级指定的**"当前唯一新开发计划和状态入口"**。入口文档的状态停留在 M2 尚未开始的口径，会误导恢复决策。
- 建议：把该行改为与台账一致的 `2 IN_PROGRESS / 80 PLANNED`，或改为"实时状态以台账为唯一事实源"并删除硬编码计数。

### 中优先级

**M-1｜`docs/` 根目录没有 README / index，整个文档树缺总入口**

- 事实：`docs/` 目录下不存在 `README.md` 也不存在 `index.md`，而其下含 192 个文档、22 个子目录。
- 影响：`README.md` 第 9 行只以文字列出少数入口，无法覆盖 `00-vision` 至 `technical-specs` 的完整结构；新读者无法从目录层建立地图。
- 建议：新增 `docs/README.md`，按 `00-vision → 01-research → … → technical-specs` 给出各目录一句话定位与其 `README` 链接。

**M-2｜16 个 `docs/` 子目录缺 `README.md`**

缺失清单：

```
docs/00-vision           docs/06-design/phase-2
docs/01-research         docs/06-design/phase-3
docs/02-architecture     docs/06-design/shared
docs/03-ai               docs/08-compliance
docs/04-content          docs/09-roadmap
docs/05-api              docs/technical-specs/modules
docs/06-design/phase-1/assets
docs/06-design/phase-1/full-coverage
docs/06-design/phase-1/uiux-specs
```

其中 `02-architecture`、`09-roadmap`、`technical-specs/modules` 属于治理规则里被显式引用的基线目录，缺索引的影响更大。

**M-3｜ADR 废弃处理标准不一致，导致编号断档与决策历史丢失**

- 事实：`docs/10-decisions/README.md` 明确声明"**ADR-0001 与 ADR-0004 不删除，保留用于解释 `core-api` 的迁移来源**"，且二者均为 superseded 状态、文件均保留。
- 但 `ADR-0002-mobile-tauri-first.md` 与 `ADR-0003-core-api-nestjs-first.md` 同为 superseded，**文件已被物理删除**（git 历史可见，后被 ADR-0004/0005 取代）。
- 后果：编号序列出现 `0001 → 0004` 断档；"为什么放弃 Tauri 优先、为什么放弃 NestJS 优先"的决策依据只能翻 git 历史获得。
- 建议：二选一并统一口径 —— ① 恢复 0002/0003 文件并在头部标注 `Superseded by ADR-0004 / ADR-0005`；或在 ② `docs/10-decisions/README.md` 中显式登记"0002/0003 已归档移除"及原因，消除断档疑问。

**M-4｜两套命名体系并行，且在 `docs/06-design/` 内部混用**

统计（`docs/` + `requirements/` 共 251 个 md）：

| 命名风格 | 数量 |
|---|---|
| 纯英文 kebab-case | 106 |
| 含中文 | 94 |
| 含大写字母（多为 `P1R-M*-*` 编号式，合规） | 50 |
| 含下划线 | 1 |

中文命名集中分布：

```
docs/06-design/phase-1/uiux-specs          25
docs/06-design/v2-980plus                  13
docs/06-design/detailed-specs               9
docs/technical-specs/modules                8
docs/06-design/v2-980plus/phase1-business-operation  8
docs/06-design/traceability                 6
requirements/backlog                        9
```

典型不合规样本：

- `docs/06-design/detailed-specs/01_Onboarding与自适应首屏详细设计.md`（序号+下划线+中英混排）
- `docs/06-design/phase-1/FIGMA_移动端UIUX_工作交接记录_2026-08-20.md`（全大写段+下划线+中文+日期）

问题不在"用中文"本身，而在**同一目录树内并存两套规则且无成文约定**。治理文件未定义文件命名规范，属于规范空白。

**M-5｜索引文件命名不统一（唯一孤例）**

- 全仓索引文件共 13 个，其中 12 个为标准 `README.md`。
- 唯一例外：`docs/06-design/phase-1/uiux-specs/00_README_设计文档索引.md`。
- 该目录因此被"缺 README"检测判为缺失（实际有索引，只是名字不同），同时 `00_` 前缀与排序约定也未在规范中登记。

### 低优先级

**L-1｜`CONTRIBUTING.md` 未指向文档治理规则**

- 现内容仅 5 条通用约定，未提及 `docs/00-vision/document-governance.md`、`scripts/check-dod.mjs` 或文档命名要求。
- 新人按 `CONTRIBUTING.md` 入门时，拿不到文档规范入口。

**L-2｜`docs/07-operations/` 的历史快照未被索引**

- 该目录 26 个 `*-validation.md` 快照中，`README.md` 只显式索引了 `b36-validation.md`。
- 其 README 已声明"快照保持可审计、不为追随新口径而改写"，属于**有意为之**；但读者无法从入口看到快照全集。
- 建议：在 README 追加一节"历史快照清单（按日期/批次）"，仅列文件名，不改写内容。

**L-3｜台账以代码形式索引任务卡，不可点击跳转**

- `02-编号任务台账.md` 使用 `` `P1R-M0-001` `` 代码格式而非 Markdown 链接引用 `execution/P1R-M0-001.md`。
- 影响：32 个任务卡在静态扫描中呈现为"无入链"，人工导航需手动拼接路径。

## 三、做得好的方面（应保持）

- **链接质量优秀**：1486 个内部链接全部有效，0 死链；治理文件以代码形式引用的 ~20 个路径也全部真实存在。
- **零乱码**：未发现 UTF-8 替换字符或编码污染。
- **官方门禁通过**：`scripts/check-dod.mjs` 5/5 PASS（必需文档 28 个、契约/迁移/测试目录 5 个、固定端口 42 个服务、真实密钥扫描、治理标记 12 个）。
- **CHANGELOG 规范且诚实**：每条含任务 ID、验证命令、未覆盖边界，明确标注 `NOT_RUNTIME_VERIFIED`，不以历史结果冒充当前结论。
- **事实源优先级清晰**：治理文件定义了 8 级优先级与各自维护边界，冲突解释规则明确。
- **ADR 状态标注完善**：索引逐条标注 `accepted / superseded`，并给出取代关系链接。

## 四、修复建议优先级

| 顺序 | 事项 | 成本 | 收益 |
|---:|---|---|---|
| 1 | 修 H-1（README 状态计数） | 极低 | 消除入口级事实矛盾 |
| 2 | 补 M-1（`docs/README.md`） | 低 | 建立文档树总入口，带动 M-2 |
| 3 | 定 M-4（补命名规范条文） | 低 | 先立规则，再谈存量整改 |
| 4 | 定 M-3（ADR 废弃口径） | 低 | 补齐决策历史、消除断档 |
| 5 | 补 M-2（16 个目录 README） | 中 | 覆盖各层索引 |
| 6 | 修 M-5 / L-1 / L-2 / L-3 | 低 | 一致性收口 |

## 五、M-4 存量命名整改（2026-09-10）

**结论：实际规模远小于初判。**

初判「94 个中文 vs 106 个英文混用」属**误读**——复查 14 个「混用目录」后发现，其中 **12 个的唯一英文文件就是 `README.md`**（索引文件，规范本就要求此命名）。真正违规的只有 3 个文件。

**已整改（`git mv` 保留历史 + 同步全部引用）：**

| 原名 | 新名 | 引用同步 |
|---|---|---|
| `docs/06-design/phase-1/LOCAL_HTML_UIUX_WORK_LOG_2026-08-21.md` | `local-html-uiux-work-log-2026-08-21.md` | 1 处 |
| `docs/06-design/phase-1/uiux-specs/SOURCE.md` | `source.md` | 2 处（含 `verify-full-design-coverage.mjs`） |
| `docs/06-design/phase-1/FIGMA_移动端UIUX_工作交接记录_2026-08-20.md` | `figma-mobile-uiux-handoff-2026-08-20.md` | 1 处 |

**豁免（2 个文件，不予整改）：**

- `requirements/语学星_PRD_v3.3_记忆与掌握闭环增强版.md`
- `docs/06-design/phase-1/语学星_Phase1_UIUX设计总册_v1.0.md`

**豁免理由（重要）**：这两个文件均被 `evidence/p1r/m1/P1R-M1-012/manifest.json` 的 **`artifactDigests`（路径 + 内容哈希，共 58 条）** 锁定。**重命名会使该证据的路径失效，直接破坏证据链**——这也是「全局 Evidence Gate FAIL」的成因之一。依据治理规则「存量文档渐进整改，不得在无关联改动中批量重命名，以免破坏跨文档链接」，予以豁免。

**结论**：M-4 的存量整改已实质收敛——**违规项从"94 个"修正为 3 个，且全部处理完毕**；剩余 2 个属被证据锁定的合法豁免。

## 六、审计工具固化（2026-09-10）

`tmp/` 下的一次性审计脚本已固化为正式检查器：

- **`scripts/audit/doc-audit.mjs`** —— 检查死链、孤儿文档、缺 README 目录（只读）。
- 命令：`pnpm docs:audit`（人读）/ `pnpm docs:audit:json`（机器消费）。
- 范围约定：索引与入链要求**仅适用于 `docs/` `requirements/` `evidence/`**；代码目录不要求 README。`evidence/**` 由 `manifest.json` 索引，豁免 README 要求。
- 当前结果：**PASS**（死链 0、缺 README 目录 0；孤儿 42 项为提示性信息，不作为失败条件）。

本次审计使用两个一次性脚本（位于 `tmp/`，未纳入版本控制）：

- `tmp/doc-audit.mjs`：内部链接有效性扫描。
- `tmp/doc-orphan.mjs`：入链分析（用于识别无入口文档）。

两者均为只读，可作为后续 CI 化候选（建议固化到 `scripts/audit/` 并接入 `pnpm dod:check` 的补充检查）。注意：入链分析会把手写 Markdown 链接以外的索引机制（如 `evidence/**/manifest.json`、台账代码式 ID 引用）判为"无入链"，解读结果时须按此口径校正。

## 七、修复执行记录（2026-09-10）

### 已修复

| 编号 | 修复内容 |
|---|---|
| H-1 | `v2-phase1-rebaseline/README.md` 状态计数改为 `2 IN_PROGRESS / 80 PLANNED`，与台账一致，并注明"以台账为唯一事实源" |
| M-1 | 新增 `docs/README.md` 作为文档树总入口（12 个顶层目录定位 + 按任务阅读路径） |
| M-2 | 为缺索引的目录补建 `README.md`；资源类目录按实际内容说明用途 |
| M-3 | 从 git 恢复 `0002-mobile-tauri-first.md`、`0003-core-api-nestjs-first.md`，并在 ADR 索引登记 superseded；编号恢复连续 |
| M-4 | `document-governance.md` 升版 v2.4，新增第 6 节「文档文件命名规范」 |
| M-5 | `uiux-specs/00_README_设计文档索引.md` 重命名为 `README.md`（`git mv` 保留历史），同步修正全部引用 |
| L-1 | `CONTRIBUTING.md` 新增「文档与交付规范」，指向治理规则、DoD 门禁与台账 |
| L-2 | `docs/07-operations/README.md` 新增「历史快照清单」，列出该目录全部文件 |

### 判定更正：L-3 撤回

原判定建议把台账中的代码式任务 ID 改为 Markdown 链接。经核实这是**错误建议**：

`scripts/audit/verify-phase1-rebaseline-plan.mjs` 第 77 行使用硬编码正则 `/^\|\s*`(P1R-M\d-\d{3})`\s*\|/` 解析台账，要求每行以代码式 ID 开头。改为链接会导致计划门禁脚本直接报错。台账的代码式 ID 属**机器解析契约**，是有意设计，**不得修改**。

### 验证结果

| 检查 | 修复前 | 修复后 |
|---|---|---|
| 内部链接死链 | 0 / 1486 | **0 / 1623** |
| 缺 `README.md` 的 docs 目录 | 16 | **0** |
| ADR 编号连续性 | 断档（缺 0002/0003） | **0001–0014 连续** |
| `scripts/check-dod.mjs` | PASS 5/5 | **PASS 5/5（未回归）** |
| `verify-phase1-rebaseline-plan.mjs` | 25 / 1 / 2 / 80 | **25 / 1 / 2 / 80（未回归）** |

修复过程中曾引入 2 处新死链（相对路径算错与漏改引用），已在验证阶段定位并修正。

### 仍待处理

无。本轮审计发现的 9 项已全部处理完毕：

- 8 项修复（H-1、M-1、M-2、M-3、M-4、M-5、L-1、L-2）
- 1 项判定撤回（L-3：台账代码式 ID 属机器解析契约，不得改为链接）
- M-4 存量命名整改已收敛（实际违规 3 个文件，已全部整改；另 2 个属证据链锁定的合法豁免）

## 八、核查更正：310 个「待细化签收」单元无需在本轮处理

审计期间曾提出「需细化 310 个低成熟度设计单元」。**经核查，该建议不成立，予以更正。**

| 项 | 事实 |
|---|---|
| 待细化签收单元总数 | 310 |
| **Phase 分布** | **Phase 2：160 个　·　Phase 3：150 个** |
| **Phase 1（当前范围）** | **0 个** |
| 编号前缀 | `V2-EXT-P2-*` / `V2-EXT-P3-*`（无 `V2-EXT-P1-*`） |

**依据：**

1. `AGENTS.md` 明确：Phase 1 仅面向 18 岁以上成人与大学生；**AI 能力仅在 Phase 2 启用；K12 / 未成年人仅在 Phase 3 完成专项合规后开放**。
2. `docs/06-design/v2-980plus/README.md` 明确：待细化签收行是「已登记在 v2 范围内的**透明占位**；**不得进入实现排期、接口发布或默认路由**」。
3. 同文件强调：`184 + 486 + 310 = 980` 只说明登记行的覆盖与成熟度分布，**不等于「980 个功能已完成」或「980 份详细设计可直接开发」**。

**结论：本轮文档梳理无需细化这 310 个单元。** 其细化时机是启动 Phase 2 / Phase 3 时，按 `V2-EXT-*` 签收流程处理。
