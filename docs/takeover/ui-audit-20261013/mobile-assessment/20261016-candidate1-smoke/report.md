# MB006 candidate1 独立窄 H5 smoke（2026-10-16）

结果：`8_NAMED_CHECKS_PASS / FULL_PAGE_NOT_SIGNED`。唯一浏览器组已完成；全部 context/browser 关闭，无 inflight。没有扩 pointer/race/主题宽度矩阵，没有改正式源码、共享模块、旧 before、Git、主文档或服务。

冻结页 SHA256 `d1b501e33b313679bd5c90dd8fcda8e9a5a6b790856a444b01e915523827366a`；i18n `d55f74003bdbe9eae58858ab51bc52d806d2b07e5b06a05e68a183768291249d`。results 保存六源 before/after，sourceStable=true。Root 自有服务 session42055，实际监听127.0.0.1:18183/PID24848；本子任务只读核对，没有启动/重启服务。组前官方额度82%/周44%，ordinaryUsageAllowed=true。

环境：正式 `#/pages/assessment/assessment`，Playwright Chromium，390×844；主链zh-CN/light，另一个独立context en-US/dark。Browser plugin及browser技能缺席，使用已记录的现有Playwright fallback。截图保留完整页面高度，context视口始终390×844。

API 全量 synthetic transport 拦截，真实页面、登录 UI、returnTo、guard、选择与submit/retest按钮。没有真实账号、cookies/storage/body/header读取，没有DOM/store/guard状态注入，没有造SKIPPED/reportId。题目与ASSESSED的A2/70分/7正确都是合成服务事实，不能作为真实业务判分证据。

| 具名检查 | 实际动作及结果 | 图 |
|---|---|---|
| 正常登录引导 | 正常登录returnTo，经guard进入；开始写0 | 01 |
| 真实选A | 点击开始1写，再点击A；aria-pressed=true，文本“已选” | 02 |
| 提交503 | 合成response503，经真实submit；本页alert显示未确认，A仍pressed且有已选文本 | 03 |
| 同题读回保留 | 清503，点击重新读取；placement GET恰增1，start仍1，进度仍0，同题A仍pressed | 04 |
| 正常报告 | 从同一题继续10次成功真实提交；respond总11（含失败1），start1，ensure1，正式A2报告 | 05 |
| 重测确认与取消 | 点击重新测评出现alertdialog，retest0；取消后关闭，仍retest0 | 06 |
| 重测503 | 再打开确认，确认后retest1；同页alert、旧A2报告均可见；取消后重测次数仍1且确认关闭 | 07 |
| 英文暗色引导 | 新context正常登录；实际locale=en-US/theme=dark；主体无中文字及裸key | 08 |

八图均view_image核看：页头/主操作层级已明显简化，报告没有旧“快照同版本”文案；失败后的选择与重测旧报告实际可见。确认对话区及错误后的报告页面变长，可滚动完整操作。此处未另核200%文字、键盘、对比度、pointer或实体设备。

所有关键态记录route/title、locale/theme、完整主体文字、aria-busy、选项pressed/disabled、progress、控件、API counts。八态均无水平溢出、裸key或Vite遮罩。unexpected API=0，pageerror=0；console error仅两条明确注入503（response/retest），无其他错误。没有遇到运行FAIL；失败注入场景的原始截图和facts均保留。

证据为 `run.cjs`、`results.json`、01…08 PNG。完整页验收、其余矩阵、report ensure失败、pointer0/160ms/drag/cancel、owner/hide/race、SKIPPED/保守计划GAP、真实IAM/Gateway/owner数据库、native/实体设备均未在本组验证，不升级为PASS或本轮整页签收。
