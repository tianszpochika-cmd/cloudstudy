# DoD Gate 与证据包规范

> **文档分类：当前执行治理规范**。本规范只定义证据和门禁，不替代 v2-980plus 的业务登记；`P1R-*` 的阶段应用、Evidence manifest 和状态流转以 [Phase 1 阶段验收与 Evidence 标准](./v2-phase1-rebaseline/03-阶段验收与Evidence标准.md) 为准。任务必须按 930 个业务单元 + 50 个跨域扩展登记位及 184/486/310 成熟度口径建立追溯，不能把登记或静态门禁当作 980 份详细设计/实现完成。

> 目标：让“Agent 说做完了”变成可复现、可审计、可回滚的交付。
>
> 关联检查器：`scripts/check-dod.mjs`

## 1. Gate 分层

| Gate | 名称 | 必须回答的问题 | 主要证据 | 失败结果 |
|---|---|---|---|---|
| G0 | 范围与治理 | 是否属于 Phase 1？是否引用了正确的 Feature Ref、ADR 和冻结枚举？ | 需求/设计链接、ADR、范围清单、冲突处理 | 阻塞，不得编码或返工 |
| G1 | 契约与数据 | API、事件、ID、状态、权限和表结构是否只有一个事实源？ | `packages/contracts/`、migration、schema diff、生成物 | 阻塞下游服务/客户端 |
| G2 | 实现与交互 | 前后端、数据库和跨端行为是否按契约工作？异常、空态、重试和降级是否实现？ | PR/commit、运行日志、截图/录屏、接口回放 | 待验收或返工 |
| G3 | 测试、安全与观测 | 关键路径能否复现？是否有权限、幂等、弱网、隐私、性能或 AI 禁用证据？ | 单元/集成/契约/E2E、扫描报告、requestId 日志 | 不得进入发布候选 |
| G4 | 发布与回滚 | CHANGELOG、兼容窗口、迁移/回滚、内容/支付/平台 Gate 是否齐全？ | 发布清单、回滚演练、验收签字 | 禁止发布 |

任务只有在适用的 Gate 全部通过后才可由统筹 Agent 标记“已完成”。只满足 G0 或“文档已写”不等于业务完成。

## 1.1 v2 平台任务强制 Gate

涉及 `ARCH-GW-*`、`ARCH-IAM-*`、`ARCH-DATA-*`、`ARCH-EVT-*`、`ARCH-OBS-*`、`ARCH-REL-*` 或 `ARCH-SVC-*` 的任务，除上述 Gate 外必须额外证明：

1. 平台自有 IAM 使用账号密码校验并按 ADR-0013 签发短时 JWT Bearer（Access Token）；Gateway 与领域服务独立通过 JWKS 验证 issuer、签名、算法、audience、时间窗口、token type 和 scope/permission。直连、客户端角色头和客户端 owner/tenant 字段不能扩大权限；PDP/策略失效必须 fail closed。
2. 服务有明确 schema/data owner、Flyway、Redis namespace、tenant 查询守卫、事件契约和运行 owner；没有跨服务写表、共享 ORM entity 或跨服务 SQL join。已抽取服务另有独立 OCI 进程、凭据和发布/回滚证据。
3. 内容/题目规则、attempt/判分报告、学习掌握度/复习事实有唯一 owner；admin/workflow/audit 不跨域双写。关键跨服务写入有 Outbox、幂等键、聚合键、消费者去重、DLQ/回放和补偿；`eventId/requestId/traceId/schemaVersion` 可关联。
4. 事件总线只传递集成事实，不承载 UI 点击、日志、指标或 RPC；具备健康探针、优雅停机、超时/重试/熔断、SLO/告警、SBOM/依赖扫描及回滚证据。

平台目录、README、静态策略或“服务可以启动”只能证明基座存在，不能替代运行态、权限、数据一致性、故障和回滚证据。

## 2. 证据包目录和命名

推荐每个任务一个目录：

```text
requirements/backlog/evidence/<TASK-ID>/
├── 00-scope.md              # Feature Ref、范围、依赖、ADR
├── 01-contract.md           # OpenAPI/事件/schema 证据
├── 02-migration.md          # DDL、迁移、回滚/补偿证据
├── 03-runtime.md            # 启动命令、日志、接口回放或截图
├── 04-test.md               # 测试命令、结果、报告链接
├── 05-security.md           # 权限、脱敏、密钥扫描（适用时）
├── 06-rollback.md           # 回滚演练和数据兼容窗口
└── 99-handoff.md            # 待验收交接摘要和未覆盖事项
```

证据文件格式为 `YYYYMMDD-HHmm_<kind>.<ext>` 时可按时间排序；路径不应包含真实手机号、音频原件、支付密文、私钥或用户笔记。截图/录屏应使用合成账号和脱敏数据。

## 3. 任务类型验收矩阵

| 类型 | 必须有 | 强制失败条件 |
|---|---|---|
| OpenAPI/REST | source schema、生成/校验结果、错误码、鉴权、幂等、分页和版本说明 | 客户端手写裸 `any`、接口没有权限/错误分支、operationId 冲突 |
| 事件/异步 | envelope、schema 版本、outbox、消费者去重、重放结果 | 重放重复记账、缺少 `eventId/requestId`、消费者无法兼容旧版本 |
| MySQL/Flyway | 正向 migration、空库/存量库验证、索引/外键、回滚/补偿 | 直接改存量表、丢历史学习/订单/审计数据、无回滚路径 |
| 前端/跨端 | Web/H5/移动端关键尺寸、错误/空/加载态、四档性能降级、键盘/读屏适配（适用时） | 只有设计图无运行证据、低配卡死、错误时不可恢复 |
| 学习算法/状态机 | 固定夹具、边界、非法迁移、版本号、可回放输入 | 同一输入结果不稳定、状态跳跃、无审计来源 |
| 内容/CMS | 版权/来源、草稿隔离、双审、版本发布/下线/恢复 | 未授权内容可见、单人绕过双审、无法恢复指定版本 |
| 支付/权益 | 支付默认关闭证据、渠道沙盒验签、回调幂等、退款/对账/补单、审计 | 假支付成功、私钥入库/日志、重复回调重复发权益 |
| 隐私/账号 | 仅本人数据、脱敏导出、Token/设备撤销、注销冷静期、审计 | 横向越权、真实隐私进夹具、旧 Token 继续有效 |

## 4. ADR 规则

- 只有影响技术主线、数据所有权、阶段边界、跨域状态、不可逆迁移、合规或成本的决策需要 ADR。
- 新 ADR 使用 `docs/10-decisions/` 中当前最高编号加一；不复用、覆盖或重编号历史 ADR。
- 状态为 `proposed` 时不能作为下游实现的强制基线；被接受后必须在相关 backlog/设计中加链接。
- 反转已接受决策时新增 superseding ADR，保留旧文件、说明迁移窗口和回滚方案。
- ADR 不能藏真实密钥、生产 URL、个人数据或未授权内容样例。

## 5. CHANGELOG 规则

每个可验收任务在合并或发布前新增一条 CHANGELOG 记录，至少包括：

```text
### [DEV-xx-xxx] 简短标题
- 范围：Feature Ref、端、服务、数据库/契约影响
- 变更：用户可感知行为和兼容性
- 数据/配置：migration、feature flag、默认开关、迁移窗口
- 验证：可复制命令 + 结果 + 证据路径
- 回滚：代码版本、flag、反向 migration/补偿、客户端兼容方式
- 未覆盖：已知限制、阻塞或后续任务
```

治理 Agent 受文件边界约束时，可以只在本文件和 ADR 中补齐规则，不代替主编排器修改根 `CHANGELOG.md`。统筹 Agent 在验收/合并时负责把规则落实到实际变更日志。

## 6. `check-dod.mjs` 预检规则

检查器只依赖 Node.js 内置模块，默认不改文件、不启动服务、不连接数据库，检查：

1. 必需治理、需求、路线图、详细设计和 backlog 文档是否存在且非空。
2. `packages/contracts/`、`database/mysql/migrations/`、`tests/` 及关键测试子目录是否存在；若目前只有 README，则给出警告，避免把空基座误报为业务完成。
3. `config/local-ports.json` 是否可解析、端口是否重复、是否 loopback、是否关闭自动递增，以及 Core API/Web/DB/Redis/MinIO 等关键端口是否与固定约束一致。
4. 常见代码/配置文件中是否出现私钥头、云厂商/代码托管高置信 Token 或未使用占位符的敏感环境变量；只输出文件和行号，不输出疑似密钥内容。
5. 治理文档是否包含 Phase 1 冻结的关键标记，防止文档被意外截断。

命令：

```text
node scripts/check-dod.mjs --help
node scripts/check-dod.mjs
node scripts/check-dod.mjs --json
node scripts/check-dod.mjs --strict
node scripts/check-dod.mjs --self-test
pnpm g:static
pnpm g:bootstrap --require-runtime
```

退出码：`0` = 无阻断错误；`1` = Gate 失败（或 `--strict` 下有警告）；`2` = 参数/配置/脚本执行错误。默认的“仅有说明文件”是 warning，因为当前仓库仍处在 B0 基线建设期；进入业务发布 Gate 时必须使用 `--strict` 并补齐真实契约、migration 和测试文件。

## 7. 统筹验收模板

```text
Task: DEV-xx-xxx
Feature Ref: FEAT-...
Status submitted: 待验收
G0: PASS/FAIL - ...
G1: PASS/FAIL/N/A - ...
G2: PASS/FAIL/N/A - ...
G3: PASS/FAIL/N/A - ...
G4: PASS/FAIL/N/A - ...
Evidence: requirements/backlog/evidence/<TASK-ID>/...
check-dod: command / exit code / JSON
Decision: 已完成 / 返工 / 阻塞
Reviewer: ...
Reviewed at: YYYY-MM-DD HH:mm
```
