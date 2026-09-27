# ADR-0027: 计划接线 pin 语义、ensure 触发与 home 投影归属

> 日期：2026-09-27；状态：已接受（Phase 1）；关联：目标“计划接线”。

## 背景

`LearnerTargetPort` 的快照要求 `contentVersionId`（目标→内容的 pin），但 learner 的目标模型（V1/V4/B25）从未存储该字段；`LearningPlanService.createPlan` 的域逻辑完整，却因两个端口 fail-closed 而无 HTTP 触发口；learner 的 home/first-day 永为 `NOT_READY`（缺 learning 输入）。

## 决定

1. **目标 pin 语义 = 定级完成自动 pin 定级内容**。定级（P1 placement）完成后，verified 报告中的 content pin 被写回 learner 目标行（`pinned_content_version_id/epoch`，NULL=未 pin）。写回由 learner 自己的内部端点执行（owner 写），learning 只转发核验过的值。
2. **pin 是咨询式缓存，不是信任根**。`plans:ensure` 每次重验报告（owner、ASSESSED、target 版本一致），目标内容变化（改目标）清 pin（profile store 写目标即清），pin 与报告不一致则 409。
3. **触发 = 客户端在定级完成后自动调 `POST /api/v1/learning/plans:ensure`（幂等）**，不另起 Kafka saga。Saga 待事件中继落地后替换调用方，不改变 pin 语义。body 只带报告指针，其余全服务端派生。
4. **home 读 learning 投影**。learner-home 保持页面形状 owner，计划事实（planningInput/plan/tasks）由 learning 内部视图原样嵌入；learning 不可达/无计划时诚实 NOT_READY（placement 阻塞），不伪造 READY，不断 home 200。
5. **planningInput 字段映射**（学习侧组装，全部有主）：
   - 目标/画像/偏好版本号、时区、locale、天数、quota、targetId/Version：读 learner 活数据；`weeklyStudyDays` 无偏好时取 owner 默认每日（`[1..7]`，文档化默认值）；
   - `goalCatalogVersion=p1-goal-catalog-v1`（冻结 P1 目标集标识）、`planningRuleVersion=P1_PLAN_ASSEMBLY_V1`（学习侧冻结装配规则）；
   - `rightsSnapshotVersion` ≡ 被 pin 内容版本的 `state_version`；`eligibilitySnapshotVersion=1` + digest = 已验 JWT 资格事实的观察快照（观察模式 v1）；
   - `sourceEventId/rootEventId` 由 placement session 稳定派生（首次完成即根），存下即不可变；
   - `pinId/pinVersion/pinDigest/inputFactWatermark` 由 pin 字段稳定派生。
6. **任务排期规则**：bank 按展示序每 3 题一天（15 分钟 quota 约 3 题），首日任务进 today；后续 quota 自适应列入后续项。
7. **B10 会话 `snapshot_id`（BIGINT）装不下 `snap_` 字符串**：B10 会话以 bank contentVersionId 承载 + 全量 hash 存 `snapshot_hash`，身份不丢失（B3 轮已立规矩，本轮沿用）。
8. **P1 UI 本期无 dedicated 定级页**：ensure 由 API 消费方在定级完成后自动调用；B25 两题旧入口不动；P1 获 UI 后再把调用点迁入前端（本轮 E2E 即消费方）。

## 后果

- 新增内部操作 3 个（learner pin 写、content plan-items、learning current-view），公共操作 1 个（ensure）；网关只投影 ensure。
- learner 目标表 +2 列、偏好表 +1 列（V12，可空向前兼容）；learning 新增输入快照表（V10）。
- learner 首个跨服务 HTTP 读（learning 视图），JWT 转发，失败开 NOT_READY。
