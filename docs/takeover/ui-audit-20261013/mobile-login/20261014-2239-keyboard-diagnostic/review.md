# MB-001 同族键盘只读诊断

结论 **FAIL（仅新增真实主按钮空提交 Enter 范围）**。当前 login 源码 SHA-256 `da5ad20851a4158ea0e23918adb27f1bcc7047ae67778add321aa8d397bb58be` 在检查前后相同。本轮没有修改 login、helper、shared 或旧证据，没有重跑普通视觉矩阵。

在正式 `#/pages/login/login` 入口新建两个隔离 Playwright context，空账号/密码，主按钮 `.focus()` 后分别执行实际 Enter/Space。所有API拦截，无请求 body/header、认证Token、cookies、敏感存储读取。

[button-keyboard-results.json](button-keyboard-results.json)：**Enter FAIL**，可信 keydown 主按钮→共享激活 click→先 focusin `mobile-login-identifier`→同次可信 keyup 落在账号→focusin `mobile-login-password`，而账号仍 `aria-invalid=true` 且错误可见。API0，pageerror0。[Enter截图](keyboard-empty-Enter.png) 保存当前错误与密码焦点。Space保持首错 `mobile-login-identifier`、API0，PASS。

这是真实浏览器输入复现的新边界，足以重新打开同族键盘问题；不能把历史登录PASS改写成未执行，也不能把本两项诊断扩展为当前登录整页FAIL或业务FAIL。需要局部补修后以新hash独立复验。真实登录、IAM、成人Gate、原生App等仍不在本诊断范围。
