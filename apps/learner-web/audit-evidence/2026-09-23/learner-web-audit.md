# 学习 Web Phase 1 功能验收记录（2026-09-23）

范围：`apps/learner-web`，通过本机 18180 页面、真实 IAM 账号与 Gateway 18070 验证。PASS 只表示列明的动作已运行；没有服务端学习事实的页面不算完成闭环。

| 功能 / 路由 | 结果 | 运行证据与缺口 |
|---|---|---|
| 注册 `/register` | PARTIAL | 真实 UI 注册成功并进入 onboarding；注册页尚无年龄与条款，当前由后续成人 Gate/同意承担。IAM register 契约也只有账号/密码/设备。 |
| 成人 Gate、同意、目标 `/onboarding` | PASS | 真实 18+ 出生年和三项同意后进入第 2 步，保存目标进入测评；第 2 步不再残留预 Gate 的 403 文案。注册后访问 learner profile/targets/preferences 的三次 403 是 Gate 前预期拒绝。 |
| 登录 `/login` | PASS | 新浏览器上下文通过真实账号密码登录，进入 `/home`；没有伪造令牌或拦截 API。 |
| 找回密码 `/reset-password` | PARTIAL | “收到口令”后不再误显示重置成功；确认表单要求账号、口令、新密码并向 IAM 使用正确字段。未取得重置口令，实际密码变更未验收。 |
| 首页 `/home` 与今日任务 `/today` | PARTIAL | 桌面与 320px 渲染无横向溢出；无任务时主 CTA 进入书架。成人目标保存后仍没有任务，计划投影需 owner 核对。 |
| 课程 `/courses` 与只读学习页 `/learn/session` | FAIL | 旧账号看到 3 个 `rollback probe` 内容，新账号书架为空；拟真与可学习性均不达标。只读页原“完成本步”可直接调用完成接口，现已移除；今日任务与学习循环入口改为“开始学习”。服务端仍需按 `P1_SESSION_V1` 检查学习证据。 |
| 定级 `/assessment`、练习 `/practice` | FAIL | 真实注册后页面展示旧 B25 两题中的英文 `Choose the greeting`（1/2）；canonical `P1_PLACEMENT_V1` 为十题。Web 仍走 `/assessment/placement/start` 等 B25 客户端链，需与 assessment owner 统一切换。 |
| 词汇、复习 `/vocabulary`、错题 `/mistakes`、掌握度 `/mastery`、报告 `/b2/report` `/reports/weakness`、计划图 `/plan-map` | BLOCKED | 页面能路由并呈现空/加载/错误状态；新账号缺测评与学习事实，不能验收真实复习、评分、错题修复和报告闭环。报告页已去掉内部版本与枚举文案。 |
| 语法 `/grammar`、写作 `/writing` `/writing/practice`、听力 `/listening`、阅读 `/reading` `/reader`、口语 `/speaking` | FAIL | 真实浏览器读接口失败。Gateway 上 `/grammar/points`、`/writing/prompts`、`/listening/materials`、`/reading/articles`、`/phonetics/catalog` 返回 404；页面不再外露 `Failed to fetch`，口语缺素材时不再误报 ready。需要 owner 路由/契约迁移与真实已发布内容。 |
| 世界 `/world`、平台 `/platform`、消息 `/messages`、个人/隐私/设备设置 | PARTIAL | 已跑受保护路由及桌面渲染，未具备完整内容与消息事实，尚不能认定各写操作闭环。 |
| 学习权益 `/commerce` | PASS（页面安全空态） | 原页面从 `/commerce/skus` 暴露内部 ACTIVE 测试 SKU 与技术编码；已改为仅解析公开 `/public/commerce/catalog` 的 canonical `plans`，仅 `PUBLISHED` 显示下单。真实 320px 浏览器现在显示 0 个方案且无内部 SKU/假价；待 commerce owner 新构建后复测公开 catalog。 |
| 客服 `/support` | PARTIAL | 真实浏览器创建工单成功；分类/状态转为中文，320px 无横向溢出。现有契约只提交问题描述 hash，客服无法看到原文，实际沟通和回复链路尚需受限内容引用/消息能力。 |
| 错误/权限 `/forbidden`、未知路由 | PASS（状态页） | 受保护路由扫查可渲染，403 不被伪装为空数据。 |

## 截图与运行观察

- 桌面：首页 `home-desktop.png`、书架 `courses-desktop.png`、今日任务 `today-desktop.png`、世界 `world-desktop.png`、消息 `messages-desktop.png`、个人设置 `settings_profile-desktop.png`。
- 320px：客服 `support-live-320.png`、学习权益 `commerce-live-320.png`。两页 `documentElement.scrollWidth - innerWidth = 0`。
- 快速连续刷新 13 次触发 `/api/v1/iam/principal/me` 429 并跳登录；常规 SPA 导航未触发。已停止高频刷新，限流恢复策略未做破坏性压测。
- 代码检查：`pnpm --filter @englishflow/learner-web build` PASS，48/48 前端测试 PASS，`git diff --check` PASS。构建有既有 Vite 混合静态/动态导入提示。

## 测试账号生命周期

本轮精确创建的 8 个合成账号（7 个 `learner-acceptance-20260923-*` 与 1 个 `audit-*@example.test`）已逐个精确匹配 IAM 记录，禁用 8/8、清空权限 8/8、撤销 14 个 active session；复核 active session 为 0。未删除账号，也未按通配符更新其他账号。
