# M1 统一执行日志

更新时间：2026-08-29（Asia/Shanghai）。本记录随实际状态推进，不继承旧 B/DEV/G Evidence。

## 当前任务

- `P1R-M1-001`：`ACCEPTED`；实现源 `96e1b541cdda8e9e5ad02bc79ea0c5b9032064c4`，Evidence `evidence/p1r/m1/P1R-M1-001/manifest.json`。
- `P1R-M1-002`：`IN_PROGRESS`；起始检查点 `dev@0a985f00c521e8f27a54f891fc1526178ba0320c`，只冻结自有 IAM 认证生命周期与 Web/原生凭据传输契约，不提前实现运行时。
- M0 供应链阻塞不在 M1-001 显式依赖内，但继续禁止发布与“M0 全绿”声明。

## 并行轨道

1. IAM 契约源：只修改认证 OpenAPI 源，拆分 Web Cookie 与原生安全存储请求/响应，并固定 RS256/JWKS、轮换、重放、撤销和错误语义。
2. 失败关闭校验：只修改 P1R 认证审计/测试，拒绝混合凭据、弱化 Cookie、可变算法或不完整错误契约。
3. 设计一致性：只修改认证相关设计/ADR 说明，移除 OIDC/client/redirect 与“禁止自研 Token Server”等过期冲突表述。

统筹 Agent 独占 canonical 合并、生成物、台账、状态轨迹、Evidence、最终提交和远程推送。三个执行轨道只能使用 Terra Ultra 或 Luna Max，不能自行改变任务状态或宣称验收通过。

## M1-001 结果摘要

- canonical API：367 operations / 486 schemas；317 个 JSON 2xx 与 385 个标准错误响应通过公共语义检查。
- 幂等：165 个外部写，164 个 required，1 个具名 signed-access 例外。
- 分页：58 个 `list*` + 2 个已有 Cursor 操作统一为 cursor；P1R 34/34。
- 兼容：以 `4d7f73a867ff3e1db8582eab7593c173625bc8a3` 为不可变基线，OpenAPI/events/schema 均 0 breaking。
