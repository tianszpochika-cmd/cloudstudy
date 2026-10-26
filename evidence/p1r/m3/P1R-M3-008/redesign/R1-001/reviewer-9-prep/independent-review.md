# 10 版准备脚本独立源码复核

复核者：子 Agent /root/r1001_diff_review。范围只读，不访问数据库，不启动服务/浏览器，不修改文件。

结论：先前接线、响应关联与空态误过缺口均已修，未发现阻止准备 READY 的新确定缺陷。产品验收尚未通过。

- r1-001-content-empty-10.cjs:13–15 使用专用 reader/schema，:32–33 直启 java -jar，绕过 runner JDBC 覆盖。
- application.yml:69–72/:80/:95 的 JDBC、relay、consumer、Flyway 环境映射相符；ContentServiceConfiguration.java:145–158 在 flyway=false 时不执行迁移。
- real-upstream-10.cjs:18–24 导航前捕捉浏览器 BFF 响应并逐页保存，:40/:62/:73 用本页实际响应核对。
- real-chain-assert-10.cjs:5 空态只允许 ready/empty；collector:64–70 使用当前 canonical 价格标题，:49–54 在渲染后计数/核标题。
- 保留旧准备脚本和历史证据。collector 明确 storageChecked=false，不能扩大为官网 Token 安全全项 PASS。

实际 jar 健康、运行有效配置、真实链双视口和失败恢复必须由后续 TC 运行证据决定。
