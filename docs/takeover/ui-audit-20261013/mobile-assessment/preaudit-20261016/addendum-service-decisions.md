# MB006 窄补充：skip 实现与两项决策（2026-10-16）

仅只读补查源码/配置/具名测试与决策；没有运行浏览器、API、构建或测试，没有修改源、共享 i18n、保护文件、进程或 Git。本补充不重复前份哈希；源码存在及测试断言存在均不等于运行 PASS。补查官方额度末组五小时 49%/周 39%，普通使用允许，未用重置券。

## 1. canonical skip 有现行实现，不应按“仅契约”隐藏

- `services/assessment-service/src/main/java/com/englishflow/assessment/web/P1PlacementJdbcController.java:47–50,256–263`：实际 `@RestController` 挂 `/internal/v1/assessment/placement/baselines/skip`，事务入口，先要求精确 `assessment.placement.skip`，再校验幂等键。
- 同文件 `:264–296`：仅接受可选 `sessionId`、可选 `requestedStartingLevel{level,authority}`；level A1…C2，authority 必须 `USER_SELECTED_NON_AUTHORITATIVE`。已有 session 要核 owner；完成报告不能变成 skip。`:297–322` 实际幂等回放与 owner 条件更新；`:1072–1082` 回执为 `SKIPPED / USER_SKIP / UNVERIFIED`，明确不带 reportId 或 digest。
- PEP 为 `web/AssessmentHttpPrincipals.java:26–60`：已认证 JwtAuthenticationToken、非空 subject、platform tenant、learner role、精确权限、成人门 PASSED、同意 GRANTED；客户端不能靠自报身份/owner 放行。
- Gateway 也有正式公开接线：`services/api-gateway/src/main/java/com/englishflow/gateway/policy/GatewayRouteExecutionPolicy.java:605` 将 `POST /api/v1/assessment/placement/baselines/skip` 转上述 owner；`:607–610` 明确旧 B25 写口不转发，不能误用旧 `/placement/skip`。
- IAM 源中已有授予：`services/iam-service/src/main/resources/db/migration/V16__grant_canonical_placement_permissions_to_learners.sql:3–17`、`iam/domain/PasswordAccountService.java:35–43` 包含该精确权限。它们不证明当前用户 JWT 已获权限；仍由实际 IAM 与 PEP 判定。

**配置边界**：`assessment-service/src/main/resources/application.yml:55–70,83–89` 默认 phase-1；Resource Server 默认 true；controller 受通用 `assessment.persistence.enabled`（默认 false）装配约束；bank.enabled 默认 true。`config/AssessmentPersistenceConfiguration.java:99–125` 表明 bank=false 切回不可用源，未绑定已有 session 的 skip 会调用此 source（controller `:292–293,427–435`），失败应 503，不能假造基线。本次所读 controller/config **未发现 skip 独立关闭 flag 或 Phase 2 限定**；未读取运行环境取值，不能据默认 persistence=false 声称当前部署关闭，也不能据源码声称当前栈已可用。

**具名测试源码（本次未运行）**：

- `web/R1023PlacementSkipTest.java:91–123`：SKIPPED、无 report/digest/分数/Outbox，同键不重复建基线；`:125–157`：已收答案不丢失、skip 后作答 409；`:160–173`：已完成报告不可被 skip 改写。该类 `:40–45` 使用独立 H2 测试库。
- `web/P1PlacementJdbcControllerFlowTest.java:88–118`：UNVERIFIED、无维度成绩、同键同回执、同键异载荷/异命令 409。
- `web/P1PlacementJdbcControllerSafetyTest.java:36–52`：精确权限先于 owner storage；`:55–69`：缺授权发布题源时 create/skip 503、零 owner 写入。

上述 `web/`、`config/` 相对前述 assessment Java 主/测试根目录。不能把测试源码直接记录成“已通过”。

## 2. auto ensure 有已接受 ADR；反馈时点仍未决

**auto ensure 应保留**。`docs/10-decisions/0027-plan-wiring-pin-ensure-home.md:3` 标“已接受（Phase 1）”；`:11–14` 要求核验 ASSESSED 报告、由客户端定级完成后自动调用幂等 `POST /api/v1/learning/plans:ensure`，只传报告指针；`:23` 要求 P1 UI 获得后迁入前端。当前 store 的自动 ensure 有该明确依据。`redesign/interaction-chains.md:57`“生成我的计划”仍与触发语义有文案协调 GAP；本次未找到覆盖 ADR-0027 的新具名决定。不得仅为配文案改为点击后才生成，也不得把重测变成静默 replan。

**FULL/ZERO 的服务端事实与 UI 反馈时点分开**。`redesign/revision-notes.md:64` 仍记 DEC-04；`redesign/tasks/R1-021.md:182–184`、`tasks/R1-028.md:193–195` 要求 Assessment/Product/Contract owner 签收反馈时点和 learner-safe response 差量后才切换。原有即时对错继续按当前真实回执展示；不能因此次重排自行切成仅保存/结束讲评，也不能称 DEC-04 已签。`docs/takeover/LUNA-SIGNOFF.md:21` 的 IT-2 站级签收不单列该决策。本次搜索限定 `docs/10-decisions`、`docs/06-design/v2-980plus/redesign` 与其直接独立签收索引，未外推未读材料。

## 3. MB006 的具体建议

可以按已有 canonical skip 契约补最小 client/store 接线并单列实际验收，保留完整 IAM/PEP、owner 与幂等；不需要新开服务或修改关闭开关。引导保持“开始测评”为主，“快速开始”为有真实行为的次入口；若要求选起点，只提交真实用户选择及非权威 authority，未选不要伪造 A1。未知结果先读原 session/同键对账，不新建假报告。

特别注意：真实 skip 回执没有 reportId。不要为了复用现有报告展示而合成 reportId/digest/零分；应使用 SKIPPED 基线读态和可选自选起点。保守初始计划业务路径已获准（`revision-notes.md:63` 的 DEC-03 明写 FEAT-ONB-005/V2-980-0005，路径不再待选），但其具体 learning 输入/运行验收另按已有 owner 契约核实；不能把报告型 ASSESSED ensure 强套给 SKIPPED，也不能据尚无前端接线称业务路径被关闭。

正式报告继续当前自动 ensure 后的真实“查看今日状态”动作，ensure 尚未成功时诚实保留状态/错误，不伪装计划已创建。当前 FULL/ZERO 反馈、SKIPPED 非权威语义和重测后计划另行确认的边界继续保留。先完成真实接线、H5 状态/指针/键盘与 owner 回放，再签本页相应范围；本补充不签 UI 或运行能力。
