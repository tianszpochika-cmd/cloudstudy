# MB-002 指针窗口补修作者报告

日期：2026-10-14。作者结论：`PASS_POINTER_KEYBOARD_UI_SCOPE_NOT_BUSINESS_ACCEPTANCE`，候选保持 `IN_REVIEW`，等待独立复审及 Root 收口。当前账号 3..128 / 密码 12..128 的完整本地契约提示和 uni 默认 140 字符截断风险由 Root 后续另行安排；本报告不关闭注册整页。

## 改动与历史失败

仅修改 `apps/mobile/src/pages/register/register.vue`、`apps/mobile/tests/ui-register.e2e.cjs` 及本 after 目录新证据。复用冻结 `pointer-feedback.ts`，未改 helper、i18n、session、其它页、文档索引或 Git；复用独审 Agent 自有固定 18183 服务，未启停服务。

保留 [原始只读 FAIL](../before/results.json)：409 后首次清空账号，blur 新增错误行令按钮从 610.84375px 下移到 641.234375px，真实点击 0。补修在 focused 编辑期间保持已报告错误文案与自然高度，合法纠正隐藏文字并保留空间；blur / 明确 submit 用即时组件 detail 值同步并报告当前 raw 校验。H5 真实 pointerdown 捕获反馈快照，直到 click、拖离或 cancel 释放。初始无空错误占位，无 pointerdown 提交，无应用固定等待，无 DOM 密码读取。

[author-run1 FAIL](author-run1/results.json) 已通过四条 pointer 场景，因英文测试预期漏写 `your` 停止，页面原文正确。[author-run2 FAIL](author-run2/results.json) 保留新发现：共享 keyboard 在 keydown click 提交并聚焦账号，同一 Enter 的 keyup 又触发账号 Next，最终误聚焦密码。本页主按钮局部阻止 Enter / Space 的 keydown 激活，在 keyup 明确 submit；共享键盘实现未改。

## 最终作者验证

[author-run3/results.json](author-run3/results.json) 在隔离 Playwright Chromium 通过。Browser plugin not available；入口为 `http://127.0.0.1:18183/#/pages/register/register`。全部 `/api/v1/**` 拦截，使用合成 fixture；不读取真实账号、后台、凭据、storage、Cookie、请求 body/header，也不记录密码值。

| 检查 | 证据与结果 |
| --- | --- |
| 旧中心真实点击 | 409 后清空账号，pointerdown 距输入 2.4ms，确认 stale 模型且实际命中主按钮；trusted click=1，首错聚焦账号、ARIA invalid / 描述关联正确，请求仍仅先前 409 的 1 次。 |
| 160ms 长按 | 实际旧中心按下，按钮文档 top 全程 610.84375px；按下不提交，释放 trusted click=1，当前空账号阻止新请求。 |
| 拖离 / native cancel | 实际主按钮按下后拖离或 CDP touchCancel；click=0、snapshot 释放、无新请求。CDP 取消是 H5 输入事件证据，不是物理设备验收。 |
| 英文 200% 长短提示 | 390px，short→empty、empty→short、short→valid；原提示自然高度分别 89.59375 / 44.796875px。编辑后等待模型 160ms 再按旧中心，并再按住 160ms，文案/高度/按钮 top 保持；三次 trusted click=1。非法输入零请求；合法纠正隐藏原提示、移除错误 ARIA，发送 1 次拦截 409。依赖确认密码错误同时保持。 |
| 键盘与其它交互 | 主按钮 Enter / Space 空提交均保持账号首错焦点；账号 Enter 到密码、密码 Enter 到确认、确认 Enter 提交；眼睛 Enter / Space、busy 全部禁用/防重、失败恢复、安全单/双编码 returnTo 及外部回退通过。 |
| 页面与布局 | 页面身份、非空、无框架 overlay、0 pageerror；四视口 × 中英 × 四主题及两条 200% 字号记录，共 34 条 UI 记录。console 9 条均为拦截 401/409/429/503 的资源状态。作者查看最终默认首错与英文放大截图，未见遮挡或横溢出。 |

`pnpm --filter @englishflow/mobile typecheck` 在最终源码通过。测试中的 160ms 是刻意覆盖长手势和模型节流窗口的验证，页面实现没有固定 sleep。未验真实 IAM 注册、真实成人学习闭环、App/小程序、物理软键盘或系统读屏。

## 冻结交接

- register.vue SHA-256：`012f7295f1c253741a2927ae90b468eeda41647f83f779e96fbfc808c4ade2bc`
- ui-register.e2e.cjs SHA-256：`c6b25070dba6224a569591184f8952936b3e92bd963e5a6862885228624424ba`
- pointer-feedback.ts 复用 SHA-256：`6464f4c1712b5a0f2fd4ab01d451d5bb6ffaa13bde486826a424511059ef6425`
- 当时 i18n SHA-256：`f772bccef324eeac99e3f7b31292040d1353557387aaf6f05d309b74d7ad947d`；以后 Root 变更长度文案需要新的关联复验，不覆盖本次旧证据。

本阶段官方额度实读五小时 23%、周 69%。源码冻结后未继续改动；独立复审、完整契约补修、页面最终状态、提交和推送由 Root 管理。
