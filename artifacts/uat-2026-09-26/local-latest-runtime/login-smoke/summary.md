# 四端浏览器登录冒烟报告

日期：2026-09-26（本地环境）  
运行方式：本地 Playwright Chromium 真浏览器；learner 1280×900、admin/官网 1440×960、Mobile H5 390×844。只测登录入口、成人首设关卡和进入学习首页的链路；不代表四个系统的全功能验收。

## 结果

| 系统 | 页面打开 | 交互结果 |
|---|---|---|
| 官网 | / 返回 200，首页内容正常渲染 | 本轮未测完整官网交互 |
| Learner Web | /login 返回 200，登录表单正常 | 随机无效账号经 Gateway 登录返回 401，页面提示“账号或密码不正确，请重试。”；随机合成账号注册返回 201 |
| Admin Web | /login 返回 200，管理员登录页正常渲染 | 未测试管理员凭据与后台权限，也未向学习账号授予管理权限 |
| Mobile H5 | #/pages/login/login 返回 200，登录页正常渲染 | 合成账号登录返回 200 并进入 TODAY 首页；H5 首页的今日任务读取失败，显示简短重试提示 |

## Learner Web 首次使用链路

- 随机 @local.invalid 合成账号经页面注册，/api/v1/auth/register 返回 201。
- 登录后的成人 Gate 页面正常出现；只对合成账户使用测试出生年份 1990 并勾选页面上的年龄、隐私和服务条款选项，/api/v1/iam/adult-gate 与同意接口返回 200。此项仅验证本地 UI/业务链路，不构成真实身份或法律文案验收。
- 目标选择与首日测评启动可用；/api/v1/assessment/placement/start 返回 200，测评题目页正常出现。本轮未提交测评答案。
- 进入 Learner 首页后页面框架正常，但首页任务投影返回 503，卡片提示“学习服务暂时不可用”。独立新上下文重新登录返回 200，仍可打开首页框架，但同一首页数据问题仍在。
- Learner Web 从设置页执行退出登录，/api/v1/auth/logout 返回 200。

## 首页 503 证据与定位

Gateway 实际响应（只保留去敏字段）：

- HTTP：503
- code：STORE_FAILURE
- message：first-day planning projection is not available for the confirmed target
- requestId：req-4145778c6196468bb530ea558b906725
- traceId：b2ef5512369343278cc1ca916d76fae4

对应实现位于 services/learner-service/src/main/java/com/englishflow/learner/web/LearnerHttpController.java 的 toFirstDay：当自有 profile 与确认的学习目标已存在时，因缺少 learning owner 的计划引用及任务投影而明确返回 STORE_FAILURE，避免伪造“已就绪”且没有任务的数据。浏览器中 Learner Web 和 Mobile H5 的首页都因此展示不可用状态。按 requestId/traceId 查询本次本地服务日志没有匹配记录；响应由该业务异常直接给出。

## 其他可见问题

- Learner Web、Admin Web、Mobile H5 各自请求 /favicon.ico 返回 404，产生一条浏览器控制台资源错误；官网没有此错误。页面脚本级 pageerror 为 0。
- 成人 Gate 前未授权的 profile/preferences/targets 读取返回 403；Gate 完成后相关读取转为 200，符合默认拒绝边界。
- 首次设置阶段曾有一次未创建目标时 /api/v1/learner/targets 返回 404；随后目标读取与创建均返回 200，界面继续正常。是否应将“尚无目标”表达为空集合由产品/API 契约确认。

## 合成数据与限制

本轮因移动端 DOM 选择器适配和响应诊断共创建了 3 个随机 @local.invalid 合成账号；未写入真实用户数据。密码、JWT、Cookie 均未写入报告、截图或证据文件。成人状态和学习目标留在本地合成数据中。部分 Web/Mobile 成功登录后的浏览器上下文关闭前没有单独收到退出登录的 200，因此服务端会话是否仍有效到过期时间未经验证。

本轮不测管理员认证、学习答题提交、官网互动全量流程，也不声称任何系统已通过完整 UAT。

## 证据文件

- report.json：四端页面、负向登录、首屏文本及控制台观察。
- positive-flow.json：合成账号注册、Web 登录、Mobile H5 登录与路由结果。
- learner-home-503.json：503 白名单响应字段、请求 ID 与页面状态。
- learner-login.png、learner-login-negative-result.png、admin-login.png、official-home.png、mobile-login.png：四端初始页面及登录拒绝提示。
- learner-register-onboarding.png、learner-relogin-onboarding.png、learner-home-synthetic.png、learner-home-503-response.png：合成首次设置及首页状态。截图不含账号或凭据。
