# 下一组执行提示词：R1-002至R1-005

接续当前Cloudstudy dev-redesign工作。先核对状态墙、主审R1-001/reviewer-11/review.md与approve-8.json；R1-001须为有效ACCEPTED，若漂移先报告，不继承旧父任务完成状态。

本组边界是002注册、003同键回放、004登录/刷新/撤销、005设备列表/踢出。当前只交R1-002开工准备包，不自标READY、不提前开发或启动共享后台、不越至006。按各卡现行来源与filePlan小步复用旧版实现，先报告可复用/缺失，不推翻重做。

1. 精读R1-002执行卡、对应来源和现有IAM实现；核对P1R-M2-002认领及契约父输入，归档HEAD/限定dirty/他人改动边界。
2. 逐项说明G-ENV/G-CONTRACT/G-PLATFORM/G-FRONTEND当前输入证据与适用scope。盘点专用IAM验收schema、owner/最小权限、迁移和可重复合成fixture，数据库写入必须隔离；不复用001空content库或共享IAM事实，不输出任何凭据/Token/私钥。
3. 核对固定端口、Node/pnpm/Java版本、真实register/principal/permissions契约及生成类型、Idempotency-Key、受限JWT/Refresh Cookie、安全密钥注入。201只代表创建账号/受限会话，不授予学习权限；不得引入OIDC、第三方身份、完整生日采集。
4. 给出002三项TC的可执行输入/动作/预期/owner读回/安全拒绝及证据目录；既有实现与卡片若冲突，定位最小差量并交主审裁定，不能改契约绕过。
5. 在R1-002卡指定证据目录新增准备报告与source-and-inputs.json。无法满足的输入逐项列唯一解阻条件；不冒称PASS、不用后置产品TC已通过作为READY前提。

交主审签READY后，才按002步骤实施并交REVIEW；不自行ACCEPTED。002获批才开启003/004各自准备，004获批才开启005。旧证据不可覆盖，保护共享dirty；端口冲突只报告，停止范围仅限当轮已核身份的自有进程。
