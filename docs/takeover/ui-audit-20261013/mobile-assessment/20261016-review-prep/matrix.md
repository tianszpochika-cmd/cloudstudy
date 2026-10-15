# MB006 待验矩阵 / PREPARED_NOT_RUN

仅准备 fixture 与验收范围；本目录没有运行新浏览器组，也没有候选 PASS、测试截图或独审签收。原 before 目录及证据保持原样。2026-10-16 本组前官方额度 68% / 周41%，ordinaryUsageAllowed=true，未用重置券。

运行前由 Root 冻结最终 page+i18n 及相关源 SHA，先实读额度，达到90%即停止新组。候选未冻结时不得把准备脚本当作验证证据。Browser plugin/browser 技能缺席，后续明确使用既有 Playwright fallback。

## fixture 接口与范围

`fixture.cjs` 只在显式 `init()` 后开浏览器。`freeze(hashes())` 或传入具名 manifest 开启每次 fresh 的源漂移保护；`hash(file)`/`hashes()` 仅算文件字节。`fresh({locale,theme,width,height,colorScheme,readySelector})` 默认390×844、zh-CN/light；真实填写登录页，经 returnTo/guard 到 assessment，再等待语义 heading，未依赖旧 assessment CSS。若最终候选没有语义 heading，Root 可传入最终具名主内容 selector，须在报告列明。

返回 `{page,p,context,state,hold,release,pending,close}`。`state.responseError=true`/`retestError=true`/`ensureError=true` 注入503；数字可指定状态码。`state.responseDelay=true` 或 `hold('response')` 保持响应，`release('response')` 放行；数字 delay 为毫秒自动放行。同样支持 retest/get delay 与 startError/getError。失败 response 不推进检查点；GET 按实际已有 session 读回。通过真实10题提交才能获得合成 ASSESSED 报告；重测真实 `POST /assessment/placement/sessions/{sid}/retest` 返回新 session、旧 session/report 保留。fixture 不消费或检查 request body/header，不把真实端点 bodyless 契约声称为已检验的网络断言。

`state.counts` 包含 start/respond/retest/ensure/GET/placementGet/login/refresh/logout/principal；请求日志仅 method/origin/path/场景编号。所有API均fulfil，未知路由501；非API只允许18183源资源，外部abort。没有 SKIPPED 合成、store/guard 注入、真实token/cookie/storage/body/header读取。`state.subject`/principalStatus/adultGate/access/accepted 只改下一次合成服务响应事实，身份切换仍须走真实登出/登录或页面恢复流程。

每个case调用其`close()`，最终`close()`释放所有hold并关闭全部context/browser。该准备fixture尚未运行，selector、主题跟随系统、owner/hide组合均需后续实际验证。

## 待验内容（全部 NOT_RUN）

| 组 | 路径与断言 |
|---|---|
| 引导/题目/报告 | 正常登录guard→引导；点击开始1写→未选禁用→选择可读状态；真实10次submit→ASSESSED与真实字段、不造0；FULL/ZERO归属上一提交；报告后ensure次数与失败notice。 |
| 重测确认 | 报告点击重测只显示确认、零retest写；取消零写；确认后仅1写、忙碌可读；新session从第1题，旧报告可读；retestError时原报告保留并显示错误、可恢复重试。 |
| 提交失败/读回 | responseError→提交失败后当前选择保留且不宣称已提交；清失败后点击读回GET原session，无新start；检查点仍未推进时允许重新选择/提交；无法读回不得伪装成功。 |
| 延迟/指针 | responseDelay hold期间选项/主操作不改当前提交；0/160ms指针up、drag出界、cancel分别验证请求次数、选中与焦点；旧坐标不误击新动作，不能只用DOM click或disabled样式。 |
| 键盘 | Tab有可见焦点；选项Enter/Space改一次；主操作Enter/Space只写一次；确认/取消焦点及错误可读；不被busy永久锁死。 |
| owner/hide | 正常退出/重新登录换owner，旧response晚到不显示旧题/旧报告、不继续write；实际导航离开/回来，未提交选择与服务端检查点分别说明；不绕过guard、不以直接store赋值代替身份事件。 |
| 排版/主题/语言 | zh-CN/en-US × light/dark/high-contrast/system（系统明暗跟随另核）；320/390/768/1280宽；200%文字+长题干/长选项/多行错误。核溢出、断词、触达、contrast、selected/focus/disabled、同宽before/after概念差异。 |
| 证据门 | 每组冻结SHA、页面身份、非空、overlay、console、真实交互与截图；未知API=0或明确FAIL。Fixture UI、真实owner DB/IAM/Gateway、native/实体设备分别记录。SKIPPED/保守计划仍是具名GAP，不造reportId。 |

建议先做上述高风险交互，再按剩余额度决定具名排版组合；不能由计划行数推导PASS或整页完成率。
