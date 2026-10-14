# LW003 Web 找回密码输运失败补修：独立复签（2026-10-14）

结论：**UI_SCOPE_PASS**，限定本次请求反馈事实补修在 Chromium Web、隔离合成 fixture 下的 UI 行为。此前 503 / 断网冒充成功路径的问题已经实际复验修正；不升级真实 IAM、邮件投递或业务闭环验收。

本 Agent 仅写此新目录，未改正式源、共享资源、旧证据、服务或 Git。浏览器沿用 `http://127.0.0.1:18180`，8 个全新隔离上下文，所有 `/api/v1/**` 被 fixture 拦截。

## 精确源码

复验前后指纹一致，与作者 `../20261014-outage-followup/report.json` 的最终指纹一致：

| 文件 | SHA-256 |
| --- | --- |
| `apps/learner-web/src/pages/PasswordResetPage.vue` | `393aac74627e7774a5e86a4b195ccedd1c5eb338caf8718df7f7b18ec8fb1a60` |
| `apps/learner-web/src/auth/auth-failure-copy.ts` | `218027c92cef95cbae311fbeb2421ded9b6557fa023e8d55d9207a38dc01b36a` |
| `apps/learner-web/tests/ui-reset.e2e.cjs` | `fa6162f65ab9b084f4b5e913775b9d433878d9c8817e2035e418583a06bf7228` |

源码核查：send 所有 `!ok` 都保留 requestSent=false、设置 server error 并 return；只在 ok=true 才展示受理反馈。resetRequest helper 的非限流 fallback 改为已存在的 requestFailed 中英文资源。限流与确认步骤分类未被改动，没有改变接口或反枚举边界。

## 独立实测

`independent-review.cjs` / `results.json`：中英各 202、503、connectionfailed、429，共 8 组；三个失败场景各再重试为 202，共 6 组重试。

| Fixture | 中文 | 英文 | 实际语义 |
| --- | --- | --- | --- |
| 202，data.accepted=true | 如果该账号可接收重置通知，我们会发送操作说明。 | If this account can receive a reset notice, we will send instructions. | role=status；无 alert、无 error class |
| 503 | 发送没有完成，请稍后再试。 | The request did not complete. Try again shortly. | role=alert；无 status，error class=true |
| connectionfailed | 发送没有完成，请稍后再试。 | The request did not complete. Try again shortly. | role=alert；无 status，error class=true |
| 429 | 操作过于频繁，请稍后再试。 | Too many requests. Try again later. | role=alert；无 status，保持限流提示 |

- 各首次请求仅 1 次；busy 最终 false，主按钮可重试，输入未被误标 invalid，路由保持 `/reset-password`。
- 所有 6 个重试：请求正在等待时旧 alert / status 都已清除，busy=true，按钮与切步入口禁用；随后拦截 202 accepted 后仅有反枚举 status，无残留 error class / alert，busy=false，总请求恰为 2 次。
- 所有 API 保持由拦截器接管，密码重置请求 URL 是 IAM HTTPS。没有真实请求或账号重置。
- pageerror=0；预期 503 / 429 / connectionfailed 控制台 error 共 6 条，非预期 error=0。
- 已实际查看 `reset-service-503-zh-CN.png` 与 `reset-network-abort-en-US.png`：错误文案清楚，布局保持简约，文字没有再暗示发送成功。

## 证据与范围

本目录包含 8 个首次场景截图、6 个重试受理截图、独立脚本和结果。脚本仅记录请求 method / origin / path 与 UI 状态，没有读取或记录 request body / header、真实 storage、cookie 或 Token。

作者的 64 主题 / 视口 / 语言 / 步骤矩阵及具名交互报告仍保留在 `../20261014-outage-followup/report.json`；本次独立小范围复验补充中英故障和恢复证据，没有冒充再次运行 64 矩阵或 vue-tsc。旧 503 成功提示原件和只读缺陷诊断保留，不作为当前补修 PASS。

真实 IAM、真实邮件投递、账号存在性后的业务效果、真实成人 Gate、原生平台和实际屏幕阅读器未测。该补修可按 LW003 的 UI 范围交主 Agent 更新文档并单独提交推送。
