# MB006 定级页只读预审（2026-10-16）

状态：`PREAUDIT_ONLY / H5_NOT_RUN`。目标是正式 uni-app 页 `apps/mobile/src/pages/assessment/assessment.vue`，真实 H5 路由为 `http://127.0.0.1:18183/#/pages/assessment/assessment`；本次没有访问该地址、启动服务、运行浏览器/构建/测试或操作 Git。只新增本目录报告和源文件 SHA256 清单，未修改页面、共享文件、进度索引、CHANGELOG 或现有 dirty。MB005 仍由主 Agent 收口；本报告不抢先实现 MB006，也不推进 MB007 首页。

已核根 AGENTS、CURRENT-HANDOFF 前段、CURRENT-PROGRESS 前段、dev-plan-R1 的 L2。当前任务为正式页面整页简约重排；历史 R1/站级签收与本轮 UI 验收分别记录。所有以下问题是源码关切或设计差异，**不是实际界面 FAIL**。

## 1. 实际源码快照与最小追溯

- 页文件共 211 行，SHA256：`30cfa42c97c3fcd3923ac1309f3786fd2a1cf57c9e0d996bd897073429a86598`，03:59:59 +08:00 读取。直接依赖哈希见 [source-sha256.json](source-sha256.json)。未执行 Git 操作，未把文件哈希称为 commit SHA。
- 路由注册：`apps/mobile/src/pages.json:186–189`；统一入口/学习资格：页 `:86–104` → `auth/navigation.ts:314–315`；401/403 分流：后者 `:326–356`。
- R1 映射：`dev-plan-R1.md:46–61` 的 R1-018…029；BC-013…022：`business-chains.md:69–84`；IC-010/011/012：`interaction-chains.md:55–57`，IC-058/059：`:166–167`（这三个文档均在 `docs/06-design/v2-980plus/redesign/`）。
- 本次相关片段未给出完整 FEAT/PRD-ATOM/V2-980、ARCH、ACT/JNY/PAGE/RULE/INT/E2E 原子映射，不能补造或称映射已闭合；正式开卡时从已有卡/契约追溯补齐。
- 每组前官方额度实读；本轮始读五小时 23%/周 35%，最后分析组 35%/周 36%，`ordinaryUsageAllowed=true`；未用重置券。达到 90% 停新分析/设计/测试的规则继续有效。

## 2. 当前分支与整页问题

下表行号均指正式 `assessment.vue`。

| 状态/位置 | 当前动作与显示 | 重排及交互关切 |
|---|---|---|
| 首次引导 `:148–154` | 10 题说明；主“开始”、次“返回学习首页” | 页头“从了解自己开始”与卡内“开始定级”层级重复；“开始”对象可更明确。没有现行 IC-058 的快速开始入口，见第 3 节差异。 |
| 准备/无题/错误/受限 `:156–167` | 共用“开始定级”；加载、offline/error、forbidden、held checkpoint、empty 共用卡；符合条件时“重新读取”，另有回首页 | 需要按状态给清楚标题与下一动作；不可把无权限装成无题。错误与重读应呈现具体可执行的人话，不直接暴露后端字段/内部快照。加载只有一条状态播报即可。 |
| 作答未选/已选 `:134–146` | 题号、进度、服务端已收题数、题干、选项、未提交提示、提交 | 正文与选项实际多用 14px Token；题干/辅助信息/选项权重需拉开。`:140,197` 选中只靠边框/底色，无 `aria-pressed`/可读“已选”标记。每个选项与整卡 hover 都变品牌边框，交互重点分散。 |
| 作答中 `:56–62,140–145` | 先清空选择；提交按钮禁用且显示“正在记录…” | 选项按钮仍可改变选择；请求完成/迟到响应可能清掉用户新选择，需真实指针与延迟用例验证。不能仅凭按钮 disabled 认定整个提交已防重。 |
| 已有题的未知提交结果/离线 `:139–145` | 保留题干；错误；主“重新读取” | 重读对账优先是正确方向；需区分网络未达、已收回执丢失、409 读回。恢复不是新开题，也不是离线成功。当前请求前清空选择与 IC-010 有差异。 |
| FULL/ZERO 回执 `:35–39,127,139` | 下一题或报告内“刚才提交的这题…” | 明确是上一份提交的反馈，避免用户将其理解成正在显示的下一题。保留 `reconciledWithoutReceipt` 不播报正误的保护；DEC-04 未决，不自行切成另一种反馈方案。 |
| 正式报告 `:122–132` | 等级/分数、可选正确数、反馈、技术性“报告和快照同版本”、计划影响说明；今日为主、重测为次 | 单一结果焦点；移除对用户无助的“快照版本”措辞。分数/等级或计数缺失不能补 0 或捏造维度。`:131` 重测只有禁用，没有忙碌文案。重测失败留旧 report，`:122` 分支仍命中，store 的 lastError 未在此显示。 |
| 跳过 `:112–120` | “水平尚未验证”、非正式分数说明、自选起点（若有）；仅“查看今日状态” | 未验证语义应保留，不能设计成已认证等级、零分或正式报告。这里是读态，不能冒充快速开始写入闭环。 |
| 全页 `:108–211` | 共享 Header + 卡片；yx/v2 两套类覆盖，选项/说明/操作都大量使用描边行 | 移除本页重复覆盖，简化卡内边框层级，使用留白组织信息；说明文字不需要仿按钮 hover。`:194` 与 `:210` flex 规则叠加，需以实际 H5 计算布局核验按钮换行。不要为本页去改共享 Header/Token。 |

整页正文/按钮/错误/反馈为硬编码中文（`:35–39,112–167`）；Header 独自使用共享 i18n（`components/MobilePageHeader.vue:20–22`、`packages/i18n/src/mobile-experience.ts:30,38`）。切英文将形成混合语言；应在现有 `mobile-experience` 命名空间补本页中英完整状态文案，保留 UI locale 与 contentLocale 分离。数字、题号、计数走现有 i18n 参数/格式化入口，不在页面拼中文。

## 3. 开工前具名处理的设计差异

这些差异需纳入本页实施范围和验收记录，不应借视觉重排静默改核心业务，也不能靠删入口消失。

1. **快速开始**：BC-017 `business-chains.md:79`、IC-010/058 `interaction-chains.md:55,166` 明确是现行次入口，DEC-03 仅保留数据细节待定。契约已有 canonical skip 写口（第 4 节），页与直接 API 当前没有该入口/适配。若恢复此既有能力，应单列最小 API/store 接线与权限/幂等/结果验收；不能只画无行为按钮或把 SKIPPED 读态算闭环。未完成则显式保留 GAP，不能签完整交互范围。
2. **断网当前页选择**：IC-010 `:55` 要求保留当前页面未提交选择，当前页 `:59` 在调用前清空；持久暂存另受 DEC-05 限制。需要区分“当前页草稿”“已接收检查点”“持久离线恢复”，禁止扩展成本地完整答案缓存或离线判分。
3. **重测确认**：BC-018 `:80` 要求用户确认再新开；当前 `:71–80,131` 直接写重测。建议点次操作后给简短页内确认，说明新开、旧报告保留及计划另行确认；取消不发写请求。
4. **报告主操作**：IC-012 `:57` 写“生成我的计划”，源码 `:130` 是“查看今日状态”，且 store `:407–408` 在正式报告后调用 ensure plan。不能只换按钮文字假装新增生成行为，也不能静默更改 ensure/replan。正式实现应具名对齐当前可用行为与已确认设计，按真实 endpoint/计划状态验收。
5. **反馈时点**：R1-021 保留即时 FULL/ZERO；BC-015/IC-011 记“仅保存进度、结束统一讲评”为 DEC-04 待确认演示方案。重排先保留真实回执事实及当前行为，不能自行拍板切换。

## 4. 不可破坏的定级契约

契约简称：`P = packages/contracts/fragments/b10/b10-placement.openapi.json`；`B = packages/contracts/fragments/b10/b10-learning-assessment-content.openapi.json`。契约片段自标 `NOT_RUNTIME_VERIFIED`，以下是规范核对，非运行验收。

| 边界 | 约束与来源 |
|---|---|
| 服务与 IAM/Phase 1 | P `:8–27`：assessment-service 拥有 session/作答/定级结果；content-service 拥有密封题与规则；learning-service 拥有计划与后续进度。Bearer、默认拒绝、服务侧 PEP；subject/tenant/adultGate/phase 来自可信事实。根 AGENTS 的 Phase 1 仅 18+ 成人，IAM 自有 RS256 JWT；不引入 OIDC/Keycloak、AI、K12。客户端不自报 owner/成人门/分数/规则 pins（P `:473–485`）。 |
| 新口与答案隔离 | 当前 mobile API `learner-content.ts:673–709` 使用 `/assessment/placement/sessions`、`/{id}`、`/{id}/responses`、`/{id}/retest`；不退回 B25 start/submit-step/skip。P `:69–82,118–136`：10 道密封题，无 answer key/rule body，原始答案不进 analytics/普通 audit/完成事件。P `:371–386`：3/3/2/2 与四维各 25%；页面不得本地伪造题/分数/完成。 |
| 作答幂等/顺序 | P `:138–149,478–485`：expectedStateVersion、itemId、itemSequence(1…10)、candidateResponse、digest、timeSpentSec；Idempotency-Key 同键同载荷返回原回执，异载荷 409。API `:704–728` 同一闭包重试保留同键；409 先 GET，对已收题采用服务端事实，完全未变才有限重试（`:347–356`）。不能在重试时换题、换摘要或新建 session。 |
| If-Match 准确边界 | P `:145–149` 引用 B10IfMatch；B `:2777–2785` 明确 `required:false`、格式 `state-N`。当前 responses 仅 expectedStateVersion + 幂等键不是遗漏必需头。B `:725–748` 的 `/assessment/sessions/{id}/checkpoint` 是独立 PRE_SUBMISSION_SESSION_DRAFT，不能把该草稿口的规则无依据套到 responses，更不能混同 attempt/report 写入。 |
| 回执/检查点 | P `:590–608`：非终态给 nextItem，终态给 finalResult，二者不可同时出现。store `:335–369` 有 asess_ 指针就读同 session；失败只保留指针，不保存答案 payload。持久缓存按 subject 分区（`:139–163`），不把缓存投影当权威结果。 |
| 迟到响应/身份 | store `:73–86,122–137,349–357,398,433` 校验 subject + identityRevision；页 `:24` 清本地状态。不能删这些隔离。还需实测同身份的“旧读回晚于新题/新重测”、页 `load():52–53` 在 await 后清选择、旧 onShow 回调改变新页 guide；当前检查不等于已证明所有请求顺序安全。 |
| 正式报告/缺失字段 | P `:299–317` 为不可变参考结果，非认证或 mastery；BC-016 要求重复完成同结果、未就绪不伪装报告。页只在服务端有 fullCount/itemCount 时显示计数（`:30–33`）；兼容分数比例/百分制由 `domain/placement-score.ts:1–8` 统一处理。不能把空值当 0 或给 SKIPPED 算分。 |
| 跳过/重测/计划 | P `:239–270` skip 写口要求 Bearer、assessment.placement.skip、幂等；`:571–580`：SKIPPED 为 UNVERIFIED、coverage=0、score/referenceLevel=null、无维度成绩。P `:182–219` 重测 bodyless、新 session、旧 report/digest 保留、同键回同一次重测。调整已有计划只走确认后的计划流程，不能跨 owner 写表或将重测等于 replan。 |
| 错误精度 | P `:173–178` responses 声明 401/403/404/409/422/503；六条 placement 路径未声明 410，不能称它已有专门 410 规范。401/403 不能伪装空态；IC-059 区分未达/已收回执丢失/版本冲突，先读 checkpoint。 |

## 5. 整页简约信息层级与动作建议

1. 顶部复用现有 Header 的 compact/文案属性，保留可识别返回与设置；单一 H1“水平测评”，说明放在引导/状态内，不用诗性标题重复占首屏。不修改共享 Header，不引入新图标或新框架。
2. 引导只有“10 道题、了解英语学习起点、一题一提交”的短说明。主“开始测评”；快速开始作为有真实后端行为的现行次入口，返回首页降为安静的返回动作。没有实测时长就不展示预计分钟。
3. 作答以“题号/已提交进度 → 题干 → 选项 → 一条反馈/未提交状态 → 主按钮”为顺序。题干/选项正文优先现有 16/20px 字号 Token，辅助说明 14px；文字放大可自然换行。选项用现有 AppIcon check + “已选”与可读 pressed 状态，不只用颜色；命中区域使用现有足够高度 Token。进度值若表达“已完成”必须来自 acceptedSequence，不把当前题序号当已提交；补可读进度名/值。
4. 每一时刻只有一个主要写操作；加载用对应忙碌文案并保护所有会改变当前提交的控件。恢复时主“重新读取进度”，不诱导重复开题；返回动作与加载/重测冲突需有清楚规则。
5. 报告用结果标题、真实等级/分数、确有的正确题数、一句结果解释；去掉“快照同版本”技术措辞。重测为次操作，忙碌与失败就地可见，旧报告保留。缺字段给诚实说明。SKIPPED 独立显示“尚未完成定级”与自选起点，无分数装饰。
6. 仅用现有语义颜色/字号/间距/焦点/状态 Token，减卡片内嵌套描边和非操作 hover；普通状态不滥用警告色，错误有图标/文字。复用 `useMobileExperience()`、AppIcon 与 `packages/i18n`。主题、high contrast、系统模式和四级画质/减弱动效保留；本页无需新增装饰动效。

## 6. 最小文件边界与实施顺序

- 纯页面重排基本边界：`apps/mobile/src/pages/assessment/assessment.vue` + `packages/i18n/src/mobile-experience.ts` 的 assessment 键；i18n 为 Root 同时使用的共享文件，实施时先对齐其最新字节、窄补本页键，不覆盖 MB005/其他页。复用 `MobilePageHeader`、AppIcon、experience、分数适配器，不编辑它们来服务布局。
- 只有恢复现行 skip、证实请求顺序问题或修复确认动作需要时，才扩到 `apps/mobile/src/api/learner-content.ts` / `stores/learner-content.ts` / 对应最小测试；先列清真实契约与 owner，不改无关共享业务。当前源问题不能凭预审就批量修。
- 建议顺序：确认第 3 节差异与现行契约 → 取得该页真实 before → 逐态布局/文案/动作实现 → 必要类型/构建及具名契约与 race 检查 → 作者实际 H5 → 独立实际 H5/源码审查 → 本页 evidence/文档 → Root 单独 commit/push 核远程 SHA。此处只是计划，未执行任何一步实现或验证。

## 7. 必要真实 H5 验收矩阵（全部 NOT_RUN）

| 组 | 必验内容与证据 |
|---|---|
| 实际页面与环境 | 正式 `#/pages/assessment/assessment`、18183 固定端口、当前源/产物哈希；before/after 同视口截图；实际 DOM、指针、Tab/Enter/Space、Console Error 和水平溢出。构建成功不替代这些证据。 |
| 核心状态 | 引导、准备、无题、受限、第一题未选/已选、提交中、FULL/ZERO 下一题反馈、held checkpoint、网络未达、服务已收但回执丢失、409、正式报告、有字段缺失报告、SKIPPED、重测确认/取消/加载/失败/成功。每态核主次动作、标题、反馈归属和禁用语义。 |
| 排版与可读性 | 320/390/768/1280 宽；zh-CN/en-US；亮/暗/系统/高对比；窄屏与宽屏 200% 文字，长题干/长选项/多行错误。关键布局按主题/语言组合复验；不能用未渲染的样式值替代对比度、实际 hitbox、选中/焦点/disabled 检查。 |
| 写入与恢复 | 真正点击重复提交、忙碌期换选项、离开返回、同键未知结果读回、409 有限同键重试、刷新恢复原 session 与下一题，确认无额外 start。未提交选项与已收进度分别断言；不做离线成功承诺。 |
| 迟到/身份 | 延迟旧 GET、旧 submit、重测返回；同身份旧 session 晚到不得覆盖新 session/题/选择；身份切换/退出/失权后旧响应不得显示旧题/报告或继续写入。断点与指针点击路径要留原件。 |
| 报告/计划/快速开始 | 10 题终态正确计数、空分数不造 0、SKIPPED 不造等级；重测确认前零写、取消零写、成功新 session 且旧报告可读；失败可见。现行快速开始独立验权限/幂等/UNVERIFIED；计划行为与第 3 节具名对齐。 |
| 工程与范围隔离 | 必要 mobile 类型/构建、具名状态/契约测试；作者与独审绑定同一实际源码哈希。Fixture UI 结果、真实 IAM/Gateway/owner schema 业务链、native App/iPad/Windows 视觉和旧 R1 签收分开标注；本页不以 UI 通过重签后端或发布就绪。 |

未形成候选源、before 图、浏览器 PASS、独审签收、提交或推送。下一步由主 Agent 在 MB005 收口后，按本报告差异与最小边界正式开 MB006。
