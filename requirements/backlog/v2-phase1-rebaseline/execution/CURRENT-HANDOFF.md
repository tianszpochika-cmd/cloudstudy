# 当前跨电脑交接（dev）

更新时间：2026-09-11（Asia/Shanghai）。本文件只说明如何恢复当前开发检查点，不替代任务台账或 canonical Evidence manifest。

## 2026-09-11 M2-001/M2-002 均验收（最新恢复入口）

更新时间：2026-09-11 16:40（Asia/Shanghai）。

- `P1R-M2-001` 独立只读终审判定 **`ACCEPT`**（P0/P1/P2=`0/0/0`，5 条 P3 加固建议不阻塞），台账晋升 **`ACCEPTED`**；canonical manifest `evidence/p1r/m2/P1R-M2-001/manifest.json`（23 artifacts，`sourceCommit=7ba4d33`），状态轨迹追加 `REVIEW → ACCEPTED`。运行证据 `evidence/p1r/m2/P1R-M2-001/runtime-evidence-2026-09-11.json`（`--run --browser --fault` PASS，29/29，`notRuntimeVerified: []`）。未验证边界不变：durable audit/NetworkPolicy/平台关联/staging/并发副本分别归 M2-006/008/010 与 M8-013。
- `P1R-M2-002` 独立只读终审判定 **`ACCEPT`**（P0/P1/P2=`0/0/0`，余 2 条非阻塞 P3），台账晋升 **`ACCEPTED`**；canonical manifest `evidence/p1r/m2/P1R-M2-002/manifest.json`（35 artifacts，`sourceCommit=c9f935b`），状态轨迹追加 `REVIEW → ACCEPTED`。返工批次 ①–⑧ 关闭全部 5 项原始 P1 与 2 项终审新发现的同意 fail-open（`7c0f428` 空控制面、`c9f935b` 部分发布规范必需集）。运行证据：opt-in MySQL 矩阵 **19/19**、V13 迁移安全 **1/1**、跨进程重启刷新 **200（rotation=1）**、IAM 全套 **90/0/0（20 skipped）**、P1R **1421/1421**；归档 `evidence/p1r/m2/P1R-M2-002/opt-in-cross-process-evidence-2026-09-11.json`（历史绑定 `172dfca`，后续加固已在 HEAD 复验）。
- 台账：`27 ACCEPTED / 1 BLOCKED / 0 IN_PROGRESS / 80 PLANNED`；总阶段仍为 `D2_CONTRACT_READY / NOT_RUNTIME_VERIFIED`；`P1R-M2-003` 依赖已满足（M2-001 + M2-002 均 `ACCEPTED`），尚未认领/启动，须按 P1R 流程从 `PLANNED/READY` 进入。
- 已知边界（M2-002）：真实邮件/短信投递与重试、真实 App Attest/Play Integrity 与真机 Keychain/Keystore、并发 IAM 副本/HA 未验证；2 项 P3（legacy 重放控制器级 409 用例、规范必需类型映射维护断言）留待后续。
- 本机 opt-in 隔离库：标准栈 MySQL 8.0（`iam_service` + `iam_v13_test_20260911_a`，`iam_runtime` 仅本地测试）；opt-in 全矩阵 19/19 与 V13 1/1 已在孤立库复现。
- M2-001 验收门禁（提交 `183c08a`）：`plan:p1r:check` PASS（26/1/1/80）、`p1r-gap-registry-check` PASS（40 CLOSED / 5 OPEN）、`p1r:evidence:check` PASS（108 tasks / `errors: []`）、`docs:audit` PASS、`check-dod --strict` PASS=5 WARN=0 FAIL=0、全量 P1R **1421/1421 PASS**（Node 20.19.5）。
- GitHub 网络仍间歇不可达，本地提交待网络恢复后推送。

## 2026-09-11 阶段更新（历史，已被上节取代）

- `P1R-M2-001` 真实运行批次已完成并归档：在标准本地栈 `yuxuexing-local`（Redis 7 `127.0.0.1:16379`）以 JDK 25 构建两棵服务树后执行（`dev@352879a`，services 树 `CLEAN`）。`--run --browser` → 27/27 PASS（16 普通 + 11 浏览器，`PARTIAL`，仅 503 未请求）；`--run --browser --fault`（精确 pause/unpause `yuxuexing-local-redis-1`）→ **`result: PASS`，29/29 PASS，`notRuntimeVerified: []`**，审计覆盖 `200/401/403/404/429/503` 与三个浏览器 reasonCode，`redis.destructiveCommandsUsed=false`、`sensitiveMaterial={persisted:false,emitted:false}`。证据：`evidence/p1r/m2/P1R-M2-001/runtime-evidence-2026-09-11.json`。首次 `--run --browser` 曾在 `redis-limit-process-a-first` 瞬时 `HTTP_STATUS` 失败（健康桶未写入、DB15 仅存浏览器阶段 `iam-jwks-public` 桶，排除 429；判定为首次请求超过 750ms 后端预算的 fail-closed），等待健康键自然过期后重跑通过，未删除任何键。详见 [P1R-M2-001 执行记录](P1R-M2-001.md)。
- `P1R-M2-002` 幂等边界预期拒绝批次源码（提交 `4bc645c`）：修复 Consent/Policy 内层事务 rollback-only（`UnexpectedRollbackException`）与幂等重放状态映射；新增 opt-in MySQL 测试 4/4，全套 71 tests 通过。详见 [P1R-M2-002 执行记录](P1R-M2-002.md)。
- 前端契约修复：三个客户端删除契约外 `X-Client-Platform`，真实浏览器登录恢复（提交 `db49906`）。
- 台账仍为 `25 ACCEPTED / 1 BLOCKED / 2 IN_PROGRESS / 80 PLANNED`；M2-001/M2-002 保持 `IN_PROGRESS / NOT_RUNTIME_VERIFIED`，M2-003 及后续依赖未解锁；总阶段仍为 `D2_CONTRACT_READY / NOT_RUNTIME_VERIFIED`。
- 本机环境：JDK 25 `C:\Users\tiansongzhen\.jdks\openjdk-25.0.2`（系统 `JAVA_HOME` 仍为 JDK 21，本项目按命令临时覆盖，不影响其他项目）；标准栈 `yuxuexing-local`（MySQL 13306 / Redis 16379 / Kafka 19092 / MinIO 19000-19001 / RabbitMQ 15689-15690）已替代临时 `cloudstudy-p1r-m2-*` 夹具并全部 healthy；Node 20.19.5、Maven 3.9.12、Edge 152、Playwright 1.63。项目历史临时容器已移除；`cloudstudy-p1r-m2-*` 数据卷保留。GitHub 网络间歇不可达，push 需等网络恢复。
- 本机仍存 M2-002 待办：`v2,local-real` 启动的 IAM 无 `local` profile，正式 Consent 策略来源缺失时 `/api/v1/iam/principal/me` 返回 503 `iam.consent.version_unavailable`；`m2-evidence` 夹具使用显式 `local` profile，不受影响。
- 下一步：① 取 M2-001/M2-002 **最终独立只读复审**；② M2-002 继续 legacy Consent 空摘要兼容、密码重置投递与 device trust；③ 网络恢复后推送本轮证据与文档提交。

## 2026-09-10 阶段更新（历史，已被上节取代）

- 本轮起点 `dev@6131783`；本轮提交：`6ceaf7f`（门禁列数修复）→ `d4909f1`（M0/M1 基线重定）→ `d530c0f`（CHANGELOG）→ `5172581`（`.gitattributes`）→ `7551da5`（CHANGELOG）→ `51a86c8`（Gateway 信封 JWKS 修复）。
- **门禁回归修复**：台账第 9 列「资产验证」上线时漏改 `scripts/audit/p1r-evidence-gate.mjs`，而 `p1r-gap-registry-check.mjs` 通过 `import { parseLedger }` 复用它，导致 evidence gate 与 gap registry **双双结构性失败**（`tasks: []`，根本走不到 digest 比对）。修复后两者恢复。
- **跨平台换行符**：项目此前只有 `.editorconfig`（仅约束编辑器）而**无 `.gitattributes`**，本机 `core.autocrlf=true` 使工作区检出为 CRLF，任何用 `\n` 匹配的测试必然失败（实测 2 项 P1R 测试假失败，接口正则提取数为 0、转 LF 后为 191）。已新增 `.gitattributes`（`* text=auto eol=lf`；二进制 `binary`；`*.bat`/`*.cmd` 保持 CRLF）并将工作区 2318 个文件转为 LF（worktree/index/HEAD 三者 hash 一致，**无内容变更**）。恢复 `core.autocrlf=true` 后重新检出仍为 LF，证明 `.gitattributes` 已接管。
- **M0/M1 证据基线重定**：按既定 current-source 重验证流程把 22 个 manifest 的 `sourceCommit` 前移至 `6ceaf7f91109d4880c89d5dbbf24bef7b9a1ca3b`，646 条 `artifactDigests` 重算（实际变化 136 条），逐项追加 `provenance.currentSourceRevalidationHistory`，原 provenance / reviewHistory 未动。复核依据为全量 P1R 回归 **1421/1421 PASS**（Node 20.19.5）。**9-09 记录的全局 Evidence Gate FAIL 已消除：`pnpm p1r:evidence:check` 现为 PASS（108 tasks / `errors: []`）**；gap registry PASS（40 CLOSED / 5 OPEN）；plan check PASS（25/1/2/80）。
- **M2-001 首次真实跨进程运行**：`--run` 首次执行即暴露出一个真实解码缺陷——IAM 按冻结契约把 `/api/v1/auth/jwks` 发布为 `ApiSuccessEnvelope`，而 Gateway 的 `NimbusReactiveJwtDecoder.withJwkSetUri(...)` 把整个文档交给 `JWKSet.parse`（只接受裸 RFC 7517 JWK Set），导致**合法 access token 一律 401 且在网关本地即拒绝、从未转发到 IAM**。已在消费侧修复（提 `51a86c8`：新增 `GatewayIamPublicJwkSource`，+13 测试），随后 `--run --fault` 取得 **`result: PASS`，18/18 检查 PASS，`notRuntimeVerified: []`**（含真实 401/403/404/429/503、Redis 故障 fail-closed 与恢复、DB15 跨进程额度续算、脱敏 audit envelope）。证据：`evidence/p1r/m2/P1R-M2-001/runtime-evidence-2026-09-10.json`。详见 [P1R-M2-001 执行记录](P1R-M2-001.md)。
- **台账状态与阶段结论均未变**：`25 ACCEPTED / 1 BLOCKED / 2 IN_PROGRESS / 80 PLANNED`；M2-001、M2-002 仍 `IN_PROGRESS`，M2-003 及后续依赖未解锁；总阶段仍为 `D2_CONTRACT_READY / NOT_RUNTIME_VERIFIED`。
- **本机（本轮实际使用）环境**：JDK 25 `C:\Program Files\Microsoft\jdk-25.0.4.101-hotspot`（已设用户级 `JAVA_HOME`）；Node **20.19.5** 位于 `C:\Users\Administrator\Tools\node-v20.19.5-win-x64`（已由管理员写入 Machine PATH 首位）；Maven 3.9.9；Docker 引擎运行中，MySQL 13306 / Redis 16379 / Kafka 19092 / MinIO 19000 均 healthy；Edge 152 满足浏览器要求；`node scripts/dev/p1r-toolchain-check.mjs` **PASS（errors: []）**；项目禁止的 `yuxuexing-local-keycloak-1` 容器已停止。
- 本机特有陷阱（不影响用户真实终端）：① Git Bash 会话缺失 `ProgramFiles` / `ProgramFiles(x86)`，会让 Docker compose 插件探测与浏览器探测**假失败**，需 `env 'ProgramFiles=C:\Program Files' 'ProgramFiles(x86)=C:\Program Files (x86)'`；② Git Bash 直接跑 `mvn`（unix 脚本）报 `classworlds.launcher.Launcher` 找不到属 MSYS 路径转换问题（Maven 完好），改直接 `java -classpath <MVN>/boot/plexus-classworlds-*.jar ... Launcher` 或 PowerShell 调 `mvn.cmd`。
- 下一步：① M2-001 补浏览器 Cookie/CORS/CSRF/Origin/Referer 正负例（需人工或外部浏览器运行器，按 `services/api-gateway/src/test/runtime/README.md`）；② M2-001/M2-002 取得**最终独立复审**（独立于实现者）；③ M2-002 按既有顺序推进 IAM 剩余风险批次。

## 2026-09-09 阶段性收尾（历史，已被上节取代）

- 按用户要求保存当前成果并暂停后续研发。Gateway 检查点 `22ab84f`；IAM 幂等/V13 与迁移资产清单检查点 `ad172e5`。两者均为待最终独立审查的开发检查点，不是任务验收或生产放行。
- 台账仍为 `25 ACCEPTED / 1 BLOCKED / 2 IN_PROGRESS / 80 PLANNED`；M2-001、M2-002 保持 `IN_PROGRESS`，M2-003 及后续依赖未解锁；总阶段仍为 `D2_CONTRACT_READY / NOT_RUNTIME_VERIFIED`。
- 完整收尾、测试日期、风险与恢复步骤见 [M2 阶段收尾记录](M2-STAGE-CHECKPOINT-2026-09-09.md)。下文 2026-09-04 记录为历史验证，不能当成本日环境验证。
- 本日全局 Evidence Gate 为 `FAIL`：M0/M1 current-source artifactDigests 与 HEAD 存在漂移；GAP registry 仍 PASS（40 CLOSED / 5 OPEN）。下次须复核对应回归和 review history 后更新 manifest，不能只刷新摘要。台账保留历史验收状态，不表示当前 HEAD 已通过全局门禁。
- 2026-09-09 Java 25 IAM 定向测试 `41/41`、Gateway Node `7/7`、计划 `108/108`、data ownership 静态检查与 diff 检查通过。此前 Gateway Java 25 全套 `69/69` 和 MySQL 8.4 V12→V13 `1/1` 结果保留；本日 Docker Linux engine 不可连接，未重新执行数据库/容器测试。
- V13 是单向、非滚动升级。已移除 local profile 中自动确认 drain 的设置；升级前必须停止写入口、排空旧 writer，再显式设置 `IAM_IDEMPOTENCY_V13_WRITERS_DRAINED=true`。旧隔离 `iam_service` 曾应用未提交旧版 V13，恢复时须核对 schema/Flyway history，不能直接重跑或修改已部署迁移掩盖漂移。
- 下一步：先完成两个检查点的独立复审与适用修复；IAM 按嵌套事务/Consent CAS → legacy Consent/V14 → password reset 投递与审计 → native trusted-context 顺序推进，Gateway 补当前提交真实服务、Redis 故障恢复与浏览器证据。

## 1. 当前检查点

- 分支：`dev`。
- M1-018 审计实现源：`2a747ba3917acd92664911c6b4be070ff469e302`；Evidence C 集成检查点：`3ab5d50e5d22c02a8a8c1d1f92643e37528d85c1`。
- 独立终验：`agent:m1_018_closure_fix_review:gpt-5.6-luna:max` 已对 C 判定 `ACCEPT`，P1/P2=`0/0`。
- 当前台账：`25 ACCEPTED / 1 BLOCKED / 2 IN_PROGRESS / 80 PLANNED`，共 108 项。
- M2 开发检查点：IAM 基础 `127fe44`、账户并发安全源码 `9deb899`；Gateway 基础投影 `a10c7ec`、安全收口 `acee36a84ee1fd6557ac3b62a41d033622e8da4a`、health/Evidence 责任治理源码 `9560c75`。两条轨道均为可恢复的 `IN_PROGRESS / NOT_RUNTIME_VERIFIED` 源码检查点，不是 canonical Evidence 或任务验收提交。
- 2026-09-04 恢复审计起点为干净且与当时 `origin/dev@9e88958` 一致；Gateway 治理源码 `9560c75` 与交接绑定检查点 `d840539` 已成功推送，`origin/dev` 从 `9e88958` 前进到 `d840539`。此后的原子提交仍须逐一推送并用远程差异核对结果，不能仅凭本地 SHA 宣称同步。
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
- 2026-09-04 IAM 账户并发安全源码 `9deb899`：Java 25 定向 `29/29`、普通全套 `57` 项且 0 failure/error（13 项外部集成按配置跳过）、真实 MySQL 8.4/Spring 事务代理 `8/8`、只含该源码提交的 detached worktree 定向 `29/29` 均 PASS；独立 reviewer 最终 `ACCEPT`、P1/P2=`0/0`。该结论只覆盖 password/hash epoch、锁定计数和 audit/idempotency 同事务回滚，不覆盖 M2-002 其余批次。

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
4. 所有 Java 25 测试必须显式使用有效的 JDK 25。已验证路径：本机 `C:\Program Files\Microsoft\jdk-25.0.4.101-hotspot`；另一台主机 `C:\Users\tiansongzhen\.jdks\openjdk-25.0.2`。默认 PATH 上的旧 JDK 不是 M2 验收工具链。前端/脚本工具链要求 **Node 20.19.5**（项目 `engines`），Maven 使用 3.9.9。
5. M2-001 真实跨进程运行批次：`node services/api-gateway/src/test/runtime/p1r-m2-001-runtime.mjs --run`；含 Redis 故障注入时加 `--fault` 并提供 `M2_REDIS_FAULT_OPT_IN=PAUSE_EXACT_REDIS_16379_AND_RECOVER` 与 `M2_REDIS_CONTAINER=<exact-name>`。该批次**要求 Gateway/IAM 两棵源码树已提交且 jar 为 Java 25 当前构建**，并拒绝已存在的 DB15 health 限流键（须等其 TTL 自然过期，不得删除）。
6. 没有真实运行环境的检查只能记为 `NOT_RUNTIME_VERIFIED`，不得改写为 PASS/GO。

## 6. 当前执行中的 M2 轨道

- `P1R-M2-001`：Gateway 进程内实现与 canonical execution projection 已保存到 `a10c7ec`，支付回调 fail-closed、单值关联 header、默认关闭未验收 owner 路由及兼容路由死配置已保存到 `acee36a`；`9560c75` 将 `/api/v1/health` contract-first 修正为 `api-gateway` 身份，冻结 Gateway root 与 health 两个标量节点的受控晋升、不可用 owner 真实 WebFlux 404 和 Evidence 责任校正，并取得独立 `ACCEPT`。真实 Redis/JWKS/upstream/浏览器与生产 Netty header 顺序仍待当前源码跨进程 Evidence，任务继续 `IN_PROGRESS / NOT_RUNTIME_VERIFIED`。
- `P1R-M2-002`：IAM 密码、会话、成人 Gate/同意、幂等、限流、Policy/PDP 和 JDBC/Flyway 基础检查点已保存到 `127fe44`；`9deb899` 已关闭 password reset/login hash epoch 竞态、并发锁定计数和正式 login 外层事务回滚问题并获独立 `ACCEPT`。幂等/V13 与其余安全批次仍在返工，真实 Redis、跨进程 Gateway/领域服务和故障恢复仍待运行 Evidence。
- `P1R-M2-003` 仅做只读预研；必须等待 M2-001/M2-002 验收后才能转为实现。

## 7. M2 检查点验收前必须关闭的风险

- IAM legacy Consent 中摘要为空的历史行仍可能导致 `JdbcConsentStore.history()` 读取失败，需要兼容迁移或读取策略及回归测试。
- IAM 登录/并发密码重置批次已在 `9deb899` 完成：锁前 BCrypt、短事务锁内重读、credential epoch 变化零写入拒绝、四路精确计数及 audit/idempotency 回滚均有真实 MySQL 证据，独立复审 `ACCEPT`；该局部结论不改变 M2-002 总状态。
- Idempotency 外层事务与 Consent/Policy 内层事务的预期拒绝可能形成 rollback-only，最终转为 500 并回滚拒绝审计；需补 controller + idempotency + MySQL 组合测试。
- IAM 正式 login 路径的失败计数/锁定事实、幂等 claim 与审计同事务回滚已在 `9deb899` 通过 MySQL 8.4/Spring 代理验证；未来 audit-service 拆分后必须改用 M2-005/006 的 Outbox/Saga，不能把当前单库事务扩张为跨服务原子性声明。
- 正式 Consent 策略来源、密码重置消息投递、VERIFIED device trust，以及 Gateway 的真实 Redis/JWKS/upstream/浏览器尚未形成当前提交运行 Evidence；NetworkPolicy/durable audit 的后续责任已校正到 M2-008/M2-006，但对应 GAP 仍为 `OPEN / NOT_RUNTIME_VERIFIED`。
- Gateway health 身份与 Evidence 责任闭环已在 `9560c75` 完成契约、实现和文档校正；执行入口、交接、Addendum 范围和 M2-004 audit-service owner 已同步，独立治理复审最终 `ACCEPT`、P1/P2=`0/0`。该校正不产生 runtime PASS，也不降低 M2-010/M8-013 最终标准。
- IAM 幂等返工源码已保存至 `ad172e5`：独立 HMAC 指纹、版本化 CAS、credential current-facts callback、账户状态/credential binding、access replay TTL、未知 scope 默认回调与单 ALTER V13 已实现并通过定向测试；最终独立复审仍未取得，保持待审检查点。历史 `57` 项普通测试不代表当前全套验证，最新范围见收尾记录。
- IAM 其他未关闭风险仍包括：`NATIVE_SECURE_STORAGE` 客户端自证、正式 Consent descriptor/策略来源、legacy 空摘要兼容、外层幂等事务与内层预期拒绝的 rollback-only、密码重置消息投递及限流/缺失账户审计；均须分批修复并独立复审。
