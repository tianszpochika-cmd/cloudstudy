# Gateway 冻结基线核对（2026-09-25）

## 已核实的边界

最后一致且可复现的 M2-001 Gateway 冻结快照是提交 `86fbd830`：56 条规则、56 个执行计划、153 个投影、170 个可用操作、365 个公开操作，执行目标摘要 `0da3e568fac7394dda30eda71e0e1b23b4414ebf581208d23e9e82eb271cb4d7`。主 Agent 对该提交与当前 fragment 重新计数，分别得到 **56/56/153** 与 **66/66/193**。后续 M2 runtime revalidation 清单未纳入 Gateway fragment/checker，不能作为这些新增路由获准的证据。

当前共享 fragment 为 66 条规则、66 个计划、193 个投影、210 个可用操作、393 个公开操作；相对冻结值为 +10/+10/+40/+40/+28。全量冻结检查未通过。不能仅改常量或摘要把当前表整体宣称合格，也不能将源码路由、匿名 401 或服务健康当成业务验收。

## 待逐项促升

| 路由族 | 已有证据 | 仍需核验 |
| --- | --- | --- |
| B3 精确 `GET /api/v1/grammar/points` | Bearer、content owner、`content.read`、精确转发和 owner PEP 的专项测试已通过；契约合并与生成检查通过。 | 可申请**单独的路由边界例外**，须以 `86fbd830` 为基线提交只含本路由的差量和审查记录。owner 的 legacy 查询仍用 `AND 1 = 0` 关闭，不能计为语法内容可用。 |
| 正式定级 5 个投影 | Assessment owner/controller 与 Gateway 路径有对应测试。 | 当前仅配置 `UnavailableP1PlacementSourcePort`，缺获授权十题快照与来源 pin，创建会 503；正向定级/报告不放行。 |
| 管理学员 360 的 7 条规则 | 有 owner controller 与 HIGH_RISK_ADMIN 分类。 | 各操作的权限、租户/主体范围、幂等、审计、Gateway 精确转发与授权正反例证据不完整。 |
| 举报队列 GET | 有只读 controller、Gateway 结构及拒绝测试。 | cursor key、安全管理员正向分页、租户隔离和私有运行证据；处置 POST 继续关闭。 |
| 离线包 GET | 有 owner 与 Gateway 只读结构。 | principal/device/tenant 范围、真实 manifest/字节、下载地址与授权运行；写路径另审。 |
| 冻结后较早的 24 个投影及 publish-task detail | 来源覆盖 admin-content、admin-recovery、IAM 删除、privacy、content、assessment mistakes、media。 | 逐路由补 owner/权限、幂等/审计、失败恢复和运行证据；不得以家族整体状态或清除 unavailable 原因代替。 |

每个促升操作需要一行可追溯记录：`编号、来源提交、method/path、rule/plan/projection、owner/controller、权限和服务 PEP、读写与幂等审计、正向/拒绝测试、运行证据、剩余关闭条件、审查结论`。B3 可以先做受控例外审查；这不解除其他 Gateway 漂移，也不授权重建/部署全量 Gateway 镜像。

本次核对未修改 Gateway checker、路由 fragment 或运行容器。相关 B3 契约记录见[语法点只读促升](../../requirements/backlog/v2-phase1-rebaseline/execution/PROMOTION-B3-GRAMMAR-POINTS-READ.md)。
