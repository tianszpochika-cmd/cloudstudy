# M2 Evidence 责任闭环校正补充决定（2026-09-04）

状态：`EFFECTIVE_SUPERSEDING_ADDENDUM`

适用范围：`P1R-M2-001/003/004/006/008/010` 与 `P1R-M8-013` 的运行 Evidence 责任编排。

## 1. 校正原因

原 M1-004 交接和 M2-001 启动卡把 Gateway 审计持久化、NetworkPolicy 与全部跨进程终验证据统一写成 `P1R-M2-001` 的关闭责任；但权威台账同时规定：

- `P1R-M2-003` 必须等待 `P1R-M2-001/002=ACCEPTED`；
- `audit-service` 的独立 schema、凭据和 Flyway 属于 `P1R-M2-004`，不可变审计运行实现属于 `P1R-M2-006`；
- 固定端口全栈编排和网络边界运行探针属于 `P1R-M2-008`；
- 平台全链关联终验属于 `P1R-M2-010`，staging 网络策略复验属于 `P1R-M8-013`。

若仍把 durable audit 和 NetworkPolicy 的最终运行证据作为 M2-001 自身的进入后继条件，就会形成任务责任闭锁。该闭锁不能用内存 sink、静态 YAML、Mock、应用层 `/internal` 拒绝或越过依赖提前实施下游任务来规避。

## 2. 不变项

1. 不新增、删除或重编号任务，仍为 108 项。
2. `P1R-M2-003` 的依赖仍为 `P1R-M2-001,M2-002`，两项未正式验收前只能预研。
3. M2 Gate 的最终标准不降低：durable audit、真实 NetworkPolicy、跨进程 trace/audit 关联和直连负例仍必须在 `P1R-M2-010` 验收完成前全部通过。
4. 六个 Gateway runtime GAP 在本校正提交中全部保持 `OPEN`；本补充决定只校正责任，不产生运行 PASS。
5. Phase 2 AI/RTC、Phase 3 K12 和生产支付继续禁用。

## 3. 六项 GAP 的唯一责任

| GAP | implementationOwnerTask | evidenceOwnerTask | finalGateTask | 说明 |
|---|---|---|---|---|
| `M2-GW-CSRF` | `P1R-M2-001` | `P1R-M2-001` | `P1R-M2-010` | 真实浏览器 Cookie 与 Origin/Referer 正负例 |
| `M2-GW-PUBLIC-PATH` | `P1R-M2-001` | `P1R-M2-001` | `P1R-M2-010` | 真实 Gateway 匿名路径集合与未知路径拒绝 |
| `M2-GW-RATE-LIMIT` | `P1R-M2-001` | `P1R-M2-001` | `P1R-M2-010` | 真实 Redis、多进程共享额度、429/503 与恢复 |
| `M2-GW-AUDIT` | `P1R-M2-006` | `P1R-M2-006` | `P1R-M2-010` | M2-001 只提供脱敏 envelope；M2-006 提供 canonical ingest、append-only 持久化和回放 |
| `M2-GW-DIRECT-CONNECT` | `P1R-M2-008` | `P1R-M2-008` | `P1R-M2-010` | M2-001 只提供应用层拒绝；M2-008 提供真实 NetworkPolicy 探针；M8-013 staging 复验 |
| `M2-GW-RUNTIME-EVIDENCE` | `P1R-M2-010` | `P1R-M2-010` | `P1R-M2-010` | 聚合 Gateway→IAM→PEP→owner→audit 与网络负例；M8-013 复验部署边界 |

## 4. P1R-M2-001 修订后的验收边界

M2-001 只有在当前提交与当前环境完成以下证据并通过独立审查后才能 `ACCEPTED`：

- canonical route、controller、owner 和 public→internal path 全量一致，未知、冲突和不可用 operation 失败关闭；
- 真实 Gateway 进程连接真实 IAM/JWKS、真实 Redis 和受保护 upstream；
- 真实 401/403/429/503、`Retry-After`、Redis 故障恢复、JWT 负例与 authority header 清洗；
- 真实浏览器 Cookie、CORS、CSRF、Origin/Referer 正负例；
- requestId/traceId 传播、受限脱敏 audit envelope 及应用层 `/internal/v1` 拒绝。

M2-001 的 `ACCEPTED` 不得宣称以下事项已经完成：durable audit-service、Kubernetes NetworkPolicy、M2 全链关联终验或 staging 网络策略。它们继续由上表中的后续任务持有，且在对应 Evidence 与独立审查通过前保持 `OPEN / NOT_RUNTIME_VERIFIED`。

### 4.1 Gateway health 身份受控晋升

`GET /api/v1/health` 已由 M2-001 的 `api-gateway` 本地 controller 承接，因此 canonical 中遗留的 `core-api` 身份必须与执行 owner 对齐。本补充决定只允许从冻结的 M1-018 基线晋升三个精确节点：

1. 完整 `x-p1r-gateway-boundary` Gateway root；
2. `paths./api/v1/health.get.summary` 修正为“读取 API Gateway 健康状态”；
3. `components.schemas.HealthData.properties.service.const` 修正为 `api-gateway`。

`compatibilityPromotion.scope` 固定为 `OPENAPI_GATEWAY_ROOT_AND_HEALTH_IDENTITY_ONLY`。路径、method、`operationId`、response envelope、status 码、header、schema 结构及其他 wire shape 均不在允许范围内。该晋升只消除与已冻结 Gateway owner 决定相冲突的历史身份，不构成新接口或运行 PASS。

## 5. Contract-first 后续约束

- `P1R-M2-006` 实现前必须先冻结 Gateway→audit-service 的 canonical ingest/delivery、工作负载身份、幂等、失败语义和 receipt 契约；不得由 Gateway 自行虚构接口，也不得让 Gateway 写 audit schema。
- `P1R-M2-008` 必须使用真实 NetworkPolicy 探针证明 Gateway 可达、外部/跨命名空间直连拒绝；Docker 端口未暴露或静态 manifest 不能替代。
- `P1R-M2-010` 必须关联 requestId/traceId/auditId 与 durable record，并重跑直连负例；`P1R-M8-013` 在 staging 绑定不可变制品再次验证。
- GAP 只有在 evidence owner 的 current-commit manifest、完整 SHA、独立 `ACCEPT` 和关闭时间齐全时才能转为 `CLOSED`。

## 6. 被取代的解释

本文件只取代以下历史文档中“六项运行责任全部由 M2-001 单任务关闭”的解释，不改写历史验收记录：

- `execution/P1R-M1-004.md` 第 38 行及第 74–76 行把 NetworkPolicy、durable audit 与全部跨进程证据归给 M2-001 的单任务责任表述；
- `execution/P1R-M2-001.md` 启动时对 durable audit 与 NetworkPolicy 的单任务完成解释；
- 其他把 Gateway 应用层拒绝等同于网络隔离、或把脱敏 envelope 等同于 durable audit 的表述。

系统目标、数据 owner、安全边界、任务依赖和最终验收标准均保持不变。
