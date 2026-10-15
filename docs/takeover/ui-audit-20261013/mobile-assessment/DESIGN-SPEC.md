# MB006 正式水平测评重设计规格（2026-10-16）

状态：设计已定、正式实现待验。不是页面完成、后台验收或远程发布。

## 范围和已读证据

实际源为 `apps/mobile/src/pages/assessment/assessment.vue`；唯一共享文案入口为 `packages/i18n/src/mobile-experience.ts`。改前五态真实 H5 合成接口证据见 `before-20261016/report.md`，原页 raw SHA256 `30cfa42c97c3fcd3923ac1309f3786fd2a1cf57c9e0d996bd897073429a86598`。需求/owner/决策映射见 `preaudit-20261016/` 三份材料。不能把源码或测试断言当运行 PASS。

## 完整视觉参照

先于正式源修改生成 `concept.png`（完整引导、答题、结果、重测确认四屏）。沿用已经书面接受的全项目简约方向：普通无衬线、语义色、自然留白、真实 AppIcon，不加装饰艺术字或大等待框。参照板不是 Demo 验收，所有结果数值只是示意，正式页面只显示服务端事实。

1. 轻导航栏，左返回、右设置。一个 H1，内容最大560px，窄屏24px左右留白，320px可适度缩至20px。不再使用重复通用标题与整页大卡。
2. 引导28px H1、16px/1.5主体、两条小图标说明；开始测评为48px主动作，首页为次动作。主次动作自然流式布局，不用绝对定位固定空白。
3. 答题显示题序与已接收完成数，4px进度条按已接收事实而非当前题号充进度。题干20px/1.5，16px选项整行可点，选中用边界、勾选与可读文字及 aria-pressed；至少44px目标。提交只发真实所选项，pending阻止重复及选项切换，网络失败同题保留本页选择，换题/换账号才清除。
4. 结果清楚分开正式等级、真实分数和可用题数；删“报告与快照同版本”等实现术语。不捏造缺失分数或零值。当前FULL/ZERO即时反馈保留且译为共享文案。
5. 重测先显示明确确认，原报告继续可见；取消零写入，确认才调用现有重测方法，错误不能被结果分支吞掉。已有计划不会静默重排。
6. 主按钮位置与消息布局需实际0/160ms pointer、drag/cancel、键盘验收；200%文字、短屏、四主题/中英/宽度、错误/恢复、owner/晚响应独审后才可收口。对比以实际uni-button host测量，不能用空button选择器冒充PASS。

## 业务、共享和导航边界

保留Vue3/uni-app、现有store/API、IAM成人/同意/owner/阶段门与幂等检查点。ADR-0027已有正式ASSESSED报告自动ensure计划继续，planNotice/pending必须诚实呈现；不能配合新文案改成点击才写。不改变DEC-04未签收反馈时点。

**快速开始具名GAP**：canonical skip写口存在，回执SKIPPED/UNVERIFIED无reportId。现有learning plans:ensure仅接placementReportId且owner拒绝非ASSESSED，无法仅UI接通保守计划。完整闭环记 `GAP_CONTRACT_OWNER_WIRING`，不捏造报告、不改后端/开关、不把源码默认值称真实部署关闭。本页先保留现有正式测评能力，引导以小字说明快速开始当前不可用；不放虚假可操作的开始学习按钮。已有SKIPPED读态保留非权威语义，不显示正式等级或分数。

导航用现有getUniRuntime出口与AppIcon，页面局部轻导航是为待提交选择的离开确认与busy控制；不为单页改动旧共享Header默认行为，也不复制会话实现。页面hide/owner换代后忽略迟到的局部状态/导航；store原有owner核验继续。固定18183，无unknown/shared进程停止。

另保留两项既有客户端边界，不能被UI验收抹平：`loadPlacement`无asess指针时调用新的start事件键，有指针才GET；未知首次start写入结果后能否同键恢复仍待单列核验，页面无指针失败动作应诚实写“重试开始”，不能承诺只读/不新开。现有retest helper发送`data:{}`，预审所述bodyless契约与其运行字节是否兼容尚未实测；fixture不读取body，不能据其PASS升级该契约。此候选不修改API/store来掩盖这些GAP。

## 验收与交付

先实现并冻结候选hash，再类型/模板与必要直接检查，再真实H5/独审。构建不代浏览器PASS；受控fixture、真实后台、native分别记录。概念图与最后实际截图同次view_image逐项核对至少五点，差异如语义配色、适应短屏、无硬件状态栏和不承诺不存在的计划能力要具名说明。未独立签收不推稳定远程。已有MB005本地验收提交758dc0fb仍待GitHub网络恢复，不得写成已推。
