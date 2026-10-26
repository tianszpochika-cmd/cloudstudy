# R1-001 delivery-7 独立审批（2026-10-05）

## 决定

不批准 ACCEPTED，登记 REWORK（提交时 REVIEW revision23，审批后 revision24，以正式收据为准）。R1-002 保持 PLANNED。下一组只修测试采集/定位与补实际交互证据；不重做已核实的业务代码、空库和启动接线。

## 已核实

verification.json：delivery-7 的28 artifacts/33 evidence当前哈希一致，本卡24产品文件仍与delivery-6一致，Git范围快照一致；主审四套件38/38、exit0。六端口当前CLOSED。本轮未启动服务、数据库或浏览器，未重跑构建；采用源码、实际归档响应/DOM报告、截图目检及合成采集器探针作拒绝依据。Browser plugin not available；本轮没有使用Playwright启动浏览器，只运行已有采集模块的内存替身探针。

真实隔离空链、正常7课程链和Gateway503已有归档回执。空态 facet.updatedAt 修正符合当前BFF：空结构projection.generatedAt可以为null，facet保留有效上游时间；终态仍只允许ready/empty。本项不再退回。有缓存恢复、storage仍由交付保留缺口，不据此声称已验。

## F15 / P1：可操作注册入口门回退

work/r1-001-sweep-7.cjs:63–65、78–84将可见可操作改成仅记录，deviceEntries存在即PASS。negative-sweep-7.cjs:41将隐藏入口预期改成true。主审用同一collectFromPage实际探针复现：全隐藏与全禁用两项都接受，operable=0。归档sweep-empty-10已有7个375宽页面operable=0且ok=true（download、announcements、compliance、status、privacy、terms、minors）。

这是采集器确定误过；不据此断言页面不存在可用入口。修复方式：新建11版，等待正确设备hydration，若入口在折叠菜单中先真实打开菜单，再验证可见、可操作、精确路径/参数并点击；未打开菜单或不可操作不得PASS。保留全隐藏/全禁用/错设备/错路径等拒绝负例。不要简单要求隐藏菜单未打开时全部链接都可见，也不要靠移除门满足验收。

## F16 / P1：TC02没有验证失败页点击重试

work/tc02-retry-10.cjs:22–27在上游恢复后新开页面并reload，全文无retry.click，也不核起始页面error；归档retryVisible=false。summary-7.md:15称reload等价覆盖点击，不成立。tc02-fail-10.cjs:37又仅用cards===0判断页面error，合法空态也可通过；当前bodySample确含错误说明是部分证据，但断言本身不够。

下一轮保持同一个真实失败页，核error响应/错误标题/可见可用重试；恢复仅本轮自有content，不reload/goto/直接调用load，不先用独立BFF请求触发测试替代；从原失败页点击重新加载，监听该点击实际BFF响应，再等DOM内容恢复并核Console。无缓存503与有缓存recovery各做一轮（后者不重启BFF丢缓存，失败在原60秒TTL内）；原页在无触发条件下并不会仅因上游恢复而自动重新加载，不能通过新开成功页声称按钮消失。

## F17 / P2：全套测试完成数与报告不符

apps/official-site/tests/browser/website-runtime.cjs:331对首个data-learning-entry断言可见；此前:283视口为390宽，首个header CTA按CSS隐藏。此定位确应修成符合当前设备的用户可操作入口，必要时打开菜单；不需要先修改产品页面来让隐藏header永久可见。

最新原始browser-checks.json at=2026-10-05T00:25:07.341Z为FAIL、checks=8、layouts=152；check函数:21–24失败即抛出，后面的:349/:384未执行。原始字节已归档website-report-observed.json。summary-7/commands-7的16/17无此报告支持；检查项、布局采样及未执行项必须分开，不能假设未执行均通过。新轮通过定位修复后跑到底，归档原始JSON/stdout/stderr/实际退出码，使用本卡新的证据目录，不覆盖默认历史报告。

## F18 / P2：交互与视觉证据需准确映射

work/tc03-10.cjs:25–35只读href、前缀检查及无evil字样，未构造恶意输入、未click、更未快速双击；rapid-click-href不能称新的快速点击PASS。reviewer-3真实落地/返回/恶意参数/双击可复用，须逐项固定原始文件SHA256、相关所有源码与适用环境，不能只写三个摘要前缀。本轮新证据只能覆盖实际执行的检查。若不具备精确复用证据，就启动自有注册前端做读页面导航，禁止提交注册写入。

同视口的空态、失败、恢复截图SHA相同。主审目检两张移动截图均为课程页上方学习方式介绍，未覆盖下方.published-courses状态；相同顶部是页面结构导致，不据此指控伪造。下一轮滚动到课程区域或截区域/fullPage，分别拍零卡空说明、错误与按钮、恢复课程、权威空价格、菜单入口，截图应支持所对应断言。

匿名官网Cookie已有数据，storageChecked=false仍是未测；补storage键名/用途白名单检查，仅记录名称/分类/命中数，不输出值或读取业务账号凭据。未知键不能靠不含token词汇就证明安全。

## 证据与历史保护

ready-9的3个准备源文件现已被替换（verification.json明确列出），并列入delivery-7 artifacts，状态机可按交付替换快照追踪；这不等于原版本字节全部仍在。不得重复写“旧文件全保留”。保留现在已固定的delivery-7及其全部artifact/evidence，后续采集器用11版及新的负例/输出，不改7/10版、不改旧收据哈希。历史版本未归档的情况如实说明，不补造旧证据。

当前knownGaps虽写blocking=false，仍含P2；状态工具approve规则禁止任意P0/P1/P2未闭项。本轮F15/F16是核心TC阻塞，不可降级。缓存recovery、website失败和storage按真实补验关闭，不靠改级别获取ACCEPTED。

## 下一组四项

1. 新11版采集器恢复入口实际可操作门、菜单路径和同模块拒绝负例，真实双视口11页复验。
2. 同一失败页真实重试，补无缓存503、有缓存recovery与恢复，错误态硬断言和对应区域截图。
3. 修website定位并跑完整原始套件，核TC03旧证据或补真实导航，匿名官网storage最小补检。
4. 新summary-8/commands-8/delivery-8 REVIEW；准确区分执行、未执行和模拟，固定所有原始证据哈希/退出码，停止自有进程，保留专用测试schema和账号。R1-002不开放。
