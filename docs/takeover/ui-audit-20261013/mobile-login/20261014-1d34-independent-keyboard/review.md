# MB-001 1d34 主按钮键盘差量独立复签

具名结论：**UI_PASS_PRIMARY_KEYBOARD_DELTA_H5**。当前 login 原始源码 SHA-256 为 `1d347967146a38723ab0bf3ae0b1accca3b519ae6515e7c14f12297be1b80e19`，两阶段运行前后相同。原 da5ad208 的真实空主按钮 Enter FAIL、截图和诊断均保留在 `../20261014-2239-keyboard-diagnostic/`；本次PASS不覆盖原件，也不重签未重跑的26项普通视觉矩阵。

正式入口 `http://127.0.0.1:18183/#/pages/login/login`。Browser的browser技能未列入会话，沿用 frontend-testing-debugging 的缺失回退：现有 Playwright1.63.0 / Chromium隔离上下文，390×844；Space滚动差量另用390×460。全部API为拦截拒绝fixture，仍核对登录POST直达IAM TLS，仅记录method/origin/path。没有真实账号或密码，没有读取请求body/header、认证Token、cookie或敏感存储。快速输入探针仅对已知合成参数输出匹配布尔，并转发既有session.login到拦截API，未改变正式源码或客户端实现。

| 范围 | 当前源码证据 |
| --- | --- |
| 主检查8项 | [results.json](results.json) 为 UI_PASS_PRIMARY_KEYBOARD_DELTA_H5。空Enter/Space各按住160ms并追加repeat keydown：释放前button焦点/无错误/0请求，单次keyup后账号首错稳定，两字段invalid和错误关联正确/0请求。有效Enter/Space各仅1请求；pending时原生输入、眼睛、主按钮和出口disabled，重复Enter/Space、真实click及直接事件/函数不能重发、换显隐或离开路由，字段保留；拒绝后恢复。另验证仅密码缺失的Enter/Space首错始终password、仅缺失字段invalid；账号input Enter到password、空password Enter报错0请求、合规password Enter只1请求；mouse form提交仍只1请求。 |
| 最新字段窗口8项 | [supplemental-results.json](supplemental-results.json)：identifier/password × clear/replace × Enter/Space。快速native input后立即移焦primary，8项均观测到blur前模型旧值窗口。clear均0调用/0POST并聚焦缺失字段；replace均合成参数匹配true、1调用/1POST，字段语义恢复。证明keyup不携带form detail时仍通过既有blur同步使用当前值；未读取HTTP body。 |
| Space滚动1项 | 同supplemental结果：390×460实际button聚焦时scrollY=200；Space按住160ms与keyup启动pending后仍均200，keydown0请求、keyup1请求，防止默认Space页面滚动。 |

共17项当前哈希记录均PASS。两阶段pageerror0、非预期console error0；预期401资源日志主检查4、补充5。fresh context核对正式路由、欢迎回来标题、2输入、无Vite覆盖层。已实际查看 [empty-primary-Enter.png](empty-primary-Enter.png)，修后账号焦点与错误明确；图中亮紫块为Playwright密码隐私遮罩，不是产品UI配色。

只读复核agent指出repeat、单字段缺失、Space滚动和keyup最新字段的窄风险，上述检查均已覆盖。复审没有修改login/shared/helper、作者证据或Git。复用原自有服务session77625 / PID19892、固定127.0.0.1:18183，无服务启停。官方额度开始36%/周71%，补充前41%/72%，收口46%/73%，未触及90%停止线。

本次只关闭原da5的主按钮Enter首错焦点差量及相关必要回归。真实IAM成功、成人Gate、业务返回、原生App/小程序、物理键盘/系统读屏、credential storage和refresh清理 **NOT_RUN**；历史整页/业务证据状态不由此晋升。root负责最新工程检查、正式报告与单独提交推送。
