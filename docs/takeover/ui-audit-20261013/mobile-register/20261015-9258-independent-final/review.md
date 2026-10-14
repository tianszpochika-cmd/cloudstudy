# MB-002 9258 当前源码独立风险复签

具名结论 **UI_PASS_RISK_SCOPE_H5**。当前 register 原始源码 SHA-256 `9258cb03e36c97d53d2e88521ba29f95aaf81de794657c8c72689fa50bd66baf`；i18n `eef37b1f82b915a0dc73e7f3351061d183912126801169dd083905a8060afd87`；helper `6464f4c1712b5a0f2fd4ab01d451d5bb6ffaa13bde486826a424511059ef6425`；作者测试脚本 `d1aa2c15ebe845b98f88809350202561c07fe393ad63779cbfa498a5154b0a65`。每个fresh context前核对这四个冻结值；三阶段另记录11个源/共享文件的前后哈希，全部0漂移。本agent未修改正式源码、shared、旧证据或Git。

先按root授权核验原自有监听PID19892的仓库命令行/创建时间与session77625，只停该进程并用既有strictPort+force启动固定18183。新session **99734** / PID **33636**，`127.0.0.1:18183`。没有停止未知或其它shared服务，没有改变端口。作者原run1裸翻译key FAIL保留；[service-refresh-results.json](service-refresh-results.json) 的fresh中英页面已真实显示账号3–128/密码最多128，0裸key、0API。此刷新不修改源码来掩盖失败。

已直接核对 `packages/contracts/fragments/b8/b8-auth-iam.openapi.json`：B8RegisterRequest、B8WebRegisterRequest、B8NativeRegisterRequest均为identifier3..128/password12..128。当前页面第33–43行按identifier.trim长度和password原值实现，全部三个uni输入`:maxlength=-1`，原生input仍是-1，不依靠截断满足边界。

| 本次风险检查 | 直接证据 |
| --- | --- |
| 长度边界17项 | [contract-results.json](contract-results.json) PASS。账号0/2/3/128/129/141及带首尾空格2/3/128/129；密码0/11/12/128/129/141和原值带空格12。非法0请求/正确首错焦点与ARIA；合法各1条被拦截注册POST。141字符在账号/密码/确认完整保留，仅输出长度。 |
| 真实指针16项 | [pointer-results.json](pointer-results.json) PASS。先建立一次合成409，再在账号尚聚焦时产生首次129长错误：实际原中心click0ms/按住160ms可信click1，drag-away/Chromium原生touchCancel可信click0，均无新增POST、快照解除，按住期间原按钮几何不移。英文200%密码short/empty/valid和账号length/empty/valid六种变化×输入后0/160ms，共12项：原中心真实down命中、再按住160ms不移动、释放后正确当前错误/首焦/ARIA，valid才新增1请求。0ms组不把尚未同步的隐藏状态当最终语义，释放后按当前实际字段验证。 |
| 主按钮键盘5项 | [key-visual-results.json](key-visual-results.json) PASS。空Enter/Space按住160ms+repeat keydown仍button焦点/0错误/0请求，单次keyup后identifier首错保持、三字段ARIA正确；合规两key各1POST，pending锁全部输入/显隐/主按钮/出口，重复按键、真实click、直接事件/函数无法重复、换显隐或导航，拒绝后恢复；input Enter仍依次到password/confirm并只提交1次。 |
| 新长错误实际视觉6组 | 同key-visual结果：390中文亮色、320英文亮色、390英文暗色、320英文高对比、390英文200%亮色、320英文200%高对比。129账号/密码同时报长错误，确认同值；全部0API、无横溢出、完整实际译文、原生语义关联正确。六张均通过view_image实际检查，长文案换行和错误/主动作/出口没有遮挡。 |

本次共44项风险检查及2组刷新译文，三阶段pageerror0、非预期console0；fixture预期状态日志分别7/8/3（被拦截拒绝）。16项pointer中首次长错误组各有1条先前409基线请求，手势本身0新增，不能将JSON累计1误读为非法请求。没有重复作者34项普通视觉矩阵，也不以此计数发布整体完成率。

代表图：[390中文长错误](length-errors-390-light-zh-CN-scale1.png)、[390暗色](length-errors-390-dark-en-US-scale1.png)、[390英文200%](length-errors-390-light-en-US-scale2.png)、[320英文200%高对比](length-errors-320-high-contrast-en-US-scale2.png)。另外320亮色、320高对比同目录。密码/确认保持原密码显示，只有合成测试数据，未使用真实凭据或切到可见密码。

使用frontend-testing-debugging技能允许的Browser缺失回退，Playwright1.63.0/Chromium隔离contexts。全部API拦截，IAM TLS保持；不读请求body/header、认证Token、cookie或敏感存储。脚本复制既有author的最小fixture/语义/边界/指针段，新目录独立运行，改成冻结哈希、首次长错误及0/160ms重放，并独立增加键盘pending与新长文案视觉；未重写作者脚本或旧FAIL。

官方额度分组实读：服务归属60%/周75%，边界前67%/76%，边界后71%/77%，键盘视觉前72%/77%，实际看图74%/77%，收口75%/77%；未触及90%停止线。服务保留给同轮作者/复审，root负责工程检查、正式报告、逐页提交与远程SHA。

真实IAM注册成功、数据库/审计、成人Gate与学习业务、原生App/小程序、物理输入/系统读屏、Keychain/Keystore和refresh清理 **NOT_RUN**。本结论是冻结候选的独立风险范围，不替代作者普通矩阵、构建或真实业务验收，历史FAIL和已推历史范围不改写。
