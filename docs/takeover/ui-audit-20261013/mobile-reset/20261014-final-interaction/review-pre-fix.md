# MB003 独立交互复审：b3eebb09 版本断点

状态：**IN_REVIEW，存在已复现的真实 pointer 点击丢失，当前不能签 UI_SCOPE_PASS。**

正式源码指纹：`b3eebb09cf8e2194ed9355f5dce863786789ca870b25d47203022815bef7c361`。本 Agent 未修改正式源、共享模块、作者证据、服务或 Git，仅写本新目录。所有 API 拦截；没有真实账号 / IAM / native 操作，没有读取 request body / header、storage、cookie 或 Token。

## 已完成的独立证据

- 账号 request、确认口令、确认密码三字段各 clear / replace × click / Enter，共 12 组，实际输入到提交约 0.5–0.8 ms，均严格确认进入旧模型窗口。清空 0 action / 0 API 且原生 invalid / 首错焦点正确；替换 boolean 全匹配。口令 replace 的 512 长度完整传给 action，未被 uni 140 默认截断。
- 513 口令、129 新密码保持完整输入，分别按 512 / 128 上限拒绝，0 API。
- 初始化 request 原生语义、空账号首错焦点、切 confirm 后新挂载字段语义、空口令 / 密码错误已经实际通过，但整个 lifecycle 分组尚未执行完。
- 独立整脚本在下一组 129 账号的首错焦点断言处停止，不把未运行的后半段写成 PASS。

## 已复现的问题

最小脚本：`pointer-new-error-diagnosis.cjs`；结果：`pointer-new-error-results.json`；截图：`pointer-new-error.png`。

1. 账号先填写合法，切确认步骤；口令 / 密码空提交出现错误，随后补齐。
2. 账号从合法内容迅速替换为 129 字符，native 输入完整保留；模型仍旧值，账号还没有历史错误行。
3. 用 `page.mouse.click` 在当时主按钮的真实中心按下；pointerdown 时仍确认模型旧值。
4. 输入 blur 同步最新值，首次出现账号长度错误行；按钮文档 top 从 625.234375 变为 655.625（下移 30.390625 px）。pointerup 不再命中原按钮，trusted button click=0、焦点落 body（空 id），0 API。

字段错误本身正确，账号也未被截断；问题是失焦时新错误行造成按钮移动，使这一次真实点击丢失。既有 lastError 自然高度方案能保留已经出现的错误，但此前没有历史错误的字段仍有此边界。

## 尚待最终复验

作者需要修复后冻结新指纹，再运行完整独立交互脚本。当前未签收：整个语言 / mount 生命周期、已知错误清理真实 pointer、请求 202 / 429 / 503 / abort、pending 直接 switch / return / toggle / duplicate guard、confirm marker 401 区别、合成成功清理及返回登录、deep code 与安全双编码 return。本脚本这些部分已写但尚未跑到，不能据源码或作者 PASS 替代独立证据。

初期两次独立 harness baseline 失败保留在 `results-first-run-harness-baseline-fail.json` / `results-second-run-harness-baseline-fail.json`：直接赋页面模型没有同步 uni-form 内部基线，已改为真实 UI 填写。随后 12 组即时输入均通过；本 pointer 丢失由独立最小真实鼠标脚本另外确认，不能与 harness 初始化错误混淆。

不重复其它 Agent 的主题 / 视口 / 200% 视觉矩阵。真实业务、原生平台、物理输入与屏幕阅读器不在此证据范围。
