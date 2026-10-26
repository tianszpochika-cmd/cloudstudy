# R1 输入Gate：核验动作与证据

> 这是逐卡READY所需的输入核验说明，不增设第二套开发任务或晋升P1R父状态。只核对该卡涉及的范围；完整M8/父Gate仍在实施后独立验收。先读具体执行卡的来源/契约/待决分支，禁止把旧ACCEPTED、目录存在或静态通过当作当前运行通过。

## 1. 共同收据格式

每项适用输入使用本卡证据目录的`inputs/<gate>.md`或JSON记录：日期、检查人、当前HEAD/本卡diff摘要、相关P1R ID和canonical证据引用、适用范围/排除原因、当前文件/配置/契约/fixture/policy digest、操作与结果、环境及恢复措施。`ready`收据引用这些文件的真实SHA-256。

尚无证据写PENDING/BLOCKED，不填PASS。某项Gate在本卡无业务写入时，记录只读/静态适用边界及其理由，由本聊天核准；这不关闭该Gate的完整服务运行范围。P1R父任务认领/DependsOn另外核实，不被R1子依赖替代。

### 输入与本卡输出的边界

READY只核验**启动本卡必需的已存在输入**。本卡将创建的契约、迁移、种子或页面是交付验收项，不能又要求在本卡启动前已完成。收据逐Gate填写`scope`，列明实际输入及本卡待交付输出；脚本中的PASS仅表示本卡准备范围通过。

| 卡片类型 | READY预检内容 | 在本卡交付后验证的输出 |
|---|---|---|
| 契约卡 | 现有契约/policy/owner版本、批准的差量范围、可用生成与校验链；需运行差量的隔离环境 | 本卡新增schema/operation/Flyway/生成物及兼容负例 |
| R1-025/026种子 | 合成内容来源/版权、真实媒体资格、四主体测试身份、上游发布命令与隔离schema；已批准的种子形状 | 本卡写入/发布的fixture、资格读回与幂等重放，不要求本卡fixture提前存在 |
| 实现卡 | 已经审批的前置契约、被复用的平台/内容输入、隔离环境与所需客户端基础 | 本卡API/DB/事件/恢复事实及页面链路 |
| 前端卡 | 已审批的服务读写口、客户端/主题/i18n基础、可用合成业务输入 | 本卡页面/所有受影响IC的浏览器操作、故障与读回 |
| QA卡 | 全部前置卡ACCEPTED及当前交付、可复现环境/权限/合成数据 | 本卡独立复测、证据与缺陷结论；QA不修实现 |

例如尚无正式媒体或四主体发布能力，R1-025依然受阻；具备上游能力而尚无本卡要生成的种子，则可以开始。新增分享契约卡检查已签收的分享政策与现有生成链，分享创建/解析/撤销实现待后续卡交付。实际必须依赖其它卡才具备的能力写入`dependsOn`，不能用循环的全量Gate掩盖。

## 2. G-ENV：环境可复现且不伤共享数据

**先读**：根AGENTS.md、`config/local-ports.json`、`config/toolchain-baseline.json`、上位`03-阶段验收与Evidence标准.md`及具体服务README。

1. 记录分支/HEAD、已有dirty文件及本卡拟修改文件；确认执行者不会覆盖共享工作。检查Node/Java/pnpm及BOM与锁文件；工具版本不足就阻塞，不私自换栈。
2. 读取固定端口，列出本卡使用服务及运行实例身份。已有共享服务仅可做获准的读检查；新启动和运行验收必须有隔离实例/数据责任确认。冲突时登记PID/服务，交给本聊天协调；不得杀进程、自动递增端口或重启共享服务。
3. QA明确本次专用MySQL schema、容器/资源、各owner最小写权限、合成fixture标识、备份/恢复/清理边界。禁止root fallback、共享表写入、默认schema删除重建；要有确认不含真实用户/生产/共享数据的记录。
4. 在隔离环境复核迁移与fixture重放，日志标明实际schema/版本和幂等结果。没有隔离数据库时只跑静态预检，并保留运行BLOCKED，不造“干净库全绿”。

**可用预检**（仓库根）：`node scripts/dev/p1r-toolchain-check.mjs --static-only`；`node scripts/check-fixed-ports.mjs`；`node scripts/fixtures/p1r-fixtures.mjs validate`。这些是预检，运行隔离证据仍需上述实际记录。

**退出证据**：工具版本/锁定文件摘要、工作区保护清单、固定端口/实例、独立资源和权限证明、fixture/迁移结果、限定恢复清单。关联P1R-M0-001/003/006/007/008、M2-008的本卡适用输入。

## 3. G-CONTRACT：精确操作、类型、owner与兼容

**先读**：本卡`contractRefs`、`config/p1r-*-contract.v1.json`适用文件、`packages/contracts/openapi/v1/openapi.json`、对应生成类型、对应P1R-M1父输入。

1. 逐项核对本卡所用operationId/路由、请求/响应/错误、If-Match/幂等、权限、owner和阶段；历史B编号不能替代canonical形状。缺少操作或字段的卡先完成明确差量和签收，再写实现。
2. 核对API片段→合并canonical→TS生成与类型检查；Java DTO必须有真正生成工具/配置/输出验证。现有`contracts:generate`不能未经核对称Java生成完成；接线缺失就登记GAP，由契约卡按同栈补齐并审查。
3. 核对Flyway版本/owner schema/回滚策略、AsyncAPI/JSON schema、事件producer/consumer/binding/version；禁止跨服务写表或从演示数据造正式DTO。
4. 对本卡字段做成功/未知字段/未知enum/版本冲突/同键异payload/401/403等适用负例；新政策差异需真实责任人签收。沿用冻结规则的实现缺口不能误标“业务重新待决”。

**现有检查**：卡片列出的`node scripts/audit/p1r-...-contract-check.mjs`及对应`tests/p1r/`。统一`contracts:merge/generate/validate`仅按当前package脚本和实际输出使用。命令通过不证明真实API/DB/事件已运行。

**退出证据**：精确源/operation与适用性、schema/policy/Flyway/生成物摘要、兼容差量签收、自动检查和运行契约负例。未批准的新分享解析/撤销、重排命令或撤销补偿权限不自行开放。

## 4. G-PLATFORM：身份、领域权限、可靠事件

**先读**：`config/p1r-data-ownership.v1.json`、事件catalog/reliability policy、`config/p1r-saga-recovery.v1.json`、服务Security/PEP及该卡事件owner事实。

1. IAM唯一RS256 JWT/JWKS；Gateway预校验与各领域服务Resource Server/PEP均生效。核对owner/subject/phase/content rights，伪角色头、错owner、过期/撤销、PDP/策略异常fail closed。
2. 用该卡隔离数据记录最小写权限和owner事务读回；所有幂等/并发版本事实来自领域owner，workflow/audit不双写。
3. 本卡写入对应Outbox/Kafka真实发布/消费、eventId/traceId/schemaVersion、去重、重试/DLQ/补偿读回。接口成功但消费失败时UI与审计要显示实际恢复状态；Redis/内存stub不能当事实源。
4. 复核回滚/补偿与审计关联，不把静态B26绑定、health或一次事件打印当整个可靠链通过。无写入的卡只预检其读取所依赖的已验收投影，明确限制。

**现有静态检查**：`node scripts/audit/p1r-data-ownership-check.mjs`、`p1r-event-governance-check.mjs`、`p1r-event-reliability-check.mjs`、`p1r-saga-recovery-check.mjs`；实际运行取本卡的最小隔离用例。

**退出证据**：当前JWT/PEP负例、owner DB状态、Outbox/event/consumer receipt与失败恢复、审计记录。关联M2-001…006/010适用输入；读卡不关闭完整平台Gate。

## 5. G-CONTENT：可使用的合成内容

**先读**：R1-025/026/088…103适用卡、内容生命周期/媒体契约、版权与来源manifest。

1. 准备明确合成标识、来源/版权/授权期限/范围、contentVersion与answerRuleVersion、题型/知识点/variant关系。不能把旧10行seed当版权与发布证明。
2. 作者、L1、L2、发布者为四个独立主体；两个审核通过后仍须独立PUBLISH命令产PUBLISHED事实，ACTIVE只可作为旧展示别名。单人简审保持演示/历史边界。
3. 定级10题四维必须有真实可读内容与合法听力音频/媒体receipt；纯文字听力或系统TTS演示不算正式听力覆盖。资格/授权/版本失效与紧急禁供都做负例。
4. 在G-ENV专用schema中幂等重放种子，禁止硬编码共享schema/root fallback/delete-then-insert。前置合格seed可先行，不等待管理交互增量卡造成循环。

**退出证据**：fixture digest、四主体审核/发布/版权记录、题单/媒体owner receipt、允许读取与失效拒绝、重放对账。M3-002…007/010对应范围；新增供给/例外待DEC-08签收。

## 6. G-FRONTEND：共用基础和每卡实际交互

**先读**：本卡双端/管理页面、`packages/i18n`、`packages/design-tokens`与当前平台适配；正式页面按登记18180/18181/18183，18283原型仅设计参考。

1. Vue3/TS；mobile uni-app，admin ElementPlus；复用共享客户端/规则，不新增第五套项目。UI locale与contentLocale分离，文案key/fallback/日期数字格式来自共用入口。
2. 亮/暗/系统/高对比、44px触达、键盘焦点、字体放大、四级性能降级依基础适配且每卡核对；颜色不作唯一状态信号。
3. 每个受影响IC按卡片验成功、Loading/Empty/Error、权限、冲突/重复/失败/中断恢复，服务owner读回与页面状态一致；禁止假成功、清空未保存输入、401/403当空列表。
4. 记录浏览器实际尺寸、Console、截图/操作和读回；UI模型/结构/构建测试分别列层级。真机/读屏/软键盘等未测时保留缺口，不把G-FRONTEND基础通过当M8完整终验。

**退出证据**：当前共用工具/适配、受影响页面操作及截图/Console、实际API状态读回、异常与恢复；关联M0-006/M8-007…009基础，完整跨端终验在实现后。
