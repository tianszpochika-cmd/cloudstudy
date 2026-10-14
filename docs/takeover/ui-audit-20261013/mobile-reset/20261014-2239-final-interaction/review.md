# MB-003 当前源码独立动态复审

当前结论：**FAIL（H5 动态交互范围，补测真实按钮 Enter 首错焦点失败）**。原四阶段41项具名 PASS 保留，不能据此签完整页。正式入口 `http://127.0.0.1:18183/#/pages/reset-password/reset-password`。页面 SHA-256 为 `e00853df5fb3dfdc0d79a824f2f751035a8c3319697910d92115334dbb42031b`，指针 helper 为 `6464f4c1712b5a0f2fd4ab01d451d5bb6ffaa13bde486826a424511059ef6425`；五个阶段均在运行前后核对相同哈希。

关闭前收到跨页键盘关切后，另外执行4项实际主按钮 focus→press Enter/Space 的空提交。[button-keyboard-results.json](button-keyboard-results.json) 中 request Enter/Space、confirm Space 均 PASS；**confirm Enter FAIL**：账号仍 aria-invalid=true 且错误可见，但 keyup 后真实焦点为 `mobile-reset-token`，而非首错 `mobile-reset-identifier`；API计数0。可信 keydown 的目标是主按钮，共享激活产生 click，提交先 focusin 账号，然后同一次可信 keyup 的目标变成账号，`@confirm` 跳到口令。精确公开事件序列和 [失败截图](keyboard-empty-confirm-Enter.png) 已保存；当前源码 `confirmField` 第171–174行在 confirm 的账号 keyup 跳下一字段。本 agent 未修正式源码，需要局部修复后以新哈希复验，不能借改断言放行。

旧 `resume-final-interaction/dynamic-results.json` 的 FAIL 保留。精确失败是旧脚本第 105 行：202 已受理后编辑账号，要求 `.reset-receipt.count() === 0`。当前源码保留旧回执的自然空间，撤销其可见与可访问状态。这次新脚本只替换该过时断言，并动态证明 **DOM=1、visible=0、visibility=hidden、aria-hidden=true、role=null**，自然高 24.5px，编辑前后主按钮 top 均为 379.375px。旧脚本第 104、107 行的新提交/换步清除断言保持原样并通过。没有修改旧证据或正式源码来消除失败。

Browser 插件的 `browser` 技能未列入本会话，采用 frontend-testing-debugging 技能允许的缺失回退：现有 Playwright 1.63.0 / Chromium 隔离上下文。所有 API 均拦截为合成响应，TLS 验证保持默认。没有真实账号、邮件或有效口令，没有读取请求 body/header、认证 Token、cookies、敏感存储；输出仅含路由元数据、布尔、长度、公开文案与 UI 几何。普通 64 项视觉矩阵未重复。

| 阶段 | 当前源码结果 | 直接证据 |
| --- | --- | --- |
| 即时输入/字段语义/状态/错误/返回 | 27 项 UI_SCOPE_PASS | [dynamic-results.json](dynamic-results.json)；12 项即时原生输入 clear/replace × click/Enter、超限不截断、步骤与语言语义生命周期、真实纠正 click、202/429/503/连接中断、未知 401 中性错误与明确 invalid 401、confirm pending 防切/防重、合成 204 清字段、合法单/双编码 returnTo 和外链回退。 |
| 真实指针与英文 200% 长短错误 | 8 项 POINTER_SCOPE_PASS | [pointer-results.json](pointer-results.json)；首次新错误快 click 与 160ms 按住均 trusted click=1、0请求，主按钮 top 625.234375px 不变；拖离与 Chromium 原生 touchCancel 均0点击/0请求且快照解除。英文 200% 长错误→空字段短错误、空字段→合规值，各覆盖输入后延时0/160ms，按住160ms时原按钮命中、几何不移，释放后更新错误/ARIA。 |
| 受理回执编辑后的真实指针 | 4 项 RECEIPT_POINTER_SCOPE_PASS | [receipt-pointer-results.json](receipt-pointer-results.json)；中文和英文200%各覆盖输入后延时0/160ms，再真实按住160ms。编辑撤销旧可见回执但保留自然空间，实际 down 命中、trusted click=1，request计数1→2；中文自然高24.5px/top379.375px、英文200%自然高147px/top821.765625px，编辑/按住期间均不移。 |
| 申请等待与成功终态补充 | 2 项 TERMINAL_GUARD_SCOPE_PASS | [terminal-guard-results.json](terminal-guard-results.json)；request pending 的真实点击、Enter及直接事件/函数调用不能换步、返回或重发，输入/动作 disabled且只有1请求；合成204成功后账号/口令/密码/显隐清空，form/input/换步/眼睛移除，反复submit/switch不新增请求、不复活表单，返回登录可用。 |

四阶段 pageerror 均0、非预期 console error 均0。仅动态 fixture 的 HTTP/连接失败日志计入预期错误：dynamic 5、pointer 2、receipt 0、terminal 1。页面身份、非空内容、无框架错误覆盖层由回执阶段四个 fresh context 核验。41 项是本次检查记录数，不能折算页面/产品/业务完成率。

追加键盘阶段 pageerror 0，4次空提交API均0；共45项记录，44项通过、1项失败，此计数仅说明检查覆盖。

已实际查看 `english200-long-to-empty-delay160-held.png`、`english200-long-to-empty-delay160.png`、`receipt-en200-delay160-held.png` 和 `reset-synthetic-confirm-success.png`：按住时保持已报长文案，释放后显示当前短错误；编辑后的回执不可见并留空间；成功后只有成功说明和返回登录。它们支持本次动态状态结论，不替代主 Agent 的全页视觉验收。

另有只读独立复核 agent 复核旧断言与当前源码，确认保留回执节点的语义；其指出 request pending 和成功后的再次提交缺口，已由 terminal 阶段补跑。其复核早于新增键盘关切，不能覆盖随后发现的 Enter 首焦点 FAIL。未验证窗口 blur/contextmenu 等其它手势中断，本次 native cancel 仅指 Chromium 输入事件，不能等同原生 App。

测试期间启动自己的服务：session **77625**、监听 PID **19892**，固定 `127.0.0.1:18183`、strictPort、`--force`。启动前该端口无监听，没有停止/重启其他共享服务。服务仍保留供 MB-002 同轮复用。root 负责构建、正式报告、全页视觉与 Git，本 agent 只写本新证据目录。

阶段额度均由官方工具实读：开始5小时已用7%/周67%；动态结束14%/68%；截图检查18%/68%；原收口20%/69%；追加键盘阶段24%/69%，均未触及90%停止线。

真实 IAM、账号存在性不枚举、邮件送达、有效一次性口令、密码事实更新及重置后真实登录 **NOT_RUN**。原生 iOS/Android/iPad/微信小程序、物理软键盘/读屏、真实 Keychain/Keystore 和 refresh 清理 **NOT_RUN**。UI fixture 的204和页面字段清空不关闭原生清理契约 GAP，也不迁移 R1/IT 业务状态。旧 b3/3e/9729 等 FAIL 与作者矩阵全部保持原件。
