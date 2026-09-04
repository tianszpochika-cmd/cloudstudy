# 当前跨电脑交接（dev）

更新时间：2026-09-04（Asia/Shanghai）。本文件只说明如何恢复当前开发检查点，不替代任务台账或 canonical Evidence manifest。

## 1. 当前检查点

- 分支：`dev`。
- M1-018 审计实现源：`2a747ba3917acd92664911c6b4be070ff469e302`；Evidence C 集成检查点：`3ab5d50e5d22c02a8a8c1d1f92643e37528d85c1`。
- 独立终验：`agent:m1_018_closure_fix_review:gpt-5.6-luna:max` 已对 C 判定 `ACCEPT`，P1/P2=`0/0`。
- 当前台账：`25 ACCEPTED / 1 BLOCKED / 2 IN_PROGRESS / 80 PLANNED`，共 108 项。
- M2 开发检查点：IAM `127fe44`；Gateway 基础投影 `a10c7ec`、安全收口 `acee36a84ee1fd6557ac3b62a41d033622e8da4a`、health/Evidence 责任治理源码 `9560c75`。两条轨道均为可恢复的 `IN_PROGRESS / NOT_RUNTIME_VERIFIED` 源码检查点，不是 canonical Evidence 或验收提交。
- 2026-09-04 恢复审计起点为干净且与当时 `origin/dev@9e88958` 一致；Gateway 治理源码为 `9560c75`，其后的本交接绑定提交已纳入本地 `dev`，相对该远程跟踪提交共领先 4 个提交。此前 `git fetch`/`git push` 均因 GitHub 443 连接失败而未同步，接手者必须重试推送并核对远程差异。
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
- 2026-09-04 `acee36a` Gateway 安全收口：Java 25 `62/62`、Gateway Node `32/32`、全量 P1R `1416/1416`、canonical Gateway audit `56 rules / 151 projections / 168 available / 197 unavailable`、contracts merge/validate、三类 Git baseline compatibility、plan、GAP registry 和 diff 均 PASS。该组仍不是跨进程/浏览器/Redis/网络/持久审计 Evidence。
- 2026-09-04 Gateway health/治理源码 `9560c75`：Java 25 `63/63`、Gateway Node `37/37`、contract tooling `63/63`、merge `26 OpenAPI fragments / 20 event fragments / 396 routes / 191 events`、validate `427 operations / 783 schemas / 191 events`、生成物 `5/5`、相对 `66246d5` compatibility `0 breaking`、计划 `108/108` 均 PASS；独立 reviewer `gateway_governance_independent_review` 最终 `ACCEPT`、P1/P2=`0/0`。该结论仍不构成真实 Redis/JWKS/upstream/browser、durable audit 或 NetworkPolicy Evidence。

## 4. 必须保留的真实边界

- 当前只是 `D2_CONTRACT_READY / NOT_RUNTIME_VERIFIED`。
- 真实 Gateway CORS/CSRF/Origin、Redis 分布式限流与 JWT/JWKS 归 M2-001；durable audit、NetworkPolicy 直连阻断、平台关联终验和 staging 复验分别归 M2-006、M2-008、M2-010、M8-013，见 `M2-EVIDENCE-RESPONSIBILITY-ADDENDUM-2026-09-04.md`。
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

- `P1R-M2-001`：Gateway 进程内实现与 canonical execution projection 已保存到 `a10c7ec`，支付回调 fail-closed、单值关联 header、默认关闭未验收 owner 路由及兼容路由死配置已保存到 `acee36a`；`9560c75` 将 `/api/v1/health` contract-first 修正为 `api-gateway` 身份，冻结 Gateway root 与 health 两个标量节点的受控晋升、不可用 owner 真实 WebFlux 404 和 Evidence 责任校正，并取得独立 `ACCEPT`。真实 Redis/JWKS/upstream/浏览器与生产 Netty header 顺序仍待当前源码跨进程 Evidence，任务继续 `IN_PROGRESS / NOT_RUNTIME_VERIFIED`。
- `P1R-M2-002`：IAM 密码、会话、成人 Gate/同意、幂等、限流、Policy/PDP 和 JDBC/Flyway 检查点已保存到 `127fe44`；真实 Redis、跨进程 Gateway/领域服务和故障恢复仍待运行 Evidence。
- `P1R-M2-003` 仅做只读预研；必须等待 M2-001/M2-002 验收后才能转为实现。

## 7. M2 检查点验收前必须关闭的风险

- IAM legacy Consent 中摘要为空的历史行仍可能导致 `JdbcConsentStore.history()` 读取失败，需要兼容迁移或读取策略及回归测试。
- IAM 登录/并发密码重置修复已进入返工：实现方向已改为锁前 BCrypt、短事务锁内重读 hash/status/counter，仍须补真实并发与 Spring 事务回滚证据并取得独立复审 `ACCEPT`。
- Idempotency 外层事务与 Consent/Policy 内层事务的预期拒绝可能形成 rollback-only，最终转为 500 并回滚拒绝审计；需补 controller + idempotency + MySQL 组合测试。
- IAM 登录失败计数、锁定事实、幂等完成与审计必须在同一 Spring 事务中接受 MySQL 并发/回滚验证；在该验证完成前不得宣称原子性 PASS。
- 正式 Consent 策略来源、密码重置消息投递、VERIFIED device trust，以及 Gateway 的真实 Redis/JWKS/upstream/浏览器尚未形成当前提交运行 Evidence；NetworkPolicy/durable audit 的后续责任已校正到 M2-008/M2-006，但对应 GAP 仍为 `OPEN / NOT_RUNTIME_VERIFIED`。
- Gateway health 身份与 Evidence 责任闭环已在 `9560c75` 完成契约、实现和文档校正；执行入口、交接、Addendum 范围和 M2-004 audit-service owner 已同步，独立治理复审最终 `ACCEPT`、P1/P2=`0/0`。该校正不产生 runtime PASS，也不降低 M2-010/M8-013 最终标准。
- IAM 幂等已引入独立 HMAC 指纹、版本化存储与 credential current-facts callback，Java 25 普通测试和隔离 MySQL 8.4 全套均为 `52/52`；独立安全审查仍判定 `REWORK`：账户锁定/禁用当前事实、access-token replay TTL、未知 scope 默认拒绝、公开测试密钥构造器及 V13 滚动迁移/升级竞态尚须修复并补证据。
- IAM 其他未关闭风险仍包括：`NATIVE_SECURE_STORAGE` 客户端自证、正式 Consent descriptor/策略来源、legacy 空摘要兼容、外层幂等事务与内层预期拒绝的 rollback-only、密码重置消息投递及限流/缺失账户审计；均须分批修复并独立复审。
