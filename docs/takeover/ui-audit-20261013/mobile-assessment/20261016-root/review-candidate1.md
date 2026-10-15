# Root 候选1阶段复核（未签整页）

2026-10-16，正式page raw d1b501e33b313679bd5c90dd8fcda8e9a5a6b790856a444b01e915523827366a，i18n raw d55f74003bdbe9eae58858ab51bc52d806d2b07e5b06a05e68a183768291249d。完整八源raw/LF与Git外备份见candidate1-source-snapshot.json，56保护文件0漂移。作者最终typecheck exit0，Root diff --check通过，仅工程/源检查，不等于模板或浏览器整页签收。

## 概念与实际同次查看

Root实际在同一次view_image QA中查看concept.png、当前candidate1-smoke/02-selected-zh-light-390.png、05-assessed-after-ten-real-submits.png与08-guide-en-dark-390.png，并对照此前before原图。阶段观察：

1. 轻返回/设置导航已使用正式AppIcon，移除旧Unicode设置字符；触达与实际键盘尚待完整测量。
2. 单一28px H1、正常无衬线与留白，删去旧艺术标题和重复卡标题，符合方向。
3. 主内容无整页外框和嵌套信息卡；普通正文16px，次文字14px，答案行16px，答题更清楚。
4. 整行选项带字母徽记，选中有勾/已选/aria-pressed；当前真实390首题主动作完整可见。此fixture题干与before并非逐字同一内容，不能据此推导任意长题干首屏均能放下。
5. 结果A2/70分/7题来自本轮实际十次合成服务回执，概念60分/6题仅示意；不复制数字或计划成功承诺。
6. 单列48px主动作与描边次动作遵循概念，取消硬件状态栏、采用真实语义紫色而非生成图片的精确色值；自然流适应短屏，不用固定大空白。
7. 即时FULL/ZERO回执继续真实展示（ADR/DEC边界未改），没有为视觉删除功能。重测确认与失败保留报告的具名交互以独立smoke为准；仍须指针/键盘/晚响应验收。
8. 英文暗色引导已实际不混中文，四主题/全部宽度/200%不是本组PASS；不能从light/dark两图升级高对比与系统主题。

## 待优化关切与剩余门

当前题序、右侧N/N、进度条下“已接收N题，共N题”三处重复计数，Root实际图已看到重复，建议在后续修稿精简可见计数并保留ARIA语义。此为设计评审关切，不冒充新的浏览器功能FAIL；不要仅为赶收口删必要状态。

200%英文长词、320/短屏、高对比边界、真实0/160ms pointer/drag/cancel、键盘焦点、onBackPress程序出口、hide/owner晚响应、持续失败/planNotice及共享旧页回归均未签。此前8项smoke只绑定本候选具名场景。真实后台/原生与SKIPPED保守计划owner契约、unknown-start恢复和retest body字节GAP保留。

候选未提交、未推稳定远程。MB005独立验收已绑定其已提交758dc0fb版本；本页新增共享i18n键使全文件hash变更，既有键diff未改，不覆盖MB005旧收据。最终提交本页前仍需当前共享组合的具名回归，不能改写旧hash为当前。
