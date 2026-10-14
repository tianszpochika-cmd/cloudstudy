# MB001 移动登录：最终独立复签（2026-10-14）

结论：**UI_SCOPE_PASS**。本结论限定正式 `apps/mobile` 登录页在 Chromium H5、隔离合成负向 fixture 下的本轮交互和排版；不升级真实 IAM、业务闭环或原生端验收状态。

复验前后正式源码 SHA-256 均为：

```text
da5ad20851a4158ea0e23918adb27f1bcc7047ae67778add321aa8d397bb58be
```

独立脚本：`independent-review.cjs`；最终结果：`results.json`。本 Agent 未修改正式源码、共享资源、作者证据、服务或 Git，仅写本新目录。服务沿用 `http://127.0.0.1:18183`。

## 已独立验证

| 检查 | 本次实际证据 |
| --- | --- |
| 快速修改密码后立即 click / Enter | 清空、追加最后字符、整体替换共 6 组，输入到提交 0.6–1.1 ms 量级；每组断言模型尚未同步，确实进入 uni 输入 100 ms 节流窗口。清空 0 action / 0 API，首焦点为原生密码输入，`aria-invalid` / error id 正确；非空新值 boolean 匹配为 true，1 action / 0 API。没有依赖等待节流结束。 |
| submit 无 detail | 隔离 action boolean 探针直接调用无参数 submit；两字段保持，1 次 action 收到当前字段。无真实 IAM 请求。 |
| 默认页面 390 / 1280 | 初始 error 行数均 0。内容宽 342 / 420 px，标题 28 px，原生输入 16 px；真实字段间距 24 px、密码区到主按钮 24 px，无横向溢出。实际截图人工检查层级、字体、按钮位置通过。 |
| 原生字段桥接持续更新 | 原生 INPUT 的唯一 id、name、`aria-labelledby`、required、username / current-password autocomplete 均正确；空提交两字段 error 关联且首焦点账号，0 请求；补齐并 blur 后错误隐藏、ARIA 错误属性移除。切换英文后原生 label 更新为 Account / Password。 |
| 密码显隐和键盘 | 眼睛目标 44 × 44 px，controls 指向实际输入；Enter / Space 改变原生 password / text 类型及 pressed，保留 autocomplete / label。账号 Enter 只聚焦密码；密码 Enter 发起唯一合成请求。 |
| busy 和失败恢复 | 等待期间账号、密码、眼睛、找回、注册出口禁用；再触发 click / Enter 不增加请求、不导航、不改显隐。合成 401 后恢复输入；服务拒绝不把字段误标为语法错误，继续编辑仍保留未处理的服务拒绝。 |
| 首次合法提交无占位 | 首次合法 busy 前后主按钮文档坐标均 481.265625 px；error 行数仍 0，1 次合成请求。 |
| 英文精确 200% 文字 | 先快照 computed font，再一次性翻倍，标题 56 px、原生输入 32 px；之后动态真实错误明确设为 28 px。两行英文错误自然高度 89.59375 px；清理后同高、visibility hidden、aria-hidden true、无 id / role、无输入 error 关联。错误、清理、busy 三状态按钮文档坐标均 977.953125 px，无横向溢出。 |
| 超过旧 10 秒页面期限 | 完全拦截的 5100 ms 无效 dummy 登录响应，再 5900 ms 权限 503。约 10209 ms 时仍 busy、无 alert、只 1 次登录；约 11082 ms 完成后显示“登录没有完成，请稍后重试。”并保持登录路由、无字段 invalid。 |

最终脚本 13 个分组全部通过；5 个 API 请求全部被 fixture 拦截。浏览器 `pageerror` 为 0；预期 401 / 503 控制台 HTTP 错误 4 条，非预期 error 为 0。

## 源码边界核查

- `syncField` 仅在 value 为字符串且非 busy 时同步；缺少 detail / value 不清空字段。blur / confirm / uni-form submit 各自补齐即时事件值；没有从 DOM 读取凭证值。
- `lastErrorText` 初始为 null，仅同步记录真实非空 error；清理后保留原错误自然高度，移除 alert id / role / 描述关联。没有默认占位卡或固定错误高度。
- 原生属性桥接位于 H5 条件编译块，通过显式 post watch + nextTick 同步；跨端事件仍使用 uni detail.value，未把 DOM 路径引入其它编译目标。
- 登录页面 await 原有 session.login；仅初始化 restore 保留原短超时。登录流程没有额外 10 秒 Promise.race。
- `stores/session.ts` 在 getPermissions 成功并 acceptPermissions 后才置 authenticated。此权限 503 fixture 不经过该路径，失败会 clear；两阶段测试不能作为登录成功或真实权限验证证据。

## 截图

- `login-default-390.png`、`login-default-1280.png`：默认视觉层级与几何。
- `login-first-valid-busy-390.png`：首次合法等待，无反馈占位。
- `login-english-200-required.png`、`login-english-200-cleared-busy.png`：精确 200% 两行真实错误及清理后按钮位置。
- `login-two-stage-still-busy.png`、`login-two-stage-neutral-error.png`：超过 10 秒等待与最终中性失败。

## 测试脚本自身修正及排除证据

本次先后纠正了两个独立测试脚本问题，正式源码未变：

1. 动态切英文后继续使用中文 label locator，导致 harness 超时；已改成稳定原生 id。原输出保留为 `results-first-run-harness-fail.json`，不是应用缺陷。
2. 最初逐层改变 computed font 造成继承字号反复叠加，同时新建错误行未放大。视觉查看后拒绝该轮文字放大证据，改为快照后统一翻倍，并明确放大动态 error。`results-first-run-zoom-harness-inaccurate.json` 与 `login-english-overscaled-harness-*.png` **不用于最终 PASS**；最终 `results.json` 及 `login-english-200-*.png` 已重新严格验证实际字号和自然行高。

## 未测范围

真实 IAM / 真实账号、成人 Gate 业务成功闭环、真实 Token / Cookie / 安全存储、iOS / Android / iPad 原生运行、小程序、物理键盘和真实屏幕阅读器均未测试。本次未运行新的构建；作者的类型检查和 H5 构建证据单列于 `../20261014-input-followup/followup-report.md`，未冒充本 Agent 的独立构建结果。原有 26 组合矩阵没有被本次 13 分组替代，本次主要复签最终改动与关键边界。

所有浏览器使用全新隔离上下文。测试没有读取真实 storage / token / cookie，没有记录请求 body / header；action 探针仅记录合成字段匹配 boolean。源码指纹最终未漂移。该页可按 UI 范围交主 Agent 验收、更新台账并按页提交。
