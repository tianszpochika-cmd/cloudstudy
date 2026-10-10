# cloudstudy 接管卡账（Takeover Card Ledger）— dev-redesign

> 建立：2026-10-10（Asia/Shanghai），接管方：Grok Bot 自主调度（grok CLI 轮次，screen `cs-<round>`）。
> 本页是调度用账本，**不替代** [CURRENT-PROGRESS](../06-design/v2-980plus/redesign/CURRENT-PROGRESS.md) 的验收事实，也不改写任何历史证据或 Luna 原件。状态冲突时以 CURRENT-PROGRESS 与证据原件为准。

## 0. 114 卡墙恢复结论

- 原 114 卡墙（含状态工具/revision27）**未找回**：仓库文档、evidence、git 历史中只存在 R1-001～R1-029 的可读定义（[dev-plan-R1](../06-design/v2-980plus/redesign/dev-plan-R1.md)、[29 卡导航](../06-design/v2-980plus/redesign/recovery-20261007/README.md)）；[恢复核对报告](../06-design/v2-980plus/redesign/recovery-20261007/recovery-report.md)结论相同。GAP-WALL-114 保持 OPEN。
- 编号规则：卡号沿 `R1-001…` 连续。只在进站时从该站真实 BC/IC 拆卡，不按 114 减已有卡数补空卡。2026-10-10 IT-3 从 BC-023…032、BC-199 与 IC-013…021/029 拆出 R1-030…042（13 张），接在 R1-029 之后。2026-10-11 IT-4 从 BC-033…062、BC-203 与 IC-022…024/030…032 拆出 R1-043…059（17 张）。IT-5～IT-7 仍待进站再拆。GAP-WALL-114 保持 OPEN。

## 1. 计数（2026-10-11）

| 类别 | 数量 | 说明 |
|---|---|---|
| 已定义卡 | 59 | R1-001～059。R1-030～042 是 IT-3 拆卡，R1-043～059 是 IT-4 拆卡 |
| 卡范围独立验收（ACCEPTED_CARD_SCOPE） | 6 | R1-002/003/004/005/006/008 |
| 源码交付、未独立终审 | 2 | R1-001（SOURCE_SCOPED_PASS）、R1-007 |
| 已实现/回放、待站级签收 | 49 | R1-009～044 仍待站级签收。R1-045～057 本轮已实现并单测，浏览器站未签 |
| 已定义、本轮未跑站级 | 0 | R1-041/042 已于 2026-10-11 补跑。R1-058/059 已跑，见下一行 |
| 已跑、站级未通过 | 2 | R1-058、R1-059。建单到回执通过，补救未接通。见第 2 节 |
| 已定义、未实现 | 0 | R1-045～057 已实现。不按 114 减已有卡数补空卡 |
| 未定义（待按站拆卡） | IT-5～IT-7 | 不按剩余张数补卡 |
| 跳过 | 4 | 原四行保留。R1-045～059 那一行已于 r4 处理，没有新的跳过 |

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
| R1-058 | IT-4 | 练错复交互验收 | 已跑。Web/H5、1280 与 390：建单、作答、回执 PASS；补救 FAIL。lunaStamp=false | 错题页出现可点的补救 |
| R1-059 | IT-4 | L4 干净库重放 | 已跑。后缀 `614f3d8b`：会话 6、作答 4、错题 4、ZERO 4，库已删。补救链 FAIL。lunaStamp=false | 干净库上从建单走到今日复习 |

## 3. 站级状态

| 站 | 状态 | 出站门 |
|---|---|---|
| IT-1 | Luna REJECT/FAIL（基线 69bea68b）；复检 ce0aa296 PASS 未签；it1-named-gates / R1-014 PASS，自审 PASS_WITH_GAPS 未签。**待 Luna 签收（外部依赖）**，不再当作本轮开工阻塞 | 独立签收。具名门浏览器已有，仍缺 Luna。不改 `lunaStamp`，不改 station-acceptance 原件 |
| IT-2 | BLOCKED；it2-station PASS_WITH_NOT_RUN；it2-score-browser 10 题 PASS 未签。**待 Luna 签收（外部依赖）**。三个独立 owner schema 的 IAM 真签出站仍未完成：本轮 `services:run` 只有 HTTP IAM，没有在不写钥匙串的前提下换上 r1 TLS | 三个独立 owner schema 的 IAM 真签出站。原 3 个 NOT_RUN 不回写 |
| IT-3 计划今日 | R1-030…042 浏览器走查 PASS，后缀 d2012bf6。自审 PASS_WITH_GAPS。lunaStamp=false | BC-023…032/199 |
| IT-4 练错复 | R1-043…057 已实现并单测。浏览器后缀 `614f3d8b`：建单、作答、回执 PASS，补救 FAIL。`summary` FAIL。lunaStamp=false。不是出站签收 | BC-033…062/203 |
| IT-5 报告 | 未拆卡 TODO | BC-063…070 |
| IT-6 双审 | 未拆卡 TODO | BC-071…084/200/204…207 |
| IT-7 收口 | 未拆卡 TODO | BC-085…093/185/186/188…198/208 |

## 4. 跳过记录

| 编号 | 原因 | 证据 | 日期 |
|---|---|---|---|
| support-real-gateway.e2e | 真实 Gateway 工单 UAT 要向 `https://127.0.0.1:18087` 注册。本轮 `pnpm services:run` 的 IAM 是 HTTP，HTTPS 连接失败。r1 测试 CA 不在磁盘上。按约束不把证书写入 macOS 钥匙串，也不改该用例去忽略证书错误。已于 r3 补跑通过 | `evidence/redesign/2026-10-10/unit-tests-r2/report.md`；失败阶段 `register`，`registered:false`，清理 `ACCOUNT:0`。补跑：`evidence/redesign/2026-10-11/r3-support-gateway/summary.json` | 2026-10-10 |
| R1-041 / R1-042 | IT-3 真实 Chrome 走查和干净库重放要向 HTTPS IAM 注册。本轮监督进程里的 IAM 只听 HTTP `127.0.0.1:18087`。磁盘上没有 `iam-server.p12` / `test-ca.pem`，`tls-harness` 不能签发。按约束不把证书写入 macOS 钥匙串，也不把客户端改成忽略证书或改打 HTTP。因此当时没有声称报告→横幅→今日任务的浏览器链通过。已于 r3 补跑通过 | `evidence/redesign/2026-10-10/it3-plan-today/report.md`。补跑：`evidence/redesign/2026-10-11/it3-browser/report.md`，后缀 `d2012bf6`，summary PASS | 2026-10-10 |
| local-development-gates | 已过：`pnpm typecheck`（turbo 7/7，exit 0）、`pnpm test`（turbo 只执行 `@englishflow/i18n` 11 项，缓存命中，exit 0；它不包含两端顶层 299 项）、`pnpm contracts:validate`（468 operations，exit 0）、`pnpm dod:check`（5 项 PASS，`strict:false`，exit 0）。未整跑：`pnpm build`、mobile `build:h5` / `build:app`、`mvn -B -ntp -f pom.xml test`、`pnpm test:p1r`。全量 Maven 会连共享库 `127.0.0.1:13306` 的 `iam_service` 等 schema，本轮不在共享库上跑集成上下文，也不为它新建或删除库。P1R 单文件 4 项失败在 `eee50c76` 上同样存在，不改冻结 hash。文档写明 2026-10-06 的 P1R 完整回归仍有 26 项失败 | `evidence/redesign/2026-10-10/it3-plan-today/report.md` | 2026-10-10 |
| R1-045～059 | 每张卡都要服务端、Web、H5 和单测。R1-044 已把语法 3 道、阅读 2 道和 CLOSED_MISSING 落地。后面的保存回执、检查点、错题、补救、SRS、对账和 L4 浏览器重放没有一条可以只改文案就完成，本轮不补空实现。R1-058/059 没有新的浏览器证据。已于 r4 处理：R1-045～057 已实现；R1-058/059 已跑，结论 FAIL。 | R1-044 单测：`GrammarReadingPackTest`、`B10GrammarReadingPackTest`、`apps/learner-web/tests/grammar-reading-pack.test.mjs`。r4 证据：`evidence/redesign/2026-10-11/it4-browser`（后缀 `aa28b151`，建单 410）与 `evidence/redesign/2026-10-11/it4-browser-614f3d8b`（建单到回执 PASS，补救 FAIL）。 | 2026-10-11 |

## 5. 轮次记录

| 轮次 | screen | 范围 | 结果 |
|---|---|---|---|
| r1 | cs-r1 | IT-1 具名门补齐与复检 | 浏览器与 R1-014 PASS；自审 PASS_WITH_GAPS；未出站、未签 |
| r2 | cs-r2 | 顶层 Node 测试修复；IT-3 拆成 R1-030…042 并落地 R1-030…040 | 同一命令现为 299 项、298 通过、1 失败，失败文件仍是 `support-real-gateway.e2e`。R1-041/042 因 IAM 只有 HTTP 未跑浏览器和干净库。全仓 local-development 门禁未整跑。`lunaStamp` 仍为 false |
| r3 | cs-r3 | 恢复本地 IAM HTTPS；补跑工单 UAT；IT-3 浏览器走查；IT-4 拆成 R1-043…059，落地 R1-043 与 R1-044 | 浏览器后缀 `d2012bf6` summary PASS。工单在证据栈里补跑 PASS。自审 PASS_WITH_GAPS。`lunaStamp` 仍为 false。R1-044 题包单测通过。R1-045～059 未实现，见第 4 节。顶层 `node --test --test-concurrency=1 apps/mobile/tests/*.mjs apps/learner-web/tests/*.mjs` 在只开 H5 时为 301 项、300 通过、1 失败，失败文件仍是 `support-real-gateway.e2e`（预检未连上 Gateway）。其后的题包 node 测试另有 3 项通过。相对 r2 的 299/298/1，多出的 2 项是 R1-043 的复用锁，已通过 |
| r4 | cs-r4 | 实现 R1-045…057；IT-4 浏览器与干净库重放 | 浏览器后缀 `614f3d8b`：建单、作答、回执在 Web/H5、1280 与 390 PASS；补救 FAIL。库事实会话 6、作答 4、错题 4、ZERO 4，六个 `r4_it4_` 库已删。较早后缀 `aa28b151` 停在建单 410，目录保留。自审 FAIL，`lunaStamp` 仍为 false。assessment-service 单测 151 项、0 失败、2 跳过。同一顶层 node 命令在 H5 与 Gateway 已监听时为 345 项、344 通过、1 失败，失败文件仍是 `support-real-gateway.e2e`：注册超时，清理目标是 `r4_it4_20261011_iam_nodesuite`，没有写 `iam_service`。learner-web 与 mobile 类型检查通过。`pnpm contracts:validate` 为 468 operations。qida 名称计数前后都是 51，没有改这些容器 |

旧 grok 会话 PID 59062（01a120cd…）推送 e7cd6dd1 后空闲，保留运行但不再使用。
