# MB-001 主按钮键盘补修作者报告

作者结论：`PASS_PRIMARY_KEYBOARD_UI_SCOPE_NOT_BUSINESS_ACCEPTANCE`；页面仍 `IN_REVIEW`，等待 Root 独立复签和单页提交。日期：2026-10-14。

保留 [独立原始 FAIL](../../20261014-2239-keyboard-diagnostic/button-keyboard-results.json)：原 login SHA `da5ad20851a4158ea0e23918adb27f1bcc7047ae67778add321aa8d397bb58be` 的真实空主按钮 Enter，在 keydown 提交后聚焦账号，同一 keyup 进入账号输入的 Next，最终焦点错误落到密码；Space 原来正确。已推历史范围和旧证据不覆盖。

本次仅给 `apps/mobile/src/pages/login/login.vue` 的主按钮增加 Enter / Space 的 keydown stop/prevent，以及 keyup 明确 submit，阻止同一次按键在新聚焦输入上再触发 confirm。没有改校验、脚本业务流程、shared、样式、i18n、MB-002、MB-003 或 Git。未增加等待、生命周期或 DOM 密码读取。复用 Root 具名固定 18183 服务，未启停服务。

新 [keyboard-regression.cjs](keyboard-regression.cjs) 仅跑本次必要键盘差量；[results.json](results.json) 五条具名路径通过，没有重复旧布局矩阵：

- 真实主按钮 Enter 与 Space：keydown 保持按钮焦点、零请求、无首错；keyup 显示错误，账号得到首错焦点，两输入 invalid / error 描述关联正确，零登录请求。
- 合法合成输入分别用 Enter / Space：每条仅一条拦截 IAM TLS login 请求；pending 时输入、眼睛、出口与主按钮禁用，重复 Enter / Space 不增加请求；释放 fixture 401 后恢复并留在登录页。
- 输入框 confirm：账号 Enter 到密码；空密码 Enter 聚焦密码并零请求；合法密码 Enter 只提交一次。原有字段事件及即时组件 detail 校验逻辑未改。

隔离 Playwright Chromium，390×844，入口 `http://127.0.0.1:18183/#/pages/login/login`。Browser plugin not available，沿用现有 Playwright；所有 `/api/v1/**` 全部拦截，拒绝 fixture，没有真实登录、后台或凭据操作，没有读取 storage、Cookie、请求 body/header 或密码值。页面非空、无 Vite overlay、0 pageerror；console 仅拦截 401 资源状态。作者查看 [Enter 首错截图](login-empty-enter.png)，当前账号焦点与错误清楚，无遮挡。

`pnpm --filter @englishflow/mobile typecheck` 通过。源码 SHA 前后相同，冻结为 `1d347967146a38723ab0bf3ae0b1accca3b519ae6515e7c14f12297be1b80e19`。本次只签作者键盘差量，不代表真实 IAM 登录、业务闭环、原生端、物理软键盘、系统读屏或整页重新签收。

阶段末官方额度实读五小时 33%、周 71%；源码与结果冻结交 Root 独审，等待 MB-003 先收口。
