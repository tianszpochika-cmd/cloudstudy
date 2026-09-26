# 消息与通知偏好追验（2026-09-23）

## 结论与边界

- 对照 `PAGE-P1-MESSAGES`、`PAGE-P1-SETTINGS`、`INT-P1-013` 和当前通知 owner 的 API。本轮本地纵切 **82/82 检查通过**，但整项仍为 **PARTIAL**：通知是通过 owner 内部排队接口创建的合成夹具，不是学习、客服或安全领域事件触发的真实通知；深链、删除、分页、跨渠道和原生设备尚未验收。
- 在当前运行的 Gateway `18070`、notification owner `18093`、学习 Web `18180`、移动 H5 `18183` 上运行。没有重启共享 Java、前端或 Docker 服务，也没有触碰非测试用户数据。
- 两个专用合成账号均完成注册、成人 Gate 与三项同意，再从 Web / 移动浏览器正常登录。凭证与 Token 只在测试进程内使用，没有写入证据。

## 真实链路结果

| 场景 | 观察 |
| --- | --- |
| 权限和隔离 | 匿名消息/偏好为 401；成人 Gate 前为 403；完成 Gate 与同意后新账号列表为 200/空；第二账号看不到首账号消息/偏好，对首账号消息标已读为 404。 |
| 偏好事实 | `REVIEW_DUE/IN_APP` 创建为 version 1；同键同体重放保持 version 1，同键异体与过期 `expectedVersion` 均 409。Web 关闭→移动读取关闭，移动开启→Web 回读开启；两端刷新仍保持。Web 按已读版本提交；模拟另一路更新后，旧 Web 页提交收到 409、重新读取 owner 的状态，确认后重试用新版本保存成功，刷新回读一致。 |
| Web 消息 | 两条合成消息从 Gateway 读取，未读 2→单条已读 1→全部已读 0，owner 回读一致；空账号显示空态；受控偏好 503 显示重试，恢复后读取成功。 |
| 移动 H5 | 原先 Gateway 200 但页面空白的数组解析已修；正文 `safeBody`、通知类型和时间正常显示。第三条合成消息已读后，未读 1→0，Gateway 回读一致；设置页可管理五类站内偏好并进入消息区；空态、受控消息/偏好 503 和重试均通过。 |
| 布局和异常 | Web 1280/390/320，移动消息与设置 390/320，共 7 个布局样本无横向溢出；浏览器 page error 为 0。 |

原始状态码、每项检查和清理计数见 [messages-notifications-followup.json](messages-notifications-followup.json)。可重跑脚本是 `scripts/runtime/uat-messages-notifications-followup.mjs`。浏览器截图见 [Web 390](screenshots/messages-followup/web-messages-390.png)、[移动消息 320](screenshots/messages-followup/mobile-notifications-320.png)、[移动设置 320](screenshots/messages-followup/mobile-settings-320.png)。

## 本轮修复

- `apps/mobile/src/stores/b4.ts`：通知列表接受 owner 实际数组响应，读取 `safeBody/notificationType`，并单独记录通知读取状态，避免 503 伪装为“暂无通知”。
- `apps/mobile/src/pages/b4-social/b4-social.vue`：通知卡移到房间列表前，显示实际未读数、可读类型和本地时间；失败时给出重试。
- `apps/mobile/src/pages/settings/settings.vue`：新增站内通知偏好和“查看消息”入口；五类偏好按 owner 缺行即默认开启的实际规则显示，保存时携带已读版本，成功后重新读取 owner。
- `apps/learner-web/src/api/notifications.ts`、`pages/MessagesPage.vue`：显示通知时间、可读类型/渠道；读取失败时不显示旧列表，用简短提示和重试。偏好写入携带 owner 返回的 `version` 作为 `expectedVersion`；409 后重新读取并显示“偏好已更新，请确认后再试。”
- 两端 TypeScript 检查、脚本语法和改动空白检查通过；最终本地浏览器/Gateway/owner 重跑 82/82。

## 测试数据清理

- 最终轮两个账号的通知 owner 行清理前分别为：消息 3/0、偏好 1/0、幂等 8/0、Outbox 3/0、workflow 3/0、审计 8/0。清理后以上均为 0；两个 IAM 账号和主体均 `DISABLED`，活跃会话和设备均 0。IAM 保留不可登录的审计身份行。
- 首轮清理脚本漏撤销设备与主体，发现后已按本轮 `uat-notification-*` 专用前缀补正。当前全前缀只读复核：活跃账号/主体/设备/会话及通知消息/偏好均为 **0**；脚本现在每轮自动核验。

## 仍需验收

- 可信领域事件→订阅/模板→投递→消息→深链，以及通知失败重试/DLQ 的真实联调，仍属 `E2E-INT-P1-013 UNVERIFIED`。内部排队夹具不能替代它。
- 移动消息尚在社群 route 的顶部，未形成登记册要求的独立消息中心；分类、详情、删除、分页和目标深链未实现或未验证。
- 设置页本次覆盖五类 **IN_APP** 偏好。Push/Email/SMS、勿扰时段、频率、同意策略及真机通知权限未完成用户链路；原生 App、iPad 和小程序未测。
- 现有社群房间仍显示 `bulk-10x` 夹具名；这不属于拟真的真实自习室数据。消息内容本轮刻意标记“验收”，不得计入正式数据品质。
