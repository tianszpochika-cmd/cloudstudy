# 当前跨电脑交接（dev）

更新时间：2026-09-02（Asia/Shanghai）。本文件只说明如何恢复当前开发检查点，不替代任务台账或 canonical Evidence manifest。

## 1. 当前检查点

- 分支：`dev`。
- M1-018 审计实现源：`2a747ba3917acd92664911c6b4be070ff469e302`；Evidence C 集成检查点：`3ab5d50e5d22c02a8a8c1d1f92643e37528d85c1`。
- 独立终验：`agent:m1_018_closure_fix_review:gpt-5.6-luna:max` 已对 C 判定 `ACCEPT`，P1/P2=`0/0`。
- 当前台账：`25 ACCEPTED / 1 BLOCKED / 2 IN_PROGRESS / 80 PLANNED`，共 108 项。
- M2 开发检查点：IAM `127fe44`，Gateway 与 canonical execution projection `a10c7ec`；两者均是可恢复的 `IN_PROGRESS / NOT_RUNTIME_VERIFIED` 源码检查点，不是 canonical Evidence 或验收提交。
- M1-018 canonical Evidence：`evidence/p1r/m1/P1R-M1-018/manifest.json`。
- C 阶段将 M1-001..009、11..017 的 current-source 摘要绑定到 `2a747ba`；D 阶段已将唯一包含 GAP registry 摘要的 M1-010 绑定到 C，并录入最终终验。

## 2. M1-018 已完成的内容

- 总 Gate 精确核对 24 个 Contract GAP、15 个 atomic Event GAP 和 1 个 `EVENT-GAP-BIND` 别名。
- 40 个 Contract/Event 记录按各 owner 的 canonical Evidence 关闭；2 个 Implementation GAP 与 3 个 Evidence GAP 保持 OPEN。
- IAM 只新增三条最小 canonical v2 事件：`iam.account.bootstrap.created.v2`、`iam.learning_eligibility.changed.v2`、`iam.policy.security_state_changed.v2`。B8 v1 继续 historical-only，禁止 dual publish 和客户端 producer。
- canonical 规模：OpenAPI `427 operations / 783 schemas`；events `191 / 141 payload schemas`，`50 canonical / 141 historical`；AsyncAPI `50 channels / 184 operations`。
- B26 静态投影：`12 topics / 50 routes / 51 consumer groups`，仍为 `static-only/pending/NO-GO`。
- 首轮 `dea989a` 的源码/测试没有语义失败，但总 Gate 因长检查被 180 秒硬超时而 REWORK；`c548b60` 冻结显式有界超时，`9820ff4` / `2a747ba` 继续完成 registry 关闭审计和相反文档清理。

## 3. 已通过的核心门禁

- M1-018 total gate：PASS。
- M1-018 专项：`48/48`；IAM compatibility：`7/7`。
- 全量 P1R：`1408/1408`；G：`41/41`；workspace typecheck：`7/7`。
- contracts merge/generate/validate：PASS。
- 固定 `463c4b2` 与 `97497af` compatibility：OpenAPI/events/schema 全 compatible。
- event governance/reliability、Gateway、IAM、data ownership/migration、B26 static、plan、CI、diff：PASS。
- M2 检查点专项：Gateway Java 25 `61/61`、Gateway Node 契约 `95/95`；IAM Java 25 普通测试 `41` 项（其中 9 项数据库测试按配置跳过）、启用 MySQL 后 `41/41`，Flyway 11 个迁移至 schema V12；Auth/Policy/Gateway contract audit、contracts merge/generate/validate、plan 和 diff 均 PASS。
- 2026-09-02 全量 P1R 首轮 `1415/1416`；唯一失败是测试进程在清单修正前读到 IAM migration `fileCount=9`。清单已修正为 `11/V12`，修正后 data-ownership 定向回归 `34/34` PASS，最终提交状态第二轮全量 P1R `1416/1416` PASS。

## 4. 必须保留的真实边界

- 当前只是 `D2_CONTRACT_READY / NOT_RUNTIME_VERIFIED`。
- 真实 Gateway CORS/CSRF/Origin、Redis 分布式限流、JWT/JWKS、持久审计和直连阻断归 M2-001。
- 真实 IAM 密码/锁定、refresh rotation/replay、会话撤销、成人 Gate/同意、policy/PDP 归 M2-002。
- 11 个领域服务 Resource Server/PEP 默认拒绝归 M2-003。
- owner schema/grants/TenantScope/Redis ACL 归 M2-004；Kafka/Outbox/consumer/DLQ/replay 归 M2-005；workflow/audit 归 M2-006。
- 浏览器、真机、端到端、集群网络与发布 Gate 仍未验证。
- `P1R-M0-006` 仍因受支持移动工具链的 high 漏洞保持 `BLOCKED`。

## 5. 接手顺序

1. `git fetch origin` 并确认 `dev` 包含 M1-018 最终源、C/D Evidence 提交。
2. 运行 `pnpm plan:p1r:check`、`node scripts/audit/p1r-gap-registry-check.mjs --json`、`pnpm p1r:evidence:check`。
3. 从 `P1R-M2-001` 和 `P1R-M2-002` 两条可并行轨道开始；它们验收后再进入 `P1R-M2-003`。
4. 所有 Java 25 测试必须显式使用有效的 JDK 25；当前主机已验证 `C:\Users\tiansongzhen\.jdks\openjdk-25.0.2`，默认 PATH 上的 JDK 21 不是 M2 验收工具链。
5. 没有真实运行环境的检查只能记为 `NOT_RUNTIME_VERIFIED`，不得改写为 PASS/GO。

## 6. 当前执行中的 M2 轨道

- `P1R-M2-001`：Gateway 进程内实现与 canonical execution projection 已保存到 `a10c7ec`；真实 Redis/JWKS/upstream/浏览器/NetworkPolicy 与 durable audit 仍待运行 Evidence。
- `P1R-M2-002`：IAM 密码、会话、成人 Gate/同意、幂等、限流、Policy/PDP 和 JDBC/Flyway 检查点已保存到 `127fe44`；真实 Redis、跨进程 Gateway/领域服务和故障恢复仍待运行 Evidence。
- `P1R-M2-003` 仅做只读预研；必须等待 M2-001/M2-002 验收后才能转为实现。

## 7. M2 检查点验收前必须关闭的风险

- IAM legacy Consent 中摘要为空的历史行仍可能导致 `JdbcConsentStore.history()` 读取失败，需要兼容迁移或读取策略及回归测试。
- 登录与并发密码重置之间缺少锁内 password-hash 复验，旧密码仍存在一次竞态登录窗口。
- Idempotency 外层事务与 Consent/Policy 内层事务的预期拒绝可能形成 rollback-only，最终转为 500 并回滚拒绝审计；需补 controller + idempotency + MySQL 组合测试。
- 登录失败计数当前使用独立事务，仍可能出现锁定事实已提交而审计失败的非原子状态。
- 正式 Consent 策略来源、密码重置消息投递、VERIFIED device trust，以及 Gateway 的真实 Redis/JWKS/upstream/浏览器/NetworkPolicy/durable audit 尚未形成运行 Evidence。
