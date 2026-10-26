# R1-001 delivery-6 独立审批（2026-10-04）

## 决策

本卡 BLOCKED，禁止按现有默认配置继续启动后台；不 ACCEPTED，不进入 R1-002。先交解阻准备包，主审核对运行输入后再签 READY 并安排终验。这样避免继续循环提交仍缺同一运行前提的交付。本轮审查始于 REVIEW revision 19。

本次仅定向源码、收据和证据审核，独立单元/当前 BFF VM 与采集函数测试替身复验；未跑实际浏览器、构建、后台、数据库。执行者的成功链及页面结果属于执行者证据，不能当作本轮主审浏览器终验。共享业务差量不改。

## 已确认

1. delivery-6 的24 artifacts、14 evidence、墙内收据与HEAD/dirty快照匹配；独立38/38退出0。产品24文件与delivery-5未变，F10/F12仍通过。
2. 严格Web pathname/mobile hash路由修复有效；直接复跑同URL模块的10个受控样本全部符合预期（MOCKED）。旧3个错path误过已关闭，不重报。
3. 固定real-upstream-6 JSON中Gateway/BFF的7个课程ID、generatedAt逐项相等，三个HTTP状态200；价格facet ready，plans/skus为0。原5/7矛盾已消除。本轮没有断言该固定事实造假。
4. 当前两份核心脚本已纳入收据固定。覆盖统计已更正2适用/3PARTIAL/6不适用。旧reviewer-1至5的101份固定证据哈希未变。
5. F14如实补共享schema和默认写后台任务开关，并承认未验证DB有无写入；这属于口径改进，尚不是安全只读运行通过。本轮六端口均CLOSED。

证据：[范围/单元](precheck.json)、[原始输出](unit.log)、[缓存复验](facet.json)、[URL负例](negative/negative-6.json)、[历史证据与端口](evidence-check.json)。

## 未关闭的问题

### F11 P2：采集主流程不再检验设备与可操作入口

位置：`work/r1-001-sweep-6.cjs:53`～64；`work/negative-sweep-6.cjs:22`～24。

collectFromPage的label参数未参与期望计算，按DOM自身target选期望；visible字段也未用。主审执行该现有函数的测试替身：移动视口仅Web入口、桌面仅mobile入口、全部链接隐藏三种情形仍全部通过。合法双视口通过、无入口失败，说明探针可区别正常与缺入口。

负例wrong-device按视口选择期望，但正式采集按DOM target选择期望；非200/缺CTA在负例自身抛错，不在实际采集共用断言中验证。URL层负例有效，不能据此声称整个采集流程负例闭合。

整改：独立确定375x812应为mobile、1440x900应为Web，等待hydration与预期目标真正可见可操作。隐藏菜单入口可先打开菜单再测；不要求闭合菜单中所有链接可见。将HTTP状态、设备、入口集合及可见性事实放入同一断言模块，真实采集和测试替身共同调用，覆盖错设备/全隐藏/缺入口/非200及合法样本。不因等待失败放宽规则。

证据：[同collectFromPage三项误过](collector-probe.json)。本次没有据此判定实际产品渲染设备错误。

### F13 P2：通过条件与报告仍有遗漏

位置：`work/real-upstream-6.cjs:47`、`:59`～61；`summary-6.md:38`。

实际存档Gateway与BFF事实相符，但采集器没有硬断言其HTTP/状态/来源/ID/版本关系；DOM只比数量，domIds算出未记录/比较。emptyNote算出未入PASS条件且从整份HTML搜索；不能证明页面可见空态说明，也未检验当页是否已经error。主审执行现有价格PASS表达式，emptyNote=false仍为true。这是采集器遗漏，不是本次实际已见空说明为false。

summary声称sweep双视口Cookie检查0命中，但当前脚本没有Cookie采集，固定输出也没有该字段。只能改为未执行，或补独立名称检查证据；不能说已有脚本做了不存在的检查。本轮两张截图没有纳入收据，截图字节与delivery-5相同；不据此断言截图造假，但不可据未固定图证明本轮重新采集。新截图/日志应绑定当轮请求与脚本，不覆盖旧文件。

整改：共享的事实断言核对响应状态/source/ID/版本与DOM可见条目对应；无ID属性时用完整渲染标题与BFF对应并说明局限，或在允许页面上加非业务data属性。价格空说明必须可见且成为PASS条件，排除error/恢复中冒充权威空。Cookie检查只归档名称或命中数量，不输出值；未检查的storage如实保留未执行。所有引用、新脚本、输入、日志和截图固定哈希。

证据：[事实一致及遗漏复验](real-evidence-check.json)、[截图固定情况](evidence-check.json)。

### F14 P1：运行输入Gate未满足，先解除阻塞

位置：delivery-6 environment/knownGaps；`scripts/runtime/run-v2-services.mjs:197`、`:202`。

上轮明确要求停用写库后台任务或在不能证明只读时保持BLOCKED。本轮仍以relay/consumer=true启动连接共享owner schema的自有后台。记录PID/profile/schema只说明进程身份，不排除后台写入；当前没有证据确认实际发生写库，也没有数据库变动审查授权。本次不启动任何后台来重演。

现有runner支持process.env覆盖：可先准备明确CONTENT_EVENT_RELAY_ENABLED=false、CONTENT_EVENT_CONSUMER_ENABLED=false的本卡启动配置，不改共享runner默认、不改后台业务。同时核content自身Flyway开关、其它写后台任务/seed和commerce公开GET依赖。仅给静态默认值不是运行有效值证明；需要启动参数/配置回执或可核对的运行属性（不输出秘密）。若仍不能证明现有公开读路径安全，则由owner提供隔离输入。

合法空课程事实缺失、真实503后重试及TC03适用安全/浏览器终验仍开放。是否可通过停启自己的content实例获得Gateway503，应检查实际映射并在READY后实测，不必等待新增业务故障开关；若实际并非503，报告真实状态，不能改成503或当TC02通过。

## 解阻准备包（四项，先不启后台）

1. 版本7采集断言与测试替身：设备/可见性/HTTP共用；严格URL已修部分保留。
2. 版本7真实链/价格空态/报告断言：固定元数据、DOM对应、Cookie真实执行或未执行、截图/日志哈希；不扩大产品功能。
3. 提交本卡安全启动配置与预检，明确禁用写后台任务/迁移/seed，固定端口、进程归属和数据来源；不能证明时列最小owner输入。修正“commerce无写路径”为本卡所检查的公开GET路径，不泛指整个商业服务。
4. 只读盘点合法空事实与Gateway断连状态映射，给可运行的TC01/02/03步骤与解阻证据清单。不要清共享库、新建migration/seed或新增未登记端口。Maven仅补版本行，不把它泛化为产品P1缺陷。

准备包写新文件，保留delivery-1至6和reviewer-1至6，状态维持BLOCKED。主审核实后登记READY；再由执行者开工运行真实终验并提交delivery-7 REVIEW。注册入口可沿用有效reviewer-3证据，不要求先实现R1-002注册业务。不继承历史ACCEPTED，不改P1R父状态。
