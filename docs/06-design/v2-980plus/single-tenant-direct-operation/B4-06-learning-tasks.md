# B4-06 学习任务类型扩展交付（TENANT-B4-06）

> 日期：2026-09-21。规划见 [B4-multilingual-plan](B4-multilingual-plan.md) §2 TENANT-B4-06。
> 状态：实现 + 单测完成；运行（真实 DB/网关/浏览器）与 P1R 验收未做，不改变任何 P1R 任务状态。

## 1. 做了什么

- **learning-service**（owner 不变；无契约变更——`LearningTaskType`/`LearningItemType` 无 fragment 覆盖，合并零漂移已验证）：
  - `LearningTaskType` 加 `LISTENING_DICTATION`、`SPEAKING_SHADOW`（与 content-service `DICTATION/SHADOWING` 行、assessment 听写/跟读判分配对）。
  - `LearningItemType.srsEligible()` 改为 `SRS_ELIGIBLE` 配置集判定：`{VOCAB, PHRASE, EXPRESSION, SENTENCE}`。`SENTENCE` 入选即法语句子可进 SRS（`SrsState`/`ReviewEvent`/`SubmitReviewCommand` 三处守卫自动放行，无需改调用方）。
  - 无 DB 迁移：`task_type` 为无 CHECK 的普通 `VARCHAR`（已核验全部 learning 迁移），`stage` CHECK 与任务/条目类型无关。
- **计划 UI 与管理端展示**：零改动——全四端无任务类型硬编码（仓库级 grep `VOCABULARY_REVIEW/GRAMMAR_PRACTICE` 零命中），学员计划页与 360° 计划 tab 均为泛型渲染，新任务自动展示；证据为 grep 空结果 + 本任务计划创建单测。
- **验证**：learning-service `146/0/0`（新增 `LearningMultilingualTasksTest 4/4`：双新任务进计划、法语句子进 SRS 到 LEARNING、历史资格不变、GRAMMAR 仍禁入）；content 188、learner 59、assessment 60 全绿；合并零漂移（424 路由）；`validate-contracts` 唯一旧失败；`p1r-api-contract` 7/2；网关 63/393/202；`diff --check` + `stale-claims` PASS。

## 2. 设计取舍（诚实记录）

1. **`SENTENCE` 全局开放而非按语言分支**：`SrsState`/`ReviewEvent` 等域对象无语言上下文，加语言参数要改三处守卫签名；`SRS_ELIGIBLE` 集合即规划要求的“配置化”，英语句子同步获益属加法（旧三类资格逐项断言未变），无旧链回退。
2. **无契约 diff**：任务/条目类型是 learning-service 内部域枚举，对外经计划/SRS 投影透名；`b9-learner` 的 `B9TaskRef.taskType` 是另一轴（首日任务），不相交——如实记录“零契约变更”而非硬凑。
3. **无前端改动**：同上，泛型渲染已覆盖；为两个枚举加前端常量表属无效 churn，不做。

## 3. 未做（后续 B4 任务）

- 法语种子与德语 5 词（B4-07，可直接组含听说任务的计划）；判分本地化（B4-08）；网关重冻；P1R 状态变更。
