# 登录后阅读页不可用诊断

日期：2026-09-26。本记录针对用户截图中的学习 Web 分级阅读页，不把服务健康或页面可打开当作业务通过。

## 复现结果

- 真实 Chromium 浏览器通过本地合成账号完成注册、成人首次设置和目标选择后，打开 `/reading`。页面显示“网络暂时不可用，变更已保留”；点击“重新读取”仍然失败。
- 登录态浏览器对 `/api/v1/reading/articles?limit=20` 的请求表现为 `net::ERR_FAILED`。用相同 origin、方法和请求头复核预检时，Gateway 的 `OPTIONS` 返回 `403 FORBIDDEN`，错误信息为 `The CORS route is not available.`；响应缺少 `Access-Control-Allow-Credentials: true`，与浏览器请求的 `credentials: include` 冲突。普通 `GET` 返回 `404 NOT_FOUND`，错误信息为 `The API route is not available.`。
- 作为对照，登录态 `/api/v1/grammar/points` 返回 200，但 `/api/v1/grammar/exercises` 和 `/api/v1/grammar/mastery` 同样表现为 `net::ERR_FAILED`。此前独立浏览器测试还确认 `/api/v1/learner/home` 返回 `503 STORE_FAILURE`，首日计划投影尚未准备好。
- 本机 Gateway、content、learning、assessment 均健康；四个前端、16 个后端固定端口在监听。故障不能用“进程没有启动”解释。

## 源码原因

学习端 `B11ReadingPage.vue` 使用 `b10.ts` 的 `loadReading()`，先请求文章列表。Gateway 的 `GatewayRoutePolicy.java` 把整个 `/api/v1/reading` 前缀归给 assessment-service；`GatewayRouteExecutionPolicy.java` 因该前缀与现有 content/learning 控制器的 owner 冲突，把 `reading-domain` 标为不可执行。`CanonicalCorsPreflightWebFilter.java` 因而先拒绝浏览器的预检；普通 GET 也在 Gateway 转发前被拒绝。

浏览器的预检失败被 `fetch` 暴露为网络类 TypeError，学习端的 `failureKind()` 将其归为 `offline`。所以页面的“网络暂时不可用”是错误归类，不能据此判断用户网络真的断开。

对照复核了 9 条本地路径：阅读文章/题目、语法练习/掌握度、写作提示、听力素材这 6 条预检均为 403 且没有凭据头；语法知识点、学习者资料、学习首页这 3 条预检为 200 且包含 `Access-Control-Allow-Credentials: true`。已知第一方来源的 Gateway 拒绝响应也缺凭据头，进一步使浏览器无法读取原始错误；这是跨域错误处理本身的缺陷，与路由未接通同时存在。

## 修复边界

需要先按现有契约和真实 owner 拆分精确的 Gateway 路径/方法绑定：文章、题目等只读请求到 content-service，阅读进度到 learning-service，答题提交需核对 assessment 的实际控制器与契约。随后构建、重启 Gateway，并在登录态逐条复测。错误展示应把路由未接通、权限、内容下线和真正的网络故障分开。只重启当前健康进程或改全局 CORS 不能修复该 owner 映射。

本次诊断没有修改应用代码或 Gateway 策略。浏览器复现的去敏请求记录见 `reading-diagnosis.json`；累计创建了 3 个随机本地合成账号，账号状态留在本地，凭据不在证据文件中。前两次尝试未验证服务端会话撤销，最后一次经设置页退出且登出接口返回 200。最终复现通过登录态直接打开 `/reading` 完成。
