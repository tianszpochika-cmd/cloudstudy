# M1014 房间举报迁移审计

**范围：** 对 canonical OpenAPI、Gateway 路由、social-service `local-real`、学习端调用、治理队列和事件契约做源码只读核对。没有修改运行代码/契约，没有启动 Docker 或访问实时数据；结论不代表运行验收。

## 已核实

- **canonical API：** OpenAPI fragment 中 `GET /social/leaderboards`、房间举报 POST、本人举报 GET 的 owner 均为 `social-service`。举报 POST 要求 `M1014ReportCommand`、`social.report.create.self` 和 `Idempotency-Key`；回执为 `M1014Report`。GET 要求 `social.report.read.self`。[OpenAPI fragment](../../packages/contracts/fragments/b12/b12-gamification-social-notification.openapi.json#L1177) · [POST](../../packages/contracts/fragments/b12/b12-gamification-social-notification.openapi.json#L1357) · [GET](../../packages/contracts/fragments/b12/b12-gamification-social-notification.openapi.json#L1457)
- **没有可用目标引用：** 当前 `M1014LeaderboardEntry` 只有名次、展示模式、展示名、分数和是否本人；没有 `targetRef`。[LeaderboardEntry](../../packages/contracts/fragments/b12/b12-gamification-social-notification.openapi.json#L6633) 请求只允许 `targetType`、`targetRef`、`reasonCode`，且禁止自由文本、附件及客户端提供的身份/审核字段。[Command](../../packages/contracts/fragments/b12/b12-gamification-social-notification.openapi.json#L6888)
- **运行形状仍是 B12：** `local-real` 榜单返回 `kind/period/roomId/entries/serverTime`，entry 不含 `targetSeatIndex` 或 `targetRef`。[SocialLocalRealController leaderboard](../../services/social-service/src/main/java/com/englishflow/social/web/SocialLocalRealController.java#L212) 控制器当前接受 `targetSeatIndex/reasonCode/clientEventId`，使用 B12 原因枚举并返回 `data.report`；其回执、状态和 ID 形状也不是 canonical `M1014Report`。[原因码](../../services/social-service/src/main/java/com/englishflow/social/web/SocialLocalRealController.java#L53) · [POST](../../services/social-service/src/main/java/com/englishflow/social/web/SocialLocalRealController.java#L320) · [Command 校验](../../services/social-service/src/main/java/com/englishflow/social/web/SocialLocalRealController.java#L538) · [回执包装](../../services/social-service/src/main/java/com/englishflow/social/web/SocialLocalRealController.java#L854)
- **现有保护可复用但需适配：** B12 POST 已校验举报人是房间成员、目标是当前可见且非本人的成员，并有幂等记录和并发唯一约束。[成员/目标检查](../../services/social-service/src/main/java/com/englishflow/social/web/SocialLocalRealController.java#L354) · [旧表与幂等表](../../services/social-service/src/main/resources/db/migration/V1__create_social_service_schema.sql#L116) 但 `soc_report` 仍以座位号和 B12 状态为主，缺少 M1014 回执要求的 `caseId`、`auditRef`、`moderationPolicyVersion` 等字段；当前 GET 使用 `social.report.read` 且只按 tenant/reportId 读取，没有限定举报人本人。[GET](../../services/social-service/src/main/java/com/englishflow/social/web/SocialLocalRealController.java#L612)
- **客户端与 Gateway：** Mobile 和 learner-web 都仍发送 B12 座位号及 `clientEventId`；mobile 页面用 `targetSeatIndex` 显示举报按钮。Web 社交面板嵌入 World 页面，mobile 社交面板挂在 B4 社交页。[Mobile API](../../apps/mobile/src/api/b12.ts#L27) · [Mobile UI](../../apps/mobile/src/components/b12/B12SocialExtensions.vue#L29) · [Web API](../../apps/learner-web/src/api/b12.ts#L88) · [Web UI](../../apps/learner-web/src/components/b12/B12SocialExtensions.vue#L77) Gateway 已映射榜单、房间举报 POST 和举报 GET；现有路径无需新增路由，仍应验证幂等头透传。[Gateway](../../services/api-gateway/src/main/java/com/englishflow/gateway/policy/GatewayRouteExecutionPolicy.java#L640)
- **契约/事件门禁：** M1014 的举报 operation 与 `M1014LeaderboardEntry` 都列入 compatibility freeze；增补榜单引用须经过 successor 契约流程并更新生成产物/检查基线。[冻结的举报 operation](../../scripts/contracts/compatibility-diff.mjs#L826) · [冻结的 schema 投影](../../scripts/contracts/compatibility-diff.mjs#L850) `social.report.created.v2` 要求 case、审计和 lineage 字段，消费者包括 admin-ops、audit、workflow。[事件契约](../../packages/contracts/events/v1/fragments/m1-014-gamification-social-v2.events.json#L110) 在本次检查的 social-service 源码范围内未找到该举报事件的 Outbox 生成路径；这是源码搜索观察，不是运行取证。
- **业务设计约束：** 报告只提交目标、目标引用和枚举原因；举报人、case、审计身份由服务端派生；榜单基于已结算事实并尊重昵称/匿名/退出隐私设置。[M1-014 设计](../../docs/06-design/v2-980plus/04-Phase1-成长社群商业后台功能设计.md#L56) 现有单元/MySQL 测试仍以 B12 座位号和旧原因码为输入，不能证明 M1014 引用链。[单元测试](../../services/social-service/src/test/java/com/englishflow/social/web/SocialLocalRealReportTest.java#L47) · [MySQL 测试](../../services/social-service/src/test/java/com/englishflow/social/web/SocialLocalRealReportMySqlTest.java#L56)

## 推荐的最小依赖顺序

1. **先定 successor 语义并通过契约门禁。** 给 `M1014LeaderboardEntry` 增加可选 `targetRef`，只在房间内非本人、当前可见且可举报的席位上提供；保留 M1014 POST command 原形。同步 OpenAPI source、生成 TS/API client、freeze 检查和理由码 UI 文案。不要把 B12 座位号或 `clientEventId` 加回 canonical 请求。
2. **实现 social owner 引用解析与 M1014 持久化。** 建议使用 tenant+room+leaseId+leaseVersion 作用域的密钥 HMAC 引用；客户端不接收原始主体/座位/lease ID。POST 时重新验证引用、当前租约、成员可见性和非本人约束。扩展 owner migration/存储以持久化 canonical report/case/state/policy/audit 事实；在同一 owner 事务写入幂等事实及 canonical v2 Outbox 事件，不跨服务写表。
3. **统一回执和权限。** 按契约返回 `M1014Report`，使用 `rpt_...` ID 和 canonical 状态；同 key 同 payload 精确回放，同 key 不同 payload 返回 409。GET 采用 `.read.self` 并同时验证 tenant 与 reporter owner。保留 IAM 成人 Gate/consent 授权来源，不接受客户端 tenant/role/owner 字段。[IAM learner 权限登记](../../services/iam-service/src/main/resources/db/migration/V17__grant_canonical_b12_learner_permissions.sql#L13)
4. **迁移学习端和治理队列。** Mobile/Web 从榜单 entry 读取服务端 `targetRef`，提交 `targetType=SEAT`、M1014 reason 和稳定幂等头；未取得回执时用同一 key 重试。管理端当前仍是 B12 治理队列，需适配 canonical 状态及事件消费，同时保持最小披露。[页面登记册](../../docs/06-design/v2-980plus/phase1-business-operation/03-全端页面功能登记册.md#L94)
5. **用隔离的合成事实做联调。** 先跑契约/生成/compatibility 检查，再跑 owner MySQL、Gateway 透传、事件 Outbox/消费去重和 mobile/Web/管理端链路。负向用例包括伪造、过期、跨房间、隐藏和本人 targetRef，未授权读、跨租户、并发重复、幂等 key 冲突以及重试后唯一回执。

## 推进前需明确的产品/设计选择

- **引用含义和隐私边界：** 本建议把 M1014 `SEAT` 的 targetRef 解释为短时、房间作用域、不可反推主体的席位引用。契约目前没有规定其格式、有效期或租约变更行为。只在指定房间榜单中返回该引用是建议，不是已冻结事实。
- **原因映射：** B12 `SENSITIVE_CONTENT`、`OTHER` 不在 M1014 enum 中；前者映射 `SAFETY` 还是 `INAPPROPRIATE_BEHAVIOR`、后者移除还是经 successor 扩展，需定规则。
- **不同幂等键的相同举报：** canonical 契约只定义同 key 重放/冲突，未定义不同 key 的重复提交。现有 DB 会按举报人、目标、原因唯一去重。应明确拒绝/返回已有 case、限时去重或允许新 case；不可把 `Idempotency-Key` 与业务去重混为一谈。
- **B12 管理状态与 canonical 状态：** 现有队列包含 `RECEIVED/ACTIONED/REJECTED/APPEALED`，canonical report 为 `SUBMITTED/RESOLVED/DISMISSED` 等；特别是申诉状态需要明确兼容映射，或决定管理端迁移边界。
- **审计回执和事件时序：** canonical 要求 `auditRef` 且要求 v2 事件，但现有 runtime 证据未显示 producer/Outbox。需决定 `auditRef` 是 owner 事务内持久的审计关联号，还是审计服务确认后的引用，并规定事件失败/重放时 API 回执如何表达。

**验收边界：** 这是契约/源码审计和实现建议，不是 M1014 runtime PASS。既有 [Batch22 契约缺口记录](./batch22-social-report-contract-gap.md#L5) 仍有效。
