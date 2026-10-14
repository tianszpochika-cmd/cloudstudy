# MB002 同族首次错误行：只读复现（2026-10-14）

结论：**CONFIRMED_POINTER_MISS**，已推注册页需要后续独立小补修；本目录不是修复后的 PASS。

源码前后 SHA-256：`e2115e12d993ceba294afe60933a6e5d8ad0d8916b210daa4e6052ff3cf8782f`。

Root 授权的单一只读场景：全新 Chromium H5 上下文，三字段全合法提交到拦截 409；此前账号没有出现过本地错误行。随后在旧模型窗口内快速清空账号，用真实 `page.mouse.click` 点击当时主按钮中心。

- pointerdown 距输入 2.5 ms，严格确认页面模型仍旧值。
- blur 首次创建“请输入账号。”错误行，按钮文档 top 从 610.84375 变为 641.234375，移动 30.390625 px。
- trusted button click=0，焦点落 body（空 id），原生账号长度为 0。
- 注册请求数仍为 1，只有前面的合成 409；清空后没有新请求。

`pointer-diagnosis.cjs`、`results.json` 和 `register-pointer-new-error.png` 是独立证据。所有 API 均拦截，没有读取真实 storage / Token / Cookie，也不记录 request body / header 或凭证值。本 Agent 未改正式源码、旧证据、服务或 Git。

此检查只确认同族首次新错误行导致的真实 pointer 点击丢失；没有重跑主题 / 视口矩阵，没有扩大业务或后台范围。移动找回密码 MB003 正在先修，注册页由 Root 后续另行分派小补修。
