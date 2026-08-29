# B20 安全、隐私、内容、支付与灾备 Gate 验证记录

> 执行日期：2026-08-23  
> 范围：Phase 1 上线前的安全供应链、隐私主体请求、内容版权与双审、支付 sandbox、备份恢复和发布证据 Gate。  
> 结论：B20 已完成可审计的代码与静态 Gate 基础；真实安全扫描、隐私请求、内容审核、支付 sandbox、备份恢复和双人发布复核仍须在批准的运行环境取得证据。

## 1. 本轮交付

- `config/b20-security-gates.json`：SAST、依赖/镜像、秘密扫描、SBOM、KMS/Vault、最小权限、非 root、网络边界、mTLS 和镜像签名 Gate。
- `config/b20-privacy-content-gates.json`：隐私告知/版本、同意与撤回、账号导出/注销、留存删除、字段脱敏、审计回放、版权、双人审批、发布/下线/回滚和官网只读投影 Gate。
- `config/b20-commerce-dr-evidence.json`：权益/激活码、支付 sandbox、回调验签、金额绑定、重放、退款、对账、MySQL/Redis/Kafka/对象存储备份恢复、PITR、RPO/RTO、故障注入、SLO/告警、Runbook、证据索引和发布阻断 Gate。
- 三个 validator 和 `tests/b20/` 测试，所有 synthetic fixture 只使用合成主体、订单、内容和媒体引用，不包含真实 PII、原始音频、支付凭据或密钥。
- `scripts/runtime/b20-bootstrap.mjs`、`b20:static`、`b20:bootstrap`、`test:b20`，把 B19 运行态前置和 B20 外部证据明确分开。

## 2. 静态验证结果

| 命令/检查 | 结果 |
|---|---|
| `pnpm test:b20` | PASS；22/22（商业化/灾备 9，隐私/内容 6，安全 7） |
| `validate-b20-security-gates.mjs` | PASS；10 个静态检查，10 个运行检查保持 pending，`runtimeBlocked=true` |
| `validate-b20-privacy-content-gates.mjs` | PASS；7 个静态检查，7 个运行检查保持 pending，release decision=blocked |
| `validate-b20-commerce-dr-evidence.mjs` | PASS；7 个 quality gates，22 个 evidence index，15 个运行证据保持 pending |
| `pnpm b20:static` | PASS；B19 静态前置、B20 测试/validator、契约、生成、兼容、固定端口、运行配置和任务基线均通过 |
| `pnpm tasks:v2:check` | PASS；103 个任务，B20 6 项计数正确，B21/B22 保留待开发 |
| `pnpm contracts:validate` | PASS；402 operations、476 OpenAPI schemas、144 events、100 event payload schemas、4 JSON Schemas |
| `pnpm contracts:generate` | PASS；5 个生成文件 |
| `pnpm contracts:compatibility` | PASS；0 breaking changes |
| `node --check`（B20 bootstrap/validators） | PASS |

## 3. B20 当前状态

静态通过只说明代码、配置、测试和证据结构已经具备，不等于运行态 Gate 通过。所有运行证据仍为 `pending` 或 `blocked`，发布决策保持关闭。

| 任务 | 代码/静态状态 | 运行态剩余 |
|---|---|---|
| `V2-B20-SEC-001` | 静态 manifest、工具族、源代码锚点和禁止伪造规则完成 | CI SAST、依赖/镜像扫描、秘密扫描、SBOM、KMS/Vault、Kubernetes 最小权限、mTLS 和签名证据 |
| `V2-B20-PRI-002` | 隐私告知、同意撤回、主体请求、留存、脱敏和审计回放契约完成 | 真实隔离账号的导出/注销/删除/法律保留、越权拒绝和哈希链审计回放 |
| `V2-B20-CNT-003` | 版权字段、草稿隔离、双人审批、发布/下线/回滚和 official-site 投影契约完成 | 真实内容审核、版权授权、撤回传播、版本恢复和官网公开投影证据 |
| `V2-B20-COM-004` | sandbox-only、默认关闭、回调验签/金额绑定/重放/退款/对账和权益边界完成 | 具备渠道资质的 sandbox 回调、重复/伪造/金额错误、退款和对账运行报告；live provider 仍禁止 |
| `V2-B20-DR-005` | 四类数据系统备份、PITR/RPO/RTO、故障注入、SLO/告警、Runbook 和人工接管契约完成 | 隔离恢复演练、实际 RPO/RTO、Kafka 重放、媒体校验、故障注入和恢复后对账 |
| `V2-B20-TEST-006` | 证据索引、缺项阻断、双人复核、风险接受和可回滚报告 Schema 完成 | 外部 artifact 哈希、双人复核记录、风险接受/过期策略和 rollback drill 结论 |

## 4. 运行态阻塞证据

`pnpm b20:bootstrap --require-runtime` 按设计退出 1，没有把阻塞当作通过。当前阻塞包括：

- 本机 Java 24，不满足 v2 Java 25；Maven 不可用；Docker 不可用；因此 B15/B17 的真实服务和基础设施前置不能通过。
- B16 测试 IAM JWT 认证中心/JWKS/授权端点、B17 Kafka、B19 Gateway/账号矩阵/MySQL/浏览器/设备 evidence 变量尚未注入。
- B20 需要外部批准证据：`B20_RUNTIME_PRIVACY_EVIDENCE_REF`、`B20_RUNTIME_AUDIT_REPLAY_EVIDENCE_REF`、`B20_RUNTIME_CONTENT_EVIDENCE_REF`、`B20_RUNTIME_OFFICIAL_PROJECTION_EVIDENCE_REF`、`B20_RUNTIME_PAYMENT_SANDBOX`、`B20_RUNTIME_PAYMENT_QUALIFICATION`、`B20_RUNTIME_BACKUP_EVIDENCE_DIR`、`B20_RUNTIME_RESTORE_EVIDENCE_DIR`、`B20_RUNTIME_OBSERVABILITY_EVIDENCE`、`B20_RUNTIME_EVIDENCE_INDEX`。
- 本轮没有执行真实支付、破坏性删除、生产备份恢复或生产故障注入；没有取得真实安全扫描、KMS/Vault、镜像签名、双人复核或风险接受记录。

运行模式不会隐式启动浏览器、真机、支付渠道或恢复操作；必须使用隔离的批准 runner，并将 artifact 与版本、环境、trace 和复核人绑定后再更新 Gate 状态。

## 5. 交接结论

B20 当前可交接为：**代码与静态 Gate 基础完成，真实运行态阻塞**。因此 Phase 1 仍不能宣告上线，也不能进入生产发布；后续应先补齐 Java 25/Maven/Docker 与 B16–B19 运行前置，再按 B20 六项逐一取得真实证据，最后才进入 B21 staging/RC Gate。
