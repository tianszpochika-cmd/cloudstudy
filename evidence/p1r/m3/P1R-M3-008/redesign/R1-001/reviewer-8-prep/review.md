# R1-001 解阻收尾包8准备核查与环境范围决定（2026-10-05）

## 结论与范围

保持BLOCKED revision20，不签READY、不start、不交delivery-7。采集断言准备有实质进展；主审独立复跑真实链断言15项和入口11项全部符合预期（MOCKED，不是浏览器产品验收）。本轮没有访问DB、启服务或改业务。

批准下一组新增**专用测试schema准备**：在已登记MySQL127.0.0.1:13306创建唯一r1_001_empty_20261005_<suffix>测试schema，结构来自当前content-service schema的只读结构元数据，不复制任何业务数据，不修改正式迁移。可创建仅SELECT权限的专用临时测试身份，凭据仅用于子进程安全注入，不进入报告或Git。所有写入仅限新测试命名空间/其临时身份，不修改共享数据、既有用户权限、端口或共享runner。

准备脚本与证据均放本卡work目录。先验证目的schema新建且不与既有schema冲突，严格白名单/固定前缀限定DDL目标。保留实际创建的schema/user清单与结构/空行只读回执；本阶段不启动后台，不清除已存在schema，不删除测试环境。凭据不可用时给出所缺权限与实际脱敏失败信息，不猜测/打印密码。

这项是限定验收环境准备授权，不是R1-001产品ACCEPTED，也不是允许写共享领域库。新环境证据确认后，由主审补READY输入签收，再运行真实TC。

## 已核实的改进

- assertNoBusinessCookies有命中失败，assertChainFacts核三路状态、BFF来源/状态、课程ID和时间，DOM标题使用归档BFF集合，价格空说明进入共用断言。
- safe-run-8为Node子进程env覆盖，六个关闭键有正确源码映射，调用方环境不赋值；但validate只是静态生成清单，并没有运行effective配置验证。
- 源码GatewayErrorMapper确有ConnectException→503，超时504，其它502；仅准备依据，READY后的真实恢复仍须实测。

## 不通过共享七行置空方案

empty-courses-input-8.md的同事务UPDATE shared content_definition七行，不批准。未提交事务对服务其它连接不可见；提交后会影响共享业务事实，回滚方案不能消除窗口期影响。移除该执行路径，不做共享UPDATE、临时下架或seed。也不需要新MySQL端口/实例来取得空课程；专用新schema即可承载无已发布课程的合法读事实。

## 专用schema接线必须正确

当前run-v2-services.mjs:293至297无条件把CONTENT_JDBC_URL/username/password绑定content_service的owner配置，外层safe-run env不能改变此分支。专用空schema阶段使用本卡自有content java启动器，或在本卡包装器明确排除runner的content分支。既有Gateway/commerce可按安全包装器各自启动，不重复占用18089。

直接启动现有content jar使用已核配置：content.persistence.mode=jdbc；content.persistence.jdbc-url、username、password（环境映射CONTENT_JDBC_URL/USERNAME/PASSWORD）；CONTENT_SERVICE_SCHEMA/service.schema；固定127.0.0.1:18089。关闭relay/consumer/schedule及Flyway，不启seed；密码通过子进程环境，不放命令行。记录脱敏JDBC host/port/schema、jar哈希、PID及非秘密安全键，并用新schema SELECT验证实际事实，不能只读调用方环境当服务effective证明。

safe-run静态检查/采集输出用新版本文件与out-dir，避免默认writeFile覆盖此前固定JSON。effective核验按六项白名单逐键输出，禁止泛扫CONTENT_/COMMERCE_环境（可能含凭据）。启动阶段显式关闭P1R_DIAG，runner该分支会输出秘密，不能继承开启状态。无需改变共享runner。

## 空态与终验脚本

补齐价格事实来源：上游commerce.plans与BFF价格集合均应符合该测试场景，不能上游非空却BFF清空仍认为权威空。版本/epoch只比较实际契约中存在并有归档来源的字段；当前模块未比较这些字段，不可声称已核版本一致，更不能为测试硬加未经授权的BFF契约字段。价格说明定位使用真实pricing页容器（例如.page-body .container），不要main,.page-body,body.first选中body。PublicStatus实际没有.facet-error/data-facet-state标记，错误排除要依据当前真实响应和组件可见错误/重试语义，不能用不存在的选择器计0证明无错误。

当前assertChainFacts及DOM断言要求课程>0，仅适用于成功态。新建显式nonempty/empty场景：空态要求真实Gateway与BFF课程数组为[]、课程facet非error/permission/maintenance且不stale、DOM课程零卡与“内容准备中”可见，其它facet按实际合法事实检查；不可仅为过断言伪造数据。

ContentHttpController空目录generatedAt用Instant.now，不同真实请求时间自然不同。空态不要复用非空目录的逐字时间相等要求；保存每次真实回执，核对页面使用对应BFF响应的更新时间，区分动态生成时间和发布版本。合法空态全局可能ready或empty，要以课程facet/真实数组判断，不硬编码全局唯一empty。

显式切换成功/空输入时，停自己本轮content实例后切schema；同步对本卡BFF内存缓存做受控清理（仅停启自己BFF进程）以免串场，固定端口不变，绝不操作他组服务。TC02记录无缓存error、恢复后真实点击重试，必要时另验有缓存recovery分支；真实状态如实记录。

## 下一组四项

1. 专用空schema/临时只读身份准备脚本、执行隔离DDL并读回空事实/结构，禁写共享数据。
2. 自有content启动接线配置及静态预检（本阶段不启后台），明确固定端口与子进程env。
3. nonempty/empty场景断言与同模块负例；沿用已通过版本7/8，输出新版本，不重做业务。
4. 固定完整SHA256、创建目标/权限/结构/空行回执与可运行TC步骤，交主审签READY。没有输入时一次报告准确权限缺项，不继续重复生成完成摘要。

主审收到实际隔离输入和接线准备证据后统一核准READY，再进行TC01/02/03真实运行，不开R1-002。
