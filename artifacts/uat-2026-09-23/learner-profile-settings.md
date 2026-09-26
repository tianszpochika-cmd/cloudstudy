# 学习 Web 学习资料：真实 Gateway 与浏览器验收

## 复现（修复前运行实例）

- 四个独立 `@local.invalid` 合成成人账号均通过真实 Gateway 注册、成人 Gate、三类同意、密码登录；数据来自 learner-service 公共 B9 路由，非 B25 内部 JDBC 路由。
- 最终一次真实浏览器复现：公开 `/learner/profile` 和 `/learner/targets` GET 均 200，目标为 `WORKPLACE/B2/30`；设置页却展示默认昵称“学习者”、口音 US。修改三项后点击保存，profile PATCH 200、target PUT 400；读回 profile 版本从 2 到 3，目标仍为 30 分钟。旧 UI 保留改后的输入，错误提示称本地已保存。原始脱敏事实见 `learner-profile-before.json`。
- B9 公共契约及 owner 无 nickname/accentPref 写入字段。旧界面的两项编辑不能宣称持久化。目标契约使用 `WORKPLACE_DAILY`，旧运行 owner 只接受 `WORKPLACE`；owner 源码对齐由独立任务处理，须待集中重启后复测。

## Web 修复

- 学习资料页只开放有公开契约的每日目标；昵称与发音偏好明确显示暂不可修改。
- 读取要求 profile 与 target 都返回有效 owner 数据，支持现有 B9 驼峰字段及 B25 下划线字段；目标缺失、版本冲突、字段无效时显示错误和重新读取，不回退假默认。
- 每日目标单独 PUT，沿用读到的目标类型、级别、日期和聚合版本；新值只有在 PUT 后 GET 与输入一致时才进入页面及本地状态。失败时隐藏旧值并要求重新读取，不展示“已保存”。
- 定向测试 13/13、学习 Web 类型检查通过。

## 集中重启后正向验收

- 新合成成人经真实 Gateway 注册、成人 Gate、三类同意、密码登录，公开 B9 目标初始化为 `WORKPLACE_DAILY/B2/30`。学习 Web `/settings/profile` 初始读取 30 分钟，昵称和口音没有可编辑控件。
- 浏览器将每日目标改为 45 分钟，仅发送一次 `PUT /learner/targets`（HTTP 200），没有从 UI 发送 profile PATCH；随后两条 GET 读回目标 `WORKPLACE_DAILY/B2/45`，profile stateVersion 从 2 到 3。UI 在读回后才显示“每日目标已保存。”，无错误提示。证据见 `learner-profile-after.json` 与 `learner-profile-after.png`。
- 390px 移动视口的 `scrollWidth=390`，未见横向溢出；截图见 `learner-profile-after-mobile.png`。首次正向脚本误把显示偏好的下拉框计作口音控件，已修正选择器并用第二个独立账号重跑；最终 JSON 和截图来自第二次准确探针。
- 两次正向合成账号都在各自探针的 `finally` 中禁用 IAM、撤销活动会话和设备，B9 六类表及 B25 两表精确清零。该结果仅证明每日目标在本地真实 Gateway/浏览器链上可保存；昵称/口音仍无正式公共写契约。

## 合成数据清理

- 四个复现账号均精确禁用，活动会话与设备撤销，B25 两表和 B9 profile/goal/preference/first-day/idempotency/outbox 按 account subject + `platform` tenant 清零。修复补清理脚本 `learner-profile-cleanup-prior.mjs` 已验证四个账号的 B9 六类表均为 0；新探针 `learner-profile-live.mjs` 的 finally 也做同样清理。
