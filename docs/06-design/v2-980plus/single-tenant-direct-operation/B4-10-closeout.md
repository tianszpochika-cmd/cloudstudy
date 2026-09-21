# B4-10 契约/门禁/文档收尾交付（TENANT-B4-10）

> 日期：2026-09-21。规划见 [B4-multilingual-plan](B4-multilingual-plan.md) §2 TENANT-B4-10。
> 状态：全量回归 + 门禁 diff + 文档收尾完成；运行（真实 DB/网关/浏览器）与 P1R 验收未做，不改变任何 P1R 任务状态。

## 1. 全量回归（§4 命令，2026-09-21 实跑）

> 推送前复验（同日第二轮，结论一致）：四服务 59/191/146/63 零失败；合并 424 零漂移；
> `validate-contracts` 唯一旧失败（IAM）；`p1r-api-contract` 7/2（失败明细含 B4 关键词零命中）；
> 网关 63/393/202；`stale-claims` PASS（1431 files）；`diff --check` 干净；
> admin-web `vue-tsc` + `vite build` 通过；i18n `test` 7/7 + `typecheck` 通过。

| 门 | 结果 | 基线对照 |
|---|---|---|
| `mvn ... test`（四服务） | learner 59、content 191、learning 146、assessment 63，**零失败** | B4 前基线 content 161+，其余全绿；只增不减 |
| `merge --write` | 28 fragments / 424 routes / 192 events，**零漂移** | B3 翻转后基数 424；B4 新增 OpenAPI 路径 **0** |
| `validate-contracts` | 唯一失败 `POST /api/v1/iam/account-deletions needs x-idempotency` | IAM 域旧失败，B4 零触碰 |
| `p1r-api-contract` | 9 tests：7 通过 / 2 失败，明细 21 条 | 与 B3 基线逐条一致；无 learner/content 新增项 |
| `gateway-contract-check` | 22 条 | B3 重冻包内（63/393/202 + publish-tasks 翻转 + recovery/iam/M1-017）；**零新增实现类错误** |
| `git diff --check` | 干净 | — |
| `stale-claims-check` | PASS（1430 files） | — |
| admin-web `vue-tsc` + `vite build` | 通过 | B4-01/02/03/04/05/09 有前端改动，均已逐任务验证 |
| i18n `test` + `typecheck` | 7/7 + 通过 | B4-09 新增 |

## 2. 门禁 diff 报告（B4 系列总账）

- **计数类**：合并路由 417（B1 基数）→ 424（B3 翻转 +7），B4 全程 424 不变；网关三数 63/393/202 全程不变；契约门禁 21 条、网关 22 条逐任务复核无新增。
- **实现类错误**：零新增（22 条网关失败与 21 条契约失败的每一条都落在 B3 已记录的冻结/旧失败集合内，无 `lexeme/language/accent/meaningLocal/pos/morphology/kind/dictation/shadowing/task/srs/goal/scoring/locale` 相关项）。
- **冻结文件**：`git diff ce97000d..HEAD` 共 66 文件；`scripts/`、`requirements/`、`*EXPECTED_*`、`p1r-gateway-boundary`、网关 Java、manifest、P1R 台账——**零触碰**（已逐项核验，见 §4）。

## 3. 三件套 Bingo 总证据

| 任务 | 变更 | 契约 | Java | DB |
|---|---|---|---|---|
| B4-01 | `lexeme.language` | upsert/record `language` + list 参数 | `Lexeme` 字段+校验+三仓储 | V19 加列/索引/默认 |
| B4-01 | `accent` 开锁 | input/record 开放字符串 | 开放 tag 校验 | V19 扩列+DROP CHECK |
| B4-01 | `meaningLocal` | sense 字段 + required 收敛 | 取其一校验 | 无（fields 内） |
| B4-03 | `LANGUAGE_CERT` | admin 枚举+字段+策略 | `GoalType` + fields + 全链路 | V11 列+CHECK |
| B4-04 | 词性 +8 | upsert/sense 枚举 | `POS` 白名单 | 无（fields 内，设计如此） |
| B4-04 | 形态四字段 | input/record 可选字段 | 合法性+法语必填 | 无（fields 内，设计如此） |
| B4-05 | 新 kinds | upsert/record/`itemKind` 三枚举 | `KINDS`+前缀+映射 | V21 CHECK 重发 |
| B4-05 | `QuestionType` | 不适用（旧轴冻结） | 枚举+判分支 | 不适用（无 CHECK） |
| B4-02/06/07/08/09 | 音素域/任务类型/种子/归一化/骨架 | 零变更（内部域/数据/函数/包） | 对应实现+单测 | V20 种子（数据行） |

DB 腿“无变更”项（B4-04 形态、B4-05 评估侧、B4-06 任务类型、B4-08 归一化）均为“字段在 JSON 内 / 无 CHECK 约束”的有意设计，各交付文档 §2/§3 均有核验记录（迁移目录零命中），非遗漏。

## 4. 冻结核验明细

- `git diff ce97000d..HEAD --name-only -- scripts/ requirements/` → 空。
- 同上 `--name-only | grep EXPECTED|p1r-gateway-boundary|manifest|gateway|Gateway|P1R` → 空（`packages/contracts/openapi/v1/openapi.json` 的变更仅为两 b9 fragment 合并输出；`p1r-gateway-boundary` 未动）。
- 契约文件地图遵守情况：仅 `b9-content`、`b9-learner-admin` 两个 fragment 有改动；网关路径新增 0（B4-02 管理端音标页复用既有 learner 通道，B4-09 切换器纯前端，均有文档记录）。
- P1R 台账状态、manifest、证据绑定：未动。生产秘密：未碰。音频字节：从未进入 content-service（发音行/判分均为引用或占位 ID）。

## 5. 系列交付索引

B4-01 语言缎带 → `B4-01-language-ribbon.md`；B4-02 音标分语言 → `B4-02-phonetics-language.md`；
B4-03 目标收敛 → `B4-03-goal-convergence.md`；B4-04 词性形态 → `B4-04-pos-morphology.md`（+ `B4/tags-taxonomy.md`、`B4/lexeme-fields-spec.md`）；
B4-05 种类扩展 → `B4-05-item-kinds.md`；B4-06 任务类型 → `B4-06-learning-tasks.md`；
B4-07 种子包 → `B4-07-seed-packs.md`；B4-08 判分本地化 → `B4-08-scoring-locale.md`；
B4-09 语言包骨架 → `B4-09-i18n-skeleton.md`；本任务 → 本文档。

## 6. 未做（审批后事项，需独立复核/运行环境）

- B3 网关重冻包（含本系列复用的 63/393/202 基数）待独立方复核后重冻——任何一方不得自行改 `EXPECTED_*`。
- 真实 MySQL 迁移演练（V19/V20/V21/V11 四个迁移文件均为集成门控外手写复核）、Gateway→owner 真实链路、浏览器八态、Kafka 投递与学员侧消费应用。
- P1R 状态变更（本系列 9 个提交均未触碰）。
