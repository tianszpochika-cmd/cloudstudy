# G-PLATFORM：R1-001 限定准备签收

- 日期：2026-10-03（北京时间）；主审：01a0cb93-8791-7ee2-b453-8e8752b2553f
- HEAD：3d11be3337accd32afbdbe13a218bca38c786043；本卡diff摘要：83ef67844c369472898cfb1fdeb0f22e3f6b971ac7650f95b90903214bf72de2
- 结果：PASS，仅下列准备scope；完整Gate未关闭。
- scope：无写入、无官网业务Token、BFF只调用公开Gateway读口。核对内容owner公开Controller/Security及Gateway路由源码，现有BFF权限/失败/缓存负例通过；不将静态源码等同当前真实已验收投影，真实数据/版权与上游恢复在交付时必须核验。

ContentHttpController.java:57/88存在公开读口，ContentSecurityConfiguration.java:124–125公开permitAll，GatewayRouteExecutionPolicy.java:69–74引用对应owner控制器。BFF只发Accept头，经Gateway读投影及公开价格，401/403区别于空列表；不转发访客密码/业务凭据。价格失败只写degraded header而返回空价是待修实现缺陷。本Gate只签收公开只读边界，未运行owner数据/发布资格/事件/撤销事实。真实上游、独立facet恢复在交付TC中补验。

当前源文件/配置/契约摘要见[current-input-review.json](current-input-review.json)，实测命令/时间/退出码见[恢复后预检](resume-20261003/verification.json)。工作区保护见[清单](workspace-protection.txt)。认领见[本卡限定确认](claim-20261003.json)。

恢复/回退：本轮只更新端口元数据与执行资料，无业务写入或服务操作；实现回退仅撤销本卡允许文件的自身差量，不覆盖共享改动。TC01…03、实际公开上游、双视口及失败恢复待实施后独立审批，不写产品PASS。
