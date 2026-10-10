# cloudstudy 接管卡账（Takeover Card Ledger）— dev-redesign

> 建立：2026-10-10（Asia/Shanghai），接管方：Grok Bot 自主调度（grok CLI 轮次，screen `cs-<round>`）。
> 本页是调度用账本，**不替代** [CURRENT-PROGRESS](../06-design/v2-980plus/redesign/CURRENT-PROGRESS.md) 的验收事实，也不改写任何历史证据或 Luna 原件。状态冲突时以 CURRENT-PROGRESS 与证据原件为准。

## 0. 114 卡墙恢复结论

- 原 114 卡墙（含状态工具/revision27）**未找回**：仓库文档、evidence、git 历史中只存在 R1-001～R1-029 的可读定义（[dev-plan-R1](../06-design/v2-980plus/redesign/dev-plan-R1.md)、[29 卡导航](../06-design/v2-980plus/redesign/recovery-20261007/README.md)）；[恢复核对报告](../06-design/v2-980plus/redesign/recovery-20261007/recovery-report.md)结论相同。GAP-WALL-114 保持 OPEN。
- 编号规则：卡号沿 `R1-001…` 连续。只在进站时从该站真实 BC/IC 拆卡，不按 114 减已有卡数补空卡。2026-10-10 IT-3 从 BC-023…032、BC-199 与 IC-013…021/029 拆出 R1-030…042（13 张），接在 R1-029 之后。2026-10-11 IT-4 从 BC-033…062、BC-203 与 IC-022…024/030…032 拆出 R1-043…059（17 张）。同日 IT-5 从 BC-063…070 与 IC-012/033 拆出 R1-060…069（10 张）。2026-10-11 IT-6 从 BC-071…084、BC-200、BC-204…207 与 IC-040…046 拆出 R1-070…090（21 张）。IT-7 仍待进站再拆。GAP-WALL-114 保持 OPEN。

## 1. 计数（2026-10-11）

| 类别 | 数量 | 说明 |
|---|---|---|
| 已定义卡 | 90 | R1-001～090。R1-060～069 是 IT-5，R1-070～090 是 IT-6 |
| 卡范围独立验收（ACCEPTED_CARD_SCOPE） | 6 | R1-002/003/004/005/006/008 |
| 源码交付、未独立终审 | 2 | R1-001（SOURCE_SCOPED_PASS）、R1-007 |
| 已实现/回放、待站级签收 | 82 | R1-009～090。R1-058/059 的 r5 重放未签。R1-068/069 与 R1-089/090 的 r6 重放未签 |
| 已定义、浏览器站未跑 | 0 | R1-068、R1-069 与 R1-089、R1-090 已于 r6 跑过，见第 3 节 |
| 已跑、站级未通过 | 0 | R1-058/059 的较早后缀 `614f3d8b` 仍是补救 FAIL。其后 `c460b646` 未签字 PASS，不改写旧证据。IT-6 较早失败后缀保留，通过后缀是 `ad30b8bc` |
| 已定义、未实现 | 0 | R1-070～090 已实现并走过浏览器站。IT-7 仍未拆，不算进未实现 |
| 未定义（待按站拆卡） | IT-7 | 不按剩余张数补卡 |
| 跳过 | 5 | 原五行保留。R1-068/069 已追加实际结论，原行不删 |

## 2. 已定义卡

| 卡 | 站 | 内容 | 状态 | 浏览器测试项 |
|---|---|---|---|---|
| R1-001 | IT-1 | 官网 11 页空态+注册 CTA | 源码交付 SCOPED_PASS；it1-named-gates 11×2 与 CTA PASS（未签）；原完整验收缺失 | 11 页×2 视口 200、CTA 到 /register |
| R1-002 | IT-1 | 注册 201+受限会话 | ACCEPTED_CARD_SCOPE | Web/H5 注册直达 IAM TLS |
| R1-003 | IT-1 | 注册幂等 | ACCEPTED_CARD_SCOPE；it1-named-gates 同键 201 / 异体 409（未签） | 同键重放 |
| R1-004 | IT-1 | 登录/刷新/撤销 | ACCEPTED_CARD_SCOPE；本轮只复验登录直达 IAM | 登录、两次刷新 |
| R1-005 | IT-1 | 多设备+踢出 | ACCEPTED_CARD_SCOPE；it1-named-gates 页面踢出后刷新 401（未签） | 被踢 401 |
| R1-006 | IT-1 | 成人门 | ACCEPTED_CARD_SCOPE；it1-named-gates 未成年 REJECTED（按钮不提交年份，未签） | 成年通过/未成年拒绝 |
| R1-007 | IT-1 | 门未过等待态 | 源码+单测交付；it1-named-gates 无权限页与退出 PASS（未签），无独立终审 | 置灰+退出键 |
| R1-008 | IT-1 | 三同意动态版 | ACCEPTED_CARD_SCOPE | 同意签署 |
| R1-009 | IT-1 | 撤回回收 403 | it1-named-gates：PUT 撤回后目标 403（无页面按钮，未签） | 撤回后学习口 403 |
| R1-010 | IT-1 | 画像+草稿续填 | it1-recheck 与 it1-named-gates 读回 PASS（未签） | 停 learner 再启读回 |
| R1-011 | IT-1 | 3 击达定级 | it1-recheck 与 it1-named-gates PASS（未签） | 新号 3 击到定级 |
| R1-012 | IT-1 | 重置不枚举 202 | it1-recheck 与 it1-named-gates PASS（未签） | 重置页 |
| R1-013 | IT-1 | 门拒清理重进 | it1-named-gates 两端 bounced PASS（未签） | 拒后重进 |
| R1-014 | IT-1 | L1 干净库重放 | R1-014/summary.json PASS（四套库，未签） | 全卡回归 |
| R1-015 | IT-1 | 注册/登录/重置三页 | it1-recheck 与 it1-named-gates PASS（未签） | 三页按幕 |
| R1-016 | IT-1 | 门说明+同意文案 | it1-named-gates 对稿 PASS（未签） | 文案对稿 |
| R1-017 | IT-1 | 画像字段+引导条 | it1-named-gates 引导条与成人核验行 PASS（未签） | 按钮去定级 |
| R1-018 | IT-2 | 前端切 P1 新口 | 实现；it2-browser PASS（未签） | 10 道题干 |
| R1-019 | IT-2 | B25 写口下线 | 实现；旧写口 404 | 新开 404 |
| R1-020 | IT-2 | checkpoint 顺序锁 | 实现/回放 | — |
| R1-021 | IT-2 | 规则判分 | it2-score-browser 奇正偶误行内反馈 PASS（未签） | 行内反馈 |
| R1-022 | IT-2 | 报告快照 | 实现；it2-browser 报告生成 | 报告页 |
| R1-023 | IT-2 | 跳过 fast-track | 实现/回放 | 跳过 |
| R1-024 | IT-2 | 重测 | 实现；公开重测 201 | 重测按钮 |
| R1-025 | IT-2 | 题库种子 10 | 实现 | — |
| R1-026 | IT-2 | B3 种子 5 | 实现 | — |
| R1-027 | IT-2 | 断网续答 | 实现/回放 | 重进续题号 |
| R1-028 | IT-2 | 定级交互验收 | it2-score-browser 覆盖计分与重测幕；整站幕幕对稿仍未签 | 幕幕对稿 |
| R1-029 | IT-2 | L2 干净库重放 | 原件 26 PASS / 3 NOT_RUN 不回写；其后公开重测 201 与浏览器计分已有证据，仍未出站 | 全绿归档 |
| R1-030 | IT-3 | ensure 正式报告 pin 与计划 | 已实现，待站级签收 | 正式报告后读到 planId |
| R1-031 | IT-3 | ensure 幂等重放 | 已实现，待站级签收 | 同键重放、异体 409 |
| R1-032 | IT-3 | 首页计划横幅 | 已实现，待站级签收 | Web/H5 两视口横幅 |
| R1-033 | IT-3 | 一句话计划解释 | 已实现，待站级签收 | 解释来自服务端 |
| R1-034 | IT-3 | 今日任务与 practiceRef | 已实现，待站级签收 | 有指针才练习 |
| R1-035 | IT-3 | 今日空态分流 | 已实现，待站级签收 | 五态文案与动作 |
| R1-036 | IT-3 | 目标确认后版本锁重排 | 已实现，待站级签收 | 409 与完成行保留 |
| R1-037 | IT-3 | Web/H5 同一计划读回 | 已实现，待站级签收 | 同 planId/planVersion |
| R1-038 | IT-3 | 输入快照只追加版本 | 已实现，待站级签收 | 不原地改历史快照 |
| R1-039 | IT-3 | 首次学习按完成状态引导 | 已实现，待站级签收 | 完成后引导收起 |
| R1-040 | IT-3 | 书架、搜索与续学 | 已实现，待站级签收 | 三态搜索与有效检查点 |
| R1-041 | IT-3 | 计划今日交互验收 | 浏览器对稿 PASS，未签。后缀 d2012bf6。lunaStamp=false | 幕幕对稿 |
| R1-042 | IT-3 | L3 干净库重放 | 干净库重放 PASS，未签。报告→横幅→今日→重排。lunaStamp=false | 报告→横幅→今日任务 |
| R1-043 | IT-4 | 练习建单锁定内容码与版本，重复开单复用同一进行中会话 | 服务端复用已单测；Web 同类型稳定键；H5 先读本地进行中会话。lunaStamp=false | Web/H5 连续点同一练习，会话号不变 |
| R1-044 | IT-4 | 语法 3 道、阅读 2 道只回 FULL/ZERO；题包不足为 CLOSED_MISSING | 服务端题包已单测；Web/H5 按已加载题数或关闭文案显示。lunaStamp=false | 真实题数或关闭说明 |
| R1-045 | IT-4 | 保存回执先于文字反馈，下一题明确 | 服务端回执顺序已单测；Web/H5 先显示已保存，再显示正确或需要再练，并写明下一题。lunaStamp=false | 作答后看到文字反馈和下一题 |
| R1-046 | IT-4 | 检查点恢复已接收题；内容下线停止加载 | 续练停在已接收题；CONTENT_OFFLINE 停止加载并 409。Web/H5 已单测。lunaStamp=false | 返回再进停在已确认题 |
| R1-047 | IT-4 | 旧会话沿用建单规则；attempt 不可改；同键同一回执 | 规则版本钉在建单内容码和版本上；改写 attempt 为 409。两端提交有进行中锁。lunaStamp=false | 重复点提交不推进两题 |
| R1-048 | IT-4 | 词汇缺发音不可播放；听力口语写作未开放不占主导航 | 无音频不渲染播放；主导航已去掉听力、跟读、写作。旧页有出口。lunaStamp=false | 没有假播放；关闭能力有说明 |
| R1-049 | IT-4 | 练习完成只写一条 outbox；成长未开放不显示奖励 | 完成键 practice-complete:{sessionId}；rewardVisible=false。lunaStamp=false | 完成后没有奖励提示 |
| R1-050 | IT-4 | 只有 ZERO 入错题本；补救按来源去重 | 非 ZERO 不入本；同一 sourceAttemptId 不重复合并。lunaStamp=false | 错题本只有答错项 |
| R1-051 | IT-4 | 无变式为 NO_VARIANT；通过只销本次补救 | 无关联变式返回 NO_VARIANT。销账文案是“本次补救已通过”。lunaStamp=false | 补救完成页写本次通过 |
| R1-052 | IT-4 | 掌握度不可直写；不足为 WEAKNESS_UNKNOWN；同一目标归并 | 自带 stage 为 409「这个操作现在不能用」。无证据为 WEAKNESS_UNKNOWN。同一目标只留先到的一条。lunaStamp=false | 弱点空态和有证据列表分开 |
| R1-053 | IT-4 | 空本区分尚未练习和已全对；跨端同投影；中断恢复同一补救 | 空态分开 NOT_PRACTICED 与 ALL_CORRECT。投影 IT4-MISTAKE-1。remediationId 稳定。lunaStamp=false | 空本文案一致，返回仍是同一任务 |
| R1-054 | IT-4 | SRS 保持 SM2_Q03_V1；超预算顺延，不堆欠账 | 到期项都留在今日列表。超预算为 DEFERRED，不记欠账。算法仍是 SM2_Q03_V1。lunaStamp=false | 今日任务能看到到期复习 |
| R1-055 | IT-4 | 拒绝自报写 stage；完成事件同键不重复推进 | 409 码仍是 UNTRUSTED_REVIEW_EVIDENCE。界面写成“这个操作现在不能用”。同键不推进 stage。lunaStamp=false | 复习页没有直接标完成的写入 |
| R1-056 | IT-4 | 历史只显示完成和延期；遗忘只来自可信结果；空队列三态 | 历史只留 COMPLETED 与 DEFERRED。空队列三态分开。重试或不信任不增加 lapse。lunaStamp=false | 复习历史和空队列三态 |
| R1-057 | IT-4 | 跨端同一 stage；对账按来源唯一性，不要求行数相等 | 投影 IT4-STAGE-1。旧版本不覆盖。来源唯一时允许行数不同。lunaStamp=false | 两端读回同一 stage |
| R1-058 | IT-4 | 练错复交互验收 | 后缀 `614f3d8b` 建单到回执 PASS、补救 FAIL。其后 `c460b646`：Web/H5、1280 与 390，补救和今日复习 PASS。lunaStamp=false | 错题页出现可点的补救 |
| R1-059 | IT-4 | L4 干净库重放 | 后缀 `614f3d8b` 补救 FAIL，目录保留。其后 `c460b646`：会话 6、作答 4、错题 4、ZERO 4、投影 4，六个 `r5_it4_` 库已删。lunaStamp=false | 干净库上从建单走到今日复习 |
| R1-060 | IT-5 | BC-063 定级报告卡 | 跳过不显示正式分；已测评的报告和快照同一版本文案。Web/H5 已接。单测通过。lunaStamp=false | 定级页看到报告卡 |
| R1-061 | IT-5 | BC-064 日报/周报窗口与状态 | 上海学习日窗口。从未学习、未就绪、空窗、生成中、部分、就绪、失败分开。旧未核验字段不升成成绩。lunaStamp=false | 报告页看到统计范围和状态 |
| R1-062 | IT-5 | BC-065 有效时长 | 只累计非暂停、非后台的已记录时段。没有时段时不拿间隔冒充。lunaStamp=false | 时长说明可见 |
| R1-063 | IT-5 | BC-066 新学/复习不双计 | 复习标记优先。缺车道或缺标识不计，并标成部分数据。lunaStamp=false | 新学和复习分开 |
| R1-064 | IT-5 | BC-067 规则建议 | 建议来源固定为 RULE。页面写明不是已开放的 AI。lunaStamp=false | 建议和依据可见 |
| R1-065 | IT-5 | BC-068 分享只读链接 | 32 位随机引用，7 天失效，只存公开字段。主人可撤销。公开读不到主体。lunaStamp=false | 生成链接、撤销、匿名打开 |
| R1-066 | IT-5 | BC-069 未学习与统计未就绪 | 这两态计数为空，officialScore 为 false，不显示能力零分。lunaStamp=false | 空态文案不是零分 |
| R1-067 | IT-5 | BC-070 历史报告不改写 | 封存后的更正是新版本，摘要重算，不改已封存的一版。lunaStamp=false | 更正后能看到上一版 |
| R1-068 | IT-5 | IC-012/IC-033 交互验收 | 后缀 `1f244c3b`：Web/H5、1280 与 390，定级卡、日/周状态、有效时长、规则建议、分享与撤销 PASS。空态没有能力零分。lunaStamp=false | 幕幕对稿 |
| R1-069 | IT-5 | 干净库重放 | 后缀 `1f244c3b`：四个空库摘要相同，学习交互 0，分享 4 且都已撤销。六个 `r6_it5_` 库已删。lunaStamp=false | 空库上同一摘要 |
| R1-070 | IT-6 | BC-071 建草稿 | 已实现，待签收。提交 `d3945cc1`。浏览器后缀 `ad30b8bc`：建稿 202，失败不留幽灵草稿。lunaStamp=false | 建稿后能读回草稿 |
| R1-071 | IT-6 | BC-072 版本锁编辑 | 已实现，待签收。提交 `d3945cc1`。后缀 `ad30b8bc` 冲突 409 `DRAFT_CONFLICT`。lunaStamp=false | 冲突不覆盖 |
| R1-072 | IT-6 | BC-073 无权边界 | 已实现，待签收。提交 `d3945cc1`、`74cd7e50`。不存在与存在都是同一 403，页面有回到有权页面。lunaStamp=false | 无权限没有绕过按钮 |
| R1-073 | IT-6 | BC-074 送审缺项 | 已实现，待签收。提交 `d3945cc1`。听力一次列出版权、媒体、报告。lunaStamp=false | 缺项列表 |
| R1-074 | IT-6 | BC-075 双签初审 | 已实现，待签收。提交 `d3945cc1`。简审做初审得到 409 `SIMPLE_NO_SECOND_SIGNATURE`。lunaStamp=false | 简审没有第二审 |
| R1-075 | IT-6 | BC-076 双签终审 | 已实现，待签收。提交 `d3945cc1`。自审 403，同一人终审 409，另一人终审 200，第三人 409。lunaStamp=false | 终审人与编辑不同 |
| R1-076 | IT-6 | BC-077 发布事实 | 已实现，待签收。提交 `d3945cc1`。发布后目录是 PUBLISHING，学习端还看不到标题。lunaStamp=false | 发布后学习端尚未可见 |
| R1-077 | IT-6 | BC-078 目录投影 | 已实现，待签收。提交 `d3945cc1`。同步成功才可见，失败保持隐藏。lunaStamp=false | 学习端只见已同步版本 |
| R1-078 | IT-6 | BC-079 下架 | 已实现，待签收。提交 `d3945cc1`、`f2512c5a`。普通下架 200；强制停止后学习端读取 409。lunaStamp=false | 两种下架文案不同 |
| R1-079 | IT-6 | BC-080 回滚 | 已实现，待签收。提交 `d3945cc1`。不合格 409，合格 202。lunaStamp=false | 回滚前看到校验 |
| R1-080 | IT-6 | BC-081 版权绑定 | 已实现，待签收。提交 `d3945cc1`。版本对不上是 409 `RIGHTS_NOT_BOUND`。lunaStamp=false | 只有提案号不能发布 |
| R1-081 | IT-6 | BC-082 审核报告 | 已实现，待签收。提交 `d3945cc1`。模式不一致是 409 `REPORT_NOT_BOUND`。lunaStamp=false | 换版后旧报告无效 |
| R1-082 | IT-6 | BC-083 旧 B3 清单 | 已实现，待签收。提交 `d3945cc1`。清单 113+2，mutated=false，没有重放清理。lunaStamp=false | 无独立用户幕 |
| R1-083 | IT-6 | BC-084 简审档 | 已实现，待签收。提交 `d3945cc1`、`74cd7e50`。默认 SIMPLE，页面可切到双签。lunaStamp=false | 页面写明当前模式 |
| R1-084 | IT-6 | BC-200 在学锁定 | 已实现，待签收。提交 `d3945cc1`、`74cd7e50`、`f2512c5a`。新版本不替换锁定的第 1 版；强制停止后这一版也不能再读。lunaStamp=false | 学习端看到锁定说明 |
| R1-085 | IT-6 | BC-204 管理登录 | 已实现，待签收。提交 `74cd7e50`。失败文案不说明账号是否存在，登录后回到有权页。lunaStamp=false | 登录失败文案 |
| R1-086 | IT-6 | BC-205 仪表盘 | 已实现，待签收。提交 `74cd7e50`。发布口径是暂无，没有示例数。lunaStamp=false | 不出现示例数 |
| R1-087 | IT-6 | BC-206 权限只读 | 已实现，待签收。提交 `74cd7e50`。只读页没有通过、驳回或发布。lunaStamp=false | 无权回到有权页 |
| R1-088 | IT-6 | BC-207 媒体边界 | 已实现，待签收。提交 `d3945cc1`、`74cd7e50`。字节没接上时不能显示成可发布。lunaStamp=false | 边界说明 |
| R1-089 | IT-6 | IC-040…046 交互验收 | 已跑，待签收。证据 `129fbcd1`，后缀 `ad30b8bc`：Web 与 H5、1280 与 390，`summary` PASS。lunaStamp=false | Web/H5，1280 与 390 |
| R1-090 | IT-6 | 干净库重放 | 已跑，待签收。后缀 `ad30b8bc` 两次简审指纹相同。六个 `r6_it6_` 库已删。lunaStamp=false | 干净库走完发布链 |

## 3. 站级状态

| 站 | 状态 | 出站门 |
|---|---|---|
| IT-1 | Luna REJECT/FAIL（基线 69bea68b）；复检 ce0aa296 PASS 未签；it1-named-gates / R1-014 PASS，自审 PASS_WITH_GAPS 未签。**待 Luna 签收（外部依赖）**，不再当作本轮开工阻塞 | 独立签收。具名门浏览器已有，仍缺 Luna。不改 `lunaStamp`，不改 station-acceptance 原件 |
| IT-2 | BLOCKED；it2-station PASS_WITH_NOT_RUN；it2-score-browser 10 题 PASS 未签。**待 Luna 签收（外部依赖）**。三个独立 owner schema 的 IAM 真签出站仍未完成：本轮 `services:run` 只有 HTTP IAM，没有在不写钥匙串的前提下换上 r1 TLS | 三个独立 owner schema 的 IAM 真签出站。原 3 个 NOT_RUN 不回写 |
| IT-3 计划今日 | R1-030…042 浏览器走查 PASS，后缀 d2012bf6。自审 PASS_WITH_GAPS。lunaStamp=false | BC-023…032/199 |
| IT-4 练错复 | R1-043…057 已实现并单测。浏览器后缀 `614f3d8b`：建单、作答、回执 PASS，补救 FAIL，`summary` FAIL，目录保留。其后后缀 `c460b646`：补救到今日复习 PASS，`summary` PASS，六个 `r5_it4_` 库已删。accepted / it4Outbound / lunaStamp 仍是 false。不是出站签收 | BC-033…062/203 |
| IT-5 报告 | R1-060…069 已实现。浏览器后缀 `1f244c3b`：`summary` PASS，链 PASS，四个空库同一摘要，六个 `r6_it5_` 库已删。较早后缀 `6cb7e018` 分享打开 FAIL，目录保留。accepted / it5Outbound / lunaStamp 仍是 false。不是出站签收 | BC-063…070 |
| IT-6 双审 | R1-070…090 已实现。浏览器后缀 `ad30b8bc`：`summary` PASS，链 PASS。六个 `r6_it6_` 库已删。较早后缀 `cd0b278e`、`7f6d6931`、`072a1ca2`、`944d414b` 保留。accepted / it6Outbound / lunaStamp 仍是 false。不是出站签收 | BC-071…084/200/204…207 |
| IT-7 收口 | 未拆卡 TODO | BC-085…093/185/186/188…198/208 |

## 4. 跳过记录

| 编号 | 原因 | 证据 | 日期 |
|---|---|---|---|
| support-real-gateway.e2e | 真实 Gateway 工单 UAT 要向 `https://127.0.0.1:18087` 注册。本轮 `pnpm services:run` 的 IAM 是 HTTP，HTTPS 连接失败。r1 测试 CA 不在磁盘上。按约束不把证书写入 macOS 钥匙串，也不改该用例去忽略证书错误。已于 r3 补跑通过 | `evidence/redesign/2026-10-10/unit-tests-r2/report.md`；失败阶段 `register`，`registered:false`，清理 `ACCOUNT:0`。补跑：`evidence/redesign/2026-10-11/r3-support-gateway/summary.json` | 2026-10-10 |
| R1-041 / R1-042 | IT-3 真实 Chrome 走查和干净库重放要向 HTTPS IAM 注册。本轮监督进程里的 IAM 只听 HTTP `127.0.0.1:18087`。磁盘上没有 `iam-server.p12` / `test-ca.pem`，`tls-harness` 不能签发。按约束不把证书写入 macOS 钥匙串，也不把客户端改成忽略证书或改打 HTTP。因此当时没有声称报告→横幅→今日任务的浏览器链通过。已于 r3 补跑通过 | `evidence/redesign/2026-10-10/it3-plan-today/report.md`。补跑：`evidence/redesign/2026-10-11/it3-browser/report.md`，后缀 `d2012bf6`，summary PASS | 2026-10-10 |
| local-development-gates | 已过：`pnpm typecheck`（turbo 7/7，exit 0）、`pnpm test`（turbo 只执行 `@englishflow/i18n` 11 项，缓存命中，exit 0；它不包含两端顶层 299 项）、`pnpm contracts:validate`（468 operations，exit 0）、`pnpm dod:check`（5 项 PASS，`strict:false`，exit 0）。未整跑：`pnpm build`、mobile `build:h5` / `build:app`、`mvn -B -ntp -f pom.xml test`、`pnpm test:p1r`。全量 Maven 会连共享库 `127.0.0.1:13306` 的 `iam_service` 等 schema，本轮不在共享库上跑集成上下文，也不为它新建或删除库。P1R 单文件 4 项失败在 `eee50c76` 上同样存在，不改冻结 hash。文档写明 2026-10-06 的 P1R 完整回归仍有 26 项失败 | `evidence/redesign/2026-10-10/it3-plan-today/report.md` | 2026-10-10 |
| R1-045～059 | 每张卡都要服务端、Web、H5 和单测。R1-044 已把语法 3 道、阅读 2 道和 CLOSED_MISSING 落地。后面的保存回执、检查点、错题、补救、SRS、对账和 L4 浏览器重放没有一条可以只改文案就完成，本轮不补空实现。R1-058/059 没有新的浏览器证据。已于 r4 处理：R1-045～057 已实现；R1-058/059 已跑，结论 FAIL。 | R1-044 单测：`GrammarReadingPackTest`、`B10GrammarReadingPackTest`、`apps/learner-web/tests/grammar-reading-pack.test.mjs`。r4 证据：`evidence/redesign/2026-10-11/it4-browser`（后缀 `aa28b151`，建单 410）与 `evidence/redesign/2026-10-11/it4-browser-614f3d8b`（建单到回执 PASS，补救 FAIL）。 | 2026-10-11 |
| R1-068 / R1-069 | 报告交互验收和干净库浏览器重放要在含报告期与分享路由的服务包上，用 HTTPS IAM 和 `r5_` 干净库走两端。本轮证据栈 JAR 打在 IT-5 代码之前（2026-10-11T04:22:22+08:00）。node 回归时 18070 与 18183 被这套旧 Gateway 和 H5 占用，回归结束后没有再打包并拉起新的证据栈。领域单测不能代替浏览器站。 | `LearningPeriodReportTest.emptyLibraryReplaysTheSameDigest`。浏览器站没有新目录。 | 2026-10-11 |
| R1-068 / R1-069 结论 | 已用含报告期与分享路由的包重跑。分享打开失败来自 MySQL 无时区时间戳，H5 周报按钮实际是 tab。修复后后缀 `1f244c3b` 的 `summary` 为 PASS。H5 390 有无类名元素多出 10px，文档横向溢出为 0。外层报告仍是历史未核验的 PARTIAL。`b10_assessment_session` 计数是 0，定级卡来自页面读回。`lunaStamp` 仍是 false。这不是签收。 | `evidence/redesign/2026-10-11/it5-browser-r6-1f244c3b/summary.json`。失败原件 `evidence/redesign/2026-10-11/it5-browser-r6-6cb7e018/` 不改写。 | 2026-10-11 |

## 5. 轮次记录

| 轮次 | screen | 范围 | 结果 |
|---|---|---|---|
| r1 | cs-r1 | IT-1 具名门补齐与复检 | 浏览器与 R1-014 PASS；自审 PASS_WITH_GAPS；未出站、未签 |
| r2 | cs-r2 | 顶层 Node 测试修复；IT-3 拆成 R1-030…042 并落地 R1-030…040 | 同一命令现为 299 项、298 通过、1 失败，失败文件仍是 `support-real-gateway.e2e`。R1-041/042 因 IAM 只有 HTTP 未跑浏览器和干净库。全仓 local-development 门禁未整跑。`lunaStamp` 仍为 false |
| r3 | cs-r3 | 恢复本地 IAM HTTPS；补跑工单 UAT；IT-3 浏览器走查；IT-4 拆成 R1-043…059，落地 R1-043 与 R1-044 | 浏览器后缀 `d2012bf6` summary PASS。工单在证据栈里补跑 PASS。自审 PASS_WITH_GAPS。`lunaStamp` 仍为 false。R1-044 题包单测通过。R1-045～059 未实现，见第 4 节。顶层 `node --test --test-concurrency=1 apps/mobile/tests/*.mjs apps/learner-web/tests/*.mjs` 在只开 H5 时为 301 项、300 通过、1 失败，失败文件仍是 `support-real-gateway.e2e`（预检未连上 Gateway）。其后的题包 node 测试另有 3 项通过。相对 r2 的 299/298/1，多出的 2 项是 R1-043 的复用锁，已通过 |
| r4 | cs-r4 | 实现 R1-045…057；IT-4 浏览器与干净库重放 | 浏览器后缀 `614f3d8b`：建单、作答、回执在 Web/H5、1280 与 390 PASS；补救 FAIL。库事实会话 6、作答 4、错题 4、ZERO 4，六个 `r4_it4_` 库已删。较早后缀 `aa28b151` 停在建单 410，目录保留。自审 FAIL，`lunaStamp` 仍为 false。assessment-service 单测 151 项、0 失败、2 跳过。同一顶层 node 命令在 H5 与 Gateway 已监听时为 345 项、344 通过、1 失败，失败文件仍是 `support-real-gateway.e2e`：注册超时，清理目标是 `r4_it4_20261011_iam_nodesuite`，没有写 `iam_service`。learner-web 与 mobile 类型检查通过。`pnpm contracts:validate` 为 468 operations。qida 名称计数前后都是 51，没有改这些容器 |
| r5 | cs-r5 | 接通 IT-4 补救投影；重跑 R1-058/059；拆并实现 IT-5 R1-060…069 | 补救投影提交 `c1fb7e64`。浏览器后缀 `c460b646`：`summary` PASS，链 PASS，会话 6、作答 4、错题 4、ZERO 4、投影 4，六个 `r5_it4_20261011_*_c460b646` 已删。`accepted` / `it4Outbound` / `lunaStamp` 仍为 false。`614f3d8b` 不改写。learning-service 199 项、0 失败、3 跳过。assessment-service 153 项、0 失败、2 跳过。Gateway 路由对测 6 项通过。契约审计仍是原有三项基线差（公开 365/404、`iam-account-deletions`、内部 66/67），摘要已与冻结值一致。同一顶层 node 命令在 H5 与 Gateway 监听时为 345 项、344 通过、1 失败，失败仍是 `support-real-gateway.e2e` 注册超时；清理目标 `r5_nodesuite_20261011_iam` 已删，18087 未监听，没有写 `iam_service`。learner-web 与 mobile 类型检查通过。`pnpm contracts:validate` 为 471 operations。R1-068/069 浏览器站未跑，见第 4 节。开始时运行中的 qida 名称是 51。收口时 `qida-dev-tsz` 仍在；`qida-auth-four-chain-20261011-c8d8c36ec0eb` 于 04:56:23 +08 退出，工作目录不在本仓库，本轮没有对它执行 stop 或 start |
| r6 | cs-r6 | 补跑 IT-5 浏览器站；拆并实现 IT-6 R1-070…090；跑浏览器站和回归 | IT-5 后缀 `1f244c3b`：`summary` PASS，提交 `26708119`、`308ac4f8`。IT-6 拆卡 `12e62e8f`，发布台 `d3945cc1`，两端页面 `74cd7e50`，强制停止 `f2512c5a`。浏览器后缀 `ad30b8bc`：`summary` PASS，链 PASS，Web 与 H5、1280 与 390。六个 `r6_it6_` 库已删。较早后缀 `cd0b278e`、`7f6d6931`、`072a1ca2`、`944d414b` 保留。`accepted` / `it6Outbound` / `lunaStamp` 仍为 false。113+2 只核对清单，没有重放清理。H5 390 文档横向溢出是 0，个别元素多出 10px 或 17px。learning-service 199 项、0 失败、3 跳过。assessment-service 153 项、0 失败、2 跳过。learner-web、mobile、admin-web 类型检查通过。`pnpm contracts:validate` 为 471 operations。同一顶层 node 命令在 H5、Gateway 与 HTTPS IAM 监听时为 348 项、348 通过、0 失败；`support-real-gateway.e2e` 通过，清理目标是 `r6_node_20261011_iam_8a9e94d1`，该库已删，没有写 `iam_service`。qida 名称计数前后都是 51，没有改这些容器。本轮服务已停，固定端口无监听 |

旧 grok 会话 PID 59062（01a120cd…）推送 e7cd6dd1 后空闲，保留运行但不再使用。本轮没有找到该进程，也没有向它发信号。
