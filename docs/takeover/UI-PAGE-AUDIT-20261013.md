# V2 UI 逐页审查索引 — 2026-10-13

> **2026-10-30 说明**：下面 10-13…10-21 的额度暂停/续做检查点均为历史。当时的 `dev-redesign` 推送失败与“本地 UI 9 / 远程 7”已过时：相关提交已于 2026-10-26 进入 `origin/dev`。当前汇总见 [STATUS](../STATUS.md)；页面表与签收原文不改。

> **2026-10-21 用户暂停检查点（最新）**：本地提交 `b64db8e9…` 成功（361文件，parent 5b3ca5a7），但 `git push origin HEAD:dev-redesign` 单次执行 exit **128**：msys `sh.exe` 直接崩溃于凭据 helper 子进程（凭据助手子进程启动失败、认证未完成；凭据状态未验证），未换transport、未force、未读数。远程未更新，本地UI 9/远程仍7（本轮未新核），MB005 758dc0fb与MB006 8a66cc73仍未推；需人类本机正常Git环境推送。详见[推送收据](ui-audit-20261013/PUSH-RECEIPT-20261021-USER-PAUSE.md)。


> **2026-10-21 人类暂停并授权提交（最新）**：人类先说“先暂停工作”，随后要求“更新文档并把所有工作提交到远程”，为新的普通Git推送授权（不绕权限/不改安全配置/不探凭据/不换SSH/不force）。当前HEAD 5b3ca5a7、index0，本地UI 9/远程7仍为发布前；MB007 home C8 b097私有候选未签、浏览器未验，auth401/empty/cross-owner风险未清，旧C7具名PASS不套C8；自动任务已不存在且不创建替代。详见[用户暂停与提交指令](ui-audit-20261013/USER-PAUSE-AND-PUBLISH-20261021.md)。


> **2026-10-21 20:40已恢复（最新）**：Root实读0%/周62%、ordinary=true，reset→2026-10-22 01:40:42 CST；HEAD 5b3ca5a7/index0，五源与暂停一致，18183/18180当前无监听（旧服务自退），准备固定18183严格端口；本地UI9/远程7，MB007首页C8 b097私有未签未提交，LearnL2仅跳转补修；Root先审C8与最终QA脚本、复验auth401/empty/cross-owner，再全矩阵；旧C7 PASS不升级C8，发布仍DSH Git阻塞禁fetch/push，>=95只存断点。详见[恢复记录](ui-audit-20261013/RESUME-20261021-2040.md)。


> **2026-10-21 16:26实际暂停（最新）**：Root实读五小时96%/周62%、ordinary=true，已停止新设计/源码/测试，仅保存断点。本地UI 9页/远程7页；MB007首页IN_REVIEW/PRIVATE_CANDIDATE_C8未签未提交；MB005 758dc0fb与MB006 C8 8a66cc73均本地未推；HEAD 5b3ca5a7，远程3230ac94仅旧读值。DSH Git helper子进程权限/无审批通道阻塞，禁fetch/push/SSH/探钥/Root代Git。本轮完成首页全重排候选+Learn onShow任务跳转L2窄补修（Learn非整页、不计页面）；C7→C8真实home401+refresh401清会话后仍停#/，为产品FAIL（root-home-auth401-l2.json/.png），C8仅候选会话恢复未浏览器复验。当前五源raw：home b097382f/i18n7e2ef7b5(store c4ef9dd8/runtime03b21bab/LearnL2 4bd50e4b)，package/lock未改；快照含16源/测试/候选记录，56保护0漂移/14目录、index0、原dirty保留。C8-CANDIDATE仅作者typecheck/SFC通过、browser NOT_RUN；Root旧读6813与当前b097差异已记录，恢复按实际字节；c8-l2-auth-1目录不存在，不得称已跑auth。旧C7五源组合ready24/search19/nav13/retry16/learn-retry9/late-same13/learn-late10/plan-late13、共享auth3 15/assessment-home5、full34/68PNG零失败、build0，仅旧组合不升级C8/IAM/native。未收口：empty40/41测试过早、auth401真实产品FAIL待C8、cross-owner late测试前提GAP；QA脚本PREPARED NOT_RUN未审。C7原件ARCHIVE_GAP、archive为RECONSTRUCTED不可冒称原始。恢复先查额度<95、读actual raw、审C8与QA差量、真实auth401/empty/cross-owner，再构建/矩阵/独立审；未签不提交。18183当前93267/PID40220 creation14:10:03，旧已停；18180 24615/PID42932未动。ui下一17:53 CST后每5h，>=95只存断点。详见[暂停记录](ui-audit-20261013/PAUSE-20261021-1626.md)。


> **2026-10-21 09:15实际暂停（最新）**：Root实读primary95%/周46%、ordinary=true，立即停止新设计/修复/测试/新页，本轮仅保存断点。C8页已local commit **8a66cc73…**（parent 687af101…，branch dev-redesign，index 0），为本地提交非推送；687af101为提交前快照HEAD。Local UI 9/远程7，MB005 758dc0fb与本页均未推，PUBLISH_BLOCKED（DSH Git helper子进程权限阻塞，不重试/不探凭据/Root不代Git）。C8三主要修复与已验各组见FINAL-UI-REVIEW；states full suite仍FAIL（read/skip/restore唯一no-console-warnings 12/9/6），settings-baseline 9/today 2/owner-read 14 warnings原样保留；真实后台/IAM/native未PASS，SKIPPED/首次start/retest{} GAP继续。18183 Root 99776/PID37960 creation21Oct08:27:39，pinned 4.4.4；18180 24615/PID42932先核未动。保护56文件/14目录0漂移，产品raw/LF快照已存私有目录。reset 1792558092=今天12:48:12，heartbeat DTSTART20261021T045000Z每5h，下查12:50。下一页MB007首页未开始，不重做C8。详见[暂停记录](ui-audit-20261013/PAUSE-20261021-0915.md)与[本地提交收据](ui-audit-20261013/LOCAL-COMMIT-RECEIPT-20261021-MB006.md)。


> **2026-10-21 C8已签（最新）**：Root具名审签MB006 C8实际H5受控UI为**UI_ACCEPTED_LOCAL/PUBLISH_BLOCKED**（非后台/native/整页业务，不签R1/IT READY）。C8页41e1670…；backguard95/95（6case）、author32/32、keyboard31/pointer30/busy31、matrix34/226图、owner submit-2 22/22与read-2 23/23（latePacket true）、auth3 15/15、fonts21、nav15/17/12+reload11、Root build exit0。保留：states完整suite仍FAIL（read/skip/restore唯一no-console-warnings 12/9/6条关联route警告）；settings-baseline 9、today 2、owner-read 14条warnings原样保留属未重排页follow-up；旧run1脚本exit2保留。本地UI 8→9、远程仍7；MB005 758dc0fb与本页均未推；HEAD 687af101，远程3230ac94仅旧观测。只准备本页单独stage待Root审后commit，不push；Git helper阻塞不重试。下一页MB007首页。详见[最终审签](mobile-assessment/FINAL-UI-REVIEW-20261021.md)。


> **2026-10-21 C8审核断点（最新）**：本页仍IN_REVIEW未签，待Root对owner迟到包/3auth窄回归及scope决定。C8页41e1670…(44989B)，i18n/package/lock未变；18183新PID37960 creation08:27:39，fresh HTTP确认路由v4.4.4，旧4.6.4证据仅环境scope不升级。实际：backguard c8-all-1 95/95 PASS（6 case，stable/deps/closed true，native explicit accept含在内，但H5原生对话框≠native App）；author 32/32；risk keyboard31/pointer30/busy-retest31 PASS_EXECUTED；matrix 34 MEASURED/226 PNG 0 fail/review/incomplete/error；fonts 21检查实证YaHei/Segoe UI，宋体疑点排除；nav guide15/cycle17/today12 PASS、reload 11 PASS（旧hash-goto FAIL保留）。states不能称整套PASS：start503 10/10，read503/skipped/restore401各12/13，唯一FAIL均no-console-warnings；settings-baseline 9条同族warnings属未重设计页。保护56/14 08:33零漂移；quota 67%/周42%，reset 1792558092=今天12:48:12，12:50后每5h，阈值95。HEAD687af101，本地8/远程7，MB005 758dc0fb未推，C8未提交；Git阻塞不重试。详见[断点](ui-audit-20261013/CHECKPOINT-20261021-C8-REVIEW.md)。


> **2026-10-21 08:20断点（最新）**：最近Root实读27%/周35% ordinary=true，阈值≥95%（非90）；reset 1792558092=今天12:48:12 CST，heartbeat 12:50后每5h；原56文件/14目录07:50零漂移。C5c页719cc0ce…最终旧源matrix 34 contexts/226 PNG，0 fail/review/incomplete/error，keyboard 31/pointer 30/busy 31具名通过；两例darkhc先counted-string误报、修脚本后MEASURED，旧失败保留；native explicit accept 18/18，dismiss首轮SPA期待native属测试时序错误非产品FAIL、修正后尚未在最终源复跑。C6b页ac8fb8d…仅build/typecheck 0；risk leave 22/26 FAIL（返回未离开、recovery 2 FAIL、Object pageerror未定因），backguard repeat-confirm 19/21 FAIL（forward确认只关提示不离站），均sourceStable/depsStable/closed=true、不签。C7首稿92e7e…静态退修(isMobileLearningPath/afterEach范围)，C7b进行中、不记未确认hash。states脚本已静态修、browser全NOT_RUN。本地8/远程7、MB005 758dc0fb未推、MB006 IN_REVIEW未提交；HEAD 687af101，远程3230ac94仅历史观测；Git阻塞不重试。详见[断点](ui-audit-20261013/CHECKPOINT-20261021-0820.md)。


> **2026-10-21 07:48已恢复（最新）**：Root实读07:48五小时0%/周31%、07:53实际7%/周32%，ordinary=true；新reset 1792558092=2026-10-21 12:48:12 CST，ui ACTIVE（DTSTART 20261021T045000Z，FREQ=HOURLY;INTERVAL=5）下次12:50 CST后每5h，未用reset券。四源未变（C5c页719cc0ce…/i18n 6ac/package 484/lock d57），保护56 match/14 dirs/drift0；18183 PID40996与18180 PID42932均未停未重启。C5c native dialog显式beforeunload监听+repeat/accept守卫已准备未跑；矩阵gate更新后Root有界跑HC390 MEASURED、english200仅报告计数展平harness FAIL（无dot点7条正则），Root实看UI正确7/10，DSH改专用段落读取，旧FAIL+16图保留；risk/lifecycle/author guards对当前C5c显式refreeze。完整矩阵/共享回归/lifecycle/races/独立终审pending。本地UI8/远程7、MB006 IN_REVIEW未提交、无CHANGELOG完成；DSH Git阻塞未重试。详见[恢复记录](ui-audit-20261013/RESUME-20261021-0748.md)。


> **2026-10-20 23:46实际暂停（最新）**：Root实读五小时96%/周31%、ordinary=true（94%后首次越线），触发≥95%实际暂停，停止一切新设计/修复/测试；本轮仅完成暂停记账，无整页验收、无页面完成CHANGELOG、无commit/push。C5c页719cc0ce…仍未签；Root官方prepared suite 53项scoped PASS（cancel-2 21/21、busy-2 18/18、clean-1 14/14，sourceStable/depsStable/closed=true，非整页，native/backend NOT_RUN）；repeat-1的about:blank为UX finding、非当前产品FAIL（playwright-core 1.63.0无监听时beforeunload默认accept，L62285-62288/L13283-13286），旧C5b未告警离开TRUE FAIL保留，下一步加显式dialog监听。待办：全主题/语言/宽度/200%矩阵、风险/lifecycle/onShow/owner/lateGET/recovery、独立终审；旧矩阵需显式refreeze。本地UI8/远程7、MB006 IN_REVIEW/未提交；DSH Git阻塞未重试。reset 1792522142=2026-10-21 02:49:02 CST，ui ACTIVE首个02:50后每5h。详见[暂停记录](ui-audit-20261013/PAUSE-20261020-2346.md)与[检查点](ui-audit-20261013/CHECKPOINT-20261020-2345.md)。

> **2026-10-20 C5c检查点（最新）**：MB006仍IN_REVIEW/未提交，本地UI8页/远程7页，无CHANGELOG完成条目、无稳定推送，当前C5c页719cc0ce…为未签候选。C5b cancel/confirm与busy为scoped PASS（响应持有、back被拦、释放后仅1次accepted），C5b二次back→about:blank的UX FAIL保留。C5c beforeunload实测：dismiss保root/prompt/选中，custom cancel回assessment且0写；accept显式离开about:blank且0写；这是浏览器事件行为，不是native App验收。C5c全主题/语言/宽度/200%矩阵、风险共享回归(onShow/owner/late GET/recovery)与独立终审pending；旧矩阵需Root复核后显式重新freeze，back guard gate更新中，旧gate记NOTRUN。Root 23:37实读90%/周30%(ordinary=true)，≥95%停止线未触发；ui任务ACTIVE、reset1792522142=10-21 02:49:02 CST、首个02:50后每5h；DSH Git子进程阻塞仍在，不重试push。 详见[检查点](ui-audit-20261013/mobile-assessment/dsh-20261020-author/runs/c5c-root-review/CHECKPOINT-20261020-C5C.md)。


> **2026-10-20 DSH执行阻塞（最新）**：MB005本地8页/远程7页，普通HTTPS只读已恢复，但DSH内Git经`sh.exe -c`拉credential helper被沙箱拒绝（Win32 error 5）且无审批通道，未推、不得记PUSHED；MB006由DSH接续精简进度候选，未签未提交，浏览器子进程受执行环境阻塞不是产品FAIL，原英文200%拆词FAIL保留，Root将独立审核测试/页面；新证据`ui-audit-20261013/mobile-assessment/dsh-20261020-author`（作者仍生成checkpoint，不预填hash/PASS）。最新暂停线≥95%，reset 1792522142≈2026-10-21北京时间02:49:02，ui自动任务ACTIVE、02:50后每5h。详见[本轮接续](ui-audit-20261013/RESUME-20261020-DSH.md)与[阻塞报告](ui-audit-20261013/PUBLISH-BLOCKER-20261020-DSH.md)。本页索引其他页状态不变；以下为历史。

> **2026-10-16 04:42额度暂停（最新）**：首次实读五小时90%/周45%立停新修测。MB005已本地验收提交758dc0fb，GitHub TLS持续失败待推（本地8页/远程7页）。MB006实际重排候选2 page d1b501e3/i18n44e4c857未提交未签：C1类型/8项H5具名通过，但英文200%标题拆词FAIL；已短文案修稿尚未复验，原FAIL保留。56保护0漂移，详[本次精确断点](ui-audit-20261013/PAUSE-20261016-0442.md)。实际reset今天08:43，同ui08:44后每五小时，不用券；以下为历史。

> **2026-10-16 MB005本地UI已签（最新）**：实际受限页C4通过52项独立H5具名记录与Root工程/概念实图复核，本机UI累计8页，已推远程仍7页。GitHub连接失败，当前单页将本地提交待推，不能称PUSHED；[范围与证据](ui-audit-20261013/mobile-forbidden/FINAL-UI-REVIEW-20261016.md)。下一MB006定级页仅只读预审，真实后台/native和历史GAP未升级。下方为历史。

> **2026-10-16 03:42已恢复（最新）**：官方五小时0%/周31%、普通使用允许，8源与56保护0漂移，接续MB005候选2剩余独审，未签整页。远程连接失败，断点4c9d97d5仅本地，候选未推；见[续做记录](ui-audit-20261013/RESUME-20261016-0342.md)。实际reset08:42:59，同ui08:44后每五小时，无券。以下为历史。

> **2026-10-15 23:44额度暂停（最新）**：独审首读90%即停新修测，作者92%/Root回读98%。MB005实际candidate2 d38/2a已写，作者128矩阵/12smoke/8text/3pointer、独审11风险具名PASS，但最终实际host对比/主题200%pointer独审未跑，整页不签、正式源不推。旧空数组对比声明已撤回为未测。见[精确断点](ui-audit-20261013/PAUSE-20261015-2344.md)，实际reset2026-10-16 03:36:25，ui03:38后每五小时，无券。以下为历史。

> **2026-10-15 22:36已恢复继续（最新）**：实读五小时0%/周15%、普通使用允许，fetch后3230ac94一致，原56保护文件0漂移。接续MB005正式访问受限整页重排，当前未签UI；作者page+i18n与独立运行/源码review分离，见[本轮记录](ui-audit-20261013/RESUME-20261015-2236.md)。下次真实reset2026-10-16 03:36:25，同heartbeat继续每五小时，不耗券。下方暂停仅作历史。

> **2026-10-15 18:53额度暂停（最新）**：五小时首次实读90%/周14%即停新修/测。MB004整页a7d26107与登录标题54f5ac0e已推、远程SHA一致；MB005已有before/重排概念与可靠状态计划，正式源仍未改，无候选/未签UI。无owner暂停marker不得描述成当前账号明确撤回。断点与待验见[本次交接](ui-audit-20261013/PAUSE-20261015-1853.md)。实际reset今天22:35:56，ui下一复查22:37后每五小时，未用券。以下为历史。

> **2026-10-15本轮已推（最新）**：MB004四态H5实际视觉/交互/独审收口并推a7d26107，登录标题窄补修54f5ac0e也已推，各自远程完整SHA一致；[收据与范围](ui-audit-20261013/PUSH-RECEIPT-20261015-MB004.md)。下一MB005受限页只有只读预审，未开正式实现/签UI；真实后台/native与发布文档GAP另列，不以UI通过覆盖。下方继续/暂停为历史。

> **2026-10-15 17:35继续（最新）**：官方实读五小时1%/周0%、普通使用允许，接续MB004；12:39周限中断前的checkbox/指针/200%拆词/restoring成功误跳登录FAIL全部保留。当前c4/7b/helper24a/sessiond944候选复验中，尚未签UI/推正式源，旧PASS不升级新版本；[本轮事实与断点](ui-audit-20261013/RESUME-20261015-1735.md)。真实reset22:35:56，每五小时继续，不用券。

> **2026-10-15 08:10额度暂停（最新）**：作者实读90%立即停新修/测，根08:10:42回读91%/周95%；真实reset今天12:32:34，同ui heartbeat首个复查已对齐12:34、随后每五小时，不耗券。MB004 f56/5e0四态候选仍未签最终UI，最后7恢复/4race fixture与31/25模块PASS仅具名范围，最终构建/矩阵/暗色边界/200%pointer/独审待验。16源/测试私有备份、56保护无漂移，正式源未提交；先读[精确断点](ui-audit-20261013/PAUSE-20261015-0810.md)。下方为历史。

> **2026-10-15 07:32已恢复继续（最新）**：开工实读Plus0%/周80%，fetch bdca4f8a一致，六源/原56保护hash无漂移；正在接续MB004正式四态，实际checkbox/插值/焦点/busy FAIL修稿与Gate/prefs边界复验。当前未签UI，旧128矩阵不代最终hash；[本轮记录](ui-audit-20261013/RESUME-20261015-0732.md)。下一真实reset12:32:34，同heartbeat首个复查对齐12:34、后每五小时，不用券。下方旧暂停为历史。

> **2026-10-15 02:14:00 UI暂停（最新）**：五小时实读90%即停，真实reset今天03:28:01。MB-003/MB-001/MB-002本轮分别推`fe6e027c`/`70ad42f4`/`4b3a40f1`并核远程同SHA，最新收据`09bcfa41`。第一接续MB-004正式四态aa20/i18n5de候选及六源未提交，未跑类型/模板/browser，不签UI；[精确断点](ui-audit-20261013/PAUSE-20261015-0214.md)。同heartbeat每五小时复查，未用重置券，以下旧接续为历史。

> **2026-10-14 22:39续做（最新）**：Plus实读4%，MB-003 c9a6当前49项独审/PUSHED_SCOPED，`fe6e027c`远程SHA一致；MB-001新主按钮Enter首错FAIL已局部修复，17项独审通过并推`70ad42f4`，远程SHA一致，MB-002指针/键盘/长度契约9258已44项独审及工程收口，PUSHED_SCOPED，已推`4b3a40f1`且远程SHA一致。见[本轮记录](ui-audit-20261013/RESUME-20261014-2239.md)。以下旧“已推/待审/暂停”仅保留对应范围，不能覆盖新FAIL。

> **2026-10-14 16:46已恢复续做**：额度实读1%、fetch后067ef187一致，原56文件hash无变化。[本轮记录](ui-audit-20261013/RESUME-20261014-1646.md)；MB-003/MB-002仍在独立复审，旧正常矩阵不代替指针/多行错误通过。

> **2026-10-14 12:27最新**：五小时已用90%即暂停，根回读92%；定时已纠正为每五小时。LW-003补修2a352cf7已推；MB-003未提交指针修稿仍FAIL，MB-002新首次错误指针FAIL已重新打开。准确未完范围见[暂停断点](ui-audit-20261013/PAUSE-20261014-1227.md)。下面“注册已推/其余PENDING”等早期描述只作历史，不覆盖本次重新IN_REVIEW。

> 分支：`dev-redesign`。本轮拉取后的源码观察基线：`4990dd29`；R1 原有签收基线：`7a6ac0a2`。时间口径：Asia/Shanghai。
> **2026-10-14 11:10续做**：实际额度已恢复（已用1%），错误的每天续跑设置已更正为每五小时检查；立即接续MB-001/MB-002最终独立复签，详见[续做记录](ui-audit-20261013/RESUME-20261014-1110.md)。
> 用户已明确改为全部正式页面简约重设计。Web三页分别推送`182e106b`/`60858fbc`/`5cd40e35`；Mobile登录即时值补修`46c5106d`、注册重设计`4968bc76`已独立复签并推送，远程SHA一致。接续MB-003正式找回密码，其余PENDING。旧FAIL与暂停记录保留，见[续做交接](ui-audit-20261013/PAUSE-HANDOFF.md)。
> **2026-10-14 04:08额度暂停**：首次90%停工，根回读92%；08:22复查额度后续做。MB-001补修26矩阵/即时输入已由作者通过，MB-002作者34矩阵通过，最终独立复签与逐页推送尚未收口，见[准确断点](ui-audit-20261013/PAUSE-20261014-0408.md)。

## 1. 进度与证据边界

- [CURRENT-PROGRESS](../06-design/v2-980plus/redesign/CURRENT-PROGRESS.md)仍是当前进度入口；本表只记录第二版正式 UI 的逐页审查与推送收据。
- 已核对 [LUNA-SIGNOFF](LUNA-SIGNOFF.md)：R1 IT-1…IT-7、R1-001…115 与全链在 `7a6ac0a2` 获签收。早于该账的 REJECT、BLOCKED、`lunaStamp=false` 原件保留，不回写。这份 R1 业务签收不自动完成 `4990dd29` 后续 UI 差量审查。
- [FEATURE-AVAILABILITY](FEATURE-AVAILABILITY-20261013.md)仍写 admin 修复未部署及旧镜像；[CONTENT-OPS](CONTENT-OPS-20261013.md)页首写未部署，而文末追加 `3e77e636` 合并/部署记录；[SUPPORT-GOVERNANCE](SUPPORT-GOVERNANCE-20261013.md)页首写未部署，而后文追加 `e61829ff`、`9d7e87a3` 部署记录。这些有时态差异的历史记录不能单独证明实时运行版本。
- 每次浏览器验收须记录实际 URL、时间、页面/资源版本可核验信息及环境。当前索引没有执行实时部署核验，不宣称本机或线上部署状态。
- **当前页 review scope ≠ 业务 PASS。** 当前源码、渲染、交互和视觉局部验收分别记录；构建、类型检查、HTTP 200、页面数量或历史 R1 签收不能替代当页真实业务/API/owner 数据证据。局部 UI 完成不改历史业务签收。
- 本轮产品阶段仍为 Phase 1。关闭能力、成人门、鉴权和配置边界按当前契约与事实解释，不为消除禁用控件擅自开放功能。

## 2. 范围与排队口径

| 正式端 | 路由事实源 | 唯一页面源组件数 | 当前处理方式 |
|---|---|---:|---|
| learner-web | [apps/learner-web/src/router/index.ts](../../apps/learner-web/src/router/index.ts) | 30 | 登录/注册/找回已推送；33 个带页面的路由记录及其别名、设置分区、重定向逐项追溯 |
| mobile | [apps/mobile/src/pages.json](../../apps/mobile/src/pages.json) | 33 | H5 路由为 `#/pages/…`；原生 App/小程序验收单列，不能用 H5 替代 |
| admin-web | [apps/admin-web/src/router/index.ts](../../apps/admin-web/src/router/index.ts) | 15 | 登录开始，依次审查权限、表格、详情、编辑/审核和弹窗 |
| official-site | `apps/official-site/pages/` Nuxt 文件路由 | 16 | 按当前实际源文件逐页审查；历史“11 页”不代表当前完整队列 |
| 合计 | 正式路由页面源组件 | 94 | 是源码范围数，**不是完成数、完成率或业务卡数** |

一个页面的别名、设置分区、对话框和状态不是新增业务能力，但必须有具名复验记录。共享样式改动后，重验受影响的已审页；同源文件的另一入口不自动完成。未路由的学习端 WelcomePage、AdultGatePage、B3ListeningPage/B3ReadingPage/B3SpeakingPage、B11SyncPage 等历史文件不混入正式页面数量。静态原型只作视觉对照。

## 3. 每页必查与交付规则

当前完整设计方向见[DESIGN-DIRECTION](ui-audit-20261013/DESIGN-DIRECTION.md)。每页必须重新评估布局、提示文字、按钮位置、字体/艺术字、配色/图标与交互舒适度，不能仅修bug即放行。

每页报告至少记录以下维度；不适用项明确写 N/A 与理由，未执行项写 NOT_RUN 与具体边界：

1. **身份与可达性**：真实路由、页面标题、主内容、刷新/返回/深链、鉴权跳转；没有白屏、框架覆盖层或相关 console/pageerror。
2. **布局与排版**：首屏层次、对齐、间距、字体/行高、图文比例、长文本/内容缺项；无重叠、裁切、布局漂移或无意横向滚动。
3. **响应式与滚动**：至少 1280×900、390×844；受平板/断点影响的页补 768 宽，窄屏风险补 320 宽；检查全页、固定导航、底部动作、safe-area、长表格/长文和软键盘遮挡。
4. **控件与键盘**：触摸目标至少 44×44px 或有等效命中区；Tab 顺序、Enter/Space、可见焦点、Esc、对话框焦点约束/恢复，关闭、返回和双击边界。
5. **表单与语义**：可访问名称/label、字段与错误关联、首错定位、自动填充、密码显示、输入类型、重试、切步骤清理、未保存内容和 pending 防重复/误切。
6. **状态与反馈**：Loading、Empty、Error、成功、禁用原因、取消、重试、失效、权限拒绝；401/403 不伪装为空，状态不只靠颜色，反馈与已保存事实一致。
7. **主题、国际化与性能**：亮/暗/跟随系统/高对比、中文默认与 UI locale fallback、长文案/格式化、内容语言分离、四级画质和减少动效；记录当页覆盖范围。
8. **交互与证据**：修复前复现 → 最小修复 → 同一交互复验；保存前后/响应式/状态截图、实测步骤与观察；API/数据事实和 fixture/source-only 证据分开。
9. **回归与独立复核**：运行改动所需的构建/类型/单测及关联页回归；复杂或风险修改由独立审查方复核 diff 与实际效果，不用源码猜测代替浏览器结论。
10. **逐页提交推送**：一页收口即同步本表、当前进度入口的对应记录、当页报告和 CHANGELOG；保存页面范围、测试/截图、未测边界、提交 SHA 与远程推送收据。只提交本页相关差量，保护其他未提交工作。共享修改说明影响页。没有推送收据不写已推送。

状态约定：PENDING → IN_REVIEW → UI_VERIFIED → PUSHED_SCOPED；阻塞时记 BLOCKED 并写明确原因。UI_VERIFIED 只表示该页报告具名范围内通过，PUSHED_SCOPED 表示其源码/报告/记录已完成远程推送；两者都不升级为业务全链 PASS。初始记录只使用 PENDING 和 LW-001 的 IN_REVIEW。

## 4. 额度与恢复规则

- 使用真实账户限额工具读取五小时滚动窗口的 `usedPercent` 与 `resetsAt`，不开新页面前、页面收口后及长工作阶段复核。
- 当五小时窗口 **usedPercent ≥ 90%（剩余 ≤ 10%）**，停止开启新页；保存当前页已完成检查、未完成步骤、证据位置和工作区差量，按安全边界结束当前操作，不因额度把页面标成完成。
- 依据工具返回的真实 `resetsAt` 设置当前线程续跑定时器，并在该时间后复查实际限额再继续；不把“从现在等五小时”或猜测周期当重置时间。无法读取限额或重置时间时如实记不可用，不编造重置，不绕过限制。
- 续跑先核对本索引、上页收据、源码差量、固定端口与进程所有权，继续未完成页；不得重做已完成页或擅停共享服务。自动恢复只在用户约定范围内推进。
- 定时器、限额实读结果与暂停/恢复记录由主 Agent 维护；本索引建立本身没有创建自动化或改变任务状态。

## 5. 学习端 Web

所有 source 链接相对仓库，便于跨机器复用。先完成 LW-001，再以认证 → 引导 → 测评 → 学习闭环 → 账号/帮助 → 关闭能力的顺序逐页推进。

| 审查编号 | 真实路由 | 页面源文件 | 本页需展开的场景 | 当前状态 | 证据 / 提交 / 远程收据 |
|---|---|---|---|---|---|
| LW-001 | `/login` | [apps/learner-web/src/pages/LoginPage.vue](../../apps/learner-web/src/pages/LoginPage.vue) | 登录：空提交、密码显示、错误、等待、链接与键盘 | PUSHED_SCOPED | [重设计记录](ui-audit-20261013/learner-login-redesign/review.md)，182e106b远程SHA一致；70c2623f旧范围保留 |
| LW-002 | `/register` | [apps/learner-web/src/pages/RegisterPage.vue](../../apps/learner-web/src/pages/RegisterPage.vue) | 注册：密码规则、确认密码、错误定位 | PUSHED_SCOPED | [重设计记录](ui-audit-20261013/learner-register/review.md)，60858fbc远程SHA一致 |
| LW-003 | `/reset-password` | [apps/learner-web/src/pages/PasswordResetPage.vue](../../apps/learner-web/src/pages/PasswordResetPage.vue) | 请求/确认两步、切步清错、等待与完成 | PUSHED_SCOPED | 原重设计5cd40e35；[503/断网补修](ui-audit-20261013/learner-reset/20261014-outage-followup/report.md)、[中英失败/重试独立复签](ui-audit-20261013/learner-reset/20261014-outage-final-review/review.md)通过，2a352cf7远程SHA一致 |
| LW-004 | `/onboarding` | [apps/learner-web/src/pages/OnboardingPage.vue](../../apps/learner-web/src/pages/OnboardingPage.vue) | 成人门、三项同意、目标/时长、保存后定级四幕 | PENDING | — |
| LW-005 | `/forbidden` | [apps/learner-web/src/pages/ForbiddenPage.vue](../../apps/learner-web/src/pages/ForbiddenPage.vue) | 限制说明、可用出口与退出 | PENDING | — |
| LW-006 | `/assessment` | [apps/learner-web/src/pages/AssessmentPage.vue](../../apps/learner-web/src/pages/AssessmentPage.vue) | 开场、选项、保存回执、反馈、报告与重测 | PENDING | — |
| LW-007 | `/home` | [apps/learner-web/src/pages/HomePage.vue](../../apps/learner-web/src/pages/HomePage.vue) | 计划横幅、今日入口、首次引导、空/错态 | PENDING | — |
| LW-008 | `/today` | [apps/learner-web/src/pages/TodayPage.vue](../../apps/learner-web/src/pages/TodayPage.vue) | 任务、空态分流、重复动作与反馈 | PENDING | — |
| LW-009 | `/courses` | [apps/learner-web/src/pages/CoursesPage.vue](../../apps/learner-web/src/pages/CoursesPage.vue) | 目录、搜索无结果、读取失败、续学入口 | PENDING | — |
| LW-010 | `/learn` | [apps/learner-web/src/pages/LearningLoopPage.vue](../../apps/learner-web/src/pages/LearningLoopPage.vue) | 学习队列、进度、检查点与恢复 | PENDING | — |
| LW-011 | `/learn/session` | [apps/learner-web/src/pages/LearnPage.vue](../../apps/learner-web/src/pages/LearnPage.vue) | 课程内容、章节、检查点、停止/失效出口 | PENDING | — |
| LW-012 | `/practice` | [apps/learner-web/src/pages/B2PracticePage.vue](../../apps/learner-web/src/pages/B2PracticePage.vue) | 作答、反馈、下一题、提交禁用解释 | PENDING | — |
| LW-013 | `/vocabulary` | [apps/learner-web/src/pages/VocabularyPage.vue](../../apps/learner-web/src/pages/VocabularyPage.vue) | 词汇、媒体可播事实、收藏、复习与三态 | PENDING | — |
| LW-014 | `/grammar` | [apps/learner-web/src/pages/B3GrammarPage.vue](../../apps/learner-web/src/pages/B3GrammarPage.vue) | 选择、图/文本降级、练习与异步切换 | PENDING | — |
| LW-015 | `/reading` | [apps/learner-web/src/pages/B11ReadingPage.vue](../../apps/learner-web/src/pages/B11ReadingPage.vue) | 阅读目录、正文、词句、提交与离线提示 | PENDING | — |
| LW-016 | `/reader` | [apps/learner-web/src/pages/B11ReadingPage.vue](../../apps/learner-web/src/pages/B11ReadingPage.vue) | 沉浸阅读入口与上下文、长文滚动 | PENDING | — |
| LW-017 | `/mistakes` | [apps/learner-web/src/pages/MistakesPage.vue](../../apps/learner-web/src/pages/MistakesPage.vue) | 错题空态、补救、回执与恢复 | PENDING | — |
| LW-018 | `/mastery` | [apps/learner-web/src/pages/MasteryPage.vue](../../apps/learner-web/src/pages/MasteryPage.vue) | 有证据/不足数据、状态与排版 | PENDING | — |
| LW-019 | `/plan-map` | [apps/learner-web/src/pages/PlanMapPage.vue](../../apps/learner-web/src/pages/PlanMapPage.vue) | 计划地图、状态文字、窄屏与键盘 | PENDING | — |
| LW-020 | `/b2/report` | [apps/learner-web/src/pages/B2ReportPage.vue](../../apps/learner-web/src/pages/B2ReportPage.vue) | 定级/周期报告、空态、建议、分享/撤销 | PENDING | — |
| LW-021 | `/reports/weakness` | [apps/learner-web/src/pages/B2ReportPage.vue](../../apps/learner-web/src/pages/B2ReportPage.vue) | 弱点报告入口与同页不同上下文 | PENDING | — |
| LW-022 | `/share/reports/:ref` | [apps/learner-web/src/pages/ReportSharePage.vue](../../apps/learner-web/src/pages/ReportSharePage.vue) | 公开只读、有效/失效/撤销/错误与返回 | PENDING | — |
| LW-023 | `/world` | [apps/learner-web/src/pages/B4WorldPage.vue](../../apps/learner-web/src/pages/B4WorldPage.vue) | 成长事实、空态、关闭能力与图文比例 | PENDING | — |
| LW-024 | `/messages` | [apps/learner-web/src/pages/MessagesPage.vue](../../apps/learner-web/src/pages/MessagesPage.vue) | 消息列表、详情、已读、空/错态 | PENDING | — |
| LW-025 | `/commerce` | [apps/learner-web/src/pages/B5CommercePage.vue](../../apps/learner-web/src/pages/B5CommercePage.vue) | 权益、兑换、关闭支付、输入与反馈 | PENDING | — |
| LW-026 | `/settings/:section` | [apps/learner-web/src/pages/SettingsPage.vue](../../apps/learner-web/src/pages/SettingsPage.vue) | 四个已具名分区及未知 section 边界，见分区表 | PENDING | — |
| LW-027 | `/platform` | [apps/learner-web/src/pages/B6PlatformPage.vue](../../apps/learner-web/src/pages/B6PlatformPage.vue) | 主题、语言、画质、动效与持久化 | PENDING | — |
| LW-028 | `/support` | [apps/learner-web/src/pages/SupportPage.vue](../../apps/learner-web/src/pages/SupportPage.vue) | 帮助、工单、可用/受限写入口、失败说明 | PENDING | — |
| LW-029 | `/listening` | [apps/learner-web/src/pages/B11ListeningPage.vue](../../apps/learner-web/src/pages/B11ListeningPage.vue) | 当前关闭能力说明、返回、无假播放器 | PENDING | — |
| LW-030 | `/speaking` | [apps/learner-web/src/pages/B11SpeakingPage.vue](../../apps/learner-web/src/pages/B11SpeakingPage.vue) | 当前关闭能力说明、返回与权限状态 | PENDING | — |
| LW-031 | `/writing` | [apps/learner-web/src/pages/B3WritingPage.vue](../../apps/learner-web/src/pages/B3WritingPage.vue) | 当前关闭能力说明与返回 | PENDING | — |
| LW-032 | `/writing/practice` | [apps/learner-web/src/pages/B3WritingPage.vue](../../apps/learner-web/src/pages/B3WritingPage.vue) | 写作练习兼容入口的关闭说明与返回 | PENDING | — |
| LW-033 | `/:pathMatch(.*)*` | [apps/learner-web/src/pages/EmptyPage.vue](../../apps/learner-web/src/pages/EmptyPage.vue) | 未知页面、登录/未登录壳、恢复入口 | PENDING | — |

### 5.1 别名入口

这些是实际 alias；需检查深链进入时内容、权限、标题、返回与关闭能力说明。与主入口同源，不重复计算页面组件数。

| 审查编号 | 真实 alias | 对应主路由 | 页面源文件 | 当前状态 | 证据 / 提交 / 远程收据 |
|---|---|---|---|---|---|
| LW-A01 | `/courses/listening` | `/listening` | [apps/learner-web/src/pages/B11ListeningPage.vue](../../apps/learner-web/src/pages/B11ListeningPage.vue) | PENDING | — |
| LW-A02 | `/practice/listening` | `/listening` | [apps/learner-web/src/pages/B11ListeningPage.vue](../../apps/learner-web/src/pages/B11ListeningPage.vue) | PENDING | — |
| LW-A03 | `/reports/listening` | `/listening` | [apps/learner-web/src/pages/B11ListeningPage.vue](../../apps/learner-web/src/pages/B11ListeningPage.vue) | PENDING | — |
| LW-A04 | `/clips` | `/listening` | [apps/learner-web/src/pages/B11ListeningPage.vue](../../apps/learner-web/src/pages/B11ListeningPage.vue) | PENDING | — |
| LW-A05 | `/courses/reading` | `/reading` | [apps/learner-web/src/pages/B11ReadingPage.vue](../../apps/learner-web/src/pages/B11ReadingPage.vue) | PENDING | — |
| LW-A06 | `/practice/reading` | `/reading` | [apps/learner-web/src/pages/B11ReadingPage.vue](../../apps/learner-web/src/pages/B11ReadingPage.vue) | PENDING | — |
| LW-A07 | `/reports/reading` | `/reading` | [apps/learner-web/src/pages/B11ReadingPage.vue](../../apps/learner-web/src/pages/B11ReadingPage.vue) | PENDING | — |
| LW-A08 | `/courses/speaking` | `/speaking` | [apps/learner-web/src/pages/B11SpeakingPage.vue](../../apps/learner-web/src/pages/B11SpeakingPage.vue) | PENDING | — |
| LW-A09 | `/phonetics` | `/speaking` | [apps/learner-web/src/pages/B11SpeakingPage.vue](../../apps/learner-web/src/pages/B11SpeakingPage.vue) | PENDING | — |
| LW-A10 | `/recording` | `/speaking` | [apps/learner-web/src/pages/B11SpeakingPage.vue](../../apps/learner-web/src/pages/B11SpeakingPage.vue) | PENDING | — |
| LW-A11 | `/practice/shadowing` | `/speaking` | [apps/learner-web/src/pages/B11SpeakingPage.vue](../../apps/learner-web/src/pages/B11SpeakingPage.vue) | PENDING | — |

### 5.2 设置分区与重定向

| 审查编号 | 路由/分区 | 实际页面或去向 | 当前状态 | 证据 / 提交 / 远程收据 |
|---|---|---|---|---|
| LW-S01 | `/settings/profile` | SettingsPage.vue：目标、显示偏好、账号 | PENDING | — |
| LW-S02 | `/settings/notifications` | SettingsPage.vue：NotificationPreferencesPanel | PENDING | — |
| LW-S03 | `/settings/privacy` | SettingsPage.vue：隐私、同意撤回 | PENDING | — |
| LW-S04 | `/settings/devices` | SettingsPage.vue：设备与会话 | PENDING | — |
| LW-R01 | `/` | 重定向至 `/login`；已登录守卫按事实处理 | PENDING | — |
| LW-R02 | `/adult-gate` | 兼容入口重定向至 `/onboarding` | PENDING | — |
| LW-R03 | `/me` | 重定向至 `/settings/profile` | PENDING | — |
| LW-R04 | `/settings` | 重定向至 `/settings/profile` | PENDING | — |

未知 `:section` 的实际行为纳入 LW-026，不擅自把参数字符串当成新增正式设置分区。完整页面源见 LW-026。

## 6. 移动学习端

地址列记录 H5 hash；每页仍属于同一个 uni-app 项目。表格、底部 tab、onShow 恢复与返回栈须用真实平台操作检查。

| 审查编号 | 真实路由 | 页面源文件 | 本页需展开的场景 | 当前状态 | 证据 / 提交 / 远程收据 |
|---|---|---|---|---|---|
| MB-001 | `#/pages/login/login` | [apps/mobile/src/pages/login/login.vue](../../apps/mobile/src/pages/login/login.vue) | 登录 | PUSHED_SCOPED | 原重设计/即时值收据保留；当前1d34键盘窄修获[17项独审](ui-audit-20261013/mobile-login/20261014-1d34-independent-keyboard/review.md)，`70ad42f4`已推且远程SHA一致；原da5 FAIL/native/IAM边界保留 |
| MB-002 | `#/pages/register/register` | [apps/mobile/src/pages/register/register.vue](../../apps/mobile/src/pages/register/register.vue) | 注册 | PUSHED_SCOPED | 原重设计收据保留；当前9258长度/指针/键盘补修获[44项独审](ui-audit-20261013/mobile-register/20261015-9258-independent-final/review.md)及工程收口，`4b3a40f1`已推且远程SHA一致；原FAIL/native/IAM边界保留 |
| MB-003 | `#/pages/reset-password/reset-password` | [apps/mobile/src/pages/reset-password/reset-password.vue](../../apps/mobile/src/pages/reset-password/reset-password.vue) | 请求/确认两步、完成态 | PUSHED_SCOPED | [正式两步重设计报告](ui-audit-20261013/mobile-reset/report.md)、[当前c9a6独立49项复签](ui-audit-20261013/mobile-reset/20261014-c9a6-final-interaction/review.md)及[root视觉/工程收口](ui-audit-20261013/mobile-reset/20261014-2239-root/final-review.md)通过；`fe6e027c`已推且远程SHA一致，旧FAIL/IAM/native GAP保留 |
| MB-004 | `#/pages/onboarding/onboarding` | [apps/mobile/src/pages/onboarding/onboarding.vue](../../apps/mobile/src/pages/onboarding/onboarding.vue) | 成人门、同意、目标、已保存摘要四态 | PUSHED_UI_SCOPED | [当前验收与版本](ui-audit-20261013/mobile-onboarding/FINAL-UI-REVIEW-20261015.md)；a7d26107远程同SHA，实际四态矩阵/交互/独立复审完成；真实后台/native及发布目录GAP另列 |
| MB-005 | `#/pages/forbidden/forbidden` | [apps/mobile/src/pages/forbidden/forbidden.vue](../../apps/mobile/src/pages/forbidden/forbidden.vue) | 限制说明、退出与可用出口 | UI_VERIFIED_LOCAL_PENDING_PUSH | [当前C4验收](ui-audit-20261013/mobile-forbidden/FINAL-UI-REVIEW-20261016.md)，远程连接失败未推 |
| MB-006 | `#/pages/assessment/assessment` | [apps/mobile/src/pages/assessment/assessment.vue](../../apps/mobile/src/pages/assessment/assessment.vue) | 开场、作答、反馈、结果与重测 | IN_REVIEW | [C2未签断点](ui-audit-20261013/PAUSE-20261016-0442.md)，C1文字放大FAIL保留 |
| MB-007 | `#/pages/home/home` | [apps/mobile/src/pages/home/home.vue](../../apps/mobile/src/pages/home/home.vue) | 首页、计划横幅、任务与首次引导 | PENDING | — |
| MB-008 | `#/pages/today/today` | [apps/mobile/src/pages/today/today.vue](../../apps/mobile/src/pages/today/today.vue) | 今日任务与各类空/错态 | PENDING | — |
| MB-009 | `#/pages/learn/learn` | [apps/mobile/src/pages/learn/learn.vue](../../apps/mobile/src/pages/learn/learn.vue) | 课程/内容/续学、队列、错题/补救/复习区域 | PENDING | — |
| MB-010 | `#/pages/practice/practice` | [apps/mobile/src/pages/practice/practice.vue](../../apps/mobile/src/pages/practice/practice.vue) | 练习入口目录与能力关闭提示 | PENDING | — |
| MB-011 | `#/pages/b2-practice/b2-practice` | [apps/mobile/src/pages/b2-practice/b2-practice.vue](../../apps/mobile/src/pages/b2-practice/b2-practice.vue) | 旧综合练习入口、失效内容说明与新入口 | PENDING | — |
| MB-012 | `#/pages/b2-vocabulary/b2-vocabulary` | [apps/mobile/src/pages/b2-vocabulary/b2-vocabulary.vue](../../apps/mobile/src/pages/b2-vocabulary/b2-vocabulary.vue) | 词汇、媒体、SRS 与空/错态 | PENDING | — |
| MB-013 | `#/pages/b3-grammar/b3-grammar` | [apps/mobile/src/pages/b3-grammar/b3-grammar.vue](../../apps/mobile/src/pages/b3-grammar/b3-grammar.vue) | 语法与长难句、练习与降级 | PENDING | — |
| MB-014 | `#/pages/b3-reading/b3-reading` | [apps/mobile/src/pages/b3-reading/b3-reading.vue](../../apps/mobile/src/pages/b3-reading/b3-reading.vue) | 阅读精练入口与正文 | PENDING | — |
| MB-015 | `#/pages/b11-reading/b11-reading` | [apps/mobile/src/pages/b11-reading/b11-reading.vue](../../apps/mobile/src/pages/b11-reading/b11-reading.vue) | 分级阅读、正文、选择与长文滚动 | PENDING | — |
| MB-016 | `#/pages/b10-report/b10-report` | [apps/mobile/src/pages/b10-report/b10-report.vue](../../apps/mobile/src/pages/b10-report/b10-report.vue) | 错题、补救、定级/周期报告、分享 | PENDING | — |
| MB-017 | `#/pages/report-share/report-share` | [apps/mobile/src/pages/report-share/report-share.vue](../../apps/mobile/src/pages/report-share/report-share.vue) | 有效/失效/撤销/错误的只读报告 | PENDING | — |
| MB-018 | `#/pages/world/world` | [apps/mobile/src/pages/world/world.vue](../../apps/mobile/src/pages/world/world.vue) | 成长、赛季、事实空态与关闭模块 | PENDING | — |
| MB-019 | `#/pages/b4-games/b4-games` | [apps/mobile/src/pages/b4-games/b4-games.vue](../../apps/mobile/src/pages/b4-games/b4-games.vue) | 游戏目录、即将开放的原因与返回 | PENDING | — |
| MB-020 | `#/pages/b4-social/b4-social` | [apps/mobile/src/pages/b4-social/b4-social.vue](../../apps/mobile/src/pages/b4-social/b4-social.vue) | 自习室、社交边界、空态与返回 | PENDING | — |
| MB-021 | `#/pages/b4-avatar/b4-avatar` | [apps/mobile/src/pages/b4-avatar/b4-avatar.vue](../../apps/mobile/src/pages/b4-avatar/b4-avatar.vue) | Avatar/衣柜、真实可用操作与状态 | PENDING | — |
| MB-022 | `#/pages/b4-offline/b4-offline` | [apps/mobile/src/pages/b4-offline/b4-offline.vue](../../apps/mobile/src/pages/b4-offline/b4-offline.vue) | 离线包服务边界、提示与返回 | PENDING | — |
| MB-023 | `#/pages/profile/profile` | [apps/mobile/src/pages/profile/profile.vue](../../apps/mobile/src/pages/profile/profile.vue) | 我的、入口、账号状态与退出 | PENDING | — |
| MB-024 | `#/pages/settings/settings` | [apps/mobile/src/pages/settings/settings.vue](../../apps/mobile/src/pages/settings/settings.vue) | 偏好、通知、隐私、撤回、持久化 | PENDING | — |
| MB-025 | `#/pages/devices/devices` | [apps/mobile/src/pages/devices/devices.vue](../../apps/mobile/src/pages/devices/devices.vue) | 设备与会话、当前设备、撤销反馈 | PENDING | — |
| MB-026 | `#/pages/b5-commerce/b5-commerce` | [apps/mobile/src/pages/b5-commerce/b5-commerce.vue](../../apps/mobile/src/pages/b5-commerce/b5-commerce.vue) | 权益、兑换输入、关闭支付 | PENDING | — |
| MB-027 | `#/pages/b6-platform/b6-platform` | [apps/mobile/src/pages/b6-platform/b6-platform.vue](../../apps/mobile/src/pages/b6-platform/b6-platform.vue) | 主题、语言、画质、动效与持久化 | PENDING | — |
| MB-028 | `#/pages/support/support` | [apps/mobile/src/pages/support/support.vue](../../apps/mobile/src/pages/support/support.vue) | 帮助、工单、受限动作和失败反馈 | PENDING | — |
| MB-029 | `#/pages/b3-listening/b3-listening` | [apps/mobile/src/pages/b3-listening/b3-listening.vue](../../apps/mobile/src/pages/b3-listening/b3-listening.vue) | 听力旧入口的关闭说明与返回 | PENDING | — |
| MB-030 | `#/pages/b11-listening/b11-listening` | [apps/mobile/src/pages/b11-listening/b11-listening.vue](../../apps/mobile/src/pages/b11-listening/b11-listening.vue) | 听力/Clips 当前关闭说明与返回 | PENDING | — |
| MB-031 | `#/pages/b3-speaking/b3-speaking` | [apps/mobile/src/pages/b3-speaking/b3-speaking.vue](../../apps/mobile/src/pages/b3-speaking/b3-speaking.vue) | 口语/音标旧入口的关闭说明与返回 | PENDING | — |
| MB-032 | `#/pages/b11-speaking/b11-speaking` | [apps/mobile/src/pages/b11-speaking/b11-speaking.vue](../../apps/mobile/src/pages/b11-speaking/b11-speaking.vue) | 音标/跟读当前关闭说明与返回 | PENDING | — |
| MB-033 | `#/pages/b3-writing/b3-writing` | [apps/mobile/src/pages/b3-writing/b3-writing.vue](../../apps/mobile/src/pages/b3-writing/b3-writing.vue) | 写作当前关闭说明与返回 | PENDING | — |

## 7. 管理后台

当前权限/审核/客服写入口按源码、服务与配置事实审查；不能把 R1 历史只读范围自动套到后续内容维护与支持修复，也不能据文档宣称写链实时可用。

| 审查编号 | 真实路由 | 页面源文件 | 本页需展开的场景 | 当前状态 | 证据 / 提交 / 远程收据 |
|---|---|---|---|---|---|
| AD-001 | `/login` | [apps/admin-web/src/views/AdminLoginView.vue](../../apps/admin-web/src/views/AdminLoginView.vue) | 登录、错误定位、密码显示、菜单与等待 | PENDING | — |
| AD-002 | `/forbidden` | [apps/admin-web/src/views/AdminForbiddenView.vue](../../apps/admin-web/src/views/AdminForbiddenView.vue) | 权限说明与安全返回 | PENDING | — |
| AD-003 | `/dashboard` | [apps/admin-web/src/views/AdminDashboardView.vue](../../apps/admin-web/src/views/AdminDashboardView.vue) | 指标口径、更新时间、零/暂无/计算中/失败 | PENDING | — |
| AD-004 | `/content` | [apps/admin-web/src/views/AdminContentView.vue](../../apps/admin-web/src/views/AdminContentView.vue) | 内容草稿、审核、发布、冲突、下架/回滚 | PENDING | — |
| AD-005 | `/lexemes` | [apps/admin-web/src/views/AdminLexemeView.vue](../../apps/admin-web/src/views/AdminLexemeView.vue) | 词条、退回/修订、审核意见、差异与批处理 | PENDING | — |
| AD-006 | `/items` | [apps/admin-web/src/views/AdminItemView.vue](../../apps/admin-web/src/views/AdminItemView.vue) | 题目/条目、退回/修订、版本冲突与批处理 | PENDING | — |
| AD-007 | `/phonetics` | [apps/admin-web/src/views/AdminPhoneticsView.vue](../../apps/admin-web/src/views/AdminPhoneticsView.vue) | 音标读取、资料/媒体、能力状态 | PENDING | — |
| AD-008 | `/learners` | [apps/admin-web/src/views/AdminLearnerView.vue](../../apps/admin-web/src/views/AdminLearnerView.vue) | 学员目录、筛选、脱敏、详情 | PENDING | — |
| AD-009 | `/permissions` | [apps/admin-web/src/views/AdminPermissionsView.vue](../../apps/admin-web/src/views/AdminPermissionsView.vue) | 权限读取及当前源码条件写入口、无权解释 | PENDING | — |
| AD-010 | `/commerce` | [apps/admin-web/src/views/AdminCommerceView.vue](../../apps/admin-web/src/views/AdminCommerceView.vue) | 订单/权益、输入、关闭支付与退款边界 | PENDING | — |
| AD-011 | `/audit` | [apps/admin-web/src/views/AdminAuditView.vue](../../apps/admin-web/src/views/AdminAuditView.vue) | 审计列表、筛选、脱敏、导出关闭说明 | PENDING | — |
| AD-012 | `/release` | [apps/admin-web/src/views/AdminB6ReleaseView.vue](../../apps/admin-web/src/views/AdminB6ReleaseView.vue) | 排期/发布权限、勾选、动作与状态 | PENDING | — |
| AD-013 | `/governance` | [apps/admin-web/src/views/AdminB12GovernanceView.vue](../../apps/admin-web/src/views/AdminB12GovernanceView.vue) | 案件、过滤、只读/冻结/权限边界 | PENDING | — |
| AD-014 | `/support` | [apps/admin-web/src/views/AdminSupportView.vue](../../apps/admin-web/src/views/AdminSupportView.vue) | 工单、详情、附件、动作权限与连接边界 | PENDING | — |
| AD-015 | `/recovery` | [apps/admin-web/src/views/AdminRecoveryView.vue](../../apps/admin-web/src/views/AdminRecoveryView.vue) | 恢复单、批准/执行/失败/未知、权限与重试 | PENDING | — |

| 审查编号 | 兼容/未知入口 | 实际去向 | 当前状态 | 证据 / 提交 / 远程收据 |
|---|---|---|---|---|
| AD-R01 | `/` | `/dashboard`，仍经过鉴权/权限守卫 | PENDING | — |
| AD-R02 | `/risk` | `/governance`，仍经过鉴权/权限守卫 | PENDING | — |
| AD-R03 | `/:pathMatch(.*)*` | `/dashboard`，需验证用户可理解的恢复行为 | PENDING | — |

## 8. 官网

公开投影、设备入口、FAQ/弹窗、文档长页逐页复验。官网不保存学习业务 Token；跨端注册 CTA 的语言/主题和目标应实际读回。

| 审查编号 | 真实路由 | 页面源文件 | 本页需展开的场景 | 当前状态 | 证据 / 提交 / 远程收据 |
|---|---|---|---|---|---|
| OS-001 | `/` | [apps/official-site/pages/index.vue](../../apps/official-site/pages/index.vue) | 首屏、导航、注册 CTA、示例与长页锚点 | PENDING | — |
| OS-002 | `/start` | [apps/official-site/pages/start.vue](../../apps/official-site/pages/start.vue) | 设备入口、注册、换设备弹窗、复制成功/失败 | PENDING | — |
| OS-003 | `/courses` | [apps/official-site/pages/courses/index.vue](../../apps/official-site/pages/courses/index.vue) | 公开课程投影、空/错态、CTA | PENDING | — |
| OS-004 | `/courses/:id` | [apps/official-site/pages/courses/[id].vue](../../apps/official-site/pages/courses/[id].vue) | 方法/内容详情、有效与未知 id、面包屑 | PENDING | — |
| OS-005 | `/method` | [apps/official-site/pages/method.vue](../../apps/official-site/pages/method.vue) | 学习方法、图文节奏与 CTA | PENDING | — |
| OS-006 | `/world` | [apps/official-site/pages/world.vue](../../apps/official-site/pages/world.vue) | 体验、图文、动效降级与 CTA | PENDING | — |
| OS-007 | `/pricing` | [apps/official-site/pages/pricing.vue](../../apps/official-site/pages/pricing.vue) | 方案投影、免费/关闭/空/错态 | PENDING | — |
| OS-008 | `/download` | [apps/official-site/pages/download.vue](../../apps/official-site/pages/download.vue) | 各平台真实下载投影、不可用解释 | PENDING | — |
| OS-009 | `/about` | [apps/official-site/pages/about.vue](../../apps/official-site/pages/about.vue) | 介绍、内容顺序、长页与链接 | PENDING | — |
| OS-010 | `/help` | [apps/official-site/pages/help.vue](../../apps/official-site/pages/help.vue) | 帮助、FAQ、键盘与展开状态 | PENDING | — |
| OS-011 | `/announcements` | [apps/official-site/pages/announcements.vue](../../apps/official-site/pages/announcements.vue) | 公告列表、内容与空态 | PENDING | — |
| OS-012 | `/status` | [apps/official-site/pages/status.vue](../../apps/official-site/pages/status.vue) | 状态说明、公告/帮助入口 | PENDING | — |
| OS-013 | `/privacy` | [apps/official-site/pages/privacy.vue](../../apps/official-site/pages/privacy.vue) | 隐私文档、目录、长文与返回 | PENDING | — |
| OS-014 | `/terms` | [apps/official-site/pages/terms.vue](../../apps/official-site/pages/terms.vue) | 条款文档、目录、长文与返回 | PENDING | — |
| OS-015 | `/compliance` | [apps/official-site/pages/compliance.vue](../../apps/official-site/pages/compliance.vue) | 合规公示、可读性与链接 | PENDING | — |
| OS-016 | `/minors` | [apps/official-site/pages/minors.vue](../../apps/official-site/pages/minors.vue) | 未成年人阶段说明、可读性与出口 | PENDING | — |

| 共享状态编号 | 触发 | 源文件 | 当前状态 | 证据 / 提交 / 远程收据 |
|---|---|---|---|---|
| OS-E01 | 未知 URL、未知课程 id、Nuxt 错误 | [apps/official-site/error.vue](../../apps/official-site/error.vue) | PENDING | — |

## 9. 共享布局随页复验

这张表记录跨页面影响，不代替逐页表。源码范围调整或共享修复后由主 Agent 添加受影响页面清单与复验收据。

| 检查编号 | 共享入口 | 源文件 | 当前状态 | 需复验的范围 |
|---|---|---|---|---|
| SH-LW | 学习端 AuthLayout / AppShell / v2 样式 | [apps/learner-web/src/layouts/AuthLayout.vue](../../apps/learner-web/src/layouts/AuthLayout.vue)、[apps/learner-web/src/layouts/AppShell.vue](../../apps/learner-web/src/layouts/AppShell.vue)、[apps/learner-web/src/theme/v2-tokens.scss](../../apps/learner-web/src/theme/v2-tokens.scss)、[apps/learner-web/src/theme/v2-pages.scss](../../apps/learner-web/src/theme/v2-pages.scss) | PENDING | 认证三页；已审业务页的导航/搜索/消息弹窗、断点、主题、焦点 |
| SH-MB | 移动页眉 / 旧公共样式 / v2 token | [apps/mobile/src/components/MobilePageHeader.vue](../../apps/mobile/src/components/MobilePageHeader.vue)、[apps/mobile/src/uni.scss](../../apps/mobile/src/uni.scss)、[apps/mobile/src/theme/v2-tokens.scss](../../apps/mobile/src/theme/v2-tokens.scss) | PENDING | 页眉、tab、滚动、密码按钮、主题、旧选择器覆盖 |
| SH-AD | 管理壳 / Element Plus 适配 / v2 样式 | [apps/admin-web/src/App.vue](../../apps/admin-web/src/App.vue)、[apps/admin-web/src/styles.css](../../apps/admin-web/src/styles.css)、[apps/admin-web/src/styles/v2-console.css](../../apps/admin-web/src/styles/v2-console.css)、[apps/admin-web/src/styles/v2-tokens.css](../../apps/admin-web/src/styles/v2-tokens.css) | PENDING | 导航/搜索、权限、移动抽屉、表格横滚、teleport 弹窗、主题 |
| SH-OS | 官网壳 / 页眉页尾 / 弹窗 | [apps/official-site/layouts/default.vue](../../apps/official-site/layouts/default.vue)、[apps/official-site/components/SiteHeader.vue](../../apps/official-site/components/SiteHeader.vue)、[apps/official-site/components/SiteFooter.vue](../../apps/official-site/components/SiteFooter.vue)、[apps/official-site/components/SiteModal.vue](../../apps/official-site/components/SiteModal.vue) | PENDING | 响应式导航、锚点、弹窗、CTA、语言/主题与长页 |

## 10. 初始接手记录

- 2026-10-13：依据当前正式路由与源文件建立索引；94 个唯一页面源组件、别名/设置/兼容入口均列出。LW-001 设置为 IN_REVIEW，其余 PENDING。
- 首轮源码候选问题已交主 Agent：学习端登录触摸目标与表单定位、两端找回密码切步遗留错误、Web/mobile 高对比 token 缺项、业务 v2 focus token 值类型、移动旧密码定位样式。这里是待复现线索，不是浏览器已确认缺陷或页面完成证据。
- 索引建立阶段没有修改业务签收、没有执行部署、没有操作 Git，也没有记录任何页面 UI_VERIFIED/PUSHED_SCOPED。
