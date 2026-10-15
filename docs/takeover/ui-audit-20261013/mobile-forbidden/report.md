# MB005 实际访问受限页重设计

> 当前C4已获H5 UI_VERIFIED_LOCAL，未推远程。唯一当前验收见[最终报告](FINAL-UI-REVIEW-20261016.md)，下方保留候选审查历史，不能覆盖当前版本。

当前：IN_REVIEW_PAUSED，未签UI、未提交正式源。最新实际候选/已验范围/未验与测量更正见../PAUSE-20261015-2344.md及独审checkpoint-quota90.md。最后冻结组合与各次真实检查以作者manifest及独审报告为准；本文件不将候选工程检查升级为完整页面通过。

## 问题与实现范围

旧正式页有通用Header和原因大卡双重标题，英文中保留中文，撤回/一般受限说明混同且缺获准账号/帮助正文出口，退出等待期间仍能重复操作。旧before、错误fixture初始化和可靠性基线保留在preaudit-20261015、20261015-independent-source中，测试设置错误单列，不冒充产品FAIL。

本页按DESIGN-SPEC和concept.png整体重排实际Vue页面：轻品牌顶部、小锁、单原因H1及短说明，账号主动作/帮助次动作与独立退出；使用现有图标、语义token、常规无衬线字体，去除外层大卡、重复标题、装饰阴影、艺术字和nowrap。中英文案经既有packages/i18n入口，不改已签auth/onboarding文案。

实现只限正式forbidden.vue、本页新增i18n和直接边界测试。已有session/gateway/navigation/pointer helper保持；不增加认证、法律发布目录、权限字段或学习能力。页面内持有pending、动作代次、可见状态与当前owner，等待现有会话恢复和可信资格读取，固定获准settings/support出口，退出返回值不冒充服务端撤销。

## 需求与权威边界

沿当前R1-007/BC-007、R1-009/BC-009、R1-013/BC-201以及C1门禁业务链；ARCH-IAM-002/ARCH-API-001、B8成人/同意契约继续有效，来源行号见preaudit与独立可靠性baseline。本轮只签UI差量，不重签历史R1业务。

当前owner明确REJECTED才给成人限制原因；UNKNOWN/读取失败/未登录不冒充拒绝。learningConsentWithdrawn为无owner sticky安全暂停marker，只能显示中性暂停；principal accepted=false和历史同意记录都不足以证明当前用户亲自撤回，权威owner原因投影仍GAP。概念深色屏的具体撤回句因这一源码事实已在实现前作废，保留审计说明。

## 验收记录入口

candidate1实际阻断FAIL：正式uni runtime的navigateTo interceptor invoke返回false后，点击管理账号，2200ms后页面仍留原路由、全部出口disabled、busy不结束且无错误提示。不是Promise.reject测试注入，不是权限或翻译故障。原始证据见20261015-independent/candidate1-2300/runtime-cancel-results.json、runtime-cancel-after2200.png。candidate1五态中英10图与作者8交互/3race的局部PASS不能抵消这一FAIL，整页不签；作者将页内有限导航等待和退出失败人话提示统一修稿后冻结新版本复验。

Root已同次view_image核概念与candidate1成人中文亮色、暂停英文暗色实际截图：单标题开放排版、常规字号/行高、小锁、账号主动作/帮助次动作及独立退出符合规格。沿用正式outline品牌、语义紫色与可收敛留白属于预先记录的设计系统保留；暂停原因改中性是权威来源不足的必要调整。该目检只证明上述正常状态，最终新源200%/短屏与取消恢复仍待验。

- 作者candidate1：20261015-author/freeze-candidate1.json，类型/SFC模板语义与既有直接3项检查仅证明具名工程范围，尚不证明浏览器。
- 独立源码：20261015-independent-source/reliability-baseline.md，列精确行号/owner/logout/void导航风险，等待冻结差量结论。
- 独立运行计划：20261015-independent/prepare-2244/acceptance-plan.md；最终真实截图、状态与交互结果须另附当前hash。
- Root最终概念/实际图核对、工程收口和推送收据待写；任何FAIL保留原始脚本、版本、输出，修稿后重新具名验证，不覆盖旧记录。

目标流程：正式受限路由 → 合成API建立各可信/未知会话状态 → 可读原因与获准出口 → 真实点击/键盘 → pending、失败、退出和晚回调反馈。Browser插件/browser技能未列出，按frontend-testing-debugging使用项目已有Playwright Chromium；所有fixture隔离context，不读取真实凭据/请求敏感数据。

## 当前未验与GAP

完整H5五态、四主题/中英/宽度、200%文本与短屏、原生ARIA/焦点/真实pointer/键盘、导航取消/失败、退出false和切号/hide晚响应尚未最终签收。类型、构建、HTTP和测试数量不能替代这些实际证据。

真实IAM/账号/支持服务业务成功、实际撤销与审计、原生App、系统字体放大/物理触摸和读屏另列NOT_RUN。缺待签发布投影仍blocked，旧显式同意fallback/409 GAP未改，不自动重签。未部署生产、未改服务器数据或Phase门。正式单页完成后才同步索引/CHANGELOG并提交推送核SHA。
