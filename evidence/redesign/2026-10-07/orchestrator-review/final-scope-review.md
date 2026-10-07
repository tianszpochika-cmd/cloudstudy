# Final scope independent review

日期：2026-10-07。审查边界为恢复快照/29卡索引、R1-002准备工具与D1计划、R1-001官网当前源局部交付。此次结论不改业务状态，不代替主审的workflow迁移。

## 签收结论

| 交付 | 结论 | 仅适用范围 |
|---|---|---|
| R1-001官网当前源码 | **ACCEPT_SCOPED_DELIVERY / SOURCE_SCOPED_PASS** | 已授权页面、公开投影、受控注册CTA及其局部双视口验证。不是R1-001卡 `ACCEPTED`，也不恢复旧机器交付。 |
| R1-002准备工具与脱敏证据 | **ACCEPT_SCOPED_DELIVERY** | 只接收准备/离线检查工具和证据，不关闭两条真实HTTPS链，不升 `PREPARATION_PARTIAL_NOT_READY`。 |
| recovery-20261007固定快照索引 | **ACCEPT_SCOPED_DELIVERY** | 固定ff0f8057来源、29卡导航与独立当前差量边界；不是114卡墙、产品测试或IAM业务前置。 |
| D1离线生命周期/harness计划 | **足以进入具名D1实施** | 根审按计划内文件清单另行具名授权后，仅实现离线stage/harness和负例。D1也未完成。 |
| D2维护窗口、D3身份候选A、R1-002 READY | **未签，保持OPEN** | D1不得带动这些范围自动获批。 |

本结论把局部源码交付与业务卡接收分开。主审可将R1-001记为源码范围复验通过，但须保留 `SOURCE_SCOPED_PASS_NOT_WORKFLOW_ACCEPTANCE`，不导入原 `ACCEPTED`，不提升IT-1出站或解锁IT-2。原114卡墙、R1-001完整验收差量、干净可复放业务基线和具名提交/验收收据仍缺；现有15服务及官网dev进程中的验证不能替代这些条件。[R1-001最终入口](../R1-001-implementation/review-ready.md#L1-L12) 与 [任务规格](../R1-001-implementation/task-spec.md#L3-L19)均明确保留该边界。

## R1-001 当前源复核

**价格/下载页的静态假空阻塞已修正。** 页面现在按各自目录的实际投影判断空态：仅真实 `ready/empty` 且相关目录为空时显示“收费方案暂未开放”或“下载准备中”；非空 `ready/recovery` 展示投影中的公开信息，错误、无权限、恢复和维护分别显示对应状态并保留重试。价格页只读展示有效投影中的SKU、格式化价格和权益，不提供购买、支付或订单动作；下载页展示公开渠道说明，不暴露投影里的安装动作或链接。[`pricing.vue`](../../../../apps/official-site/pages/pricing.vue#L4-L54)、[`download.vue`](../../../../apps/official-site/pages/download.vue#L4-L45)、[BC-001](../../../../docs/06-design/v2-980plus/redesign/business-chains.md#L56) 与冻结页面登记册的 [PAGE-P1-OFFICIAL-PRICING/DOWNLOAD](../../../../docs/06-design/v2-980plus/phase1-business-operation/03-全端页面功能登记册.md#L50-L51)一致；没有增加接口、BFF字段或服务请求。

价格scope通过同一次 `useRequestFetch` 的 `onResponse` 观察现有 `x-public-projection-commerce` header。BFF以HTTP 200保留其他内容但commerce回源退化时，现有header为 `degraded`；composable仅把 `pricing` 的空价格投影转为error并给retry，`download`/`courses` 不因commerce问题全局报错。[composable](../../../../apps/official-site/composables/usePublicProjection.ts#L33-L58)、[既有BFF退化分支](../../../../apps/official-site/server/api/public-projection.get.ts#L156-L205)。这样既区分正常 `plans: []` 与价格读取失败，也避免其他公开内容被误报。此前 `H3Event$Fetch` 不支持 `.raw` 的类型/SSR尝试失败记录被保留；最终实现改用经SSR验证的 `onResponse`，没有把失败记录覆写成通过。[适用性记录](../R1-001-implementation/applicability-report.md#L15-L17)。

本机现有Gateway/BFF只读收据是 projection HTTP 200、`x-public-projection-commerce=gateway`、`state=empty`，commerce catalog HTTP 200且 `plans=[]`、`productionPaymentEnabled=false`；桌面/手机四个真实页面观测与这一快照相符。[投影owner检查](../R1-001-implementation/projection-owner-check.json)。BFF的专项单测另外注入commerce 503并证明响应仍可用、header为 `degraded`、不进入共享缓存及失败/空目录不复活旧价格。[BFF测试](../../../../apps/official-site/tests/public-projection-bff.test.mjs#L234-L274)。浏览器40例是本地响应fixture，覆盖七态、相关目录空/非空、degraded和缺响应；不是40次真实Gateway故障演练，也不是40条owner/E2E事实。两组证据组合足以验证当前客户端状态映射；真实线上退化、支付与下载仍未验收。[局部分支记录](../R1-001-implementation/projection-branches.json)标明 `fixtureIsNotPublishedBackendFacts=true`，两条与价格无关scope也保持内容可读。

**视觉检查通过。** 我目检了最终桌面/手机非空目录四张保存截图：价格金额与权益文字可读，移动布局无明显挤压或横向溢出；下载只显示渠道说明，没有安装/应用商店动作。真实空态另由最终双视口观察覆盖。截图对应浏览器fixture的合成非空公开投影，不能当作已上线的真实付费方案或安装包。[桌面价格](../R1-001-implementation/screenshots/final_desktop_pricing_ready-nonempty.png)、[手机价格](../R1-001-implementation/screenshots/final_mobile_pricing_ready-nonempty.png)、[桌面下载](../R1-001-implementation/screenshots/final_desktop_download_ready-nonempty.png)、[手机下载](../R1-001-implementation/screenshots/final_mobile_download_ready-nonempty.png)。

官网注册入口复用固定 `/register` 的 `buildPublicLearningEntry`，固定 `returnTo=/home`，仅保留白名单UTM/UI locale/theme；注册不是官网业务会话，页面不收密码、不持有token、不提交注册。18+成人资格仍由IAM判定，通过前不开放学习能力。[链接构造](../../../../apps/official-site/utils/public-links.mjs#L10-L48)、[当前源CTA测试](../R1-001-implementation/test-r1-001-final.log)。B13/B14/website-entry是读工作树的应用源测试，本轮依R1行为更新；原8a689ec5三个测试blob与SHA已在manifest记录，我独立按Git对象核对均匹配，canonical fixture/阈值/历史Evidence未改。[适用性说明](../R1-001-implementation/applicability-report.md#L1-L17)。

官网文案进入共享 `packages/i18n`；最终4项R1 HTTP/SSR用例直接用 `createI18n` 验证en-US界面键缺失时回退中文，`contentLocale`仍独立于UI locale。该结果满足本卡中文fallback范围，不代表完整英文翻译、全locale或主题矩阵。[共享资源](../../../../packages/i18n/src/official-site.ts#L1-L24)、[fallback测试](../../../../apps/official-site/tests/r1-001.test.mjs#L63-L70)。

最终交付记录为官网应用源测试26/26、R1 HTTP/SSR 4/4、隔离typecheck与production build exit 0；11个原路由两视口22/22首次直接200，CTA实际到达learner注册页、未提交注册。官网PID 9008没有重启。浏览器分支记录、日志和截图被artifact manifest绑定。我独立确认artifact manifest内112/112哈希和source-and-results内14/14源码哈希一致，8a689ec5三项历史测试blob/sha亦一致；未重复运行完整测试矩阵。[验证摘要](../R1-001-implementation/validation-summary.json)、[源码/结果](../R1-001-implementation/source-and-results.json)、[artifact manifest](../R1-001-implementation/artifact-manifest.json)。

## R1-002准备工具、身份与Outbox边界

R1-002准备包可在窄范围签收。最终 `prepare.mjs` 对Git外私密目录逐项 `lstat` 读取owner/mode/type/symlink；工具在消费受保护配置前后核验目录与七个文件。现有测试真实执行 `chmod 0600→0640` 并触发拒绝，实际材料的owner/mode/type读回为PASS。owner负例通过把预期UID错配到 `process.getuid()+1` 进入拒绝分支；没有对文件执行 `chown` 或从另一OS用户运行。故可签本机POSIX metadata guard/readback，不可称跨用户OS隔离；Windows ACL仍UNVERIFIED。[权限代码](../../../../scripts/redesign/r1-002/prepare.mjs#L21-L50)、[权限负例](../../../../scripts/redesign/r1-002/prepare.test.mjs#L66-L94)、[最终读回](../R1-002-preparation/tls-materials-final.json)。

`prepare --out`只脱敏证据归档副本，保留实际lstat结果、owner UID、证书摘要和普通相对source路径；Git外真实transport plan及stdout执行语义不变。最终路径以 `<PRIVATE_MATERIAL_DIR>` / `<PRIVATE_MATERIAL_PARENT>` 表达，不把占位父路径当source path。11/11定向测试通过；TLS私钥未读入证据。[脱敏返工记录](../R1-002-preparation/sanitization-review-rework.md#L1-L19)、[脱敏清单](../R1-002-preparation/sanitization.json)。

同一准备包验证了Gateway 5.0.3新SSL属性前缀的真实Binder绑定、JVM独立trustStore空库拒绝以及独立合成材料。它仍未启动/停止业务服务、改库或执行HTTPS握手。Gateway route WebClient与 `GatewayIamPublicJwkSource` 的独立JVM-trust链必须分别动态证明；当前`--all` runner无可复放启动收据，本轮不得单停共享runner。`PREPARATION_PARTIAL_NOT_READY`因此保持。[准备报告](../R1-002-preparation/report.md#L1-L34)详细记录开放项。

身份兼容不能由工具准备PASS带过：IAM内部`PrincipalId`/JWT `sub`及现owner路径是裸UUID，而冻结M1-018 bootstrap事件payload要求`prn_...`；只给事件字符串加前缀或改全局`toString()`都不能证明JWT、envelope、learner owner与PEP一致。[Outbox提案](../../../../evidence/p1r/m2/P1R-M2-002/redesign/R1-002/outbox-proposal-4.md#L11-L21)、[冻结schema](../../../../packages/contracts/events/v1/fragments/m1-018-iam-v2.events.json#L59-L74)。候选A可以作为具名身份评审材料，尚需IAM/learner/security owner与canonical/ADR决议；若改变schema或身份合同则先正式版本化更新。Outbox本地事务写入、异步至少一次与消费端去重、topic/event/schema现值、`PENDING_ELIGIBILITY`等不改变冻结语义的提案口径可以进入实现前签收；V19 migration、Kafka依赖、ports/adapters、relay、runtime装配与故障测试仍要逐项明确卡、owner和文件清单。`tc03-plan-4.json`标记 `executed:false`，计划不证明事务或relay已通过。

`execution-plan.md`具体分开D1/D2/D3，并约束离线harness、receipt和进程守卫。可放行的下一轮只应具名D1清单范围，端口被占用时拒绝启动且不发signal；“拒绝”不能写成动态TLS通过。D2仍需维护窗口owner、原runner恢复bundle、固定端口空闲与可回滚/恢复收据；D3仍需身份方案的正式签收。不得据该计划实现注册、迁移、Outbox业务或提前给READY。[D1/D2/D3计划](../R1-002-next-round-plan/execution-plan.md#L5-L40)、[身份候选A](../R1-002-next-round-plan/identity-decision-A-draft.md#L1-L14)。

## 恢复索引与冻结门禁

修复后的builder从固定 `ff0f8057` Git blob重建manifest和导航索引，manifest摘要不匹配时拒绝覆盖；`--verify-replay`只读复放结果为29卡、25来源、R1-002输入27/27匹配。最终`verify-index`为862/862检查通过，kind明确为handoff source index，而非业务验收；当前工作树边界独立记录legal进度差量，不将其与历史blob混为来源漂移或workflow状态。三个既有移动文档差量摘要仍匹配且 `preserved=true`。[builder](../../../../docs/06-design/v2-980plus/redesign/recovery-20261007/build-index.py#L1-L42)、[验证器](../../../../docs/06-design/v2-980plus/redesign/recovery-20261007/verify-index.py#L1-L18)、[验证结果](../../../../docs/06-design/v2-980plus/redesign/recovery-20261007/validation.json)、[工作树边界](../../../../docs/06-design/v2-980plus/redesign/recovery-20261007/current-worktree-boundary.json)。这个恢复修复是接手档案质量门，不是独立IAM业务READY前置；29卡仍是索引而非原114墙。[前两轮报告](independent-round2.md#L1-L20)保留先前逐轮结论。

本次没有重跑或调宽全局26项治理回归，冻结D2仍为FAIL；相关M1-008/M1-018/M2-001/Gateway投影失败仍阻止对全栈owner/事件兼容的更大范围主张，但不否定上述官网源码局部交付或离线准备工具签收。其他治理失败保持原状；不得以本报告宣称全局门禁清空。详见[首轮回归相关性审查](preflight.md#L49-L51)。

## 本轮hash与审阅证据

以下SHA对应最终审阅字节。R1-001完整14源码及112归档工件摘要另由`artifact-manifest.json`与`source-and-results.json`绑定并已独立逐项校验。

| 对象 | SHA-256 |
|---|---|
| R1-001 `task-spec.md` | `9f578b432074b59083233b2f478b39cd611948aa366d93c8c89a8939247b0da6` |
| R1-001 `source-delta.patch` | `d4497aea42a3f25068565a34db96730a2769d88677760b992b5ccbe967112038` |
| R1-001 `artifact-manifest.json` | `5aca3aea225af7fdef5fd7e66a74d12382e332ac2b9553e4f69ffc3293cfe99a` |
| R1-001 `usePublicProjection.ts` | `17327dbb3495a2cac462706398625b2e25bec6237573808d4e5a961c526c9d1b` |
| R1-001 `pricing.vue` | `552447d04753781eb1f1baa38b1ccf5ca18dc2a66e6ae28f088797ba746aaa83` |
| R1-001 `download.vue` | `6ba17499978b0931c74c492caf37f14d5681a45c3b08c078c4aac957e6c218d9` |
| R1-002 `prepare.mjs` | `bfb9b91f19f7a50c45c53347549ffbe5ea9d9e9148a5da1ff1f409943258c399` |
| R1-002 `prepare.test.mjs` | `312182dbaded2ebc0d997b4af5e9e1d6f01f8454e50c880db6ad14afe7a5b9b7` |
| R1-002 `sanitize-evidence.mjs` | `cab2eff3544d128b1586e24170fc4e7a26583d8aabcc449b13254eceec275c00` |
| recovery `build-index.py` | `0cb1775a870fb451227ba6d54731e9c37caeeea2271636ee0c20f83f2feea4a1` |
| recovery `verify-index.py` | `81b67a09e6de56f29d2c12af926e6435fb594845eb80efafcb993bdcab324fc9` |
| recovery `source-manifest.json` | `d6c4f419fa62932d74ab6542ec0ef16583748cde07790f650dba95a9b2f3b319` |

除已记录的定向测试、builder只读复放、摘要核验与截图目检外，本审查没有启动/停止服务、连接数据库、修改源文件、更新工作状态或提交更改。
