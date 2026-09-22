# 本机真实运行验证（2026-09-21 / 09-22 会话）

> 性质：**运行证据快照**。只说明本次会话实际跑过什么、看到什么、改了什么。
> 不改变任何 P1R 台账状态、manifest 或证据绑定；不是发布 GO 结论。
> 相关提交见 `CHANGELOG.md` 的 `[T1-20260921]` … `[T21-20260921]` 条目。

## 1. 环境（本次实测）

| 项 | 值 | 取得方式 |
|---|---|---|
| JDK | OpenJDK 25.0.4.1 LTS（Microsoft build） | `java -version` |
| Maven | 3.9.9 | `mvn -version` |
| Node | 20.19.5 | `node --version` |
| 基础设施容器 | mysql 13306 / redis 16379 / kafka 19092 / rabbitmq 15689+15690 / minio 19000+19001 全部 UP | `docker ps` |
| 应用服务端口 | 18070–18097 由 `pnpm services:run` 固定端口启动；收工时全部释放 | `pnpm ports:check` |

`pnpm ports:check` 在基础设施运行时恒报 7 个 BUSY（正是上面那 7 个容器端口），这是**预期基线**，不是端口冲突；应用服务端口全 FREE。

## 2. 本次运行验证到的链路（均为实测）

| 链路 | 证据 |
|---|---|
| learner 管理面 | 分页走 90 条零重复；非 admin JWT → 403；stale `expectedStateVersion` → 409；profile 顶层 `subjectId`、commands `status:ACCEPTED` 就位 |
| content 管理列表 | PACK 40/40、LEXEME 5/5、ITEM 3/3 零重复零丢失；三分支统一 `{data[], meta{…hasMore,nextCursor}}` |
| content 定时发布 | 三主体四眼 → `SCHEDULE_PUBLISH` → relay 到期执行 → 任务 `EXECUTED`、包 `PUBLISHED` |
| content → Kafka | `platform.content.v1` 收到 relay 发布的词条事件，headers 含 eventId/eventName/schemaVersion/dedupeKey/`requestId=sched-*`，key=聚合 id，payload 无答案/音频/PII |
| learning → Kafka → gamification | outbox v2 行 → `platform.learning.v1` → gamification 消费并结算 `prn_t21_flow_probe_0001` **+15 XP**，同时落 `gamification_event_record` |
| gamification 幂等 | 同一记录重放不重复结算（xp_ledger 仍单行） |
| notification 订阅/模板门禁 | 无订阅行 → `DELIVERED`；插显式退订行 → `CANCELLED` + `SUBSCRIPTION_OPTED_OUT`（DB 直查） |
| social 持久化 | join 落 member+seat(OCCUPIED+lease)；**重启服务后**同一 membership 仍 ACTIVE，重 join 无重复 |
| audit 全链 | 网关 401 拒绝 → 审计包络 → canonical ingest → 恰好 1 条 fact + 1 条 receipt，requestId 可关联、无凭证 material（8/8 PASS） |
| workflow 补偿 | 手工置 COMPENSATING 后 compensate → saga `COMPENSATION_FAILED` + `REFUSED_NO_TRANSPORT` 回执，**无假成功** |
| 跨 schema 写阻断 | `svc_content` 写 `learner_service.learner_profile` → `ERROR 1142`；写自 schema 正常 |
| 官网 | 12 个页面 200、零控制台错误；单测 12/12；浏览器套件 19 检查 + 152 布局全绿 |
| admin-web | Playwright 真实登录（服务端权限 18 项）→ dashboard/lexemes/items/learners/phonetics 全页；切英文整页渲染英文、零错误 |
| 听力波形 | 浏览器内真实解码合成 1s 正弦：96 peaks、方差 0.6151、48 柱保持形态、canonical 格式合法 |

## 3. 运行测试抓出、静态门禁抓不到的缺陷（本次已修）

| # | 缺陷 | 为什么单测/静态检查抓不到 |
|---|---|---|
| 1 | learner 管理 403 被伪装成 400 | 抛错类型写错，单测只测 service 不测 HTTP 映射 |
| 2 | 契约字段 `expectedStateVersion` 被忽略（并发保护旁路） | 实现读的是另一个字段名，只有按契约发请求才暴露 |
| 3 | lexeme 键集分页跨页丢行/重复 | 内存适配器与 JDBC 同错，且测试从不翻页 |
| 4 | 定时执行遇非业务异常中断整批 | 单测只喂业务异常 |
| 5 | PACK pin 对含 DRAFT 的全局 max 校验 → 误报 stale | 需要真实「APPROVED + 新 DRAFT」组合 |
| 6 | UPSERT 未走版本锁 | 需要按契约传 `expectedStateVersion` |
| 7 | 排期列表吞异常返回空 | 需要存储层故障注入 |
| 8 | LIKE 未转义（`q=%` 枚举全量） | 需要真实 SQL |
| 9 | `learning.persistence.mode=mysql` 别名下管理端不装配 | 只有换别名部署才暴露 |
| 10 | DICTATION 缺答案规则静默判 0 分 | 需要无规则快照 |
| 11 | learning plans 查询引用不存在的 `created_at` 列（500） | 需要真实表结构 |
| 12 | `JdbcLearningFactStore.appendOutbox` 漏写 V9 起 `NOT NULL` 的 `event_name`（1364） | **单测用内存适配器，永远碰不到该列** |
| 13 | v2 事件 `schemaVersion="v2"` 不符 `domain.event.vN` 约束 | 构造期即抛，但此前无测试走 v2 路径 |
| 14 | learner-web 登出后不导航（滞留失权页） | 需要真实点击 |
| 15 | 「撤销其他设备」是死按钮（直接 throw） | 需要真实点击 |
| 16 | 官网 SSR 不输出 `data-theme`（与客户端首帧不一致） | 需要真实 SSR 响应 |
| 17 | workflow 补偿记 ATTEMPTED 回执却返回成功（假 APPLIED） | 需要把 saga 置入 COMPENSATING |

第 12 项尤其说明问题：**内存适配器上的绿测试不能证明真实 MySQL 路径可用**。本次新增的 `TrustedCompletionFlowIntegrationTest`（opt-in，真实库）就是为补这一类盲区。

## 4. 本次未验证 / 未闭合（不得当作已完成）

- **P1R 台账状态未动**：本轮只做运行验证与修复，未改任何任务状态、manifest 或证据绑定；`P1R-M5-013` 等仍是原状态。
- **契约 M1014 具名残留**：`rootEventId`、`contentPin`(snapshotId/snapshotHash)、`rulePin.ruleDigest` 需要内容快照事实，learning 侧目前拿不到，未伪造。
- **content 入站消费者**（`cg.content-from-iam.v1`）未做端到端断言，只观察到容器启动与分区分配。
- **learner-web 完整首日旅程**：浏览器里被成人 Gate + 同意流程挡住，未跑通到设置页；离线态需 PWA 壳（M8-009）才能端到端。
- **`contracts:validate` 仍失败 1 条**：`POST /api/v1/iam/account-deletions needs x-idempotency declaration`，是**本次之前就存在**的 IAM 域旧失败，非本轮引入。
- **无线上资源项**：真机/iOS 构建签名、短信通道、真实支付、staging/K8s、不可变 RC、独立 Go-No-Go —— 本地无对应资源，未做。
- **`bulk-100x` fixture 行**：`learning_runtime_outbox_event` 中 91 行 `available_at` 在未来（2026-09-23 ~ 11-16），relay 按设计不处理未到期行；它们到期后会被判为 `EVENT_NOT_ON_TOPIC` 进 DLQ，属预期。

## 5. 复现方式

```powershell
# 基础设施
docker compose -f infra/docker/docker-compose.dev.yml up -d
# 服务（固定端口；relay/consumer 由 runner 按 local-real 策略打开）
& "$env:APPDATA\npm\pnpm.cmd" services:run -- --service iam-service,api-gateway,learner-service,content-service,learning-service,assessment-service --timeout-ms 180000
# 单测（各模块）
mvn -pl services/learning-service test
# 真实 MySQL 端到端（opt-in；凭据走环境变量，本机 Maven 会吃掉带点的 -D 键）
$env:JAVA_TOOL_OPTIONS='-Dlearning.relay.integration=true'
$env:LEARNING_RELAY_TEST_JDBC_URL='jdbc:mysql://127.0.0.1:13306/learning_service?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC'
$env:LEARNING_RELAY_TEST_JDBC_USER='svc_learning'; $env:LEARNING_RELAY_TEST_JDBC_PASSWORD='local-owner-only'
mvn -pl services/learning-service test -Dtest='TrustedCompletionFlowIntegrationTest' -DfailIfNoTests=false
```

> 账号密码只走环境变量，不写入仓库；测试用的合成账号（`repro-*@example.invalid`）与合成数据留在本地 dev 库，不影响他人。
