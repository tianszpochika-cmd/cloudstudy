# 契约校验门禁与 IAM 账号删除漂移（2026-09-23）

> **16:40 CST 当前状态：** B26 Saga 补偿已落服务端持久请求幂等并经 Gateway/owner 复测；内容自动校验与媒体注册/重试/字幕的同键重放另见[第五、六批记录](batch6-runtime.md)。媒体上传地址现严格标记为无成功路径的失败关闭操作，不能伪作上传幂等成功。[媒体专项](media-upload-url-contract-boundary.md)和[工作流专项](batch7-workflow-runtime.md)完成后，`contracts:merge:check`、`contracts:validate`（455 operations）及 `contracts:generate:check` 均 PASS。Gateway 检查器补齐 workflow URI 映射，并用发布任务/工作流运行证据移除两条过期不可用断言后，[冻结检查](gateway-contract-check-audit.md)仍有 **6 项**漂移；契约通过也不代表 IAM 账号删除运行差异、真实媒体上传或跨服务 Saga 已通过。

## 本轮最小修复

`packages/contracts/fragments/m1-017-privacy-lifecycle.openapi.json` 已定义 IAM 账号删除申请、查询、取消的正式 OpenAPI 操作，含必填幂等键、请求和响应 schema。`packages/contracts/fragments/b8/b8-auth-iam.openapi.json` 后合并的三条同路径简化定义覆盖了它们，导致聚合文件首个失败为 `POST /api/v1/iam/account-deletions needs x-idempotency declaration`，生成类型又与聚合 operationId 不同。

本轮仅从 B8 片段移除这三条重复定义，并用现有合并器重建聚合文件。三个聚合 path item 现与 M1-017 原始片段逐项相同，operationId 分别是 `createM1017AccountDeletionRequest`、`getM1017AccountDeletionStatus` 和 `cancelM1017AccountDeletionRequest`；现有两份生成的 TypeScript registry 已使用这三个名称，无需改写生成物。其他片段中的 B13 503、评测、SRS 改动由合并器保留。

## 本轮验证

后续管理指标 UAT 发现 analytics owner 读取异常被旧运行时包装为 HTTP 200/空数组。analytics 新源码改为 503（不支持的版本为 422），B13 metrics 专属片段及聚合 OpenAPI 已同步这两种错误响应；[两页实测](admin-dashboard-commerce-uat.md)记录当前旧运行时与待部署边界。此项只对齐错误响应，不能消除下表全量门禁的其他缺口。

| 检查 | 结果 | 边界 |
| --- | --- | --- |
| `pnpm contracts:merge:check` | PASS，28 OpenAPI、20 event fragments | 原始片段与聚合文件一致，不证明运行行为 |
| `pnpm p1r:iam-policy-contract:check` | PASS，8/8 具名 policy operation | IAM policy 片段检查 |
| `pnpm p1r:privacy-analytics-audit-contract:check` | PASS，17 operations、5 events | M1-017 冻结原始文件检查 |
| `pnpm contracts:validate` | PASS，455 operations、796 schemas | 第七批补齐声明与实现后，聚合契约通过；不等于各路由运行通过 |
| `pnpm contracts:generate:check` | PASS，5 个生成文件一致 | 生成物与当前契约一致 |
| `node scripts/audit/p1r-gateway-contract-check.mjs` | FAIL，当前 6 项：五项冻结规则/操作/目标基线及 IAM 删除的旧不可用断言 | workflow owner URI 工具误报与两条已实测路由的过期断言已修；余项需逐条审阅，不可只改常数 |
| Gateway Maven 全测 | PASS，102 项、0 failure/error/skip（26 suites） | 本机默认临时目录导致的 Java NIO loopback 初始化错误在 `TEMP/TMP=C:\Temp` 后消失；不代表冻结基线通过 |
| `git diff --check` | PASS | 仅文本格式 |

早期聚合 OpenAPI 曾有 **7 条**写操作缺 `x-idempotency`，见[旧快照与逐项判定](contracts-idempotency-gate-gap.md)。第七批后全量契约门禁已通过；媒体上传授权被明确标为无成功路径的 503 失败关闭操作，不能以此推断字节上传已实现。

本地当前 JAR 已对内容自动校验、媒体注册/重试/字幕/激活、工作流补偿分别作过 Gateway/owner 运行回归，证据见[第六批](batch6-runtime.md)和[第七批](batch7-workflow-runtime.md)。这些定向成功不覆盖真实媒体 PUT、跨 owner Saga transport 或 Docker 容器运行。

此外，M1-017 契约仍是 `D2_CONTRACT_READY / NOT_RUNTIME_VERIFIED`，不可凭聚合修复宣称 IAM 删除全周期通过。现行 `IamAccountDeletionController` 的申请接口不校验请求 body 摘要且默认返回 200（契约为必填 body、不同摘要冲突及 202）；取消接口读取但不使用幂等键，重放会在状态不再 `REQUESTED` 后返回 409；契约定义的内部 owner receipt 与 recovery 为 POST，运行 Controller 当前仅有 GET。这些差异需要单独的实现、兼容策略与活链路回归。
