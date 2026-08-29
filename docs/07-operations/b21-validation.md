# B21 预发布、发布候选与 Go/No-Go 验证记录

> 执行日期：2026-08-23  
> 范围：Phase 1 的 staging/production-like 清单、不可变 RC、可观测性、回滚和多角色 Go/No-Go 代码与静态验证。  
> 结论：B21 已完成代码/配置/静态 Gate 基础；真实 staging、RC、观测、回滚演练和发布签字仍为 `pending`/`blocked`，发布决策保持 `NO-GO`。

## 1. 本轮交付

- `config/b21-deployment-staging.json`、`deploy/b21/`：OCI digest、cosign/SBOM、Kubernetes/Kustomize/Helm/GitOps、ExternalSecret、探针、滚动/蓝绿/回滚、NetworkPolicy、生产等价 staging、脱敏夹具、迁移和依赖故障矩阵。
- `config/b21-observability-rc.json`：OTel、SLO/错误预算、告警路由、值班、Dashboard、事故演练、静默审计、不可变 RC、版本签名、构建物一致性和 Phase 1 回归选择。
- `config/b21-release-gate-evidence.json`：产品/架构/安全/数据/运营五角色 Go/No-Go、B20 前置、风险接受、变更窗口、双人审批、回滚负责人、RC 证据索引和可复现报告 Schema。
- 三组 validator 与 `tests/b21/` 测试；synthetic fixture 只使用引用和占位值，不包含真实凭据、PII、生产数据、支付调用或破坏性操作。
- `scripts/runtime/b21-bootstrap.mjs`、`b21:static`、`b21:bootstrap`、`test:b21`；默认静态模式不创建集群、不发布镜像、不切流、不批准 Go。

## 2. 静态验证结果

| 命令/检查 | 结果 |
|---|---|
| `pnpm test:b21` | PASS；26/26（DEP/STG 9，OBS/RC 9，GATE/TEST 8） |
| `validate-b21-deployment-staging.mjs` | PASS；13 个静态检查，13 个运行检查保持 pending，26 个 evidence，`runtimeBlocked=true` |
| `validate-b21-observability-rc.mjs` | PASS；6 个静态检查，6 个运行检查保持 pending，`releaseDecision=NO-GO` |
| `validate-b21-release-gate-evidence.mjs` | PASS；9 个静态检查，9 个运行检查保持 pending，`releaseDecision=NO-GO` |
| `pnpm b21:static` | PASS；B20 静态前置、B21 测试/validator、契约、生成、兼容、固定端口、运行配置和任务基线均通过 |
| `pnpm tasks:v2:check` | PASS；103 个任务，B21 6 项、B22 4 项计数正确 |
| `pnpm contracts:validate` | PASS；402 operations、476 OpenAPI schemas、144 events、100 event payload schemas、4 JSON Schemas |
| `pnpm contracts:generate` | PASS；5 个生成文件 |
| `pnpm contracts:compatibility` | PASS；0 breaking changes |
| `node --check` / `git diff --check` | PASS |

## 3. B21 当前状态

静态通过只证明发布结构、策略、来源锚点和阻断规则存在，不证明任何真实集群、镜像、监控、RC 或审批已经执行。

| 任务 | 代码/静态状态 | 运行态剩余 |
|---|---|---|
| `V2-B21-DEP-001` | OCI/Kubernetes/Helm/Kustomize/GitOps 和不可变发布模板完成 | 真实 registry digest/signature/SBOM、secret 注入、rollout/rollback 和集群证据 |
| `V2-B21-STG-002` | production-like staging、脱敏夹具、迁移和依赖故障矩阵完成 | 空库、升级/降级、网络策略、依赖故障与迁移恢复的实际运行报告 |
| `V2-B21-OBS-003` | OTel、SLO、错误预算、告警、值班、Dashboard、事故演练契约完成 | 真实 trace/metric/log、告警触发、静默审计、升级链路和演练记录 |
| `V2-B21-RC-004` | RC 版本绑定、签名、构建物一致性和回归选择规则完成 | 固定 RC 的契约/E2E/浏览器/设备/性能/安全回归、签名和回滚点 |
| `V2-B21-GATE-005` | 五角色独立决策、风险/窗口/双人审批/回滚 owner 规则完成 | B20 接受、角色签字、风险复核、变更窗口、回滚演练和审计记录 |
| `V2-B21-TEST-006` | RC 证据索引、哈希绑定、报告 Schema 和阻断规则完成 | 真实 artifact、版本/环境绑定、可复现报告和签字索引 |

## 4. 运行态阻塞证据

`pnpm b21:bootstrap --require-runtime` 必须先执行 B20 runtime prerequisite；当前环境仍无法满足该前置，因此按设计退出 1，不会把 B21 静态结果升级为运行态通过。已登记的 B21 外部证据变量保持空值：

`B21_K8S_CONTEXT`、`B21_IMAGE_REGISTRY_EVIDENCE`、`B21_SECRET_PROVIDER_EVIDENCE`、`B21_STAGING_MIGRATION_EVIDENCE`、`B21_NETWORK_POLICY_EVIDENCE`、`B21_ROLLOUT_ROLLBACK_EVIDENCE`、`B21_RUNTIME_STAGING_ORIGIN`、`B21_RUNTIME_OTEL_ENDPOINT`、`B21_RUNTIME_ALERT_EVIDENCE`、`B21_RUNTIME_RC_ARTIFACT_DIR`、`B21_RUNTIME_SIGNATURE_EVIDENCE`、`B21_RUNTIME_REGRESSION_EVIDENCE`、`B21_RUNTIME_ROLLBACK_EVIDENCE`、`B21_RUNTIME_B20_GATE_EVIDENCE`、`B21_RUNTIME_STAGING_RC`、`B21_RUNTIME_RELEASE_WORKBENCH`、`B21_RUNTIME_ARTIFACT_STORE`、`B21_RUNTIME_SIGNOFF_INDEX`。

当前已知阻塞包括 Java 24（目标 Java 25）、Maven 不可用、Docker 不可用，以及 B16–B20 的真实 IAM JWT 认证中心、Kafka、数据库、浏览器/设备、安全、隐私、内容、支付 sandbox、备份恢复和发布复核证据缺失。没有执行真实 Kubernetes、镜像发布、生产迁移、流量切换、支付、删除、恢复或签字。

## 5. 交接结论

B21 当前可交接为：**代码与静态发布 Gate 基础完成，真实预发布/RC/Go-No-Go 阻塞**。因此 Phase 1 仍不能宣告上线；必须先补齐 B20 运行态 Gate 和基础设施，再在批准的隔离环境执行 B21 staging、RC、观测、回滚及五角色独立决策，并将 artifact 哈希、版本、环境、trace 和复核记录写入证据索引。
