# MB001 登录标题生命周期窄补修

状态：PUSHED_UI_SCOPED。提交54f5ac0e02a529635eefb3b7c55dd3cd7d33a71f已推origin/dev-redesign，并以ls-remote核对同一完整SHA。原登录重设计与键盘/输入验收范围不重做，旧PASS/FAIL保留。

在MB004恢复401及退出后迟到响应的独立复审中，真实捕获两次未处理Promise异常。隔离API调用栈已归因到原login.vue的onShow：页面元数据尚未注册就setNavigationBarTitle，返回page not found，不能把这些Object错误免除为预期401。见[原始归因](before-title-origin.json)。本地uni-h5实现也在pageMeta缺失时明确reject。

正式login.vue仅将标题初始化从onShow移至onReady，不添加catch免除、不改变输入/提交/布局/主题/权限。当前raw SHA256为0c5fb5cd346d9e86271eaf65638cf2ffabbc9b466fb3d6cd1079e4fbc9a55460。

[独立窄修报告](review.md)及[标题结果](title-results.json)：中英各初次进入、注册登录返回、缓存历史返回、受限引导退出reLaunch共8例真实document.title正确且pageerror0；[恢复结果](restoring-results.json)中成功、401与logout后late200三支亦pageerror0，owner/权限断言继续通过。三auth共享指针定向15例另具名记录，具体范围见独审。

当前组合typecheck/H5 build通过，日志随本目录保存。验证在相同当前九源候选下进行，完整freeze随证据保存；MB004八源由下一单页提交集成。本提交只发布登录标题窄修与其记录，不把合成API结果升级为真实IAM/native/业务验收。

归档执行脚本与控制台日志保留原始末尾空行，日志也保留原输出尾随空格；空白检查只对这些原始记录免除对应EOL/EOF项。正式源及编写的说明按普通diff规则检查，未改写失败原件。
