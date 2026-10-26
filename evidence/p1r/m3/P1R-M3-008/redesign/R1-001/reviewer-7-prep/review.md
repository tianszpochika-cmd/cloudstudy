# R1-001 版本7解阻准备核查（2026-10-04）

当前仍BLOCKED revision20，submission仍delivery-6。本次只读源码核对与版本7同模块负例复跑，不启后台/浏览器，不更改产品、共享配置、凭据或状态。负例输出写本目录negative/，原准备输出未覆盖。

## 已通过准备检查

- collectFromPage按视口判设备并要求至少一个对应可见可操作入口，HTTP状态进入同函数；独立复跑11个受控样本全部符合预期。仅MOCKED采集器验证，不是产品TC PASS。
- 严格路径已修；真实链脚本补DOM完整标题对应、可见价格空说明、Cookie名称采集和截图哈希准备。
- content/commerce Flyway与content relay/consumer配置键存在，显式false可覆盖runner默认true；未修改共享runner。
- 自有PID停启恢复属于已授权验收动作。READY后仅操作当轮自己启动、身份核对过的实例，不需再向用户申请同一许可，也不操作其它任务进程。

## 三项准备修正

1. `work/real-upstream-7.cjs`的cookie-names仍`record(..., true, ...)`，业务命中>0也PASS。记录与验收分开：Cookie来源限官网域/本轮上下文，记录名称/数量而非值，对已定义业务Cookie命中实行失败断言。不能将未检查storage改为通过。
2. 真实链记录HTTP、ID、generatedAt但没有硬断言其关系；DOM标题来自另一次未归档BFF fetch。加入同轮Gateway/commerce/BFF状态200、ready/gateway、课程ID/时间对应的断言，保存用于DOM对照的完整脱敏标题集合和对应响应来源，版本变动时判快照不一致而非数量相同就通过。空说明定位须限定pricing区域，不用页面任意“暂无”文本冒充；响应/页面当前状态要核实，不能仅依赖更早抓的facet。另补错误ID、非200、Cookie命中、空说明缺失负例共享实际断言模块，不运行真实浏览器也可先测。
3. `work/r1-001-safe-runtime-7.md`仍为POSIX行内环境变量启动语法，当前Windows/PowerShell不可直接执行。改成可执行的本卡调用配置，明确CONTENT_EVENT_RELAY_ENABLED=false、CONTENT_EVENT_CONSUMER_ENABLED=false、CONTENT_FLYWAY_ENABLED=false、COMMERCE_FLYWAY_ENABLED=false、CONTENT_SCHEDULE_ENABLED=false及适用SPRING_FLYWAY_ENABLED=false。仅对子进程设置或保存恢复原环境值，不改共享默认；归档完整SHA256、jar身份、固定端口与effective值预检，勿输出凭据。准备阶段不启动后台。

## 唯一仍缺的业务输入

合法空课程事实没有提供。content公开投影在ContentHttpController.publicSiteProjection中对PUBLIC/PUBLIC目录取全部课程，uiLocale仅影响其它facet；不能通过换locale/筛选query把现有七课程目录当权威空。

下一项必须产出可使用的owner隔离空事实的具体输入位置、服务profile/schema、版本和前后只读核查方法。先盘点既有隔离fixture/schema/合法快照；不要清共享库、临时下架共享七课程、改公开过滤契约或把MOCKED当真实。若现有输入不存在，一次性给出需要新建的隔离fixture最小文件/数据范围和影响，交主审决定扩大限定环境准备范围，不再重复“等待owner提供”而无具体方案。

先补准备包，状态保持BLOCKED，不start，不新交产品delivery。主审拿到可执行配置、准确采集器与合法空输入后签READY，再一次集中执行TC01/02/03终验。Gateway源码的ConnectException→503只能作为准备依据，真实停启恢复结果仍须在READY后采集。
