# MB-002 注册契约边界补修作者报告

日期：2026-10-15（北京时间）。作者结论：`PASS_UI_SCOPED_NOT_BUSINESS_ACCEPTANCE`；候选继续等待 Root 独立复签与单页提交。本报告不签真实 IAM、业务闭环或原生端。

## 最小改动与依赖

现有 `packages/contracts/fragments/b8/b8-auth-iam.openapi.json` 的 `B8RegisterRequest`、`B8WebRegisterRequest`、`B8NativeRegisterRequest` 一致要求 identifier 3..128、password 12..128；现有 session 注册只 trim identifier，password 原样。没有接口、数据 owner 或传输变更，IAM TLS 和既有成人 Gate 继续由原流程负责。

注册页补齐账号 trim 后 3..128、密码 raw 12..128 本地校验，消费 Root 添加的 `auth.register.identifierLength/passwordLength` 中英文资源。三字段明确 `maxlength=-1`，保留完整输入后给出本地错误，避免 uni-input 默认 140 静默截断；H5 原生账号同时补 minlength=3。确认字段仍只判必填与两次密码一致。

原 focused 编辑期间已报告文案/自然高度保持、blur / submit 即时组件值与当前错误报告、H5 pointer 快照以及主按钮 Enter / Space keyup 提交策略均保留。本次没有改 helper、session、登录、找回、样式、shared 或 Git；i18n 两键由 Root 修改，作者只消费。

## 旧 FAIL 保留

原 [首次错误行指针 FAIL](../20261014-pointer-followup/before/results.json) 和 [旧作者运行 1/2 的测试、键盘 FAIL](../20261014-pointer-followup/after/report.md) 原样保留。当前新 [author-run1 FAIL](author-run1/results.json) 通过 34 条布局记录后，账号 2 字符长度错误显示裸 key；[缓存说明](author-run1/cache-failure.md) 记录源与共享资源正确、Vite 预 bundle 仍旧。独审 Agent 仅核对并刷新其自有固定 18183 服务，使用 strictPort / --force；作者没有启停服务。新运行使用 fresh context，不覆盖失败。

## 最终作者证据

[author-run2/results.json](author-run2/results.json) 在冻结源码与共享依赖上完整通过。入口 `http://127.0.0.1:18183/#/pages/register/register`，隔离 Playwright Chromium；Browser plugin not available，沿用现有 Playwright。所有 `/api/v1/**` 全部拦截，只有合成拒绝/成人 REQUIRED fixture，不读取真实后台、storage、Cookie、凭据、请求 body/header 或 DOM 密码值。长度保留证据只读取组件长度并记录数字。

| 范围 | 最终证据 |
| --- | --- |
| 长度与原值 | 17 条边界：账号 0/2/3/128/129/141、带前后空格后的 2/3/128/129；密码 raw 0/11/12/128/129/141 与 raw 带空格 12。非法本地错误/首错焦点/ARIA 且零注册请求；合法各一次拦截请求。账号 raw141、密码与确认 raw141 均保留完整组件长度。 |
| 指针与取消 | 409 后首次新账号错误的真实原中心快速点击、160ms 长按，实际命中动作且 click=1；拖离和 CDP native touchCancel click=0。按下不提交，快照在结束释放，非法值无新请求。 |
| 英文 200% | 390px 上旧密码短/空/合法及新账号长度/空/合法共 6 条；原文案的自然高度 89.59375 / 44.796875px，在模型 settle160ms 后、按住160ms期间均稳定，6 次真实 click=1。合法纠正隐藏文字并移除错误关联；blur / submit 后显示当前错误。 |
| 其它 UI 回归 | 当前 34 条布局记录、四视口/中英/四主题、系统主题切换、200% 与短视口滚动；label、眼睛 Enter/Space、primary Enter/Space 首错、字段 confirm、即时纠正/清空、busy 锁定/防重、失败重试和安全 returnTo 通过。 |
| 页面健康 | 页面身份/非空/无框架 overlay、0 pageerror；16 console error 均为被拦截 fixture 的 401/409/429/503 资源状态。 |

作者目检最终 [英文 200% 新账号长度错误](author-run2/register-reported-error-empty-to-length-en200.png)、[密码 141 本地上限](author-run2/register-contract-password-141.png)；错误靠近当前字段，首错焦点可见，文字自然换行，主动作与出口可滚动到达，未见遮挡或横溢出。

`pnpm --filter @englishflow/mobile typecheck` 通过；最终浏览器运行已实际编译并呈现 Vue 模板。作者没有凭矩阵数量或 fixture 签真实注册、成人资格、App/小程序、物理软键盘、系统读屏或其它页面完成。

## 冻结交接

- register.vue：`9258cb03e36c97d53d2e88521ba29f95aaf81de794657c8c72689fa50bd66baf`
- ui-register.e2e.cjs：`d1aa2c15ebe845b98f88809350202561c07fe393ad63779cbfa498a5154b0a65`
- Root 共享 i18n：`eef37b1f82b915a0dc73e7f3351061d183912126801169dd083905a8060afd87`
- 未改 pointer-feedback.ts：`6464f4c1712b5a0f2fd4ab01d451d5bb6ffaa13bde486826a424511059ef6425`

运行后四项原始哈希仍与 results 匹配。阶段末官方额度五小时 69%、周 76%。源码与测试不再改动，交 Root 独审、最终状态与提交推送收口。
