# MB-003 c9a6 独立动态复签

**UI_PASS（本次正式 H5 页面动态交互范围）**。当前页面 SHA-256：`c9a6da864e9ce8933cb5a42b6743ff99551fa433eafe701ea470c760d88cc936`；helper：`6464f4c1712b5a0f2fd4ab01d451d5bb6ffaa13bde486826a424511059ef6425`。五个脚本运行前后均核对该组合，pageerror 0、非预期 console error 0。

前版 e008 的41项通过、真实 primary Enter 首错焦点 FAIL及截图保留在 `../20261014-2239-final-interaction/`。root在正式 reset 页局部处理按钮 keydown/keyup，本 agent未修改源码、helper、shared或Git。新源码不能继承旧通过，所以在本新目录执行当前哈希复签，没有重跑普通64项视觉矩阵。

| 当前哈希检查 | 结果与证据 |
| --- | --- |
| 实际主按钮 Enter/Space，空/有效，两步骤 | 8/8 PASS：[button-keyboard-results.json](button-keyboard-results.json)。空提交 keyup 后首错均 `mobile-reset-identifier`、aria-invalid=true、错误可见、API0；有效申请和确认的 Enter/Space 均恰好1请求，并显示合成503的中性失败。空确认Enter的已修焦点截图：[keyboard-empty-confirm-Enter.png](keyboard-empty-confirm-Enter.png)。 |
| 原独立动态回归 | 27/27 UI_SCOPE_PASS：[dynamic-results.json](dynamic-results.json)。即时输入、字段长度不截断、语义/语言/换步生命周期、真实纠正click、202/429/503/连接中断、未知401与明确invalid401、confirm pending防切/防重、合成204清字段、单双编码安全returnTo与外链回退。 |
| 真实指针与英文200%多行长短 | 8/8 POINTER_SCOPE_PASS：[pointer-results.json](pointer-results.json)。快click/按住160ms实际命中且可信click1，首次新错误0请求；拖离/Chromium原生touchCancel为0点击/0请求并解除快照。英文200%长错误→空字段短错误、空字段→合规值，输入后0/160ms两组均保持按住几何，释放后正确更新错误/ARIA。 |
| 受理回执编辑后的真实指针 | 4/4 RECEIPT_POINTER_SCOPE_PASS：[receipt-pointer-results.json](receipt-pointer-results.json)。中文和英文200% × 输入后0/160ms，旧回执隐藏且撤销status/ARIA，原坐标按住160ms命中并trusted click1，请求计数1→2。自然高度中文24.5px/英文147px、主按钮top379.375px/821.765625px，编辑/按住不移。 |
| 申请pending与成功终态 | 2/2 TERMINAL_GUARD_SCOPE_PASS：[terminal-guard-results.json](terminal-guard-results.json)。request pending真实click/Enter及直接事件/函数均不能重发、换步或返回，保持1请求；合成204后清所有字段/显隐、移除form/input/换步/眼睛，反复submit/switch不复活、不新增请求，可返回登录。 |

49项是本次检查记录，不是产品完成率。fixture预期console错误为键盘4、动态5、pointer2、receipt0、terminal1；没有其它错误。页面身份、非空与无框架错误覆盖层经回执阶段fresh context检查。已实际查看本版空确认Enter、英文200%短错误、英文200%隐藏回执按住、合成成功四张截图；该检查支持动态状态，不替代root的全页视觉验收与构建。

旧独立动态 FAIL 的精确原因仍在前版记录：`resume-final-interaction/dynamic-review.cjs:105`要求受理后编辑账号的receipt DOM删除。新断言动态证明DOM1但visible0、visibility hidden、aria-hidden true、role null、高度保留，因此该旧断言过时；原第104/107行的新提交与换步删除断言保持并通过。旧b3/3e/9729及e008键盘FAIL均没有覆盖或改写。

采用 frontend-testing-debugging 技能；Browser的browser技能不在本会话，使用既有Playwright1.63.0/Chromium，全部API拦截、TLS验证默认，没有真实账号/邮件/有效口令，也没有请求body/header、认证Token、cookie、敏感存储读取。只保存路由元数据、布尔、长度、公开UI文案与几何；确认截图遮罩口令/密码字段。

自有固定服务 session77625 / PID19892，`127.0.0.1:18183`，strictPort+force，保留供MB002同轮复用，没有重启其它服务。c9a6阶段官方额度实读29%/周70%，回归时31%/70%，最终33%/71%，未达到90%停止线。

真实IAM、账号不枚举、邮件送达、有效一次性口令、密码事实更新/重置后登录业务闭环、原生iOS/Android/iPad/小程序、物理键盘/读屏、Keychain/Keystore与refresh清理 **NOT_RUN**。窗口blur/contextmenu等其它手势中断也未新增验证。UI合成204和输入清空不关闭原生清理GAP，不迁移R1/IT业务验收。

同族MB001只读诊断单独保留在 `../../mobile-login/20261014-2239-keyboard-diagnostic/`：当前da5ad208真实空主按钮Enter会跳password，Space正常、均0API。该发现需要独立局部修复，不由MB003本次PASS覆盖。
