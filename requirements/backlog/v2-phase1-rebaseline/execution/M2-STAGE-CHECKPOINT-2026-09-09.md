# M2 阶段性收尾 — 2026-09-09

## 结论与提交

本次按用户要求结束当前研发批次并保存可恢复状态。起点为 `dev@ea6c931`，fetch 后与当时 origin/dev 一致；源码分别保存为 Gateway `22ab84f`、IAM `ad172e5`。本记录及 CURRENT-HANDOFF 随后以独立文档提交推送 dev。最终同步状态以 `git rev-parse HEAD`、`git rev-parse origin/dev` 和 `git status` 核对，文档不自引用自己的 SHA。

状态保持 `25 ACCEPTED / 1 BLOCKED / 2 IN_PROGRESS / 80 PLANNED`。当前是 `D2_CONTRACT_READY / NOT_RUNTIME_VERIFIED`；M2-001/M2-002 未达到 AC、最终独立审查和 canonical Evidence 要求。M0-006 官方 uni-app/Vite 安全兼容阻塞保留；Phase 2 AI/RTC、Phase 3 K12 继续禁用。

## 已保存成果

- Gateway：显式 m2-evidence profile 输出闭集、限长、脱敏 NDJSON；默认 bounded sink 保持原行为。运行夹具覆盖固定端口、Redis DB15、IAM/JWKS/upstream、状态码/header/audit、精确 Redis 容器 pause/unpause 和串行双进程计数续接。浏览器 fixture 和操作说明已落盘。sink 标记 NON_DURABLE_TEST_ONLY；这些夹具尚未实际执行跨进程场景。
- IAM：独立密钥 HMAC 请求指纹、版本化 JDBC CAS、legacy tombstone、凭据重放当前账户/session/device/credential binding 校验、access TTL 和当前剩余 TTL、未知 scope 回调策略、显式密钥构造。V13 采用单条 atomic ALTER，移除旧摘要/响应列并建立新列及完整 CHECK；启动校验迁移状态、表结构和 CHECK 漂移。专用升级测试覆盖 populated V12、旧 writer 失败、CAS/并发、DDL 原子失败和 DDL/history 窗口。
- 收尾修正：local profile 不再自动声明旧 writer 已排空；必须显式确认 V13 切换。迁移清单同步为 12 个文件（版本 V1,V3…V13，缺 V2 为既有状态）。

## 验证与证据范围

| 日期 | 检查 | 结果与范围 |
| --- | --- | --- |
| 2026-09-04 | Gateway Java 25 全套 | 69/69，零失败/错误/跳过；进程内测试，不代表运行夹具通过 |
| 2026-09-04 | MySQL 8.4 V12→V13 opt-in | IdempotencyV13MigrationSecurityTest 1/1；专用 schema；首轮 metadata guard 失败后修复，第二轮通过 |
| 2026-09-09 | IAM Java 25 定向 | 41/41，零失败/错误/跳过；IdempotencySecurityHardeningTest、IdempotencyCredentialReplayControllerTest、IamSecurityFactsTest、IamPolicyControlServiceTest |
| 2026-09-09 | Gateway Node | 7/7；运行夹具静态安全/schema 测试 |
| 2026-09-09 | plan / data ownership / diff | PASS；108 项，静态/D2 范围 |
| 2026-09-09 | GAP registry | PASS；45 项，40 CLOSED / 5 OPEN |
| 2026-09-09 | 全局 Evidence Gate | FAIL；M0/M1 manifest 的 current-source artifactDigests 与 HEAD 已漂移，涉及契约生成物、Gateway/compatibility 工具及本次两份迁移资产清单；执行时另有台账未提交提示，文档提交后该提示自然消除，摘要漂移仍待修复 |

Java 使用 `C:\Program Files\Java\jdk-25`。Java 报告位于各服务 `target/surefire-reports/TEST-*.xml`，属本机可再生输出，未作为 canonical Evidence 提交。测试源码已提交；上述历史结果有本次会话工具输出及本地报告支持。两个新检查点的最终独立 ACCEPT 未取得，先前其它检查点的 ACCEPT 不自动继承。

本日 Docker Desktop Linux engine 管道不存在，容器状态无法核验；未重新执行 MySQL、Redis、故障注入或浏览器。不得将 9 月 4 日数据库通过结果标记为 9 月 9 日环境通过。

## 环境恢复与 V13 注意事项

历史隔离环境为 `cloudstudy-p1r-m2-mysql-84`（MySQL 8.4，127.0.0.1:13306）与 `cloudstudy-p1r-m2-redis-1`（127.0.0.1:16379）；Gateway/IAM 使用 18070/18087。恢复时先核对容器归属、端口、schema 和进程，凭据仅从本机安全配置获取。

专用测试库 `iam_v13_test_20260904_a` 的对象在测试 finally 中已清理，schema 历史上保留；本日无法确认其存在。最初误命名的空测试库 `iam_service_v13_upgrade_20260904` 已于 9 月 4 日确认零表后删除，不含业务数据。

历史主隔离 `iam_service` 曾应用未提交旧版 V13（checksum `-205420604`，旧 request_hash/response_* 列，检查时幂等表零行）。新代码会拒绝此漂移状态。恢复时先核对实际 schema/history 并制定专用测试库或前向修复方案；不要直接重跑 V13、修改已部署迁移或盲目清库。

正式切换：停止写入口 → 排空旧 writer 和在途请求 → 显式 `IAM_IDEMPOTENCY_V13_WRITERS_DRAINED=true` → 迁移 → 验证 schema/history → 启动新版本。该升级不支持滚动兼容；DDL 成功但 Flyway history 未记录的窗口必须保持停机并人工核对恢复，普通 repair 不等于自动补记成功。SQL 层旧摘要失效不代表物理备份/binlog 已擦除。

## 下次继续的顺序与未完成项

1. 完成 `22ab84f` 与 `ad172e5` 的最终独立只读审查，修复发现，按当前提交补必要测试。Gateway 夹具需重建两个 jar 后执行；串行计数续接不等于并发副本测试。真实浏览器 Origin/Referer/Cookie 仍未验证。
   同时复核 M0/M1 current-source 摘要漂移及对应回归证据，再更新 manifest 和 review history、重跑全局 Evidence Gate；不能只重算摘要以制造 PASS。历史 ACCEPTED 台账本轮未改写，但不能据此声称当前 HEAD 的全局门禁通过。
2. IAM 嵌套事务与 Consent CAS：避免预期拒绝将外层事务标成 rollback-only；真实 Spring 代理/MySQL 证明 canonical 4xx、REJECTED 与拒绝审计提交，基础设施失败整体回滚。
3. Legacy Consent：空/NULL digest history 兼容与后续 V14 方案，保留旧事实不授权；非法非空值应失败关闭。正式 Consent descriptor/策略来源仍待落地。
4. Password reset：补实际投递 handoff、缺失/禁用账户和限流审计、独立 HMAC 目标摘要、Retry-After 与防枚举。新增响应必须 contract-first；可靠出站依赖后续 Outbox/notification，不能以 recording adapter 宣称送达。
5. Native trust：关闭客户端 header/body 循环自证，建立服务端可信上下文与默认拒绝。真实 App Attest/Play Integrity、设备证明与 Keychain/Keystore 验收另需外部配置和真机证据。
6. M2-001/M2-002 满足 AC、真实 Evidence 和独立验收后才能开始 M2-003。durable audit、NetworkPolicy、平台关联与 staging 仍分别归 M2-006/008/010、M8-013。

本轮仅完成阶段性保存与交接；自动化测试通过、任务验收、生产放行分别记录。后续研发等待用户恢复。
