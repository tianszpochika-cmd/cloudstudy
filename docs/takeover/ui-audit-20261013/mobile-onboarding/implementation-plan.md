# MB-004 正式 onboarding：只读实施与验收计划

2026-10-14。当前正式源码 `apps/mobile/src/pages/onboarding/onboarding.vue` SHA-256：`812ef4a4469c70dd211d7256dadca2a1fae31903d8ce3b124f4e3d809e3cf345`，与既有 before 一致。本次只读源码、契约和既有 evidence，不启动新测试，不修改业务源码、共享资源、服务、数据或 Git。此文件不是页面完成签收。

依据：DESIGN-DIRECTION；R1-006/007/008/010/011/013/016/017；BC-006/007/008/010/011/201/202；IC-005/006/009/055/056/057；B8 IAM 与 learner targets 契约。原型、legacy 摘要、fixture 均不替代正式事实。

## 1. 四种渲染态的具体重排

保留 gate / consent / goal / assessment 四种现有状态。最后一种是已保存设置的恢复摘要，不新增第四个必经确认动作。正常新号仍是成人确认 → 必要同意 → 保存目标并进入定级；不新增快速开始能力。步骤依据服务端实际事实，不能承诺固定“3 击”。

| 状态 | 主体与文案 | 主动作与辅助动作 |
| --- | --- | --- |
| gate | 一个标题“确认成人身份”；短说明“出生年份用于成人学习资格确认，不收集完整生日。”；年份输入；整行“我确认自己已满 18 周岁”复选框。移除重复大标题、默认黄色政策大框及内部实现说明。 | “确认并继续”；提交中“正在确认…”；账号设置和退出置于主体后明确出口。只有真实拒绝才使用“当前版本暂不能向你开放学习”，不引导改年份绕门。 |
| consent | 一个标题“阅读并确认”；逐项紧凑展示账号条款 / 隐私说明 / 成人学习资格、服务端必要性、真实文档版本。真实记录可读时增加“来源记录”展开区，保留发布时间、记录时间、digest 与政策引用；不自造条款正文或不可用链接。 | 当前已发布逐项文档确实可读且逐项确认后，才有“确认并继续”。缺失发布投影时不显示签署按钮，显示“同意内容暂时无法完整读取”及实际“重新读取”动作、账号设置/退出。已记录历史事项明确叫“已记录版本”，不叫“当前已发布版本”。 |
| goal | 一个标题“选择学习目标”；四种既有目标与短说明；每天 5/15/30/45 分钟选择。四目标和 wire mapping 保持不变；不增标签必填或生日字段。 | 唯一主动作“保存并开始定级”；保存失败留在本步，已保存读回后再导航。辅助出口写实际目的，不使用笼统“继续”。 |
| assessment | 一个标题“设置已完成”；已保存目标和每日时长的简洁只读摘要；一条定级用途说明。不要再次呈现整套可编辑选项、重复“目标已保存”或默认未保存警告。 | 主动作“开始定级”；次动作“调整目标”进入 goal 状态并回填已保存值。编辑后的主动作仍是“保存并开始定级”，不允许当前可见修改被主动作忽略。 |

共用布局：沿既有 brand/icon/token，开放单列；移动左右 24px（320 窄屏若需调整必须实测），入口字段宽度上限 420px，同意/目标主体可按密度扩到 560–640px，平板/桌面居中且不依赖 rpx 把内容压成 300px。只保留一层主要容器；真实进度以小字和可读“已完成/当前”标记，当前项有 aria-current。

字号沿设计方向：标题 28px/1.4/650；说明 14px/1.75；标签 14px/1.6/500；真正原生输入和主按钮 16px；辅助规则 13px。正常无衬线；文案、布局、焦点及图标视觉重量均复验。当前任务主体到动作区 24px；所有整行选择/按钮/出口命中区至少 44px。取消装饰性重阴影、艺术字、大面积渐变；只消费共享语义色，颜色不是唯一状态信息。完整中英文案经 packages/i18n；不以 UI locale 改 contentLocale。

错误靠近字段或当前动作，合并现在同一问题的三处重复说明。纠错后保留曾实际出现的自然高度、隐藏空文案并移除 role/id/aria 关联，避免 pointerdown→blur→pointerup 之间按钮移动；初始正常与首次合法 busy 不预留空错误框。布局须支持英文长版本和 200% 多行提示。

## 2. 输入、复选框与恢复的最小页面修复

- 年份只校验 1900 至当年的整数，不能由客户端计算年龄后授予资格；只采年份，不采完整生日。具名 uni form/input + 标签/原生语义桥；真实输入 16px。复用认证页即时 form.detail.value、blur/confirm 同步模式，无 detail 保留 ref，busy 不同步；不读取 DOM.value、不加固定等待。
- 复选框用现有 uni checkbox-group 的 typed change 值、稳定 id/value 与真实 label/for 关联，整行点击、组件本体、键盘 Space/Enter 各只改变一次。移除现有 checkbox@click 与 label 的不完整切换机制，避免 change+click 双切。H5 额外语义桥只在实际 uni 语义不足时补，不能以 CSS 假复选框通过验收。
- saving 时锁年份、全部 checkbox、目标/时长选择、步骤返回和设置导航，handler 同时防重入。允许的账号/设置出口保留；不隐藏真实受限原因，不变成无限加载。
- onHide / identityRevision / 请求代次失效时清未提交年份和同意选择，晚回调不得改步或跳转。保留已经由 owner 确认的事实；服务端已保存目标重进读回。未提交草稿仍不持久化（DEC-05 未批准）。cancel 使用 try/finally，导航失败如实处理。
- 返回不重新征求已经确认的成人事实；“调整目标”只调整目标。错误读取提供实际重读入口，读取失败与无已保存目标严格分开。进入新步更新标题焦点/滚动，不让屏幕停留于上一幕底部。

## 3. 两个事实问题的精确路径

### 成人门 503 被误写为 REJECTED

`onboarding.vue:179 next()` → `session.confirmAdultGate(Number(birthYear))` → `auth/gateway-auth.ts:203 adapter.confirmAdultGate` POST `/iam/adult-gate` → `session.ts:300` 将任何非 PASSED 返回改成 REJECTED；`:304 catch` 又将网络/503改成 REJECTED → 页面 `next():190` 调用 leaveRejected 去 forbidden。既有全 API 拦截 fixture 的 `results.json:adult503` 实际复现跳转。forbidden 截图仅是导航瞬间，不能推导稳定空白页缺陷。

最小修复：保留服务端真实 PASSED / REJECTED / NOT_EVALUATED 区分；网络失败、缺失响应与 UNKNOWN 是未完成/不可读，不是服务端拒绝。保留真实拒绝的受限清理与出口。`MobileAuthSnapshot` 当前只带归一化 adultGate，未保留 `B8AdultGateResponse.learningAccess`；`session.isLearningReady:69` 只看 PASSED + permission。沿现有 generated B8AdultGateResponse 给 snapshot/read fact 保留权威 learningAccess（及必要有效性字段），解析不能把 PASSED+RESTRICTED 当可学习；缺失/不确定保持受限，不保留旧 PASSED 作此次不确定确认的许可。不要简单将 catch 改成 PASSED 或单纯清错误。

这项可在现有 adapter/session/resume 读模型内修，沿原接口与字段，不新增接口、改判定或签 token。共享影响需定向验证登录后恢复/permissions、成人门和既有 auth fixture，不能只测 onboarding UI。

### 未保存目标仍开始定级；保存目标再次无条件重签

页面 `targetDirty:52` 和 `saveEdits:164` 只控制次级“保存修改”；`next:181` 的 assessment 分支立即 openUniPage，没有 dirty 判断。最小布局修复是 assessment 默认只读摘要，“调整目标”进入 goal，不让编辑与忽略编辑的 primary 同时出现。

更深的现有调用：`store.saveTarget:217` → `mobileLearnerContentApi.saveOnboarding({goal,quota,consentsRecorded:true})` → `api/learner-content.ts:562` 仍无条件 `await signRequiredConsents(...)` → 三次 PUT `/iam/consents`。因此单纯保存目标可能替用户接受期间新发布文档。这一行是需要移除的目标保存重签路径，不能只改主按钮。

最小维护方案：分开明确的“用户确认本批已查看文档”与“使用已有已确认同意事实保存目标”。consentsRecorded=true 路径只 GET principal/me 读当前 adultGate/consentState 权威结果、必要时按既有流程刷新会话再读；要求已确认且当前仍有效，才写 learner targets/preferences。此路径 **零 PUT /iam/consents**。未确认/更新/不可读则返回 typed needsConsentReview/unreadable 到 consent 状态，清未提交勾选；不自动签署、不开始定级。旧 saveOnboarding(consent fields) 的兼容入口也只能签调用方实际确认过的逐项版本，不能通用自动“三签”。

继续复用现有 GET/PUT targets、expectedStateVersion/幂等键、保存后读回和 owner/identity guard，不改 learner 服务规则。409目标冲突与409同意文档冲突区分，保存失败不得显示已保存。

## 4. 法律事实：现有能力能修到哪里

### 已有契约/类型足够容纳真实记录；当前 Mobile 投影不够

`@englishflow/contracts` 现有 generated/openapi.ts：B8Consent（1218）包含 type、purpose、required、document、state、effectiveAt、revalidation、withdrawalEffect、provenance、policyRef、policyVersion、decisionRef；B8ConsentDocument（2533）是 version/digest/publishedAt；B8ConsentProvenance（2543）是 IAM_SERVER_RECORDED_CONSENT、recordedAt、PUBLISHED_DOCUMENT_VERSION_AND_DIGEST、IAM_ACTIVE_POLICY_CONTROL_PLANE。B8ConsentUpdateRequest（1233）已有 type/version/decision/expectedDocumentDigest。无需手写 any 或改契约。

目前 `domain/onboarding-consent-copy.ts` readPublishedConsentVersion 只读 principal/me 的 consentState.version；该字段是 **legacy summary**，不是逐项 document.version。`api.MobileOnboardingResumeRead`、`domain.OnboardingConsentFact`、`store.loadOnboardingResume:171` 只投影 readable/accepted/unsatisfiedPurposes；`store.recordRequiredConsents:201` 最终返回 boolean/string lastError，没有 document/provenance 或版本变化原因。MobileOnboardingModel/PersistedState 也不含法律文档；不要为补齐展示把事实或敏感草稿塞进持久 cache。

可增加一个独立只读 consent review 内存投影（类型复用 Pick<B8Consent,...> 或 generated B8Consent），不改 saved onboarding 结构。调用 existing `mobileApiClient.request<unknown>('/iam/consents')`，unwrap 既有 data.items 并校验，保留服务端原值，再配合 GET principal/me 的当前资格/缺项事实；按 declared pagination 读取完整已记录事项，失败不伪造。身份变化和 onHide 清除页内选择，identity 缓存不得跨号。

展示层 type → purpose 映射：TERMS → ACCOUNT_TERMS；PRIVACY → PRIVACY_NOTICE；ADULT_LEARNING → ADULT_LEARNING_ELIGIBILITY；wire 值保留，只用 i18n 输出人话标签。PRODUCT_ANALYTICS / VOICE_RECORDING 不插入基础学习必选，不预勾、不默认签。必要性与授权效果采用服务器值；“来源记录”展示上述真实 document/provenance/政策引用，不把 policyRef 当可点击 URL，也不编造发布方名称或法律正文。

### 关键边界：GET consents 不是未签发布文档目录

`IamProviderBoundaryController.java:408–421 consentList` 遍历 ConsentType，调用 consentStore.find(principal,type)，不存在项过滤。所以新号 items=[]，返回的是已记录事项。`:1161–1174 consentResponse` 的 document.version/digest 来自 record，publishedAt 来自当前 descriptor；它不能证明这些记录就是未签的最新发布文档，更不能以 legacy summary 给缺失项补版本/来源。principal/me 的 consentState（1077起）只返回学习必要用途、首项 documentVersion 摘要和当前是否全部满足，不含逐项未签 document/digest。

因此本次客户端不新增接口/服务器、不批准法律文本。真实已记录事项可读时呈现真实记录；新号或版本更新缺少权威逐项发布投影时清楚 fail closed，不显示签署动作，保留 IAM published-read projection owner GAP。不靠全 accepted fixture 伪装正常新号可签；fixtures 分“既有真实记录可读”与“缺发布投影 blocked”。禁止拿 localCandidate 的 b30 固定值当发布证明。

### 消除现有危险重试

`fetchActiveConsentVersion:385` 失败回退 b30-consent-v1；`signConsent:468` 用全局 cachedActiveConsentVersion；遇409后读新版本并自动 PUT ACCEPTED，新 body 新 key。需要删除 fallback 与自动重签。页面最终提交必须显式带本次真正查看并勾选的逐项 document.version/digest，client 不能提交时自行换版本；只传 B8ConsentUpdateRequest 定义字段，purpose/provenance 永远由服务端决定。

409先停止此次批次并 GET 重新读事实，不把所有409都说成“条款已更新”（也可能幂等冲突）。确实有权威逐项新文档时显示变更的事项、影响与新版本，清对应勾选并要求用户重新确认；读取不到则不显示签署动作并保留 blocked。不能自动全选、不能静默重签。已成功记录的部分由 GET 回读如实显示，不谎称整个批次回滚或完成；后续只提交用户本次确认的适用项。

最小文件边界：onboarding.vue（四幕与控件/忙态/请求代次）；onboarding-consent-copy.ts（真实记录解析/映射，不编正文）；api/learner-content.ts（只读记录与分离明确签署/目标保存，移除 fallback/409自动PUT）；store/learner-content.ts 与 onboarding-resume.ts（必要内存投影、typed恢复原因）；auth/gateway-auth.ts/session.ts（真实 gate/access事实）；packages/i18n 对应新键。不得扩到目标服务、批准法律文件、Token策略或无关页面重构。

## 5. 待实现后逐项验收（本次未运行）

1. 四幕 * 320/390/768/1280 * 中英 * 四主题，system实时变化、200%、短屏滚动与键盘；真正16px输入、28/14/13字号、24px动作间距、44px命中区、语义色/对比、无横向溢出。逐张实际查看正式组件截图，不检查静态demo替代。
2. 年份即时输入/清空/替换→click/Enter 都消费事件即时值；缺失/非法年份聚焦正确字段；整行 checkbox、本体、Space/Enter只切一次。初始全不勾选，busy锁输入/所有选择/返回/设置，响应晚到不越页。
3. 合成 adult PASSED+ELIGIBLE、REJECTED+RESTRICTED、NOT_EVALUATED/UNKNOWN、PASSED+RESTRICTED、缺 learningAccess、503/超时；只真实拒绝去受限拒绝说明，未完成可重读/再试且学习仍受限，不能把网络失败称拒绝或成功。真实 IAM/审计另列 NOT_RUN。
4. 同意分三种：既有真实记录可读展示；新号无发布投影明确 blocked无签署按钮；明确逐项权威文档 fixture 可读才试UI确认（若当前接口不供应，该 fixture 不能升级真实业务可签）。检查 document/purpose/provenance 保真、optional不预勾、旧摘要不能补缺项、读取失败不签。
5. 同意409/版本变化后零自动第二次PUT；changed项清勾并显示变更，重新用户确认前零签署；非文档409措辞准确。失败部分逐项回读，不全体默认已同意。保存目标 consentsRecorded=true 路径 **GET-only IAM、零consent PUT**；当前同意失效进入review，不写target/不开始定级。
6. 目标初选/回填/明确调整/保存失败与冲突/目标读失败；可见dirty不被“开始定级”忽略；目标读回与已保存摘要一致后才导航。英文多行错误纠正不移动按钮，首次合法busy无凭空占位。
7. onHide重进、切号、旧响应、导航异常、logout失败；已保存字段续上，未提交年份/勾选不持久化，不串号。API全拦截UI证据与真实Gateway/IAM/learner/定级验收分开；原生App/小程序另列未运行。

实施完成后独立 Review 以最终 source hash 签 UI_SCOPE，报告/索引/CHANGELOG逐页更新，再由root单页提交推送核SHA。当前只完成读审与计划；MB-004仍未实现/未签。
