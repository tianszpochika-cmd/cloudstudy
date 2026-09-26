# 移动 H5 成人引导与首页运行复测（2026-09-23）

使用现行本地 Mobile H5、Gateway 和 owner 服务，每次以独立 `@local.invalid` 合成成人账号经浏览器完成注册、成人 Gate、三项同意、目标保存、重新登录及首页/学习/资料页读取；测试结束精确停用账号并撤销活动会话。证据未保存口令或令牌。

引导页原先在 Gate 和同意前调用 `/learner/profile`、`/learner/preferences`、`/learner/targets`、`/onboarding/options`，产生四个 403 与多余报错。现只在 `session.isLearningReady` 后加载 owner 引导数据；新账号先显示受控目标选项。复测中注册 201、Gate 200、三项同意各 200、目标 PUT 200、重新登录 200；注册和 Gate 阶段没有学习者 owner 的 4xx 请求。目标保存流程中未建目标时的 GET 404 仍是预期空记录读取。独立三页复测见[机器记录](mobile-real-gateway/batch4-bottom-action-verified/results.json)。

首页、学习、资料页在 320/390/768px 均无横向溢出，页面异常 0；390px 将首页滚到最底部后，末项按钮底边 756px、底部导航栏顶边 793px，可见且可操作。[初始全页图](mobile-real-gateway/batch4-bottom-action-verified/home-real-390.png)中的固定导航覆盖的是截图拼接位置，[滚动到底视口图](mobile-real-gateway/batch4-bottom-action-verified/home-bottom-390.png)显示最终操作状态。浏览器 Console 有 6 条 error，其中包括受控断网探针和真实首页失败，不能记为无错。

新账号的 `/api/v1/learner/home` 仍返回 503 `STORE_FAILURE`：目标确认之后尚无规划输入、计划及任务 owner 事实。页面明确显示不可用和重试，不显示假进度；这只证明失败态可操作，**首日学习链仍为 BLOCKED**。合成账号清理核验为 `DISABLED`、活动会话 0。
