# M1 统一执行日志

更新时间：2026-08-29（Asia/Shanghai）。本记录随实际状态推进，不继承旧 B/DEV/G Evidence。

## 当前任务

- `P1R-M1-001`：`ACCEPTED`；原实现源 `96e1b541cdda8e9e5ad02bc79ea0c5b9032064c4`，Evidence `evidence/p1r/m1/P1R-M1-001/manifest.json`；共享产物在 `82b27f4` 由 Luna Max 完成 current-source revalidation。
- `P1R-M1-002`：`ACCEPTED`；原最终实现源 `25705c4caab46449cfaa577db08bd13c8ad13fba`，Evidence `evidence/p1r/m1/P1R-M1-002/manifest.json`，原独立评审 `m1_002_final_review`（Terra Ultra）；共享产物在 `82b27f4` 由 Luna Max 完成 current-source revalidation。
- `P1R-M1-003`：`ACCEPTED`；最终实现源 `82b27f4108cfb976a274c2ac0cc34b1c9460a7a7`，Evidence `evidence/p1r/m1/P1R-M1-003/manifest.json`，独立评审 `m1_003_final_review`（Luna Max）。
- M0 供应链阻塞不在 M1-001 显式依赖内，但继续禁止发布与“M0 全绿”声明。

## M1-003 执行轨道

1. IAM 权限契约：只修改 B8 OpenAPI 源，冻结 principal、成人 Gate、consent、tenant、RBAC/ABAC、admin policy 生命周期与内部 PEP/PDP 输入输出。
2. 失败关闭校验：只新增 M1-003 结构化审计/测试与命令入口，覆盖客户端伪造 authority、缺失 owner/tenant、默认拒绝、成人/同意限制、双人审批、撤销和缓存失效。
3. 设计一致性：只对齐 ADR-0010、安全边界和契约说明，明确控制面、服务本地 PEP、远程 PDP 触发条件与 fail closed 语义。

统筹 Agent 独占公共生成物、兼容基线、状态、Evidence、提交与远程推送。运行期 IAM、领域服务 PEP、真实数据库与 Gateway 仍分别属于 M2-002/M2-003/M1-004。

实际调度：`m1_003_policy_contract`（Terra Ultra）完成权限契约源；根级线程上限阻止另外两名执行 Agent 启动，因此 `root-coordinator` 在互斥文件边界内接管失败关闭审计和设计一致性；`m1_003_final_review`（Luna Max）只读独立终验。没有调用模型未知的历史 Agent，也没有把未启动轨道记录成已完成。

## M1-002 执行轨道

1. IAM 契约源：只修改认证 OpenAPI 源，拆分 Web Cookie 与原生安全存储请求/响应，并固定 RS256/JWKS、轮换、重放、撤销和错误语义。
2. 失败关闭校验：只修改 P1R 认证审计/测试，拒绝混合凭据、弱化 Cookie、可变算法或不完整错误契约。
3. 设计一致性：只修改 ADR-0013 与契约说明，明确 transport profile、discriminator 和会话终止边界；只读确认生成设计文档已无 OAuth client/redirect 与“禁止密码直登”冲突。

统筹 Agent 独占 canonical 合并、生成物、台账、状态轨迹、Evidence、最终提交和远程推送。三个执行 Agent 分别为 `m1_002_auth_contract`（Terra Ultra）、`m1_002_auth_audit`（Luna Max）和只读终验 `m1_002_final_review`（Terra Ultra）；因根级线程名额和公共合约依赖采用顺序调度，没有使用模型未知的历史 Agent。

## M1-001 结果摘要

- canonical API：367 operations / 486 schemas；317 个 JSON 2xx 与 385 个标准错误响应通过公共语义检查。
- 幂等：165 个外部写，164 个 required，1 个具名 signed-access 例外。
- 分页：58 个 `list*` + 2 个已有 Cursor 操作统一为 cursor；P1R 34/34。
- 兼容：以 `4d7f73a867ff3e1db8582eab7593c173625bc8a3` 为不可变基线，OpenAPI/events/schema 均 0 breaking。

## M1-002 结果摘要

- 认证传输：`WEB_COOKIE` 与 `NATIVE_SECURE_STORAGE` 使用具名请求/响应 schema 和 `data.authTransport` discriminator；生成客户端不再暴露可选 Refresh Token 的混合响应。
- 会话安全：固定短时 RS256、RSA JWKS、`kid`/缓存/轮换/重叠与 unknown-kid fail closed；固定 rotation、reuse/replay、family/session revoke、logout、reset 和清 Cookie 语义。
- 契约工具：新增 `p1r:auth-contract:check` 与 10 个失败关闭测试；canonical 计数为 367 operations / 497 schemas，Git baseline 0 breaking。
- 验证：P1R 44/44、B8 29/29、G1 6/6；完整 G 的 G0/G3 两项旧 source marker 失败经独立评审确认不由本任务引入。

## M1-003 结果摘要

- 权威上下文：principal、tenant、role/permission 由 IAM 派生，resource owner/content rights 由领域 owner 提供；客户端 authority 字段不能放大权限。
- 准入与授权：成人 Gate、required consent、RBAC+ABAC、默认拒绝、本地 PEP/远程 PDP、可信服务身份和异常 fail closed 已形成严格契约。
- 策略治理：新增 8 个控制面操作和 1 个结构化 PDP 操作，覆盖 draft/submit/独立 approve/activate/revoke、职责分离、审计、幂等和缓存失效。
- 契约工具：新增 `p1r:iam-policy-contract:check` 与 13 个失败关闭测试；canonical 计数为 377 operations / 536 schemas，Git baseline 0 breaking。
- 验证：P1R 57/57、B8 29/29、G1 6/6；独立 Luna Max 评审接受最终源。完整 G 仍是既有 39/41，D2 不替代 M2 运行实现。
