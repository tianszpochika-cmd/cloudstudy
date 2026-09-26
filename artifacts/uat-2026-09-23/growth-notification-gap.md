# Phase 1 成长、社群、通知与同步验收（2026-09-23）

## 验收边界

- 基线：`docs/06-design/v2-980plus/phase1-business-operation/03-全端页面功能登记册.md` 的 `PAGE-P1-WORLD`、`GAME`、`SOCIAL`、`AVATAR-REWARD`、`MESSAGES`、`SYNC-OFFLINE`、`SETTINGS`。
- 当前端口：learner-web `18180`、mobile H5 `18183`、Gateway `18070`；Java 服务由共享运行器持有。本轮未重启 Java 服务，也未代用户接受成人 Gate/条款，故没有经过授权成人账号的完整写链路证据。
- `PASS` 只用于已验证完整业务链路；`PARTIAL` 表示可达/契约/局部行为有证据，缺少关键运行验收；`BLOCKED` 表示当前链路不能正常完成。

| 功能 | 结果 | 当前证据与主要缺口 |
| --- | --- | --- |
| `PAGE-P1-WORLD` 成长世界 | **PARTIAL** | 两端有 `/world` 页面；Web 聚合读取已是 `Promise.allSettled`，移动端本轮修成分项读取。Gateway `/api/v1/gamification/me/summary` 无令牌返回 401，说明路由存在且边界拒绝；未有成人 Gate 后的成长事件→XP/ledger/streak 运行证明。 |
| `PAGE-P1-GAME` 游戏 | **BLOCKED** | 旧运行版 `/api/v1/games/catalog` 无令牌 401。当前 owner 源码曾将 `SENTENCE_TRAIN` 标为 enabled，但返回固定 `vocab-foundation-001..003` 与 `local-token-001..003`，提交回合只递增 `attemptCount`，结束时任一尝试即给 100% 正确率、通过、奖励资格，没有判题。两端页面曾要求用户选择令牌/填写 itemCode，无法构成正常玩法。本轮源代码把唯一 enabled 入口关闭，旧会话结束强制 0 分、`passed=false`、`rewardEligible=false`；需批量部署后复测。真实游戏题包、判分、奖励资格仍未实现。 |
| `PAGE-P1-SOCIAL` 自习室 | **PARTIAL** | mobile `/b4-social` 可达；Web `/world` 有社群分栏。Gateway `/api/v1/social/rooms` 无令牌 401。页面具加入/离开、番茄、预设互动，B12 扩展含排行榜/举报；本轮没有授权账号验证服务端席位、可见性、举报与恢复链。 |
| `PAGE-P1-AVATAR-REWARD` 角色/奖励 | **PARTIAL** | mobile `/b4-avatar` 与 Web `/world` 角色分栏存在；Gateway 成长路由 401。B12 边界测试覆盖服务端概率与受控领取接口，但没有真实学习事件→奖励 ledger→概率披露→领取的运行证据。移动端仍显示 `itemCode`、`resourceVersion` 等内部字段。 |
| `PAGE-P1-MESSAGES` 消息中心 | **PARTIAL** | 登记册说 Web 缺 route，但现有 Web router 有 `/messages` 且顶栏弹层/导航可达；mobile 仅在 `/b4-social` 合并通知，没有独立消息中心。Web 原实现把 owner 返回的 `read: boolean` 当 `readAt`，并用 POST 调已读；本轮改为 `read` 与 PUT。无令牌实测 PUT 单条/全部已读各 401，旧 POST 各 404。需授权账号复测读取、未读计数、偏好写入和详情深链。 |
| `PAGE-P1-SYNC-OFFLINE` 同步/离线 | **BLOCKED** | learner-web `B11SyncPage.vue` 未挂载 `/sync`；mobile `/b4-offline` 可达但尚无真实 manifest、分片传输与 hash 校验。Gateway `/api/v1/sync/offline-packages`、`/api/v1/sync/events` 当前均 404，policy 将 `sync-domain` 标记为 learning/notification owner 冲突。两端 B4 聚合原会调用缺失的离线包接口；Web 已显示局部可用，移动端本轮修为相同原则。队列、冲突、cursor、重试不能算通过。 |
| `PAGE-P1-SETTINGS` 中通知偏好 | **PARTIAL** | Web 消息页有 IN_APP/EMAIL/PUSH 偏好表单，mobile 设置页仅有主题/动效/内容语言，通知偏好嵌在 B12 社群扩展，未按登记册形成同一设置路径。Gateway `/api/v1/notifications/preferences` 有鉴权边界；缺少两端持久化往返验收。 |

## 运行与数据证据

1. 2026-09-23 对 Gateway 无令牌请求：`/api/v1/gamification/me/summary`、`/api/v1/games/catalog`、`/api/v1/social/rooms`、`/api/v1/notifications/messages` 均 401；`/api/v1/sync/offline-packages` 与 `/api/v1/sync/events` 均 404。401 仅证明公开边界/路由存在，不证明有权用户功能可用。
2. 通知已读方法探针：PUT `/api/v1/notifications/messages/uat-nonexistent/read` 与 PUT `/api/v1/notifications/messages/read-all` 无令牌均 401；对应 POST 均 404。`NotificationReadJdbcController` 的 owner 路径也只使用 PUT。
3. 本地 MySQL 只读聚合：`social_service.soc_study_room` 100 行且 100 行为 OPEN；`soc_seat_lease` 100 行、取样时 65 行未过期；`notification_service.notification_message` 249 行、27 个不同标题、210 行 UNREAD，其中一个通用标题占 200 行；`notification_offline_package` 100 行。`local-real-10x-fixture.mjs` 明确生成 `local-10x-room-name-*`、`学习提醒 N`、固定本地奖励/事件。这证明规模脚本写入，不证明房间活跃、通知内容拟真或离线可用。
4. 当前 Java 进程在本轮代码变更前启动；游戏的 fail-closed 源码修复只有编译/单测证据，尚无重启后 Gateway 复测。

## 本轮小修与验证

- `apps/learner-web/src/api/notifications.ts`、`pages/MessagesPage.vue`、`layouts/AppShell.vue`：采用 owner `read` 字段与 PUT 已读接口，修正未读角标/列表状态和空消息文案。
- `apps/mobile/src/stores/b4.ts`：13 个独立读取分项处理。单项 404 不再把成长/社群/通知整体判错；401/403 仍显示权限错误，全部失败仍显示错误，不把权限拒绝当空列表。
- `services/gamification-service/.../GameCatalog.java`、`GamificationLocalFeatureController.java`：没有可信判题事实时禁止新游戏入口、旧会话结束不产生通过或奖励资格。`UnverifiedGameFinishTest` 验证 5 次客户端事件和旧的 true/100 结果也会降为 0 分/不通过。
- 两端 TypeScript typecheck 通过；Web B12 边界测试 4/4、mobile B12 边界测试 4/4；GameCatalogTest + UnverifiedGameFinishTest 通过。这些不等于授权账号的浏览器/服务端端到端验收。

## 后续验收次序

1. 批量部署 Java 后确认游戏目录无 enabled，旧游戏 session 的结束结果不能再给通过/奖励资格。
2. 先明确 canonical sync owner 与 Gateway 路由，再做 mobile 离线包 manifest/分片/hash、Web `/sync` 与冲突恢复。
3. 用受控、已完成成人 Gate 的合成账号依次验证成长事件、房间加入/续租/离开、消息已读/偏好、奖励资格与领取；清理该账号与产生的测试事实。
4. 以真实业务场景数据替换通用重复标题、全开放房间和仅用于计数的离线包样例，再进行视觉与内容验收。
