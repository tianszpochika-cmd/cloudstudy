# Gateway 冻结契约检查逐项核查（2026-09-23 16:28 CST）

## 当前快照与判定边界

16:28 CST 只读执行 `node scripts/audit/p1r-gateway-contract-check.mjs`，原始完整输出见 [`gateway-contract-check-current.json`](gateway-contract-check-current.json)，当时为 **15 项失败**，早期记录中的“14 项”是旧快照。随后主任务为检查器补上已存在于 Java/配置的 `workflow-service → gateway.workflow.workflow-base-url` 映射；[第一次复跑](gateway-contract-check-after-uri-fix.json)消除了七条假 URI 报错。内容发布任务详情 [14 项真实运行检查](admin-content-publish-task-live.md)和工作流 [22 项运行检查](batch7-workflow-runtime.md)提供了两条原“必须不可用”断言的正向/边界证据，因此再从旧列表移除这两条。[当前输出](gateway-contract-check-after-route-evidence.json)余 **6 项失败**：五项冻结范围/摘要待复核、一项 IAM 删除真实契约缺口。冻结常数、Gateway/owner 路由与契约未因检查器修正改变；未重启或打包。

| 计数 | 检查器冻结值 | 当前值 |
| --- | ---: | ---: |
| route rule / execution plan | 56 / 56 | 63 / 63 |
| 公开 operation | 365 | 393 |
| 精确 execution projection | 153（冻结时期） | 190 |
| 被 projection 覆盖的公开 operation | 170 | 207 |
| 未开放的公开 operation | 195（冻结时期） | 186 |

当前契约的公开覆盖为 **393/393**，`canonicalProjectionMatches=true`，内部操作外部拒绝映射为 **62/62**。这些是静态一致性结果，不证明 207 条接口都能完成业务。冻结常数和 `0da3e568…` 摘要与仓库的 `86fbd830` 版本一致；该版本为 56 条规则、365 个公开操作、153 个 projection。现在新增了七条规则、28 个公开操作及 37 个精确 projection，均为相对该版本的新增项，没有删除旧 projection。七条新规则全部属于 `admin-learner-*`；28 个公开操作按来源为管理学员 7、管理恢复 7、管理内容 2、assessment 错题 3、content 替代 1、media 6、privacy export 2。冻结保护发挥了应有作用：新范围尚未经过同一基线的独立复核，不能直接改数字让检查变绿。

## 初始 15 项逐项分类

类别：**F**＝冻结范围扩展待复核；**S**＝旧“必须不可用”列表与后续精确投影不一致；**C**＝检查器 owner URI 表漏项。行号与顺序和当前 JSON 完全一致。

| # | 报错简写 | 类别 | 当前证据与判断 |
| ---: | --- | :---: | --- |
| 1 | routeRule 必须 56 | F | 当前 63；新增七个 `admin-learner-*` 精确 owner 规则。不是“漏配七个 owner”，也不能仅改常数。 |
| 2 | public operation 365→393 | F | 相比 `86fbd830` 新增 28 个公开操作，未见删除；当前全部有唯一最高优先级 route rule。需复核每个新增 operation 的 owner、权限和默认拒绝。 |
| 3 | execution plan 必须 56 | F | 63 条规则各有一份 plan，覆盖完整；冻结计数尚未重基线。 |
| 4 | `admin-content-publish-tasks` 必须不可用 | S | 现有精确 GET 投影到 content owner 的 `B9ContentAdminController.getScheduledTask`；Gateway Java 定义相同 rewrite。静态映射已存在，但未找到这条 GET 的正向 Gateway/owner 本人权限运行证据，暂不能称发布任务查询已验收。 |
| 5 | `admin-recovery` 必须不可用 | S | 七条精确 workflow 投影、owner Controller 路径及 Java Gateway rewrite 已存在；本地 Saga/人工恢复权限与幂等边界有 [22/22 运行证据](batch7-workflow-runtime.md)。真实下游补偿 transport 仍失败关闭，不是完整恢复业务通过。 |
| 6 | `admin-recovery.recovery-request` URI | C | 契约写 `gateway.workflow.workflow-base-url`，Java owner URI 映射及 `application.yml` 已使用同名配置；只有 JS 检查器的 `EXECUTION_URI_CONFIG_BY_OWNER` 没有 `workflow-service`。 |
| 7 | `admin-recovery.recovery-approve` URI | C | 与 #6 同一缺失映射；本条 POST 的内部 Controller 方法存在。 |
| 8 | `admin-recovery.recovery-reject` URI | C | 与 #6 同一缺失映射；本条 POST 的内部 Controller 方法存在。 |
| 9 | `admin-recovery.recovery-execute` URI | C | 与 #6 同一缺失映射；本条 POST 的内部 Controller 方法存在。 |
| 10 | `admin-recovery.sagas-unfinished` URI | C | 与 #6 同一缺失映射；本条 GET 的内部 Controller 方法存在。 |
| 11 | `admin-recovery.saga-detail` URI | C | 与 #6 同一缺失映射；本条 GET 的内部 Controller 方法存在。 |
| 12 | `admin-recovery.saga-compensate` URI | C | 与 #6 同一缺失映射；本条 POST 的内部 Controller 方法存在，入口同键重放已测；真实补偿仍失败关闭。 |
| 13 | `iam-account-deletions` 必须不可用 | S＋真实缺口 | 三条公开精确路由与 IAM Controller 存在，故旧“零投影”断言过期；但 [M1-017 契约](../../packages/contracts/fragments/m1-017-privacy-lifecycle.openapi.json)要求申请必填 body、同键异摘要 409、202，现 Controller 忽略可选 body、仅按 key 重放并默认 200；取消未使用键做重放。内部 owner receipt/recovery 契约是 POST，Controller 只有 GET。不能把 route 可达当删除全周期完成。 |
| 14 | available operation 170→207 | F | 相比冻结版多 37 个精确 projection，对应 207 个静态可匹配操作；正向运行、owner PEP、数据语义未逐个通过。 |
| 15 | execution target digest 漂移 | F | 当前 `60e83e09…` 与冻结 `0da3e568…` 不同，和上面 37 个新增 projection 一致。摘要必须在审阅路线清单与独立复审后更新，不能自动把新值复制进检查器。 |

关键源码位置：检查器常数、不可用列表和 URI 映射在 [`p1r-gateway-contract-check.mjs`](../../scripts/audit/p1r-gateway-contract-check.mjs) 顶部，三条规则的现行投影在 [`p1r-gateway-boundary.openapi.json`](../../packages/contracts/fragments/p1r-gateway-boundary.openapi.json) 的 `admin-content-publish-tasks`、`admin-recovery`、`iam-account-deletions` 段；Java owner URI 与七条恢复 rewrite 在 [`GatewayRouteExecutionPolicy.java`](../../services/api-gateway/src/main/java/com/englishflow/gateway/policy/GatewayRouteExecutionPolicy.java)，配置默认值在 [`application.yml`](../../services/api-gateway/src/main/resources/application.yml)。内容发布任务读取、工作流恢复/Saga 与 IAM 删除的 Controller 分别位于 `B9ContentAdminController.java`、`ManualRecoveryController.java` / `SagaController.java`、`IamAccountDeletionController.java`。

## 可安全修复的最小顺序

1. **检查器事实漏项已修。** `EXECUTION_URI_CONFIG_BY_OWNER` 现含 `workflow-service → gateway.workflow.workflow-base-url`，七条 URI 报错消失；保留对错误 URI 的负向断言。这不扩大路由。
2. **两个旧不可用断言已按运行证据移除。** content 发布任务 GET 有匿名/无权/不存在/正向 task 的 Gateway→owner 矩阵；workflow 有请求权限、Saga 读取、同键冲突及真实 transport 失败关闭证据。IAM 删除仍未符合 request/cancel 与内部 POST 契约，保留该项失败，不能仅删除旧断言。
3. **以当前 63/393/190/207 清单重新签收冻结目标。** 校核新增 7 条规则、28 个 operation、37 个 projection 的 owner、方法、路径、权限、Controller 与默认拒绝，运行必要正反例后再更新 56/365/170 常数、冻结摘要和 `tests/p1r/p1r-gateway-contract.test.mjs` 的 summary 断言。保留对未知路径和无精确 projection 的失败关闭检查。
4. `pnpm contracts:merge:check`、`contracts:validate`、`contracts:generate:check` 当前已由主任务另有通过证据；这三门与 Gateway 冻结检查分别跑。Gateway 静态门变绿后仍需按四端真实业务链单独验收。

边界：本次没有为 37 个新增 projection 逐一做 HTTP 正向运行，也没有新建 IAM 删除请求；因此只认定上述报错的来源和安全修复顺序，**不将静态 route `AVAILABLE` 升级为完整业务 PASS**。
