# 后续 Epic 任务卡（2026-09-26，待产品拍板）

> 两份卡都已做 Spike，只差产品决策即可开工。不改 P1R-108 台账编号，新任务另起编号。

## EPIC-B3：技能页迁正典端点

**现状** [实测]：5技能页（词汇/语法/阅读/听力/写作）调 B3 旧读，权利门+`1=0`开关守着，列表恒空但诚实；正典目录/详情可承载学习（6条 DEMO-P5 在线）。

**要定的产品决策**：
1. 哪些正典 kind 投影到 B3 形状（VOCABULARY/GRAMMAR/READING/LISTENING/WRITING 的字段映射）；
2. 题目/答案隔离线：B3 读是否可带 options（当前投影策略禁答案规则，练习判分走 B10）；
3. 存量 B3 表是迁移还是冻结（`1=0` 去留）。

**建议范围**：前端 b10 store 加正典 fallback（B3 空时读正典详情并适配 blocks/questions），后端不动；每技能页截图+落库对证。
**契约改动**：无（复用已有正典操作）。
**验收**：5技能页有内容可学；B3旧读保持关闭；回归全绿。
**估算**：3–5 轮。**依赖**：上述3个决策。

## EPIC-PLAN：计划写链接通

**现状** [实测]：`LearningPlanService.createPlan` 域逻辑完整，但 `LearnerTargetPort`/`PublishedContentPort` 仅接 fail-closed 实现，无 HTTP 触发口；读侧（today/plan/srs）已用 B25 行验证通过。

**要定的产品决策**：
1. 计划触发点：定级完成自动建（Saga）还是用户点“生成计划”；
2. 跨服务读方式：learning 直调 learner/content 内部接口（需新内部契约）还是事件投影；
3. home READY 组合：learner 是否读 learning 投影（owner边界决策，需 ADR）。

**建议范围**：端口适配器 + `POST /api/v1/learning/plans:ensure`（幂等）+ 网关投影 + 契约（OpenAPI 内外部操作数需同步重基线）+ E2E。
**验收**：定级完成→计划行落库→today 有任务→home 展示计划引用；旧 B25 读不受影响。
**估算**：2–4 轮（含契约门禁重跑）。**依赖**：上述3个决策；M4-007 域测试已绿可复用。

## 另两项（已立项，本轮不展开）

* 正典十题定级：题库 pin+entitlement 待定（见演示文档§19）。
* 发布流送审门：权利激活+报告绑定缺失（M3，见§6）。
