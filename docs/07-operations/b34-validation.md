# B34 MCP 浏览器验收证据

> 执行时间：2026-08-25（本机）  
> 范围：`V2-B34-MCP-001` 至 `V2-B34-MCP-005`  
> 浏览器：Codex In-App Browser MCP 真实标签页；没有读取 cookie、localStorage、session storage、token 或密码。

## 证据摘要

| 用例 | 结果 | 运行证据 |
|---|---|---|
| MCP-001 真实操作与证据协议 | PASS | MCP 实际执行导航、点击、等待、DOM snapshot 和截图；learner-web、admin-web、official-site、Mobile H5 均使用真实页面 |
| MCP-002 干净会话认证闭环 | PARTIAL | 已在真实 Keycloak 中完成本地合成账号注册/登录、OIDC 回调、会话恢复和后续页面访问；退出、彻底清会话后重新登录以及 Admin 登录仍需独立复测 |
| MCP-003 learner-web 完整旅程 | PARTIAL | 已完成成人 Gate、同意、目标/时长、测评开始与服务端判分、今日任务、课程详情、保存断点和任务完成；2026-08-26 已将 `/practice` 从旧 B10 session 客户端切换到 B25 MySQL placement 客户端，需在新认证会话中复测题目/报告；SRS/报告/通知/个人设置逐项页面验收仍未全部完成 |
| MCP-004 Mobile H5 完整旅程 | PARTIAL | `390x844` 下完成登录/回调、目标/成人同意、真实练习报告读取、报告→今日任务、真实任务首页和课程详情；H5 新鲜任务的答题提交、触摸返回/刷新及剩余报告链路仍需继续复测 |
| MCP-005 四端公开/跨端边界 | PARTIAL | 官网公开页面由 Gateway→content-service MySQL 投影渲染，Web/H5 已显示同一 B31 内容；Admin 发布后再由认证 Web/H5 读取的完整跨端证据仍未闭环 |

认证后核心旅程复核 runId：`b36-browser-2026082516`。Browser MCP 实际完成 learner-web 的注册/登录、回调、成人 Gate、同意、目标、测评答题与报告、今日任务、课程详情、断点保存和任务完成；Mobile H5 完成登录/回调、目标/成人同意、真实练习报告读取、报告→今日任务、真实任务首页和 B31 MySQL 内容详情。全过程未读取 cookie、Web Storage、Token 或密码，也没有把密码写入仓库。

## Browser MCP 操作证据

1. `http://127.0.0.1:18180/home`：未登录实际跳转 `/login`，页面显示“通过身份服务登录”，OIDC URL 使用 learner-web client、PKCE 和 Gateway 事务入口。
2. `http://127.0.0.1:18181/login`：实际显示管理端登录入口，使用 admin-web OIDC client。
3. `http://127.0.0.1:18182/`：实际读取官网 SSR 页面；DOM 中出现由内容服务投影的 `B31 本地真实内容` 课程和进入学习链接。
4. `http://127.0.0.1:18183/#/pages/home/home`：未登录实际显示“登录后继续”，点击后进入 Mobile H5 登录页。
5. Mobile H5 登录页修复后，在 `390x844` 下显示“身份服务已就绪”和“打开身份服务”；点击后实际进入 Keycloak `Sign in to your account`，页面显示 Username、Password、Sign In、Register。
6. Gateway 停止期间，Mobile H5 实际显示“登录入口暂时不可用”和“网络暂时不可用，请稍后重试”，并保留可重试按钮；Gateway 全量恢复后刷新页面重新显示“身份服务已就绪”。
7. 认证后复核：learner-web 显示真实 `LEARNING SPACE`、B31 课程投影、测评报告和已完成任务；Mobile H5 的真实练习页显示服务端报告，报告可回到今日任务，首页和学习页显示 `B31 本地真实内容`、`COURSE_UNIT`、`MySQL 内容投影` 和真实课程单元，不是前端静态样例。

8. 2026-08-26 Web 练习入口修复：`/practice` 不再调用未接通的 `/assessment/sessions`，改为复用 `/assessment/placement/start` 与 `/assessment/placement/submit-step` 的真实 B25 流程。`learner-web` build、typecheck、B33 和 G 回归通过；当前浏览器会话已过期，认证后题目/报告复测待用户重新登录后继续。

## 本轮修复

`apps/mobile/src/pages/login/login.vue` 原先只有 `v-if="loginUrl"` 按钮。H5 页面级 `onLoad` 未及时执行或身份请求异常时，用户没有任何可操作登录入口。本轮改为：按钮始终存在、登录 URL 延迟准备、`onMounted` 兜底、会话恢复和 OIDC 请求均有超时与错误态，且不伪造登录成功。

`apps/mobile/src/platform/v2-foundation.ts` 同步增加“准备中、已就绪、暂时不可用”的中英文文案。

## 当前结论

B34 已关闭“等待用户确认密码”这一阻断，并修复 Web `/practice` 的旧接口调用；认证后的 Web 新练习入口仍需新会话 Browser MCP 复测。B34 的验收定义覆盖完整页面矩阵和跨前端发布联动，当前仍为 `PARTIAL`；不能把核心链路通过扩大为全量功能通过，也不能据此把 B36 改成 `LOCAL-TEST-PASS`。
