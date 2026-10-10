# cloudstudy 接管卡账（Takeover Card Ledger）— dev-redesign

> 建立：2026-10-10（Asia/Shanghai），接管方：Grok Bot 自主调度（grok CLI 轮次，screen `cs-<round>`）。
> 本页是调度用账本，**不替代** [CURRENT-PROGRESS](../06-design/v2-980plus/redesign/CURRENT-PROGRESS.md) 的验收事实，也不改写任何历史证据或 Luna 原件。状态冲突时以 CURRENT-PROGRESS 与证据原件为准。

## 0. 114 卡墙恢复结论

- 原 114 卡墙（含状态工具/revision27）**未找回**：仓库文档、evidence、git 历史中只存在 R1-001～R1-029 的可读定义（[dev-plan-R1](../06-design/v2-980plus/redesign/dev-plan-R1.md)、[29 卡导航](../06-design/v2-980plus/redesign/recovery-20261007/README.md)）；[恢复核对报告](../06-design/v2-980plus/redesign/recovery-20261007/recovery-report.md)结论相同。GAP-WALL-114 保持 OPEN。
- 编号规则：卡号沿 `R1-001…` 连续。只在进站时从该站真实 BC/IC 拆卡，不按 114 减已有卡数补空卡。2026-10-10 IT-3 从 BC-023…032、BC-199 与 IC-013…021/029 拆出 R1-030…042（13 张），接在 R1-029 之后。IT-4～IT-7 仍待进站再拆。GAP-WALL-114 保持 OPEN。

## 1. 计数（2026-10-10）

| 类别 | 数量 | 说明 |
|---|---|---|
| 已定义卡 | 42 | R1-001～042。其中 R1-030～042 是 IT-3 真实拆卡 |
| 卡范围独立验收（ACCEPTED_CARD_SCOPE） | 6 | R1-002/003/004/005/006/008 |
| 源码交付、未独立终审 | 2 | R1-001（SOURCE_SCOPED_PASS）、R1-007 |
| 已实现/回放、待站级签收 | 21 | R1-009～017（IT-1）、R1-018～029（IT-2） |
| 已定义、本轮实现中 | 13 | R1-030～042（IT-3） |
| 未定义（待按站拆卡） | IT-4～IT-7 | 不按剩余张数补卡 |
| 跳过 | 1 | `support-real-gateway.e2e`，见第 4 节 |

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
| R1-030 | IT-3 | ensure 正式报告 pin 与计划 | 待实现 | 正式报告后读到 planId |
| R1-031 | IT-3 | ensure 幂等重放 | 待实现 | 同键重放、异体 409 |
| R1-032 | IT-3 | 首页计划横幅 | 待实现 | Web/H5 两视口横幅 |
| R1-033 | IT-3 | 一句话计划解释 | 待实现 | 解释来自服务端 |
| R1-034 | IT-3 | 今日任务与 practiceRef | 待实现 | 有指针才练习 |
| R1-035 | IT-3 | 今日空态分流 | 待实现 | 五态文案与动作 |
| R1-036 | IT-3 | 目标确认后版本锁重排 | 待实现 | 409 与完成行保留 |
| R1-037 | IT-3 | Web/H5 同一计划读回 | 待实现 | 同 planId/planVersion |
| R1-038 | IT-3 | 输入快照只追加版本 | 待实现 | 不原地改历史快照 |
| R1-039 | IT-3 | 首次学习按完成状态引导 | 待实现 | 完成后引导收起 |
| R1-040 | IT-3 | 书架、搜索与续学 | 待实现 | 三态搜索与有效检查点 |
| R1-041 | IT-3 | 计划今日交互验收 | 待实现 | 幕幕对稿 |
| R1-042 | IT-3 | L3 干净库重放 | 待实现 | 报告→横幅→今日任务 |

## 3. 站级状态

| 站 | 状态 | 出站门 |
|---|---|---|
| IT-1 | Luna REJECT/FAIL（基线 69bea68b）；复检 ce0aa296 PASS 未签；it1-named-gates / R1-014 PASS，自审 PASS_WITH_GAPS 未签。**待 Luna 签收（外部依赖）**，不再当作本轮开工阻塞 | 独立签收。具名门浏览器已有，仍缺 Luna。不改 `lunaStamp`，不改 station-acceptance 原件 |
| IT-2 | BLOCKED；it2-station PASS_WITH_NOT_RUN；it2-score-browser 10 题 PASS 未签。**待 Luna 签收（外部依赖）**。三个独立 owner schema 的 IAM 真签出站仍未完成：本轮 `services:run` 只有 HTTP IAM，没有在不写钥匙串的前提下换上 r1 TLS | 三个独立 owner schema 的 IAM 真签出站。原 3 个 NOT_RUN 不回写 |
| IT-3 计划今日 | 已拆 R1-030…042，实现见后续提交。lunaStamp=false | BC-023…032/199 |
| IT-4 练错复 | 未拆卡 TODO | BC-033…062/203 |
| IT-5 报告 | 未拆卡 TODO | BC-063…070 |
| IT-6 双审 | 未拆卡 TODO | BC-071…084/200/204…207 |
| IT-7 收口 | 未拆卡 TODO | BC-085…093/185/186/188…198/208 |

## 4. 跳过记录

| 编号 | 原因 | 证据 | 日期 |
|---|---|---|---|
| support-real-gateway.e2e | 真实 Gateway 工单 UAT 要向 `https://127.0.0.1:18087` 注册。本轮 `pnpm services:run` 的 IAM 是 HTTP，HTTPS 连接失败。r1 测试 CA 不在磁盘上。按约束不把证书写入 macOS 钥匙串，也不改该用例去忽略证书错误 | `evidence/redesign/2026-10-10/unit-tests-r2/report.md`；失败阶段 `register`，`registered:false`，清理 `ACCOUNT:0` | 2026-10-10 |

## 5. 轮次记录

| 轮次 | screen | 范围 | 结果 |
|---|---|---|---|
| r1 | cs-r1 | IT-1 具名门补齐与复检 | 浏览器与 R1-014 PASS；自审 PASS_WITH_GAPS；未出站、未签 |
| r2 | cs-r2 | 顶层 Node 测试修复；IT-3 已拆 R1-030…042，实现见后续提交 | 292 项中 291 通过；`support-real-gateway.e2e` 因 IAM 只有 HTTP 记入跳过。`lunaStamp` 仍为 false |

旧 grok 会话 PID 59062（01a120cd…）推送 e7cd6dd1 后空闲，保留运行但不再使用。
