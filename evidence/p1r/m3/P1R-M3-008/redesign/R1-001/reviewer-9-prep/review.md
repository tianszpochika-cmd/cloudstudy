# R1-001 隔离输入准备审批与限定终验放行（2026-10-05）

## 决定

批准从 BLOCKED revision 20 转为限定终验 READY（正式 revision 以 ready-9.json 的状态登记结果为准）。这是输入准备签收；不批准产品 ACCEPTED，不关闭 TC01/TC02/TC03，不开放 R1-002。现有交付 delivery-6 保留为历史，后续由执行人记录 start、实际终验、提交新 delivery-7 REVIEW。

## 主审核查与直接修正

1. prep9 的 content 启动器仍用 svc_content，而专用空库授权给 r1_001_reader_t9b。新增 work/r1-001-content-empty-10.cjs，直启当前 jar，固定 127.0.0.1:18089，以专用只读身份接入 r1_001_empty_20261005_t9b。密码只在启动时解析并通过子进程环境传入，不输出、不放命令行；不改变共享账号权限。静态 validate 不代表启动健康。
2. ContentHttpController.java:221 的公开 facet 查询需要 content_public_site_facet，prep9 七表未包括它。主审仅在已批准测试 schema 中 CREATE TABLE LIKE 补此空表，未复制业务行。runtime-preflight.json 证明专用 reader 八表均可 SELECT、均为零行，权限只有 USAGE 与新 schema 的 SELECT；共享结构仅只读。共享 DEMO% 前后 COUNT 均为 11，本口径比 prep9 的 DEMO-P5 更宽，不能把 6 与 11 解释成漂移，也不能用 COUNT 证明全量历史数据未变。
3. 新增 work/real-chain-assert-10.cjs：课程空态只接受最终 ready/empty，loading/recovery 不再误过，并要求有效生成时间；独立四个合成探针核实合法空态通过、两种未完成状态和无效时间失败。模拟探针只证明断言语义。
4. 新增 work/real-upstream-10.cjs：导航前监听浏览器真实 GET /api/public-projection 响应，逐课程/价格页归档实际 mounted 响应，再核对 DOM；非空卡片等待渲染完成后比对标题。空目录时间不与独立上游 GET 强求逐字相等，归档对应 BFF 时间并核显示日期。价格空说明读取当前 i18n 正文，限定实际 pricing 区域，结合真实 facet 与可见状态判断，保留 Cookie 有命中失败规则及 storageChecked:false。
5. 新增 work/r1-001-safe-run-10.cjs：仅允许明确列出的 content/commerce/gateway 自有实例；显式关闭 relay/consumer/schedule/Flyway 与 P1R_DIAG。空场景只用此包装器起 commerce/gateway，content 使用专用启动器，不能重复占 18089。非空场景仅公开 GET 读取现有已发布事实，关闭后台写任务；共享 owner 身份不等于数据库权限隔离，不得作此声明。

所有旧交付/旧主审证据与版本 7/8/9 文件保留。新增 10 版是本次实际执行入口；其静态检查通过不能替代运行验收，运行失败必须如实报告。

## 当前证据

- preparation-check.json：delivery-6 的 24 artifacts 与 14 evidence 逐件当前哈希一致；此前 READY 非交付输入未漂移；状态 BLOCKED 20、R1-002 PLANNED；六固定端口均 CLOSED。
- units.log：主审四套件实际 38/38，exit 0；新四脚本语法检查 exit 0。
- runtime-preflight.json：新测试 schema 的八表零行、专用 reader 实际连接身份与 SELECT grants、结构哈希。LIKE 是读 fixture 结构复制，不是完整迁移/外键等价认证。
- launcher-static/content-empty-10.json：jar 身份、固定连接与白名单开关；未启动服务。
- negative-chain/negative-chain-9.json：旧共享断言负例 15/15 符合预期（MOCKED）。新 10 版终态探针在 preparation-check.json。
- toolchain.log：当前 Node/Java/Maven 版本实测；Maven WARNING 不再被当作版本缺失。

## 四项输入 Gate 的限定签收

- G-ENV：固定端口当前空闲、工具链与既有 jar 可核、隔离空库实际读回、专用只读接线及写任务关闭参数已备齐。有效运行配置/PID、健康、浏览器和故障恢复仍为后置终验；不签 IAM/Java/Outbox 全量运行 Gate。
- G-CONTRACT：复用此前三个公开 GET 契约签收；对应非产品输入哈希未变，不扩展 schema、不新增 API。独立测试通过。不存在把测试准备当新 Java DTO/完整服务验收的结论。
- G-PLATFORM：公开请求继续经 Gateway，内容 owner 的合法空事实在专用库，价格 owner 只读事实按当轮响应关联；无官网业务写入、不提交注册、不得操作共享服务。已准备的 runtime 白名单须在终验中核有效值，不以启动请求参数代替生效证明。
- G-FRONTEND：受控链接/共享 i18n 与主题基础输入未漂移，38/38 基线通过；严格设备和可操作入口沿用 sweep-7。当前新增采集器覆盖范围明确，真实双视口、重试、主题适用项和 TC01…03 等待运行，不降级为 P3、不自批。

父任务认领沿用 inputs/claim-20261003.json 的 Muse Spark 本卡切片，核当前 canonical ledger 摘要一致；本次不改变父台账状态或其他任务。所有必测保留，本卡输出不再作为开工前必须先完成的循环输入。

## 下一组：直接集中终验

1. 检查当前 READY 与输入摘要，记录 start。启动只属于当轮的固定端口实例，记录 PID/jar/schema/reader/白名单有效值，不输出凭据。空库八表 SELECT 0 行与公开 Gateway/BFF 真实回执相互核对；服务未健康不得继续声称 PASS。
2. TC01：375x812、1440x900 的 11 页可读及可操作注册链接，空/非空课程和权威空价格各有当轮实际响应、截图与 Console。使用 sweep-7、real-upstream-10；切场景仅停启自己的 content/BFF 清缓存，禁止写共享事实。不能为满足旧正则修改业务文案。
3. TC02：停当轮自有 content 取得 Gateway 真实失败，再恢复并实际点击重试，归档请求与 DOM 更新。无缓存 error 必测，有缓存 recovery 在可用场景验证；记录真实 503/504/502，不冒充 503，若无法满足 TC02 指定 503 如实留待主审判断。仅停启身份已核的自有实例，无需重复申请。
4. TC03 与收尾：核受控路径/参数、恶意 returnTo、快速点击/返回及官网 Cookie；复用 reviewer-3 证据必须重核相关源码哈希和环境适用性，官网 storage 未检则如实保留，不提交注册写入。执行适用 website-runtime 项，主题/重试等必测不得借“不适用”跳过。输出 delivery-7：三个 TC 的真实结果、截图原始文件哈希、运行日志/退出码、精确覆盖与剩余缺口；只提交 REVIEW，不进 R1-002。停止本轮自有进程，保留测试 schema/user 供主审复验。

## 范围与限制

本轮主审未启动后台/前端、未跑真实浏览器或构建；只改准备脚本、批准测试库的一张空表与审批资料。24 个产品文件保持 delivery-6 快照。端口/共享服务/共享领域数据/既有账号权限未由本轮修改。READY 不代表整体 R1 或遗留产品完成，正式 ACCEPTED 仍为零。
