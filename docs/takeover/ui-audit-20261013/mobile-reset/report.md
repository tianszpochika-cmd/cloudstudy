# MB-003 — Mobile 找回密码逐页重设计

日期：2026-10-14。当前状态：`IN_REVIEW / POINTER_FOLLOWUP_FAILED`。独立复审发现此前作者矩阵遗漏真实指针窗口，当前源未签收，不能推送为完成。正式入口为 `http://127.0.0.1:18183/#/pages/reset-password/reset-password`，申请与设置新密码是同一路由的两个步骤。

最新断点：初版 `b3eebb09…` 的68矩阵通过仅是历史作者结果。独立 [真实首次新错误 FAIL](20261014-final-interaction/pointer-new-error-results.json) 证明 blur 新建错误行令主按钮移动、trusted click=0。当前 H5 反馈快照修稿 SHA-256 为 `3e7b9fc8f8f7b45d78e06fed83f6045afffc98ce9b21168624dd48a4b2a92623`；typecheck 通过，但 [run2/results.json](20261014-run2/results.json) 在160ms真实手势断言仍 FAIL（按钮625.234375→655.625）。需继续定位快照没有稳定布局的原因，再复验 click、拖离、cancel、长按和键盘；尚未签本页，未改 MB002。

追溯 R1-012 / BC-012 与 R1-015 / IC-054；UI owner 为 `apps/mobile`，密码重置事实 owner 为 IAM。继续使用既有 IAM TLS `/auth/password-reset/request`、`/auth/password-reset/confirm`、skipAuthRetry 与客户端 8000ms 超时，没有接口、存储或门禁改动。

## 修改与保留证据

[修改前申请](20261014-run1/request-390-before.png)、[旧错误跨步骤](20261014-run1/confirm-stale-error-390-before.png)、[等待时可换步](20261014-run1/busy-cross-step-390-before.png) 及 [只读审查记录](20261014-run1/next-page-notes.md) 从具名 Git 外备份复制。有效英文申请截图为 [fresh 版本](20261014-run1/request-320-en-fresh-before.png)，未采用同文档 hash 留旧状态的截图。

- 去掉重复 hero、装饰品牌、卡框和艺术字，保留顶部正式品牌与成人说明；两个步骤各自有一个标题、短说明和主任务。表单开放排列、最大 420px，真实 uni-view 字段容器提供 24px 间距。主按钮正常 16px，输入实际 16px，标题 28px、描述/标签 14px、密码规则 13px。
- 确认步骤增加既有 eye 图标 19px、44×44px 命中区；换步为文本动作，底部为明确「返回登录」，不使用已有账号的注册文案。所有按钮有可见键盘焦点。
- H5 watch `flush: post` + nextTick 将 id/name、标签、username/one-time-code/new-password、required/minlength 与错误关联同步到真正原生 input，覆盖步骤挂载/卸载、输入、焦点、显隐、busy 和语言变化。uni-input 模型和跨端焦点保持原有平台能力。
- form/blur/confirm 使用组件即时值，缺少事件值时保留 refs，busy 时拒绝同步；不读 DOM.value 来提交，不加固定等待或页面 Promise.race。空缺/长度错误逐字段关联、聚焦首错；保留已报错误的自然行高，纠正后视觉隐藏旧文字并移除 alert/错误关联，防止 blur 时按钮在 pointerdown/up 间移动。首次合法表单没有错误占位。
- 提交禁用输入、眼睛、换步和返回；处理函数同样阻止直接派发点击绕过。切步清除旧校验、服务错误、回执和显示状态，回申请清口令/新密码并保留账号；修改账号清除旧回执。安全 returnTo 使用既有单/双编码 helper，口令深链仍进入确认。
- 202 显示既有「若收到重置邮件」条件回执；429/503 显示中性重试，不宣称失败请求已受理，不根据账号是否存在分类。明确 allowlist 的无效口令 401 与未知 401 分开；服务错误不会因普通编辑消失。合成确认成功清理页面账号/口令/密码/显示状态并展示返回登录说明。
- 全输入显式 `maxlength=-1`，避免 uni 默认 140 字符截断。按现有契约验证账号 3..128、重置口令 32..512、密码 12..128；过长密码明确报错，不能静默变成另一串密码。

共享中英文资源和 session 的 allowlist marker 保留修复由主 Agent 提供；作者只修改页面、UI 脚本和本目录。没有扩大真实成功后的认证状态或原生安全凭据清理范围。

## 验证

Browser 插件不可用，使用现有 Playwright Chromium 隔离上下文；TLS 保持严格默认验证。全部 API 请求拦截，未使用真实账号、邮件或有效口令，不读取敏感存储、Cookie、请求 body/header 或认证 Token。结果 URL 不记录重置口令；长口令用纯合成内容，仅保存长度/布尔。

| 检查 | 证据与结果 |
| --- | --- |
| 两步骤完整矩阵 | 320/390/768/1280 × 中英 × 四主题 × 两步骤，64/64 PASS；真实字号、24px 间距、44px 控件、无横溢出、无框架错误覆盖层，系统偏好实时切换。 |
| 字段与即时输入 | 空缺、短密码、过长密码/口令、短账号、即时合规纠正与立即清空；错误字段关联和首焦点正确，校验失败零新增请求。512 字符纯合成口令完整保留，结果只含长度和布尔。 |
| 键盘及原生语义 | Tab 可见焦点、账号 Enter/口令 Enter 跳到下一字段、密码 Enter 提交、眼睛 Enter/Space；步骤切换、语言适配器切换、busy 与恢复后真实 input 语义持续正确。适配器切换不代表页面有语言选择器。 |
| 请求与等待 | 202 条件回执、账号修改清回执、429/503 中性失败；request/confirm 的 pending 直接派发换步/返回和重复提交均被挡住。 |
| 确认与清理 | 明确 invalid-code 401 显示重新申请；未知 401 显示中性失败；返回申请后口令、密码、显隐和旧错误清空，账号保留。合成 204 成功后表单/输入移除并有成功说明。 |
| 放大/短屏/深链 | 中英文 × 两步 200% 字号共四组 PASS，矩阵总计 68；320×460 英文确认可纵向到达出口。口令深链、单/双编码合法 returnTo 和外部 URL 回退通过。 |
| 工程检查 | Mobile typecheck、H5 build PASS；IAM transport、public handoff、password-reset-failure-marker、成人 Gate/consent 共 18/18 PASS。构建只有既有配置加载、Sass @import、动态 chunk 和插件计时警告。 |

最终 [results.json](20261014-run1/results.json) 为 PASS，pageerror **0**，console 只有 fixture 的一次 429、一次 503、两次 401。初次共享文案缓存导致标题断言失败的版本保存在同一目录 `results-failed-*.json`，不以旧缓存当当前结果。核对本人旧 PID9820 后仅重启本项目 Mobile 服务一次并用官方 `--force` 刷新预 bundle。

## 设计对应与交接

作者共同查看 [设计方向](../DESIGN-DIRECTION.md)、[正式 Web 确认截图](../learner-reset/screenshots/reset-confirm-390-light.png) 与本轮 [申请亮色](20261014-run1/reset-request-390-zh-CN-light.png)、[确认亮色](20261014-run1/reset-confirm-390-zh-CN-light.png)、[确认高对比](20261014-run1/reset-confirm-390-zh-CN-high-contrast.png)、[英文 200%](20261014-run1/reset-confirm-390-en-US-text-200.png)：开放单列/420px 上限、28/14/16 字号、25px 品牌/19px 眼睛、共享紫色与高对比、主任务→换步→返回顺序均保持同一设计体系。Mobile 密码规则单独靠近输入；成功后明确返回登录，不声称自动进入学习。390px 中文申请/确认主按钮底部分别约 **380.88/614.45px**；标题/说明/主按钮最小对比分别 **14.17/5.50/8.00**。放大后单行输入可横向承载文本，标签和说明完整、页面可纵向滚动。

最终页面 SHA-256：`b3eebb09cf8e2194ed9355f5dce863786789ca870b25d47203022815bef7c361`。最终结果记录十项源/共享依赖/脚本哈希并与当前文件核对一致。脚本默认输出 `.git/codex-local-backups/mobile-reset-<timestamp>`；本轮指定本页 `20261014-run1`，没有覆盖已签其它页面。

本人服务保留：session **99926** / PID **29808**，固定 `127.0.0.1:18183`，uni H5 strictPort + force。未停止其它共享服务，未操作 Git/index/CHANGELOG。

真实 IAM、邮件送达、有效一次性口令和密码更新后的登录闭环 **NOT_RUN**；原生 App/小程序、物理软键盘、系统读屏和真实 Keychain/Keystore refresh 清理 **NOT_RUN**。现有 session 成功仅返回 true，原生清理契约 GAP 保留；页面输入清空和 UI fixture 成功不能证明该 GAP 已关闭。UI scope PASS 不迁移 R1 业务完成状态。
