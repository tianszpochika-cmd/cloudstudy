# Phase 1 阶段验收与 Evidence 标准

> 目标：让“写完代码”与“业务可运行”“可以发布”严格分离
> 原则：没有当前 commit、当前环境和可回放 Evidence，不得标记 `ACCEPTED`

## 1. 成熟度门

| 成熟度 | 必须回答的问题 | 必须具备 | 不能替代它的内容 |
|---|---|---|---|
| `D1 运行设计完成` | 系统、页面、规则、owner、失败和验收是否定义？ | 15 JNY、56 PAGE、8 RULE、18 INT、16 E2E、GAP owner 和关闭条件 | PRD 数量、页面截图、代码目录 |
| `D2 Contract Ready` | API、事件、数据、权限、版本和迁移是否只有一个事实源？ | OpenAPI/AsyncAPI/JSON Schema/Flyway/policy、生成物、兼容窗口、Contract/Event GAP 清零 | Mock payload、客户端手写类型、静态 README |
| `D3 Implemented` | 代码是否按契约工作并具有最小集成能力？ | 服务/客户端代码、真实 storage adapter、unit/contract/integration、安全静态证据 | “能编译”、内存 smoke、旧 B 状态 |
| `D4 Runtime Verified` | 真实业务链能否从页面穿过平台并在故障后恢复？ | Browser→Gateway→PEP→owner DB→Outbox/Kafka→consumer/projection→Audit/Trace/Recovery | CLI 单点调用、旧截图、汇总声明 |
| `D5 Release Ready` | 制品是否可以在受控环境安全发布和回退？ | staging、不可变 RC、SBOM/signature、SLO、备份/DR、迁移/回滚、Go/No-Go | 本机通过、静态部署模板、占位镜像 |

阶段不得跳级。D2 未通过时可以做探索性 spike，但不得把产物合入正式业务路径；D3 未通过的任务不得进入 D4 Evidence；D4 未通过时 D5 结论必须为 `NO-GO`。

## 2. 设计与治理 Gate 对应关系

| Gate | 适用阶段 | PASS 条件 | 强制失败 |
|---|---|---|---|
| `BD-G1 范围` | D1/M0 | 仅 Phase 1 成人；来源和阶段明确 | AI/RTC/K12/未成年人/未授权内容或生产支付开放混入 |
| `BD-G2 业务` | D1/M0 | 角色、入口、主链、失败、恢复和下一步闭合 | 只有功能列表，无端到端出口 |
| `BD-G3 页面` | D1/M0 | 56 PAGE 均有入口、功能、CTA、八态、权限和实现/GAP 映射 | 页面不可达且未标 GAP |
| `BD-G4 规则` | D1/M0 | 学习、内容、商业和恢复规则确定且版本化 | 客户端决定掌握、奖励、权益或可信完成 |
| `BD-G5 契约` | D1→D2 | operationId、owner、事件、错误和兼容策略明确 | 重复外部入口、客户端 role/owner/tenant、事件命名漂移 |
| `BD-G6 验收` | D1/M0 | 每条旅程绑定 E2E、负例和 Evidence 类型 | 只写“测试通过”或只依赖静态检查 |
| `G0 范围治理` | 每个任务 | Source/Phase/ADR/owner/依赖完整 | 范围扩张、未签收决策、错误事实源 |
| `G1 契约数据` | D2 | API/event/schema/migration/policy/生成物一致 | 双 owner、跨服务写表、破坏兼容无窗口 |
| `G2 实现交互` | D3 | 代码、八态、PEP、幂等、降级和最小集成 PASS | Mock/内存事实进入正式路径，错误不可恢复 |
| `G3 测试安全观测` | D3/D4 | 测试、安全、隐私、trace/audit/SLO Evidence PASS | P0/P1、安全 fail-open、不可追踪写入 |
| `G4 发布回滚` | D5 | 不可变制品、迁移/回滚、staging、审批和值守 PASS | 无恢复点、占位镜像、生产 Gate 默认开启 |

## 3. 每个里程碑的验收标准

### M0 Gate：可信执行起点

必须全部满足：

1. `dev` 基线、工具链、锁文件、固定端口和启动前置可复现；环境差异没有改写需求。
2. 主要目录和历史任务均有复用标签、owner、风险和当前验证状态。
3. 被跟踪的编译产物/缓存已安全清理并有防回归检查；源代码和唯一证据没有被误删。
4. 四项目边界一致，独立 miniapp 历史目录不再接收新业务。
5. CI 在 `dev/master` 真正执行并对失败 fail closed。
6. 合成夹具无真实隐私、凭据、版权内容和原始用户音频。
7. 108 个任务、运行层 ID、GAP 和 Evidence 目录可由校验器审计。
8. 旧证据全部是 `historical-candidate`，没有继承 ACCEPTED。

### M1 Gate：D2 Contract Ready

必须全部满足：

1. 24 个具名 Contract GAP、15 个具名 Event GAP及其重复/别名已归一并关闭；关闭记录包含 owner、diff、迁移和测试。
2. OpenAPI operationId、请求/响应、错误、幂等、分页、权限、弃用窗口和 Web/移动 Token 语义明确。
3. AsyncAPI operation/channel/binding、canonical event、producer/consumer、topic/partition、schemaVersion、去重和重放规则明确。
4. 每个服务有唯一 schema/Data Owner、Flyway、Redis namespace、tenant guard、保留/删除和回滚/补偿策略。
5. RBAC/ABAC/PEP 默认拒绝；客户端 role/tenant/owner/content rights 不具权威性。
6. 所有生成客户端、Java DTO/TS 类型、契约 lint、merge、generate、compatibility 和 migration validator PASS。
7. M1-018 的独立审查确认没有用假 payload、目录或旧接口绕过 GAP。

### M2 Gate：平台 D3

必须全部满足：

1. Gateway 和每个领域服务分别验证 JWT/issuer/audience/alg/type/permission；直连和伪造角色头不能提权。
2. IAM 账号密码、RS256/JWKS、刷新轮换、重放、撤销、成人 Gate、同意和设备会话真实存储通过。
3. 服务独立 schema/凭据/Redis namespace；空库与存量迁移、tenant 负例和跨库写阻断通过。
4. Kafka/Outbox/consumer dedupe/DLQ/replay/Saga/人工恢复在真实 transport 或 Testcontainers 中通过重复、乱序和故障测试。
5. requestId/traceId/eventId/auditId 可以从入口关联到 owner 与 consumer；秘密不进 Git、镜像和日志。
6. 固定端口本地编排和 CI 可重复，内存 adapter 不作为正式 profile 唯一事实。

### M3 Gate：内容供应链 D3

必须全部满足：

1. 合成内容从草稿、自动校验、媒体处理、L1、L2 到发布全链可运行；作者不能自审。
2. 未授权、版权过期、答案泄漏、Phase 不符、媒体失败和非法状态迁移均被阻断并审计。
3. 草稿对学习者不可见；发布投影带 contentVersion/contentEpoch；cache invalidation 和迟延可解释。
4. 下线、紧急阻断和回滚只恢复到已验证版本；学习中的用户获得安全替代或可恢复状态。
5. 官网和学习端只能读取正式投影；后台只通过 command boundary 写领域事实。

### M4 Gate：首日 D3

必须全部满足：

1. 注册、重置、登录、刷新、退出、会话撤销、returnTo 和成人/同意正负例通过。
2. 目标、5/15/30/45、时区和草稿恢复进入 learner owner；重复提交不重复建计划。
3. `P1_PLACEMENT_V1` 固定输入输出、维度/覆盖/置信度、checkpoint 和中断恢复通过。
4. placement/target→plan/first-day Saga 可查询、可重放、可补偿；报告不因计划失败丢失。
5. 首页、今日、地图、课程架和 assessment 页面有 canonical route、八态、深链和跨端一致性。

### M5 Gate：核心学习 D3

必须全部满足：

1. 内容/题目/答案规则版本被 Session/attempt 快照固定；过期权利和下线内容不可继续新建 Session。
2. 六技能均使用规则反馈；Phase 1 不调用生成式 AI、ASR、AI 评分或 RTC。
3. attempt/checkpoint/提交幂等；重复、超时、乱序和旧版本不产生双写。
4. `SM2_Q03_V1` 是唯一 SRS 写路径；错误答案不能提交高 quality；dueAt/时区/DST 可回放。
5. 错题、变式、D+1/D+7 与 mastery 分离；D+7 前不得进入 MASTERED。
6. 日/周/阶段报告具有 watermark、版本、确定分子分母和重建/对账策略。
7. 离线冲突可见、可恢复且不静默覆盖；trusted completion 只由 owner Outbox 产生。

### M6 Gate：运营与合规 D3

必须全部满足：

1. 通知偏好、模板、去重、重试和恢复不改变源领域事实；敏感原文不进日志。
2. 通用同步队列/冲突/恢复可见，客户端不直接生产 Kafka 事件。
3. learner/admin 工单写入同一 `admin-ops-service.support` owner，客服不能跨域修改学习、订单或身份事实。
4. 隐私导出具有状态、短时下载、过期、脱敏、失败重试和各 owner receipt。
5. 账号删除具有强确认、7 天冷静期、撤回、会话撤销、合法保留、跨域匿名化和半失败恢复。
6. analytics ingress 受同意/删除约束，UI telemetry 与 Kafka 领域事实隔离。
7. 风险、审计、权限和人工恢复使用最小权限、双人审批和不可变审计。

### M7 Gate：互动与商业 D3

必须全部满足：

1. 同一可信完成事件重放任意次数只产生一条奖励账本；客户端不可直接发奖。
2. 游戏 catalog 服务端判定阶段；Phase 1 P0 只有 Sentence Train，其余保持禁用。
3. 自习室使用服务端 lease/focus，断线可恢复；不开放陌生人私聊或自由发帖。
4. 激活码、订单、sandbox 回调、权益、退款/撤销/到期和对账有幂等状态机。
5. content/learning 在自身 PEP 中执行权益准入；401/403 不伪装空列表。
6. 生产支付 flag、真实渠道凭据和生产流量保持 OFF；没有批准不得改变。

### M8 Gate：D4/D5

必须全部满足：

1. W0–W4 共 16 个 E2E 全部使用当前 commit 和当前环境通过，成功/失败/恢复 Evidence 齐全。
2. 56 个 PAGE 在适用平台完成八态、深链、响应式、Console、键盘/读屏、i18n、主题和四级性能验证。
3. Web/PWA、Mobile H5、iOS/Android/iPad 及微信条件编译边界通过；不存在第五套业务事实或页面实现。
4. 安全、隐私、版权、依赖、密钥和支付审查无未关闭 P0/P1。
5. 负载、SLO、告警、超时、Kafka/DB/Redis/对象存储故障、DLQ/重放和人工恢复通过。
6. 备份、PITR、RPO/RTO、跨服务对账、删除/保留和灾难恢复通过。
7. 单一部署事实源、全服务不可变镜像、staging、migration/canary/rollback 和 runbook 通过。
8. RC digest、签名、SBOM/provenance、CHANGELOG、Evidence index 和风险清单完整。
9. 产品、架构、安全、隐私、运营和发布角色独立签收；未满足时结论保持 `NO-GO`。

## 4. 测试与证据矩阵

| 类型 | 最低要求 | 强制失败条件 |
|---|---|---|
| 规则纯函数 | 固定夹具、边界、非法迁移、版本、确定性和回放 | 同输入结果漂移、无 algorithmVersion、跳过 D7/状态门 |
| OpenAPI/生成物 | lint/merge/generate/compat、错误/权限/幂等/分页 | operationId 冲突、客户端手写裸 any、破坏兼容无窗口 |
| AsyncAPI/事件 | producer/consumer/topic/binding/schema、Outbox、去重、重放 | Kafka RPC、UI 点击当领域事件、重复消费双写 |
| Migration/Data | 空库/存量库、索引/约束、tenant、回滚/补偿、owner 权限 | 共享表写、跨服务 join、丢历史、Redis 唯一事实 |
| Unit/Service | 正常/边界/异常/授权/幂等，关键领域使用 JUnit/等价框架 | 只有读取源码字符串的测试却宣称业务通过 |
| Integration/API | Gateway、IAM、服务 PEP、真实 owner storage、Outbox/consumer | 直连绕过、Mock DB、401/403 语义错误 |
| Browser/E2E | 真实点击、网络、Gateway、DB、事件、审计、恢复；合成账号 | 只用 CLI/截图、旧 commit、无法关联 trace |
| 安全/隐私 | SAST/DAST/SCA、越权、租户、CSRF、重放、限流、脱敏、删除 | fail-open、真实敏感数据、Token/私钥进日志或 Git |
| 跨端/体验 | route、八态、响应式、i18n、主题、a11y、四级性能、弱网 | 低配卡死、错误不可恢复、颜色是唯一状态信号 |
| 发布/恢复 | staging、RC、备份/PITR、migration/canary/rollback、值守 | 占位镜像、无恢复点、静态模板冒充部署通过 |

## 5. Evidence 目录与 manifest

每个任务使用：

```text
evidence/p1r/m<里程碑数字>/<TASK-ID>/
├── manifest.json
├── 00-scope.md
├── 01-contract.md
├── 02-migration.md
├── 03-runtime.md
├── 04-tests.md
├── 05-security-privacy.md
├── 06-recovery-rollback.md
└── 99-handoff.md
```

例如 `P1R-M0-001` 的唯一 canonical manifest 路径是 `evidence/p1r/m0/P1R-M0-001/manifest.json`。`requirements/backlog/evidence/`、旧 `evidence/b*` 或其他历史目录不能满足 P1R Gate。

`manifest.json` 至少包含：

```json
{
  "taskId": "P1R-Mx-xxx",
  "sourceCommit": "full git sha",
  "artifactDigests": [],
  "environment": "local|test|staging",
  "startedAt": "RFC3339",
  "finishedAt": "RFC3339",
  "actors": [],
  "sourceIds": [],
  "journeys": [],
  "pages": [],
  "rules": [],
  "integrations": [],
  "e2eScenarios": [],
  "serviceOwners": [],
  "dataOwners": [],
  "commands": [],
  "results": [],
  "requestIds": [],
  "traceIds": [],
  "eventIds": [],
  "rollbackEvidence": [],
  "knownGaps": [],
  "reviewer": null,
  "decision": "REVIEW"
}
```

manifest 不得包含密码、Token、私钥、真实手机号、原始用户音频、未脱敏自由文本、支付密文或未授权内容。

## 6. 验收流转

1. 执行者确认依赖与 G0 后将任务从 `PLANNED` 提交为 `READY` 请求；统筹确认后才能开始。
2. 执行者记录基线提交和文件边界，将状态改为 `IN_PROGRESS`。
3. 完成实现与适用测试后，执行者生成 Evidence 并提交 `REVIEW`，不得自行标记 `ACCEPTED`。
4. 独立评审逐项核对 Source、owner、diff、测试、运行、恢复和未覆盖事项。
5. 全部适用 Gate PASS 才改为 `ACCEPTED`；失败改为 `REWORK`，外部依赖改为 `BLOCKED`。
6. 里程碑只有全部必需任务 ACCEPTED 且里程碑 Gate 独立通过后才能关闭。

## 7. 严重级别与发布结论

| 级别 | 示例 | 处理 |
|---|---|---|
| `P0` | 数据丢失、跨租户、认证绕过、私钥泄露、重复发权益、错误删除 | 立即阻断，D4/D5 `NO-GO` |
| `P1` | 核心旅程失败、双写、无法恢复、未授权内容、支付错误 | 阻断里程碑和发布 |
| `P2` | 非核心功能/兼容/体验缺陷，有安全降级 | 必须有 owner、修复任务和明确风险签收；通常不进入 RC |
| `P3` | 文案、低影响视觉或非阻断维护项 | 可进入后续任务，但不得掩盖为“无问题” |

最终 Go/No-Go 必须是独立评审结果。计划完成、静态 Gate 通过、D3 完成或本机 E2E 局部通过都不能自动产生 `GO`。

## 8. 资产复用与禁止引用（M3+ 强制）

本节由 2026-09-10 的 M3–M8 资产预检结论补充，适用于 `M3` 及其后全部里程碑。

### 8.1 禁止引用清单

`services/core-api` 是迁移中的 v1 兼容单体（Strangler 反腐层与回滚边界），**其任何实现不得进入 v2 正式业务路径**。已识别的禁止引用项包括（不限于）：

- `B2AssessmentEngine`、`AssessmentB2Controller`（旧测评引擎与控制器）
- `InMemoryIdentityRepository`、`InMemorySessionRepository`、`InMemoryB4DurableRepository`（内存实现冒充持久化）

`M5` 开工前必须先产出**完整的 core-api 禁止引用清单**，并以静态检查（import / 符号扫描）保证不被违反。违反视为**强制失败**，按 `P1` 处理。

### 8.2 复用资产的前置条件

`M3`–`M7` 中资产策略含 `REUSE-VERIFY` / `REPAIR` / `REWRITE` 的任务，其**进入条件**见 [01-里程碑与依赖图 §3.1 资产预检门](01-里程碑与依赖图.md)。**台账「资产验证」列仍为 `未验` 的适用任务不得开工。**

复用结论必须落到台账「资产验证」列：`已验-可用` / `已验-需修` / `已验-不可用`。判定为 `已验-不可用` 时，须将该任务的资产策略改为 `REWRITE` 或 `NEW`，并同步评估工期。

### 8.3 测试覆盖的执行口径

第 4 节 Unit/Service 要求为「正常 / 边界 / 异常 / 授权 / 幂等」。**仅存在 smoke / 冒烟测试不视为满足该要求。**

当前实际覆盖显著不足（`learning` / `assessment` / `content` / `media` 各仅 1 个 smoke 测试，`admin-ops` 为 0），相关任务在提交验收前必须补齐关键路径测试。

### 8.4 预检发现索引

`M3`–`M8` 的资产预检逐项判定、风险清单与核实记录见 [execution/asset-preflight-report-2026-09-10.md](execution/asset-preflight-report-2026-09-10.md)。其中 R1–R9 的具体缺口已点名写入对应任务的「最小退出证据」。
