# MB-004 候选基础显示与只读边界

本阶段为 **FRESH_COPY_PASS / READ_ONLY_FACT_REVIEW**，不是最终UI签收。fresh显示读取的page raw SHA `aa20a389d915a4d289db11c0a44a698f7f4f02abe94df5907760555c9a866b0b`，i18n `5de636433b73ba72a2549c3e6331da9f8ccec48226c71e56d071396cc0a69eeb`。作者与root尚在收口page/API/session，冻结后必须按新hash复验。

确认旧session99734仍运行，PID33636监听18183，仓库uni命令行相同，CreationDate为2026-10-15 00:04:50；依root授权仅停止该自有进程并用既有strictPort+force刷新。新session **7489** / PID **27892**，CreationDate **2026-10-15 07:35:01**，固定 `127.0.0.1:18183`。没有停止未知/shared进程或新增端口。

[fresh-copy-results.json](fresh-copy-results.json) 的两个隔离context显示正式gate路由：中文“确认成人身份”、英文“Confirm adult eligibility”，标题/说明/年份/成人声明/动作/出口没有裸mobile.onboarding键，Vite overlay0、pageerror0。使用明确无效的合成内存session与受控resume provider，仅为显示实际Vue组件；所有API均拦截，未读token/cookie/storage/body/header，不证明认证或业务。未启动全面矩阵。

已实际查看生成concept.png与本次中英fresh截图：真实组件沿开放单列、24px左右间距、现有brand/icon、步骤文字、28px标题和短说明，去掉原大框。概念图的浅色不可用主按钮是静态示意；当前候选空表单主按钮可触发字段反馈，不能根据示意图直接断言功能错误。gate基础方向对齐；其它状态、暗色/高对比/200%、真实checkbox行为和最终视觉尚待作者冻结后复审。

只读事实基线gateway b17373e7、session22efb5ca、learner API63ef96f1：旧parseAdultGate只归一status，丢learningAccess；session旧ready只看PASSED+permission，确认只凭PASSED返回true。getPermissions503或401/404 null时refreshGateFromServer没有先使旧资格失效。root正在修这组源码，因此这里保留为修前事实，不声称修后仍有同一问题。

最小权威投影方案已核服务与契约：

- generated/OpenAPI名字为 **B8PrincipalResponse**，required有principalId/permissions，字段含adultGate/consentState；B8PermissionsResponse契约没有adultGate，不能依赖实际controller额外字段来授予资格。
- IamProviderBoundaryController principalResponse1064–1074 与permissions311–315均从同一tokenAccount(account).permissions计算当前权限。既有adapter.getPermissions可内部改成sole GET principal/me，核required principalId与当前verifiedSubject匹配，保留owner/identity/epoch guard；无需为此新增架构或双请求。
- B8AdultGateResponse明确learningAccess为权威保护Gate。缺失/UNKNOWN/RESTRICTED均不能从PASSED状态补为ELIGIBLE；当前事实读取失败使资格/ready失效，但不必无故清除合法身份会话。
- adult-gate POST360–405只写事实并返回成人结果，不换Access JWT；GET principal/permissions也不签新JWT。refresh191–195才重签，eligibilityClaims1046–1060写当前adult_gate/consent_state；LearnerHttpPrincipals69要求JWT PASSED/GRANTED，当前复核不能补旧JWT。已签用户成人确认后直接续goal，必须先通过既有refresh更新claims再learner读写；若明确签署流程已有刷新则复用一次。

page aa20只读：generation+identityRevision+active的current守卫用于晚读/保存/导航；onHide使代次失效并清未提交年份/勾选，已由owner读回的目标保留。两处最小候选风险已通知root：loadResume仅挡saving而未挡reading，直接重读可能并发GET（旧代次结果会被弃）；goal next handler没有同步挡targetUnreadable，只有按钮disabled，建议handler同样fail closed。这是静态风险，不是已执行浏览器FAIL。未扩大认证架构或修改正式源码。

额度实读依次5%/周81%、25%/84%、29%/85%，ordinaryUsageAllowed=true，未耗券。真实IAM、JWT刷新与领域PEP、后台事实/审计、真机/物理输入和存储均 **NOT_RUN**。最终签收须冻结page/API/session/i18n组合，fixture和真实后台/真机证据分别列出。
