# v2 平台能力矩阵

> 目的：把 v2-980plus 的业务设计单元和后端平台能力分开登记，供下一轮开发任务设计使用。  
> 说明：`ARCH-*` 是架构能力编号，不计入 980 个业务设计单元。B7/B8 已提供部分代码层、契约和静态测试证据，但以下能力仍需按最低交付证据完成运行态验收，不能仅凭目录或静态配置宣称完成。

## 1. 能力清单

| 能力 ID | 能力 | 主要 owner | 目标阶段 | 依赖 | 最低交付证据 |
|---|---|---|---|---|---|
| ARCH-PLAT-001 | v2 设计、ADR、契约、任务和验收追溯基线 | 架构治理 | Platform 0 | v2-980plus、ADR-0009/0010 | 文档链接、ID 追溯检查、未决项清单 |
| ARCH-GW-001 | API Gateway、外部路由与 `/api/v1` 版本治理 | `api-gateway` | Platform 0 | 自有 JWT/JWKS、端口/部署基线 | 路由测试、直连阻断、限流、requestId/traceId、回滚 |
| ARCH-IAM-001 | 自有账号密码 JWT 认证中心、用户/租户/设备/会话/同意 | `iam-service` | Platform 0 | 自有 JWT ADR、密钥管理、契约 | 登录/刷新/登出/撤销、密码策略、JWKS 密钥轮换/重放测试、principal 映射和审计 |
| ARCH-IAM-002 | RBAC + ABAC、资源 owner、阶段、版权与授权执行 | `iam-service` + 服务 PEP/PDP | Platform 0 | IAM、资源策略模型 | allow/deny 矩阵、服务侧 PEP、本地策略/短时安全缓存、PDP 故障 fail-closed、403 语义、无客户端角色头 |
| ARCH-DATA-001 | 服务数据库/schema owner、Flyway、Redis namespace、tenant 查询守卫 | 各领域服务 | Platform 0/1 | 服务边界、IAM | 跨服务写入扫描、迁移演练、数据库权限账号验证、跨租户拒绝/复合索引测试 |
| ARCH-EVT-001 | Kafka 事件总线、Outbox、AsyncAPI、DLQ 和回放 | 平台/Workflow | Platform 0/1 | 数据 owner、Trace | 集成事实筛查、断电重试、聚合键分区、消费者去重、旧 schema、DLQ 回放；不以 Kafka 代替 RPC/事务 |
| ARCH-API-001 | OpenAPI/AsyncAPI/JSON Schema 生成和兼容门禁 | 契约治理 | Platform 0 | `packages/contracts` | 生成 diff、破坏性变更检测、客户端编译 |
| ARCH-OBS-001 | OTel Trace、Metrics、Logs、Audit 关联 | 平台工程 | Platform 0 | Gateway、事件 envelope | 一次请求跨服务回放、脱敏扫描、告警规则 |
| ARCH-REL-001 | timeout、重试预算、熔断、幂等、Saga、补偿 | 平台/各服务 | Platform 0/1 | API、事件 | 故障注入、重复提交、补偿和人工恢复演练 |
| ARCH-DR-001 | 备份、PITR、RPO/RTO、灾备和恢复演练 | SRE/数据平台 | Platform 1 | 数据 owner、监控 | 可复现恢复报告、数据校验和回滚方案 |
| ARCH-DEP-001 | Java 25 服务模板、容器、Kubernetes、GitOps | 平台工程 | Platform 0 | Java/BOM、配置、观测 | 新服务模板启动、健康探针、滚动/灰度/回滚；已抽取服务具有独立进程、schema、凭据和发布证据 |
| ARCH-SEC-001 | 秘密、KMS/Vault、SBOM、CVE、镜像签名和 mTLS | 安全/平台 | Platform 0/1 | IAM、部署平台 | secret 扫描、密钥轮换、供应链报告、服务身份验证 |
| ARCH-SVC-001 | 领域服务边界与 `core-api` Strangler 迁移 | 架构/领域团队 | Platform 1 | 以上平台能力 | 读旁路、数据一致性、流量切换、旧路由退出 |
| ARCH-LCM-001 | API/事件/数据库兼容窗口和十年升级策略 | 架构治理 | 全阶段 | 发布治理、ADR | 弃用公告、兼容矩阵、升级/回滚演练 |

## 2. 前置顺序

```text
ARCH-PLAT-001
  ├─ ARCH-API-001
  ├─ ARCH-DEP-001
  ├─ ARCH-GW-001
  ├─ ARCH-IAM-001
  │    └─ ARCH-IAM-002
  ├─ ARCH-OBS-001
  ├─ ARCH-DATA-001
  │    └─ ARCH-EVT-001
  ├─ ARCH-REL-001 / ARCH-SEC-001
  └─ ARCH-SVC-001 → 按领域拆分新的业务任务
```

`ARCH-IAM-001` 已有自有账号密码 JWT、RS256/JWKS、principal/session/adult-Gate 代码与契约静态证据，但真实 IAM HTTP、持久化和 JWKS 运行态仍未通过；`ARCH-IAM-002` 已有服务模板 PEP、RBAC+ABAC 规则和 fail-closed 静态证据，但尚未覆盖每个领域服务。`ARCH-GW-001`、`ARCH-API-001`、`ARCH-OBS-001` 已有 B7/B8 代码/静态证据，但在 Java 25 运行态、跨进程回放和安全 Gate 通过前，任何标注“已完成 RBAC/微服务迁移”的任务都必须退回待验收。

## 3. 业务域映射原则

| v2 设计域 | 首选服务 owner | 备注 |
|---|---|---|
| ONB / USR | `iam-service` + `learner-service` | 认证/租户归 IAM；学习目标、偏好和首日状态归 learner |
| VOC / RDG | `content-service` + `learning-service` + 按需 `assessment-service` | 内容版本/题目定义归 content；进度/SRS 归 learning；阅读测验作答归 assessment |
| GRM / WRT | `content-service` + `assessment-service` + `learning-service` | 题目/规则版本归 content；attempt/反馈归 assessment；掌握度投影/修复计划归 learning |
| LST / SPK | `content-service` + `media-service` + `assessment-service` + 按需 `learning-service` | 媒体/版权归 content+media；听写、录音会话和评分归 assessment；播放/学习进度归 learning |
| ASM | `content-service` + `assessment-service` + `learning-service` | 题目/答案规则归 content，作答/判分/报告归 assessment，掌握度/复习归 learning；均不由前端或 Gateway 决定 |
| GAM | `gamification-service` | 只消费可信学习事件，不能从客户端积分请求直接入账 |
| SOC | `social-service` | 低 UGC、举报、可见性和内容安全受权限与审核约束 |
| COM | `commerce-service` | 订单/支付/权益/对账独立事实，真实渠道默认关闭直至合规 Gate |
| ADM | `admin-ops-service` + 各领域服务 | Admin 是操作入口和聚合层；仅 `admin-ops-service.support` 拥有客服工单事实，不复制内容、用户、订单或学习事实 |
| INF | `notification-service` + `media-service` + `workflow-service` | 按职责拆分，不用一个“杂项服务”承载所有横向状态 |
| AI2 | `ai-orchestrator` + `content-safety` + `evaluation` | Phase 2 Gate 后才可路由 |
| K12 | `guardian-service` + `institution-service` + `curriculum-rights-service` | Phase 3 合规 Gate 后才可路由 |

## 4. 新任务编号规则

Phase 1 当前任务不得直接沿用旧 B/`DEV-*`/G 编号，统一使用 [Phase 1 开发计划重基线](../../requirements/backlog/v2-phase1-rebaseline/README.md) 的编号：

```text
P1R-M<里程碑>-<NNN>
```

任务必须同时填写：

- `Source Ref`：`FEAT-*`、`PRD-ATOM-*` 或已细化签收的 `V2-980-*`；
- `Arch Ref`：一个或多个 `ARCH-*`；
- `Service Owner`：目标服务及数据 owner；
- `Client Host`：四个前端项目之一或“无客户端”；
- `Contract Ref`：OpenAPI/AsyncAPI/JSON Schema；
- `Security Ref`：角色、权限、租户、owner、phase、版权和隐私规则；
- `Evidence`：代码、契约、迁移、测试、运行、观测、回滚证据。

没有 `Source Ref` 的架构能力不能被包装成业务 Feature；没有 `Arch Ref` 的业务任务不能进入微服务实现排期。
