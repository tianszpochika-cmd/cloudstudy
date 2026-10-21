# MB006 C3 风险组 Root 独立执行审核（2026-10-20）

范围：C3 page `86620ed0…` / i18n `6ac6800e…`，current 18183。脚本由 **DSH 作者准备**，由 **Root 独立执行与审核**；本文件是 DSH 依 Root 已核事实与只读 JSON 的文档转录，**不构成 DSH 浏览器 PASS**。已逐项读 `results.json`，不以 exit code 推断完成度。

## 1. Pointer（2 cases）

- `runs/codex-review-pointer-1/pointer/results.json`：`executor="Codex independent pointer review"`，**30/30 PASS**，`summary={cases:2,checks:30,passed:30,failed:0,notRun:0}`，`closed=true`、`sourceStable=true`、`result=PASS_EXECUTED_CHECKS`。
- 范围仅已执行 checks；`notRun=0` 不代表整页完成。

## 2. Busy（3 cases）

- `runs/codex-review-busy-1/busy-retest/results.json`：`executor="Codex independent busy retest review"`，**31/31 PASS**，`summary={cases:3,checks:31,passed:31,failed:0,notRun:0}`，`closed=true`、`sourceStable=true`、`result=PASS_EXECUTED_CHECKS`。

## 3. Keyboard（1 FAIL）

- `runs/codex-review-kbd-1/keyboard/results.json`：**29/30 PASS、1 FAIL**，`result=FAIL`、`closed=true`、`sourceStable=true`。
- FAIL：`K1-shift-tab-reverses-without-loss`。detail 的 `reverse` 为：先 `assessment-back`（focusVisible，2px 实线 outline），再落到 `body`（不可见）。
- Root 判定：反向焦点从 back 到 body，属于**普通文档 Tab 边界**，页面并非 modal focus trap；因此该断言本身与页面模型不符。**Root 不自行改脚本**，而是分发给 **DSH 修正断言**，Root 待独立重跑后判定（实现归 DSH，执行/审核归 Root）。
- 处置：**原始 FAIL 保留**，不修产品源、不升级为 PASS；待修正脚本**重跑**后再判。分类：assertion（脚本假设），非产品 FAIL、非已解决。

## 4. Leave（3 FAIL）

- `runs/codex-review-leave-1/leave/results.json`：**23/26 PASS、3 FAIL**，`result=FAIL`、`closed=true`、`sourceStable=true`。
- FAIL 明细：
  1. `L1-back-without-selection-exits-to-home`：`before=#/pages/assessment/assessment`，`after=#/pages/login/login`；脚本假设回 home，实际回到 **login**。Root 已 view_image 核对 `l1-04` 实际登录表单。
  2. `L1-relogin-recovery-no-new-start`：`page.waitForFunction` 超时 8000ms；`start=1`、`placementGet=1`、`accepted=1`、`question=false`。重登后恢复失败，**根因未知**。
  3. `L1-relogin-selection-is-page-only`：`pressed=[]`。该检查的预期是恢复后**所有选项为 FALSE 且 submit 为 disabled**（即本地草稿已清空）；实测**未到题页**，因此“草稿清空”断言无法成立，属于**依赖恢复失败的不完整断言**，不能据此称“选择未保活/选择未保留”为产品缺陷。
- Root 判定：当前源在 `uni` 页面栈长度 >1 时返回**实际上一页**，否则 home；脚本“总是 home”的假设不成立 → 第 1 项分类 **assertion**。
- 但 Root 同时指出：把已登录学习者带回**陈旧登录表单**是未解决的 UX 风险，**不予豁免**；需按产品/交互决策处理，不能以“脚本假设错”结案。第 2 项重登后 reload 恢复失败**根因尚未定位**，分类 **recovery（未解决）**；第 3 项因恢复未到题页，草稿清空断言无法成立（**依赖恢复失败的不完整断言**），不列为产品缺陷。
- 结论：**保留真实 FAIL**，assertion / UX / recovery 三类分开记录，不伪造已解决、不改产品源。

## 5. notRun 标注

- leave `results.json` 的 `notRun` 含 `L1-onBackPress-browser-back-exit`，理由称浏览器 back 会先卸载文档、无法观察 leave dialog。该“browser-back 不可能”属**旧测试假设**，当前不作为已证事实；生命周期 harness 正以真实 history 准备。native/Android back 与 browser-back 拦截仍 **NOT_RUN**。
- 全组 `caveat` 明确：notRun 是未测分支，不是通过。

## 6. 边界与状态

- Native、真实后台/IAM/Gateway：**NOT_RUN**；不因本组局部 PASS 升级。
- MB006 仍 **IN_REVIEW**，**无整页签收**，不新增“页面完成”CHANGELOG 条目；本地 UI 8 页 / 远程 7 页不变。
- Git：DSH 沙箱子进程阻塞仍在，未推、不得记 PUSHED。
- 额度：Root 22:59 实读 64%（primary），95% 停止线不变；旧读数不当现值。
- 本文件只含日志/元数据摘要，无 auth/token 等敏感内容。
