# B4 成长任务、成就与奖励真实性门禁

日期：2026-09-23。状态：**源码与局部 HTTP 测试通过；私有 Docker 和授权用户正向链待复测**。关联 `PAGE-P1-WORLD`、`PAGE-P1-GAME`、`PAGE-P1-AVATAR-REWARD`。

## 发现与修复

- `gamification_feature_state` 的旧本地 JSON/固定任务默认值曾把一个任务预置为完成；`claimQuest` 只按任务 ID 将其标成 `claimed=true`，不检查真实练习事实、账本、幂等键。成就默认解锁一个条目，`showcase` 接受任意编码；赛季奖励对任意 seasonId 展示固定 `ITEM_*`。这些不是可信成长或持有证明。
- 任务、成就、赛季奖励读取现在只返回空态且不创建默认 JSON 行；任务领取和成就展示位写入返回 503，旧 JSON 保留但不回显/改写。装扮相关门禁见 [B4 权属专项](b4-avatar-entitlement-gate.md)。
- 游戏登记册保留 P0 的 `SENTENCE_TRAIN` 规划条目，但当前六款均 `enabled=false`，直到服务端可核验题包和判分事实成立。OpenAPI 的描述、`enabledByDefault` 与逐条标记已和运行源码对齐。
- 新增的 503 响应使用统一 `{error,meta}` 格式：`SERVICE_UNAVAILABLE`、`retryable=false`、安全的 `reasonCode`、请求/追踪 ID、版本和时间均返回；旧控制器其他错误格式未在本批统一迁移，不能声称全服务 API 格式已对齐。
- 移动成长世界与 Web 任务区去掉原始任务/赛季 ID；无进度事实时不把地图节点显示为 0/UNKNOWN，移动破冰入口只在中断风险状态出现。以上是展示修复，不是奖励正向链完成。

## 验证

- `UnverifiedRewardFailClosedTest` 直接调用与 MockMvc：旧 JSON 不产生任务/成就/赛季结果，领取/展示写入 503 且无 JDBC；HTTP 503 的 `error/meta` 与关联 header 对齐。`AvatarEntitlementFailClosedTest` 和 `GameCatalogTest` 聚焦测试一起通过。
- `mvn -q "-Dtest=*,!GamificationJwtDecoderNegativeTest" test` 通过；排除项在 Windows JDK 建立本机 HTTP 测试端点时存在已记录的 loopback 环境错误，不能把排除说成该测试通过。
- OpenAPI `contracts:merge:check`、`contracts:validate`（455 operations）、`contracts:generate:check` 均通过；管理 Web、学习 Web 构建，移动 H5/App/微信小程序编译通过。原生真机尚未运行。

## 未闭合

真实任务需要可信学习事件、规则版本、主体进度、奖励账本和事务性幂等回放；成就和赛季同样需要 owner 事实及审核后的目录。没有正式法律文档和可合法登录的私有 Docker 账号，不能验证授权用户浏览器中的领取、装备或成长页面。当前为空/拒绝状态，**功能仍未正常可用**。
