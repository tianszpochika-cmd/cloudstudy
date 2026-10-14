# MB003 独立真实指针复审：9729 候选（2026-10-14）

结论：**IN_REVIEW，英文 200% 历史错误行变化仍发生真实坐标点击丢失。未签 UI_SCOPE_PASS。**

精确源：页面 `9729e8140c0e70fa99308f1be8543949e7dbf67a1aef7650596c7b38153cefa6`；`platform/pointer-feedback.ts` 为 `6464f4c1712b5a0f2fd4ab01d451d5bb6ffaa13bde486826a424511059ef6425`。本 Agent 未改正式源码、作者证据、服务或 Git，只写此新独立目录。所有 API 被拦截，没有真实 IAM / 账号 / native 业务操作。

## 已完成

首次出现的新账号错误，旧按钮中心先预置真实 pointer，修改输入后立即真实按下并保持 160 ms：

- click：pointerdown 模型仍旧值，action 命中，top625.234375 全程保持，snapshot=true；真实 click=1，释放后 snapshot=false、账号 invalid=true、首焦点账号、0 API。
- drag-away：相同期间几何保持，拖到控件外释放，真实 click=0、snapshot=false、0 API，失焦后的新错误显示。
- native CDP touchCancel：实际 touchStart / touchCancel，click=0、snapshot=false、0 API。平台取消后输入仍聚焦，所以首次新错误继续延期；显式 blur 后正常呈现并更新 ARIA。没有把手工 pointercancel + mouse.up 当成原生取消。

英文精确 200%，曾报告的账号长度长错误 → 空账号短错误，立即 pointerdown（约1.9 ms）+保持160 ms：命中action、snapshot=true，错误自然高89.59375保持，button top1144.546875保持，click=1；释放后短错误高44.796875、首焦点账号、0 API。此范围通过。

## 新 FAIL：历史文案在按下前改变行数

同一英文 200% 历史长错误，捕获旧按钮中心并预置 pointer，清空账号后先等待160 ms，让 uni 100 ms 更新完成，再在原坐标真实按下并保持160 ms、释放：

- 两行长错误自然高89.59375 → 一行必填错误44.796875。
- 主按钮文档 top1144.546875 → 1099.75，上移44.796875 px。
- 实际 down 距输入172 ms，模型已新；事件目标不是action、snapshot=false。
- 实际 mouse.up 后 trusted button click仍0，焦点body（空id），0 API。

该失败属于**已报告字段的文案变行数，在真实按下前移动了按钮**。与前版“首次错误行在 blur 创建”以及 run2 的未报字段100 ms 更新窗口分开记录，不能用前三个首错手势 PASS 遮盖。

具名完整前段：`pointer-results-9729-first-final-fail.json`；最小失败及真实 release：`pointer-results.json`。脚本 `pointer-review.cjs` 支持 `POINTER_CASE_FILTER=english-delayed` 定点复现；`english200-long-to-empty-delay160-held.png` 已人工查看，并遮罩合成口令和密码输入。

## 测试脚本修正与未跑项

首次脚本期待 touchCancel 自动失焦并立即报新错误，实际浏览器保留输入焦点；已改为先检查真实cancel无click / 无snapshot / 无API，再显式blur验证后续错误。旧 harness 输出保留在 `pointer-results-first-harness-touch-focus.json`，不作为源缺陷。

英文空错误 → 合法更正、其它历史文案变高 / 变短，以及原完整动态后半（pending直接guard、状态、synthetic成功清理与返回、安全深链）本轮尚未跑到。必须在作者修复并冻结新hash后继续独立验收，不沿用旧源 PASS。没有重跑64 / 68视觉矩阵，也没有冒充独立build/typecheck结果。

结果仅记录合成长度 / boolean、UI错误文案与几何；不记录 code / password 值、request body / header、真实 storage / cookie / Token 或带token的URL。真实后台、邮件及原生凭据清理继续未测。
