# E2E 浏览器实测记录 · 2026-10-13

环境：`dev-redesign` → learn / mobile / admin.clyunedev.com  
测试账号前缀：`e2e-20261013-`（可整批清理）  
工具：Playwright headless Chromium  
前端修复部署：`learner-web:5dd0daec`（bundle `index-Czsf7pgM.js`）

## 模块进度

| 模块 | 端 | 结果 | 证据 / 说明 |
|---|---|---|---|
| 认证 / 引导：注册 | learner-web | pass | `e2e-20261013-m*` 注册 201 → `/onboarding` |
| 认证 / 引导：成人门 | learner-web | pass | `POST /iam/adult-gate` 200 |
| 认证 / 引导：必要同意 | learner-web | fixed | 见 BUG-1；正常路径 refresh 200 进目标步 |
| 认证 / 引导：目标与时长 | learner-web | pass | FOUNDATION + 15 分钟，`PUT /learner/targets` 200 → `/assessment` |
| 定级测评：开场与作答 | learner-web | pass | `POST .../placement/sessions` 201；提交 1 题 responses 200，进入第 2 题 |
| 定级测评：整卷跑完 | learner-web | pending | 脚本未答完 10 题；跳过入口存在 |
| 首页 `/home` | learner-web | pass | SPA 导航到达「今天，也给自己一点进步。」无 pageerror；未完成定级时显示空计划属预期 |
| 今日 `/today` | learner-web | pass | 「给今天，安排一点进步。」 |
| 内容书架 `/courses` | learner-web | pass* | 页面渲染 OK；`GET /content/learner/catalog` **503** → 记 blocked |
| 学习路径 `/learn` | learner-web | pass | 「从这里，接着往前走。」 |
| 专项练习（侧栏分组） | learner-web | pending | 侧栏为折叠组，需展开后再点词汇/练习子项 |
| 错题本 `/mistakes` | learner-web | pass | 「再遇见一次，就更熟悉一点。」 |
| 学习报告 `/b2/report` | learner-web | pass | 「回头看看，你已经走了多远。」 |
| 掌握进度 `/mastery` | learner-web | pass | 「学过的，现在记住了多少？」 |
| 计划地图 `/plan-map` | learner-web | pass | 「按自己的节奏，一步一步来。」 |
| 学习世界 `/world` | learner-web | pass | 「把进步，装进你的世界。」 |
| 帮助与反馈 `/support` | learner-web | pass | 「遇到问题，我们一起解决。」 |
| 设置 `/settings/profile` | learner-web | pass | 「设置」 |
| 消息 / 商城 / 报告分享深链 | learner-web | pending | |
| 移动端全链路 | mobile | pass* | 见下方移动端表；主路径可走通 |
| 管理端模块 | admin | blocked | 登录页 OK；缺授权管理员账号 |

## 已知缺口（前端写死，不改）

- 部分页面「暂未开放 / 暂不可用」：按产品规则记入缺口，不静默改 API。
- 未完成定级时首页/今日显示「还没有学习计划」：产品预期，不是回归。

## 阻塞（后端 / 基础设施）

### BLOCK-1 内容目录 503

- `GET /api/v1/content/learner/catalog?contentLocale=en-US` → 503（nginx 多次命中，body ~136B）
- content-service 容器 Up；未改后端。书架页仍可打开但目录数据不可用。
- 处理：blocked，需查 content-service / gateway 路由与上游依赖。

## 缺陷与修复

### BUG-1 引导「必要同意」点继续无响应（401 refresh）

- **现象**：三份同意已勾选，点「继续」无跳转、无报错。控制台见 `POST /auth/token/refresh` 401。
- **服务端日志（用户 11:50–11:52 CST）**：`PUT /iam/consents` ×3 均为 200；随后 refresh 401；无后续写目标。同意已落库。
- **根因**：
  1. `signRequiredConsents` 在同意写入后强制 `refreshSilently()`。
  2. refresh 失败时清空会话。
  3. `recordRequiredConsents` 的 `catch` 在 `!stillCurrent(owner)` 时不写 `lastError`。
  4. 与 muse 换皮无关（仅 CSS class）。
- **复现**：擦除 refresh cookie 后再提交同意 → 401，旧版 `errors []`。
- **修复**：`5dd0daec` — `refreshSilently({ clearOnFailure: false })`；失败始终写 `lastError`；同意步展示 session 错误。
- **回测**：同场景出现「必要同意已保存，但登录凭证未能更新。请退出并重新登录后再继续。」
- **用户侧**：**退出再登录**（同意多半已在服务端）。



## learner-web 技能与扩展（补 · SPA / router.push）

| 模块 | 结果 | 说明 |
|---|---|---|
| 词汇复习 `/vocabulary` | pass | 「把见过的词，变成记得的词。」 |
| 分级阅读 `/reading` | pass | 「读一小段，看见更大的世界。」 |
| 语法与句子 `/grammar` | pass | 「拆开一句话，读懂它的结构。」 |
| 综合练习 `/practice` | pass | 「练一练，让理解更扎实。」 |
| 听力 `/listening` | pass | 「慢一点，听懂每一句。」 |
| 口语 `/speaking` | gap | 页面可开；文案含「暂未开放/暂不可用」类已知缺口 |
| 写作 `/writing` | gap | 同上 |
| 消息 `/messages` | pass | 「与你有关的新消息。」 |
| 商城 `/commerce` | pass | 「你的学习权益，一目了然。」 |
| 平台 `/platform` | pass | 「让这里，用起来更舒服。」 |

说明：硬刷新依赖 refresh cookie，E2E 中途多次硬跳会丢会话；侧栏 SPA / `$router.push` 更稳。


## 移动端 mobile.clyunedev.com

| 模块 | 结果 | 说明 |
|---|---|---|
| 注册 | pass | `uni-button`「注册并继续」→ onboarding |
| 成人门 | pass | 需点 `uni-checkbox`（非原生 input）；`POST /iam/adult-gate` 200 |
| 必要同意 | pass | 三项 consent PUT 200，refresh 200，进入目标步 |
| 目标保存 | pass* | 点「保存并开始测评」出现「正在保存…」；随后进定级/首页链路 |
| 定级入口 | pass | `#/pages/assessment/assessment` 可打开 |
| 今日 / 课程 / 练习 | pass | today / learn / practice 可渲染 |
| 我的 / 世界 / 设置 / 客服 | pass | profile / world / settings / support 可渲染；客服受控文案属产品策略 |

## 管理端 admin.clyunedev.com

| 模块 | 结果 | 说明 |
|---|---|---|
| 登录页 | pass | 渲染正常，空提交有校验文案 |
| 登录后业务 | blocked | 无演示账号；文案要求「已授权管理账号」。需你提供测试管理员凭据后继续 |

## 仍开着的事

- BLOCK-1：`/content/learner/catalog` 503（书架数据）
- 口语/写作 learner-web：页面开得开，含「暂未开放/暂不可用」已知缺口
- b4-games 暗色模式、管理端无路由 demo 页：仍待你定
- 管理端深测：缺账号
