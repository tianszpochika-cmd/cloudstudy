# 当前会话刷新与导航复核竞态 — 实际合成 UI FAIL

应用组合为 page854 / i18n5e0 / helper9a，测试1cca；完整hash、响应字段类型、请求路径及非敏感状态时间序列见 results.json。未读取或记录Token、凭据、请求体/头、cookie或存储。执行脚本字节另存 execution-script.cjs。

同一合成身份revision=4，恢复成功分支：

1. 时间1792057408276，实际onboarding页面 restoring/reading/busy均true；session.status由authenticated进入refreshing，isAuthenticated=false。
2. 1792057408279 请求refresh，8281 fixture进入hold，8282释放；8288 refresh HTTP200。之后8300/8302 current principal GET/200，响应仍含adultGate及learningAccess字段。
3. 1792057408319 已处于登录路由，session仍refreshing、isAuthenticated=false；同一毫秒稍后变为authenticated、isAuthenticated=true，revision仍为4。
4. 后续current principal200、target404（当前未保存目标）正常；没有401、没有identity撤销，页面却留在login。期望goal不可见，最终30秒timeout。

因此restoring-run2的成功支落登录已具备产品竞态证据，不能归因于刷新失败或权限事实缺失。静态导航源revalidateProtected在await session.restore后立即按isAuthenticated判登录；restore已restored会立即返回，而同owner已有refresh尚在进行，status=refreshing使该判定为false。现有navigation串行队列没有覆盖页触发的owner refresh，符合实际先跳login后认证完成的顺序。精确调用路径仍可由Root评估；修复不能把refreshing直接视为授权，应等待已有刷新结束后重新执行完整owner/auth判断。

本组已退出，未修改正式源码。Root负责共享窄修与新freeze，随后应分别验证refresh成功留goal可用、refresh401回login可用，以及owner/晚回调边界。旧FAIL原件保留。
