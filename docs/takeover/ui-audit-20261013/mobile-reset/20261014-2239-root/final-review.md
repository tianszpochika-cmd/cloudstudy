# MB-003 root收口 — 正式Mobile找回密码

当前具名结论：**PUSHED_SCOPED / UI_VERIFIED**。正式页raw SHA-256 `c9a6da864e9ce8933cb5a42b6743ff99551fa433eafe701ea470c760d88cc936`，窄Mobile H5 helper `6464f4c1712b5a0f2fd4ab01d451d5bb6ffaa13bde486826a424511059ef6425`；root接受[最终独立动态复签](../20261014-c9a6-final-interaction/review.md)。不能把旧版本测试改写为本版通过。

## 最终实现与修复

申请/设置新密码两步使用正式uni-app页面：开放420px表单，28px标题、14px说明/标签、16px真实输入与主按钮、13px规则、24px字段间距；保留既有19px眼睛/44px操作区、共享语义主题和简短辅助出口。没有默认等待卡、装饰外框/艺术字、重复hero或静态Demo替换。

数据校验继续使用组件即时form/blur/confirm值；空缺、账号3..128、口令32..512、密码12..128各自有可读错误。focused编辑期间已报错误文案/自然空间稳定，纠正合法可清可见错误；blur或明确submit更新反馈，H5真实press快照延续到click或取消。已受理回执编辑后立即隐藏文字、撤销status/ARIA，仅保留此前真实出现的自然空间，下一次明确提交/切步清理；不能把点击误送到换步骤动作。Enter/Space只在primary局部keyup提交，避免共享keydown提前激活后同一keyup跳过首错。

## 证据与版本

- `b3`首次blur新错误移按钮、`3e`真实down前新错误提前出现、`9729`英文200%历史长提示变短、回执清除误切步骤、`e008`确认按钮Enter跳token等FAIL均保留；它们是推动补修的实际证据。
- 作者[run4](../20261014-resume-run4/results.json)为e008快照的68组和扩展指针结果。c9仅增加primary局部键盘处理，不改样式或字段结构。当前c9由独立方重跑49项：keyboard8、dynamic27、pointer8、receipt4、terminal2，全部PASS，pageerror与非预期console均0。
- 对c9运行typecheck与H5 build，均通过，日志在本目录。既有构建配置、Sass @import/chunk及插件计时警告保留；构建不替代上述浏览器结论。failure marker 8项request/confirm专项再验通过，明确invalid401、未知401、429与503不混写或展示内部诊断。
- 当前移动自有服务为session77625/PID19892、固定127.0.0.1:18183。Browser插件的browser skill不可用，使用仓库已有Playwright Chromium隔离上下文，API严格fixture。没有真实账号/邮件/有效口令，没有读取请求body/header、Token、cookie或敏感存储。

## 视觉对照

root以view_image实际对照[已采用参照](../../learner-login-redesign/concept.png)、run4的390中文确认/英文200%初始图，以及c9当前[真实键盘首错截图](../20261014-c9a6-final-interaction/keyboard-empty-confirm-Enter.png)：开放单列与420px上限、无嵌套卡；正常无衬线字号/行高；共享紫色/对比；品牌25px与眼睛19px的重量；主动作→换步→返回的顺序；字段对齐/真实间距；错误文案与焦点可读，均符合本轮方向。

口令和密码区域的magenta为Playwright隐私遮罩，不是产品颜色。200%长placeholder遵循原生单行输入的可滚动/截取显示，完整标签、规则与说明保持可读；不把原生输入placeholder当作多行说明。参照是含浏览器外壳的桌面图，实际H5检查320/390/768/1280与短屏，按当前任务采用三字段两步，而非照抄登录的两字段。四主题/系统偏好和中英文视觉证据保留于对应作者快照；c9局部键盘变更不改变这些样式，旧raw hash仍如实记录。

## 未关闭范围

只接受正式H5的具名UI范围。真实IAM/反枚举事实、邮件送达、有效一次性口令、密码事实更新后的登录闭环、iOS/Android/iPad/小程序真机、物理键盘/软键盘/读屏和原生安全Refresh清理均NOT_RUN。session成功仍只返回true，不能用UI合成204关闭Keychain/Keystore清理GAP；不迁移R1/IT/业务签收。

本页单独提交/推送并核对远程SHA后追加收据。其他登录/注册未签差量不混入本页提交；原56个预存文件hash复核变化0。

## 正式推送收据

本页正式源/证据提交 `fe6e027c1332787171724442a197cf478d1f6289` 已推送 origin/dev-redesign，随后远程 refs/heads/dev-redesign 与本地 HEAD 均为该 SHA。此收据不表示部署或真实 IAM/mail/native 业务签收。
