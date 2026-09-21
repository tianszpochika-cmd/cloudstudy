# B4-03 目标类型收敛交付（TENANT-B4-03）

> 日期：2026-09-21。规划见 [B4-multilingual-plan](B4-multilingual-plan.md) §2 TENANT-B4-03。
> 状态：实现 + 契约 + 单测 + 管理前端完成；运行（真实 DB/网关/浏览器）与 P1R 验收未做，不改变任何 P1R 任务状态。

## 1. 做了什么

- **契约先行**（零新增路径；`b9-learner-admin` 只增枚举值/可选字段/策略允许项）：
  - `AdminLearnerCommandRequest.goalType` 加 `LANGUAGE_CERT`（描述注明 `CET_4_6` 为历史英语考试目标、`LANGUAGE_CERT` 为收敛的语言考试目标）；新增可选 `examName`（1..128）、`language`（BCP-47，2..16）；`SET_GOAL` 的 `x-command-field-policy` allowed 加二者（required 仍为 `goalType+dailyMinutes`）。
- **learner-service**（owner 不变）：
  - `GoalType` 加 `LANGUAGE_CERT`；`CET_4_6` 零行为改动（历史兼容：读写/双审/幂等/指纹全沿用）。
  - `LearningGoal` 加 `fields`（`examName/language`）：`LANGUAGE_CERT` 必须携带（考试名 1..128、语种 BCP-47 子集，否则 `INVALID_GOAL`）；其他类型携带考试字段即拒收（收敛，不让历史行被模糊）。
  - `LearnerAdminService.setGoal` 加 `examName/language` 入参（服务层先验：非 CERT 带考试输入直接拒，CERT 缺考试输入直接拒；指纹纳入考试字段防幂等串扰）；`LearnerAdminController` 透传并在 `goal` 投影回显 `fields`。
  - `JdbcLearnerProfileStore` 读写 `learner_goal.fields_json`（NULL/空读作空，老行兼容；`GoalRow/StoredGoal` 同步；幂等快照往返携带）。
  - `V11__goal_language_cert.sql`：加 nullable `fields_json` + `chk_learner_goal_type`（五值全集，含全部历史值）。
  - 学员自有 `PUT /targets` 保持历史四码（`LANGUAGE_CERT` 仍 `GOAL_CODE_UNSUPPORTED` 并指明走租户管理通道，老客户端零影响）；读侧如实透出类型名（未知码客户端按既有目录策略 fail-closed）。
  - 学员自有建目标（`DefaultLearnerProfileCommandService`）显式传空 fields；影子适配器沿用兼容构造。
- **管理前端**：360 页目标下拉加“语言证书（收敛新值）”（`CET_4_6` 标“历史兼容”），`LANGUAGE_CERT` 时显示考试名/语种输入并回显已存值；`learner-360.ts` 透传两字段（空串=未填，服务端按缺省处理）。
- **验证**：learner-service `59/0/0`（`LearnerAdminServiceTest 9/9`，含新增 CERT 建档/缺考试拒收×3/历史类型带考试字段拒收/CET→CERT 互操作；`LearnerDomainTest 8/8` 未动）；content 180、learning 142、assessment 57 全绿；admin-web `vue-tsc` + `vite build` 通过；合并 424 路由（仅 learner-admin 加值）；`validate-contracts` 唯一旧失败；`p1r-api-contract` 7/2（失败明细无 learner 项）；网关 63/393/202；`diff --check` + `stale-claims` PASS。

## 2. 三件套 Bingo 证据

| 变更 | 契约 | Java | DB |
|---|---|---|---|
| `LANGUAGE_CERT` | learner-admin `goalType` 枚举 + 策略 | `GoalType.LANGUAGE_CERT` + `parseGoalType`（`valueOf` 直通）+ 全链路 fields | V11 `chk_learner_goal_type` 五值 CHECK |
| 考试名/语种 fields | `examName`/`language` 可选字段 | `LearningGoal` 校验 + admin 服务/控制器/JDBC | V11 `fields_json` 列 |

## 3. 设计取舍

1. **fields_json nullable 而非 NOT NULL+默认值**：避开 MySQL JSON 表达式默认值的兼容风险；Java 空值即空 map，老行零迁移。
2. **非 CERT 类型禁带考试字段**：看起来严格，但这是“收敛”的含义——防止把 CET_4_6 行写成四不像；确需转 CERT 走一次代管 SET_GOAL（留痕）。
3. **学员自有 PUT 不开 CERT**：`b9-learner` 不在本批契约文件地图内，不擅自加码；CERT 的学员侧读写统一走 360° 代管（版本锁+审计），符合直营方向。
4. **V11 真实迁移演练未做**：同 V19/V20（集成门控），语句为 `ADD COLUMN + ADD CONSTRAINT` 常规模式，CHECK 值集覆盖全部历史值。

## 4. 未做（后续 B4 任务）

- 词性/形态机制（B4-04）；听写跟读种类（B4-05）；法语种子与德语 5 词（B4-07，用到 CERT 目标做学员验证时回看本任务）；网关重冻；P1R 状态变更。
