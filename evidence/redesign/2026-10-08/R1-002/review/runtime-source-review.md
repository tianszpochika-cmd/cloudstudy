# R1-002 业务运行工具源码审查

日期：2026-10-08  
审查结论：**SOURCE_SCOPE_PASS / 可按具名授权执行**。本审查只覆盖本轮受限运行脚本与来源路径，不是业务卡最终验收。审查未运行测试、启动服务、连接数据库或操作 Docker。

## 审查绑定

- `scripts/redesign/r1-002/business-runtime.mjs` SHA-256：`31a5a7cfb28133e3e0c555dbbc557ee1aef0a10fe0779ed1202b02e66f9d5d0a`。
- `scripts/redesign/r1-002/business-runtime.test.mjs` SHA-256：`7edbdaae0619d3acf63e84c780f9f2c8d3377ed86727ce96dc8e5261b7a320b4`。
- [run-approval.json](../runtime/run-approval.json) 的 `scriptSha256` 与运行脚本相同；scope 只列专用 IAM schema 和 18087/18070/18088，绑定 MySQL 身份及 loopback，审批有效时间覆盖本轮窗口。
- [business-tests-final.log](../runtime/business-tests-final.log) 记录4/4 business runtime tests 通过，包含损坏 JWT header/claims 固定错误归类且不回显输入标记。[tool-tests-final.log](../runtime/tool-tests-final.log) 记录28/28 全工具定向项通过；两个日志有重叠，不相加为独立测试总数。
- 受保护 task spec 已改为 Node `business-runtime.mjs`、Node crypto 验签和 stdin MySQL probe，与当前实现一致；没有不存在的 Java helper 依赖。

## 安全边界审查

- Docker 只读识别固定 `yuxuexing-local-mysql-1`，每次 SQL 前复核容器 ID、Compose project/service、镜像、healthy 状态和固定 `127.0.0.1:13306`。SQL 只通过 `docker exec -i` stdin 传递；root password 在容器内从既有环境引用，不出现在参数、stdout 或证据。脚本无 Docker 生命周期命令。
- schema 名有专用前缀及随机十六进制 allowlist；但当前脚本最初生成的 `GRANT ... ON ${schema}.*` 未转义 schema 中的下划线。MySQL 8.0 在 `partial_revokes=OFF` 时将数据库级授权中的 `_` 解释为通配符，因此源码字符串的前缀 allowlist 本身不能证明有效权限只落到该 schema。此项在下方 ACL 差量复核中记录为待关闭的权限范围问题。其他 SQL 每次执行前复核固定 MySQL 容器身份，查询模板只引用通过 allowlist 的本轮 schema，不引用既有 IAM schema。Git 外运行目录要求本用户 owner、非符号链接且 mode 0700，敏感文件 `wx` 新建并 mode 0600。
- `safeJson` 对 JWT header/claims、Docker inspect、运行配置、审批及 build receipt 的解析错误转换成固定错误码；CLI、失败报告和清理错误只输出受限错误码。HTTP response JSON 解析也映射到固定错误。密码、token、cookie 和私钥内容不写入 evidence。
- access token 由 JWKS 公钥验 RS256 签名并匹配 issuer/audience/未过期、`adult_gate=NOT_EVALUATED`、`consent_state=UNKNOWN`、`phase-1`/`platform`、subject=owner，且只接受四项注册后权限白名单、学习权限计数为0。Web 注册响应检查 `no-store`、`yuxuexing_refresh` Cookie 属性和 JSON 不含 refresh token。
- fresh schema 在注册前要求 principal/account/session/device/audit/idempotency 六项计数全部为0；Flyway 要求17个成功版本、0失败、最大版本18。成功路径读回 account/principal/session/device 关联；审计插入触发器制造失败后，六项计数必须完全不变并移除本轮专用触发器。
- 仅脚本自身 spawn 的 IAM/Gateway/learner Java children 会进入监督列表；停止前校验 OS 出生身份及 ChildProcess native handle，发 SIGTERM 并等待退出。每个 child 在 finally 中收尾；报告要求登记端口释放，失败时只记录失败，不向未确认归属的进程发信号。

## 范围界限

运行脚本验证迁移成功与实际 owner 行关联，没有单独枚举 `information_schema` 的外键约束定义；此审查将其保留为数据库结构核查边界，不视为 R1-002 卡级阻塞。Outbox/Kafka 没有扩大进本卡；如实际实现产生跨服务事实仍须同 owner 原子 Outbox，缺失的 `auth.account.registered.v1` 发布运行证据保持 OPEN。

## learner JDBC 启动修复差量审查（2026-10-08）

首轮 `runtime-results-51ca8300.json` 保留 FAILED。当前可执行候选的 `business-runtime.mjs` SHA-256 为 `9db3dc4cf3333046633319a109eb020d0163942155acf035d302f42d9c41b0a7`，测试源 SHA-256 为 `bc21f860461176570024ca0cc0099ca17801dbb79555487155a2b88721241e7b`。后者按运行者提供的结果为 4/4 通过；本审查只看源码，不重复运行测试或运行时。

差量新增第二个严格分离的 schema allowlist：`r1_002_learner_20261008_<12个小写十六进制字符>`，IAM 仍只允许 `r1_002_20261008_<12个小写十六进制字符>`。两者独立生成随机账号和密码；但最初的 DDL/DML 授权语句对两种 schema 都未转义下划线，不能仅据源码判定授权范围是字面 schema。脚本在创建前分别查询该新 schema 与账号是否已存在，所有 SQL 仍经每次复核固定 MySQL 身份后的 stdin。learner 的 0600 Git 外配置显式设置 JDBC、Flyway、schema、loopback 地址与固定端口 18088；运行入口要求审批记录匹配当前脚本 SHA、两个 schema、MySQL 身份和有效期。

learner 改用正常 JDBC 模式以装配 `learnerTargetPinService` 所需的 `JdbcTemplate`，并要求其 12 个 Flyway 版本成功后，才直接向固定 learner 端口发携带受限 JWT 的请求。必须观察到 Gateway bypass、`403/CONSENT_REQUIRED`，且拒绝发生在 JDBC domain adapter 读取之前；learner migration 和 PEP 结果不能由 IAM schema 计数或 Gateway 结果替代。清理仍仅停止本次脚本出生且身份匹配的 child，并验证 owned ports 释放，不对容器执行生命周期操作。此候选按其固定源 hash 可绑定运行，但本审查对 schema 授权范围的结论暂为 `PENDING_ACL_SCOPE_PROOF`，不能沿用前述未转义 grant 的源码级假设。

## MySQL GRANT 下划线语义差量（2026-10-08）

已核对 MySQL 8.0 官方手册：数据库级 `GRANT` 范围中的 `%` 和 `_` 可作为通配符；若需要字面字符必须在 `GRANT` 语句中反斜线转义。`partial_revokes=ON` 时 MySQL 会把未转义的 `_` / `%` 当字面字符；默认关闭时则不能如此假定。[MySQL 8.0 Access Control, Stage 2](https://dev.mysql.com/doc/refman/8.0/en/request-access.html)、[Privilege Restriction Using Partial Revokes](https://dev.mysql.com/doc/refman/8.0/en/partial-revokes.html)。


后续独立 readback 已完成：`partial_revokes=false`。本轮三位自建账号的最终 `SHOW GRANTS` 均仅有全局 `USAGE` 与对应 owner schema 的反斜线转义 literal DDL/DML grant；无 global write、无 `GRANT OPTION`。每位账号 own schema 的 `SELECT 1` 与 `flyway_schema_history` 聚合读取成功，分别为 IAM final 17、learner final 12、首次失败 IAM 17；另一自有 schema 的 `USE` 被拒绝且未读取其他数据库行。证据在 `permission-readback-final.json`、`owner-table-readback.json`、`source-manifest-post-tightening.json`。因此，MySQL pattern 风险已在最终安全暂停状态关闭；必须继续准确保留事实：`9db3…` 执行初始 grant 曾使用未转义下划线，随后只对本轮三个新建用户做了授权收紧，绝不声称初始授权从未扩大。

当前未来工具源码 `business-runtime.mjs` SHA-256 为 `eda7075959c60f4d8a2bd133a123367f4d0e1ead6088f463a125f9966e1af570`，测试源码 SHA-256 为 `8f77d8374011748250c4aa90796e9c3c8cfa6f96a91f498682fc5a6bcb298ea2`。差量读取 `@@GLOBAL.partial_revokes`，OFF 时在 GRANT 数据库名中转义 `_`，ON 时使用字面 schema；新增测试覆盖两种模式和拒绝非法 schema，日志 5/5。该未来工具只做源码/定向测试审查，没有再次运行注册服务或数据库迁移，不能替换本轮审批和执行 hash `9db3…`。
