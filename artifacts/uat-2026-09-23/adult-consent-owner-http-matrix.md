# 成人准入与同意：真实 HTTP owner 矩阵

2026-09-23，本机现行 Java 进程经 Gateway `127.0.0.1:18070`，运行 `node scripts/runtime/uat-adult-consent-owner-matrix.mjs`。一次性 `@local.invalid` 账号只用于此探针；输出未包含口令、Cookie 或 JWT。运行结束后精确匹配该账号，状态 `DISABLED`，角色/权限清空，活跃会话 `0`。

| 阶段 | learner 资料 | learning 当前计划 | assessment 定级读取 | content 学习目录 |
| --- | ---: | ---: | ---: | ---: |
| 成人 Gate 前 | 403 | 403 | 403 | 403 |
| Gate 通过、同意未完成 | 403 | 403 | 403 | 403 |
| 三项必需同意完成并重新登录 | 200 | 200 | 200 | 200 |
| 撤回隐私同意，继续使用旧 Access Token | 200 | 200 | 200 | 200 |
| 撤回后重新登录取得新 Access Token | 403 | 403 | 403 | 403 |

Gate 写入和三项同意写入各返回 200。此矩阵证实服务端 Gate/同意签发与四个 owner 读边界能按新令牌工作，也证实撤回后旧 JWT 仍可在其剩余有效期内读学习者数据。IAM 的撤回事实已落库并撤销会话；Gateway 和四个 owner 只验证旧 JWT 中冻结的 `consent_state=GRANTED`，不复核精确 `session_id`。`docs/10-decisions/0017-access-token-eligibility-claims.md` 第 3 项明确选择签发时冻结声明、900 秒 TTL（验证器另有时钟容差）；因此这是现行 ADR 的实测时效限制，不把本次 200 误写成偶发服务故障或撤回即时生效。`docs/02-architecture/security-and-data-boundaries.md` 同时要求撤回后拒绝对应动作、撤销状态不确定时 fail closed；两份基线的即时性需要统一。要让撤回即时生效，需修订 ADR，并让 Gateway 与各 owner 独立复核精确会话/撤销事实，未知时拒绝。只改客户端或 Gateway 都不足。当前不得把同意撤回链标成全量验收 PASS。

本地使用 `local-development-attestation` 年龄输入，只能验证本地链路，不能代替生产可信年龄证据、正式发布的法律文档版本或真实学习内容验收。
