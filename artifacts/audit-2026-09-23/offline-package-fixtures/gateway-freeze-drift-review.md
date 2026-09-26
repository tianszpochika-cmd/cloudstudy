# Gateway 冻结门禁增量清单（只读，2026-09-23）

使用只读比较脚本 `scripts/audit/local_gateway_freeze_drift.py` 将当前共享工作树与冻结的提交 `86fbd8307199714727a3bceed51e983f401460b6` 对照。该提交同时满足 56 条规则、56 份 execution plan 和 170 个可执行操作。完整逐操作清单见 [gateway-freeze-drift.json](gateway-freeze-drift.json)。本次没有修改检查器的冻结计数、摘要或 IAM 删除旧断言。

## 当前 6 条检查器报错

| 报错 | 冻结 / 当前 | 来源与结论 |
| --- | --- | --- |
| routeRule count | 56 / 64 | 新增 8 条精确规则，见下表；其中 7 条管理学员规则来自此前代码，1 条离线 GET 是本次候选修复。 |
| public operation count | 365 / 393 | 新增 28 条公开操作；离线 GET 在冻结 OpenAPI 中已经存在，不增加公开操作。28 条为管理学员 7、管理恢复 7、管理内容 2、错题 3、内容替代 1、媒体 6、隐私导出 2。 |
| execution plan count | 56 / 64 | 每条新增规则增加一份 plan，静态数量对应；不等于运行通过。 |
| `iam-account-deletions` 旧不可用断言 | 原要求无投影 / 当前 3 条 | IAM 自助删除当前运行返回 503 并保持零写入；申请/取消的请求体、幂等和内部回执契约尚未对齐，旧断言不能无证据地删除。 |
| available operation count | 170 / 208 | 净增 38 条精确可执行投影，下面逐组列出。此前已有 37 条，本次离线 GET 增加 1 条。 |
| execution target digest | `0da3e568…` / `be8f2b52…` | 目标路径、owner、方法清单改变，摘要保护正常报警；待 38 条各自复核后统一重基线。 |

曾检出第 7 条 `canonical Gateway projection` 漂移；主任务已执行合并与生成，复跑确认 `canonicalProjectionMatches=true`，该项已消失。`contracts:merge:check`、`contracts:validate`、`contracts:generate:check` 由主任务报告通过。当前 public route 覆盖为 393/393，内部 62 条外部拒绝映射为 62/62。这只说明静态表完整；冻结 Gateway 检查仍为 **FAIL（上述 6 条）**，没有通过发布门禁。

## 新增 8 条路由

| 规则 | 精确方法与路径 | owner | 运行证据边界 |
| --- | --- | --- | --- |
| `admin-learner-search` | GET `/api/v1/admin/learners/search` | learner | 本轮已有授权检索 200/一条的局部记录，尚缺完整权限与过滤矩阵。 |
| `admin-learner-profile` | GET `/api/v1/admin/learners/{subjectId}/profile` | learner | 本轮合成资料 200 且页面打开；未覆盖跨账号/写操作。 |
| `admin-learner-commands` | POST `/api/v1/admin/learners/{subjectId}/commands` | learner | 未找到此精确操作的 Gateway→owner 正向/反向运行证据。 |
| `admin-learner-plans` | GET `/api/v1/admin/learners/{subjectId}/plans` | learning | 未找到此精确操作的 Gateway→owner 运行证据。 |
| `admin-learner-srs` | GET `/api/v1/admin/learners/{subjectId}/srs` | learning | 未找到此精确操作的 Gateway→owner 运行证据。 |
| `admin-learner-learning-commands` | POST `/api/v1/admin/learners/{subjectId}/learning-commands` | learning | 未找到此精确操作的 Gateway→owner 运行证据。 |
| `admin-learner-assessments` | GET `/api/v1/admin/learners/{subjectId}/assessments` | assessment | 未找到此精确操作的 Gateway→owner 运行证据。 |
| `sync-offline-packages-read` | GET `/api/v1/sync/offline-packages` | notification | 第十批本地 Gateway 实测新成人 200 空列表、匿名 401、未过成人 Gate 403；移动 Origin 的预检与 GET 凭据 CORS 头均通过。真实离线包下载仍缺。 |

前两条管理学员的局部证据在 [admin-gap.md](../../uat-2026-09-23/admin-gap.md)。离线 owner/旧 Gateway 证据在 [offline-package-owner-pre-gateway.json](../../uat-2026-09-23/offline-package-owner-pre-gateway.json)。七条管理学员规则已在此前 HEAD；本次任务只增加最后一条离线 GET 规则。

## 38 条新增可执行操作的来源与运行边界

| 规则组 | 数量 | 本轮证据与未闭合部分 |
| --- | ---: | --- |
| `admin-content` | 2 | 自动校验经 Gateway 有幂等/冲突运行证据；批量导入未找到精确运行证据。 |
| `admin-content-publish-tasks` | 1 | 详情 GET 经 Gateway→owner 200、401/403/404、MySQL 对照，14/14 PASS。 |
| `admin-learner-*` | 7 | 检索与资料读有局部 200；其余 5 条缺逐路由运行矩阵。 |
| `admin-recovery` | 7 | 工作流权限、Saga 读取/补偿失败关闭与幂等 22/22 运行检查；人工申请/批准/拒绝/执行及真正下游补偿没有全链正向通过。 |
| `assessment-domain` | 8 | 3 条错题操作缺逐条 Gateway 运行证据；5 条 P1 定级已实际验证匿名/准入/权限、缺正式题源时 503 零写入、未知 ID 404，完整十题→报告仍 BLOCKED。 |
| `content-domain` | 1 | 替代内容 GET 缺精确运行证据。 |
| `iam-account-deletions` | 3 | 真实申请链 503 失败关闭与零写入已验证；未满足完整申请、查询、取消契约。 |
| `media-domain` | 6 | 注册/字幕/重试的元数据幂等经 Gateway 运行；激活在无对象时 503 零写入；任务 GET 与上传 URL 正向、真实对象字节和播放未通过。 |
| `privacy-domain` | 2 | 导出工作流未验收，Web 申请按钮已禁用；不能将静态投影视为可用。 |
| `sync-offline-packages-read` | 1 | 第十批固定 18070 Gateway 已实测 owner 空列表、身份拒绝、移动凭据 CORS、五条写路径继续关闭；真实可下载包仍为 0。 |

分组求和 `2+1+7+7+8+1+3+6+2+1=38`。其中 28 条是冻结提交之后新增的 public OpenAPI 路径/方法；另 10 条是原公开操作从 withheld 转为精确投影：内容发布详情 1、P1 定级 5、IAM 删除 3、离线包 GET 1。逐条路径、Controller 文件和目标路径均在机器可读清单中。

离线 GET 的 B4 OpenAPI 片段目前仅显式列 `200`，没有列运行中实际发生的 `401/403` 和上游不可用时应有的 `503`。当前代码/运行证据不能证明这组错误响应契约完全一致；下一轮契约修订须明确错误响应，并验证 503 的真实状态与错误体。此项不计入上述冻结六项，也没有在本轮静默补写契约。

本轮证据分别见 [内容发布详情](../../uat-2026-09-23/admin-content-publish-task-live.md)、[工作流](../../uat-2026-09-23/batch7-workflow-runtime.md)、[P1 定级](../../uat-2026-09-23/p1-placement-live/report.md)、[IAM 删除](../../uat-2026-09-23/iam-account-deletion-runtime-batch8.md)、[媒体](../../uat-2026-09-23/batch6-runtime.md)、[隐私](../../uat-2026-09-23/learner-devices-privacy-live.md)。上述报告的状态不能汇总成 38/38 业务 PASS。
