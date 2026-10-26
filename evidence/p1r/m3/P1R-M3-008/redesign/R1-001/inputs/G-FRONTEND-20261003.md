# G-FRONTEND：R1-001 限定准备签收

- 日期：2026-10-03（北京时间）；主审：01a0cb93-8791-7ee2-b453-8e8752b2553f
- HEAD：3d11be3337accd32afbdbe13a218bca38c786043；本卡diff摘要：83ef67844c369472898cfb1fdeb0f22e3f6b971ac7650f95b90903214bf72de2
- 结果：PASS，仅下列准备scope；完整Gate未关闭。
- scope：复用现有Vue/TS、每请求独立共享i18n/token基础、UI locale与contentLocale分离、主题与受控链接helper；现有26项单元/静态/VM基线通过，包含待迁移旧断言。双视口、触达/焦点/主题/Console及TC01…03均为本卡待交付验收。

v2-foundation.ts引用共享i18n/design-tokens及adapter，SSR每请求新实例，locale/contentLocale分离；foundation.ts仅公开locale/theme偏好。public-links.mjs已提供固定Web/mobile注册路径、安全returnTo和协议检查。本卡复用其能力改CTA；pricing/download、课程空文案及旧测试需按当前源规格实现。现有26项并非最终产品TC。

当前源文件/配置/契约摘要见[current-input-review.json](current-input-review.json)，实测命令/时间/退出码见[恢复后预检](resume-20261003/verification.json)。工作区保护见[清单](workspace-protection.txt)。认领见[本卡限定确认](claim-20261003.json)。

恢复/回退：本轮只更新端口元数据与执行资料，无业务写入或服务操作；实现回退仅撤销本卡允许文件的自身差量，不覆盖共享改动。TC01…03、实际公开上游、双视口及失败恢复待实施后独立审批，不写产品PASS。
