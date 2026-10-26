# G-CONTRACT：R1-001 限定准备签收

- 日期：2026-10-03（北京时间）；主审：01a0cb93-8791-7ee2-b453-8e8752b2553f
- HEAD：3d11be3337accd32afbdbe13a218bca38c786043；本卡diff摘要：83ef67844c369472898cfb1fdeb0f22e3f6b971ac7650f95b90903214bf72de2
- 结果：PASS，仅下列准备scope；完整Gate未关闭。
- scope：仅消费三个既有公开GET；源片段与canonical逐操作相等，生成TS映射存在，security为空；公开价格契约父M1-015已补引用。未声称重新生成Java DTO、完整契约或运行负例通过。正式schema差量需先审查。

已核对getB9OfficialSiteProjection、listB9PublicContentCatalog、getB13PublicCommerceCatalog三项GET，security=[]，正式source/canonical操作相等，生成TS映射存在。B9只公开published projection、PUBLIC_V1及服务端owner；B13标记NOT_RUNTIME_VERIFIED，保留该限制。官网不会调用认证IAM/learner/admin接口。若facet状态引出正式schema差量，先提交主审，不能手改generated。

当前源文件/配置/契约摘要见[current-input-review.json](current-input-review.json)，实测命令/时间/退出码见[恢复后预检](resume-20261003/verification.json)。工作区保护见[清单](workspace-protection.txt)。认领见[本卡限定确认](claim-20261003.json)。

恢复/回退：本轮只更新端口元数据与执行资料，无业务写入或服务操作；实现回退仅撤销本卡允许文件的自身差量，不覆盖共享改动。TC01…03、实际公开上游、双视口及失败恢复待实施后独立审批，不写产品PASS。
