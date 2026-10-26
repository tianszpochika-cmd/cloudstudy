# R1-001 delivery-5 独立定向审批（2026-10-04）

## 结论

退回 REWORK；本轮从 REVIEW revision 16 审查，不放行 R1-002，不升级 P1R 父状态。整改集中在验收采集器、环境与证据，不要求重做已通过的业务实现。

本次是限定差量/证据/源码审查和独立单元、当前 BFF VM 复验；未重跑构建或真实浏览器/后台联调。执行者的真实上游与双视口结果属于执行者证据，尚未由本轮主审终验。五项 P1 blocking 仍未关闭，不能批准 ACCEPTED。

## 已确认的进展

- delivery-5 的24 artifacts、12 evidence、墙内收据、HEAD及限定dirty快照一致；复验时墙revision16。历史 reviewer-1至4 共86份固定证据哈希未变。
- 独立四套件38/38，退出0。F12 已修：ready旧SKU→recovery且commerce失败→outage后 pricing仍为error/PUBLIC_COMMERCE_DEGRADED，commerceState/Error同步；empty/changed/failed三序列均不复活旧SKU。F10/F12不再列作未修问题。
- 采集器已使用真实HTTP状态、设备origin/port、returnTo及h1可见等待；原硬写200问题已修。错误origin检查本身有效，但path仍有误通过。
- 六个已登记端口在本次TCP核对均CLOSED；本轮未启动或停止服务、未访问或修改数据库、未改产品实现。

证据：[范围与单测](precheck.json)、[38项原始输出](unit.log)、[缓存状态/原因](facet.json)、[历史证据与端口](evidence-check.json)。

## F11 P2：实际采集器仍能把错误注册路径判通过

位置：`work/r1-001-sweep-5.cjs:31`、`work/negative-sweep-5.cjs:11`（路径均相对本卡证据目录）。

主审直接提取现有checkHref函数，给两个合法、三个同origin错误path及一个错误origin样本：合法2/2通过，错误origin被拒；三个错误path全部误通过，包括`/register-incorrect`、`/incorrect?extra=/register`、移动hash路由后缀错误。原因是末项`url.href.includes(expected.path)`绕过精确路径比较。

negative-sweep-5虽调用采集器，但bad.html未被服务或导航使用，只验证不可达19999时退出1；另一wrong-origin是独立硬编码assert，未调用实际checkHref。不能证明缺CTA、错path、错origin时真实采集器会判失败。visibleCount=0的路由也直接PASS，需实际打开导航并检查可操作入口，或如实保留PARTIAL，不以DOM中隐藏链接当可点击证明。

整改：新建版本6采集器，Web pathname严格等于/register；mobile pathname及解析后的hash路由严格等于规定值，查询参数独立比较，不使用includes/startsWith放宽。通过同一采集器的受控响应入口或同一实际校验模块覆盖HTTP非200、缺CTA、错origin、错path、错设备及合法基准，逐项保存失败项/退出码。受控响应明确标MOCKED，仅证明采集器，不作为产品真实上游验收。不新增未登记HTTP端口；不运行或清理他人的实例。

复验：TC01/TC03；[同函数URL探针](collector-probe.json)。这是证据采集器问题，本次没有据此判定正式页面实际链接错误。

## F13 P2：真实链及空价格证据不能支撑所声称范围

位置：`work/real-upstream-5.cjs:34`、`:42`，`summary-5.md`第二/三/五节。

courses-success只检查卡片>=1和空文案不存在；pricing-empty-honest只检查含购买/下单/支付文案的button为0。没有断言pricing facet为合法empty/ready空、没有价格卡、存在正确空说明，也没核链接入口；错误态或错误价格链接也可能满足此检查。脚本没有归档同轮content→Gateway→BFF的版本、课程ID、trace/request关联，不能仅由DOM证明数据来自该真实链。报告5门课与BFF7卡未提供逐ID对照，暂列待核，不武断认定数据错误。

两份核心采集脚本与两张成功截图未在delivery-5收据evidence固定，也无输出内脚本哈希；本轮主审另存当前哈希。website mapping实际是2项applicable=true、3项PARTIAL、6项false，报告的4PASS/2PARTIAL/5不适用不一致；布局主题维度未跑，不能整项PASS。原retry已在JSON标PARTIAL，应保留这项正确修正，不再指控该JSON写retry PASS。

整改：版本6报告按实际子断言统计，未执行项保留PARTIAL；限定本卡适用范围，避免为了旧套件额外开发world/help等。归档脱敏的真实公开GET状态、request/trace、版本与课程ID/数量、pricing facet、BFF source及DOM对应证据；明确价格权威空与请求失败的区别。固定脚本/输入/输出/截图哈希；旧收据和输出不改。构建、TCP200及模拟响应不代替TC01/02。

复验：TC01/TC02；[当前证据固定情况](evidence-check.json)。

## F14 P2：自有进程与只读/数据隔离口径缺运行证明

位置：`scripts/runtime/run-v2-services.mjs:197`、`:202`、`:273`；`services/content-service/src/main/resources/application.yml:80`、`:95`；delivery-5 environment.schemas为空。

现有启动器默认开启content relay/consumer，并使用既有owner schema/DML身份；配置有效映射。relay和consumer实现含UPDATE/INSERT，因此自有进程本身不能证明数据库隔离或只读。报告未提供实际启停时的有效开关、schema/profile和发布输入证明。本次没有读取实际数据库或完整进程环境，不能断言发生了写入、数据变化或泄露。

整改：新报告如实区分“自有进程、共享现有数据、仅发公开GET、后台任务是否停用”；给出无秘密的有效profile/schema/开关/端口/PID与jar身份。下一轮只读检查显式停用会写库的relay/consumer及其它适用后台任务，禁用自动迁移/seed；若不能证明已有实例可安全只读，保持BLOCKED并列最小owner输入，不再重复启动。若要准备空发布事实，使用owner提供的既有隔离事实/授权fixture，不清共享库、不更改后台业务或新增migration。

这是运行输入Gate的证据阻塞；不是要求本卡重构后台。真实503→恢复可先核现有Gateway对自有上游断连的映射；若确实返回503，可仅停/启自己已记录PID的上游并恢复，不必须新写故障注入开关。若返回其它状态，诚实记录实际状态并说明503仍缺，不能冒充。

## 下一组（四项）

1. 修验收采集器及同入口负例；产品24文件仅在复现产品缺陷且仍在授权范围时改动。
2. 核实名义只读运行环境，补合法成功/空输入与真实content→Gateway→BFF对应；无法取得空事实时提交具体输入BLOCKED。
3. 执行TC01双视口11页空态、TC02真实503→恢复后用户点击重试及适用浏览器回归；对失败原因/更新时间/无假价格/假下载逐项取证。
4. TC03可复用reviewer-3源码未变的两端落地/返回/双击/8负例，补官网业务会话隔离适用证明；本卡不要求完成R1-002注册写入。对引用证据作有效性核对，完整收据delivery-6 REVIEW，不自批或开002。

全组保留共享dirty、旧delivery-1至5、reviewer-1至5；报告写summary-6/commands-6。若只剩明确运行输入不足，停止反复改业务代码，提交BLOCKED事实及所需owner动作。主审按实际新证据判断，不以跑过检查数当产品完成百分比。
