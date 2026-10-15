# MB005 candidate2 作者断点（2026-10-15）

状态：候选未签收。实际额度首读 92% / 周 29%，ordinaryUsageAllowed=true 后停止新设计、修稿和测试；无作者浏览器进程在运行。未使用额度券。Root 负责整合、主报告和 Git。

## 冻结与工程证据

- 页面 raw SHA256：`d38dd97ccb717d3b477327cef5af49fa84d265df0a0032a17e2725ad6e85e718`。
- i18n raw SHA256：`2a143436a7cd84544dc679eef1ed489e785e3202dd6803b082bba844de53c130`。
- 当前浏览器脚本 raw SHA256：`53fa5f889b2b9ac2116ad36e72d1335f549409c3f2eacd6331b676008ba4359a`。
- 原件：`source-candidate2/`；完整应用、测试、共享依赖 raw/LF 哈希与各组运行前后哈希见 `checkpoint-candidate2-paused.json`，工程冻结见 `freeze-candidate2.json`。
- `template-types-candidate2.log`：实际 SFC 模板及虚拟 TS 语义检查通过。`adult-copy-candidate2.log`：相关 3 项通过。Root 的完整 typecheck/H5 build 属独立工程证据，不能替代浏览器验收。

## 当前候选的作者 H5 证据

Browser 插件/对应 browser skill 不在当前可用能力中，使用现有 Playwright Chromium。全部 API 由隔离合成 fixture 拦截，不访问真实 IAM、凭据或业务后台。以下组均使用同一冻结页面/i18n/脚本，结果分别存于目录内 `results.json`，没有覆盖旧运行。

| 目录 | 实际完成范围 | 结果 |
| --- | --- | --- |
| `candidate2-smoke/` | 成人拒绝、暂停、中性、未知、未登录、读取失败，中英共 12 个 context；单 H1、标题、无裸 key/横溢出、无未授权写入 | 12 PASS |
| `candidate2-matrix/` | 成人拒绝/暂停/中性/未知 × 320/390/768/1280 × 中英 × light/dark/high-contrast/system；字号、图标尺寸、点击尺寸、标题/说明文字对比度、无横溢出/overlay | 128 PASS |
| `candidate2-text/` | 四个状态中英，320×460，实际计算字体放大 200%，滚动可达退出及自然换行 | 8 PASS |
| `candidate2-pointer/` | 真实鼠标中心按住 160ms 后释放单次导航、拖离不导航、CDP touchCancel 不导航；按住期间不提前导航 | 3 PASS |

各组 pageErrors 和 unexpected API 均为空。矩阵在检查额度时已自行完成并退出，额度停止线之后未继续启动新行或新组。文字放大不是操作系统/浏览器原生缩放认证；CDP touchCancel 不是 App 原生验收。

本轮将 `concept.png` 与实际 `candidate2-matrix/adult-1280-en-US-dark.png`、`candidate2-text/adult-en-US-200-short.png` 同次目检：轻品牌、小锁、单个 H1、开放居中列、主次按钮、独立退出层级一致；实际使用规范 25px 品牌图标、22px 锁、28px 标题、14px 说明、420px 最大内容列。短屏不复制概念固定大留白，放大后按钮文字完整换行。概念旧深色图对“撤回”的具体归因已按批准边界改为中性暂停文案。真实 uni 控件 host 边界对比度仍待独审测量，未用文字对比度代替它。

## 旧失败与版本保留

- `source-candidate1/` 保留实际 candidate1 页面 `52709e83…` 与 i18n `ae269975…` 原件；实际 runtime interceptor 取消导航后 busy 不解除的产品 FAIL 在独审 `../20261015-independent/candidate1-2300/runtime-cancel-results.json`。candidate2 用页面内 4 秒有限等待恢复操作与人话提示，不改共享导航。
- `smoke-run1/results.json` 保留 harness FAIL：错误要求 custom-navigation 页面存在可见原生标题节点。旧脚本 hash `612579b6d022fd49ae5e4c8dffd97a20035b943e33f726f9aa460f8a6176ca6b`。
- `smoke-run2/results.json` 保留 harness FAIL：未登录入口 fixture 未初始化真实 i18n adapter 的英文 locale。旧脚本 hash `72cef0be0e79ab61cdfe5d090677ce26d43ae98a8a7fea8f291a80b7e9a52b9b`。这两条未证明产品标题或 locale 失败。
- 两份旧 smoke 的精确执行脚本字节当时未逐 run 归档，属于证据 GAP；当前脚本原件已保存，不冒充旧版本。`template-types-run1.log` 与 `adult-copy-before-run1.log` 等旧失败也保留。

## 未完成与限制

独审已报告 candidate2 风险 11 项通过（真实取消 4 秒解锁、移除 interceptor 后重试、logout false/owner/hide 等）；以其独立具名文件为准，不并入作者数量。作者 candidate2 未另跑 interactions/cancel/races；candidate1 对应 8/3 项仅证明旧源范围。最终控件实际 host 边界/对比度、200%/pointer/主题独审未完成，整页未签、未推正式源。

页面不能撤销已 dispatch 的平台导航；本地超时仅解除等待并提供重试。暂停 marker 缺少具体撤回事实来源，保持中性文案。真实后端、原生 App、系统缩放仍未验收。下一窗口先复核原件与服务归属、实际额度，然后完成独审剩余范围；出现真实 FAIL 再协调单点修稿。
