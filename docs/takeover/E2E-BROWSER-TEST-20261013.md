# E2E 浏览器实测记录 · 2026-10-13

环境：`dev-redesign` → 德国服务器 learn / mobile / admin.clyunedev.com  
测试账号前缀：`e2e-20261013-`（可整批清理）  
工具：Playwright headless Chromium

## 模块进度

| 模块 | 端 | 结果 | 证据 / 说明 |
|---|---|---|---|
| 认证 / 引导：注册 | learner-web | pass | 注册 201，进入 `/onboarding` |
| 认证 / 引导：成人门 | learner-web | pass | `POST /iam/adult-gate` 200 |
| 认证 / 引导：必要同意「继续」 | learner-web | fixed | 见下方根因；修复后应显示明确错误或进入目标步 |
| 首页 | learner-web | pending | |
| 学习与复习 | learner-web | pending | |
| 技能页 | learner-web | pending | |
| 错题 / 消息 / 客服 / 设置 | learner-web | pending | |
| 商城 / 社交 / 报告分享 | learner-web | pending | |
| 移动端全链路 | mobile | pending | |
| 管理端模块 | admin | pending | |

## 已知缺口（前端写死，不改）

- 部分页面「暂未开放 / 暂不可用」：按产品规则记入缺口，不静默改 API。

## 缺陷与修复

### BUG-1 引导「必要同意」点继续无响应（401 refresh）

- **现象**：三份同意已勾选，点「继续」无跳转、无报错。控制台见 `POST /auth/token/refresh` 401。
- **服务端日志（用户 11:50–11:52 CST）**：`PUT /iam/consents` ×3 均为 200；随后 `POST /auth/token/refresh` 401；**没有**后续 learner 写目标请求。同意已落库。
- **根因**：
  1. `signRequiredConsents` 在同意写入后强制 `refreshSilently()`，用新 JWT 带上学习权限。
  2. refresh 失败时 `refreshSilently` **清空会话**。
  3. `recordRequiredConsents` 的 `catch` 在 `!stillCurrent(owner)` 时直接 `return false`，**不写 lastError**。
  4. 页面停在同意步且无提示；再点「继续」因会话已死仍无响应。
  5. 与 muse 换皮无关（仅加了 CSS class）；换皮后更容易在已登录页上撞到失效 refresh cookie。
- **复现**：headless 注册→过成人门→清掉 refresh cookie→提交同意 → refresh 401，`errors []`，标题仍为「完成必要同意」。
- **修复**（本提交）：
  - `refreshSilently({ clearOnFailure: false })` 供同意后刷新使用，失败时保留 access token。
  - 同意失败路径始终写入 `lastError`；文案提示退出重登。
  - 同意步同时展示 `session.lastError`，并加强 v2 下 `.setup-error` 可见性。
- **用户侧**：同意多半已保存。请 **退出登录再登录**，一般会从目标步或定级继续；不要反复盲点「继续」。
- **状态**：fixed（已部署 `learner-web:5dd0daec`，bundle `index-Czsf7pgM.js`）
- **回测**：擦除 refresh cookie 后再点继续 → 页面显示「必要同意已保存，但登录凭证未能更新。请退出并重新登录后再继续。」不再静默。


