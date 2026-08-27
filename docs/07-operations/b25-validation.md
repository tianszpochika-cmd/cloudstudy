# B25 本地真实数据代码与回放验证

> 验证日期：2026-08-24  
> 范围：`V2-B25-DATA-001` 至 `V2-B25-DATA-006`  方式：代码、契约、静态校验和本地 Docker MySQL 回放

## 结论

B25 的代码层和本地数据基础已完成：合成 fixture、root migration/seed、服务级迁移、JDBC 读写 seam、Gateway 内部路由、JWT/tenant/owner 边界、幂等写入契约和五个服务的测试均已落地。

本轮不能关闭 B25 的运行 Gate，也不能宣告正式进入 B26 测试。原因是当前本机没有可用的标准 OIDC/JWKS 测试 IdP 和有效 JWT，尚未完成 Gateway → 服务 → MySQL → API 的认证后真实回放；Redis 重建、服务重启读回、Flyway 空库/重复迁移和正式 owner grant 对账也没有形成完整证据链。

## 交付状态

| 任务 | 状态 | 已完成 | 尚未关闭 |
|---|---|---|---|
| DATA-001 | 代码/静态完成，运行部分完成 | root V0023、独立 service schema 基础、owner 表清单和 additive migration | Flyway 空库/重复迁移、正式 owner grant、schema ledger 运行证据 |
| DATA-002 | 代码/静态完成 | 20 个合成实体、课程/单元/词汇/题目/答案规则/媒体引用/商品权益/通知偏好、支付调用关闭 | 通过认证 API 读取并在页面显示 |
| DATA-003 | 代码完成 | learner JDBC seam、V4 迁移、profile/goal/preferences/daily-task 写入和幂等边界 | 有效 JWT 下 onboarding API→DB→API、刷新/重启读回 |
| DATA-004 | 代码完成 | content JDBC seam、V4 迁移、已发布内容读取和答案规则隔离 | Gateway 权限回放、页面真实目录/题目交互 |
| DATA-005 | 代码完成 | learning、assessment、notification JDBC seam/迁移/服务测试；服务端答案规则边界 | 跨服务事件联调归 B26；认证后端到端写链尚未回放 |
| DATA-006 | 部分完成 | root MySQL migration/seed、行数摘要、可重复 seed 设计和 Redis 重建配方 | API round trip、Redis rebuild、服务重启、清理/对账和正式证据索引 |

## 可复核证据

### 代码、契约和静态校验

| 命令 | 结果 |
|---|---|
| `pnpm test:b25` | 5/5 通过 |
| `node scripts/database/validate-b25-data.mjs --mode static` | 通过；20 个合成实体、3 个 Redis 重建配方、22 个 owner 表绑定 |
| `node scripts/database/replay-b25-fixture.mjs` | preview 通过；默认不写库 |
| `pnpm contracts:merge` | 20 个 OpenAPI fragment、13 个 event fragment、393 个 route |
| `pnpm contracts:validate` | 427 operations、479 schemas、147 events、103 event payload schemas、4 JSON schemas |
| `pnpm contracts:generate` | 5 个生成客户端/类型文件完成 |
| `mvn -o -q test`（learner/content/learning/assessment/notification） | 五个服务均通过 |
| `git diff --check` | 无空白错误；工作区既有 LF/CRLF 提示除外 |

关键实现和数据文件：

- [B25 数据配置](../../config/b25-data.json)
- [Phase 1 合成 fixture](../../database/mysql/fixtures/b25-phase1.json)
- [root V0023 migration](../../database/mysql/migrations/V0023__create_phase1_real_data_b25.sql)
- [root seed](../../database/mysql/seeds/dev/V0023__b25-phase1.sql)
- [service schema seed](../../database/mysql/seeds/dev/V0023__b25-service-schemas.sql)
- [B25 静态测试](../../tests/b25/b25-real-data.test.mjs)
- [B25 OpenAPI fragment](../../packages/contracts/fragments/b25/b25-phase1-real-data.openapi.json)

### 本地 Docker MySQL 回放

在当前本地 Docker MySQL 容器中以追加方式执行了 root V0023 migration 和 B25 seed，未执行 `DROP`、`TRUNCATE` 或 destructive cleanup。回放摘要如下：

| 数据 | 结果 |
|---|---:|
| `b25_fixture_run` | 1，`seed-b25-phase1-v1`，`READY` |
| `b25_fixture_row` | 20 |
| `b25_fixture_owner_binding` | 22 |
| `b25_fixture_redis_projection` | 3 |
| root domain owner tables | learner/content/learning/assessment/media/commerce/notification 均有预期 seed 基础 |

另外建立了本地独立 service schema 并应用 B25 service seed，确认以下 owner 表存在并有 fixture 基础：

| schema | 核验表 | 行数 |
|---|---|---:|
| `learner_service` | `b25_learner_profile` | 1 |
| `content_service` | `b25_content_course` | 1 |
| `learning_service` | `b25_learning_plan` | 1 |
| `assessment_service` | `b25_assessment_item_rule` | 2 |
| `notification_service` | `b25_notification_preference` | 1 |

上述数据库操作只使用本机 Docker 的临时开发凭据，凭据没有写入仓库、fixture、日志或文档。

## 未关闭项与下一步

1. 启动批准的标准 OIDC 测试 IdP，完成注册、授权码 + PKCE、JWKS、有效 JWT 和 IAM session 回放。
2. 以真实 JWT 通过 Gateway 回放 onboarding、内容读取、练习/测评/SRS/报告/通知写链，并用 DB 查询核对 owner 表。
3. 从 MySQL owner rows 重建 Redis，停止并重启相关服务，再次读取并核对结果。
4. 使用 Flyway 在空 schema 和已执行 schema 上分别进行一次 migration/repeat 验证，补充 owner grant 与 schema ledger 证据。
5. B25 运行 Gate 全部通过后，再进入 B26 的 Kafka/Outbox、浏览器/H5 真实数据正式测试；B26 不得用本轮静态测试替代。

因此当前状态是：**B25 代码开发完成，B25 真实运行验收未完成；不能据此宣告正式测试阶段开始。**
