# MB004 正式学习设置 — 本轮H5 UI收口

状态：**PUSHED_UI_SCOPED**，提交a7d26107698b88f58df7bbd8ac7fd289f817cb0e已核origin/dev-redesign完整SHA一致，[推送收据](../PUSH-RECEIPT-20261015-MB004.md)。真实路由为http://127.0.0.1:18183/#/pages/onboarding/onboarding；Vue/uni-app正式代码实现，不是静态Demo。范围为本机Chromium实际H5、合成API夹具下的排版/视觉/交互/状态与共享影响；真实IAM/learner事实、原生端/物理输入/读屏不在本次签收中。

## 重新设计后的四态

| 实际状态 | 信息与排版 | 主次动作 |
| --- | --- | --- |
| 成人资格 | 单标题、短出生年份说明、原生年份与整行18岁声明；没有默认政策大框或重复hero | 条件未满足时主按钮禁用；确认中锁控件，真实拒绝与未知/网络失败分开；账号设置、退出为明确出口 |
| 同意状态 | 简洁真实历史记录、已记录版本、可展开来源；缺当前待签发布投影明确blocked | 已满足事实可续步；缺文档不出现签署按钮，可实际重新读取；不造正文/默认版本或自动重签 |
| 学习目标 | 四目标与5/15/30/45分钟，短说明、选中信号和足够边界对比；字体放大时自动减少时长列 | 唯一主动作保存并开始定级；失败保留可见选择，目标读回匹配后才导航 |
| 已保存摘要 | 目标/时长只读摘要和定级用途；不重复整套编辑表单，不新增强制确认步骤 | 开始定级；明确调整目标回填已保存值，不能忽略可见dirty修改 |

标题28px/1.4/650，说明14px/1.75，标签14px，输入/主动作16px，辅助13px；420/560px开放主体、24px移动边距、44px交互区域，沿AppIcon和共享语义色。当前/完成/待完成有文字，颜色不是唯一状态信号。中英UI经共享i18n，内容语言与界面语言分离。

## 实际验证与版本范围

作者[完整报告](20261015-resume-author/final-1239/author-report.md)及[逐组版本清单](20261015-resume-author/final-1239/author-final-manifest.json)保留每组前后hash与执行字节。独立[最终签收](20261015-independent/final-1239/review.md)和[九源签名](20261015-independent/final-1239/final-signature.json)已完成；没有把旧f56/854/9a结果改标为当前结果。

| 证据层 | 当前具名结果 | 实际限界 |
| --- | --- | --- |
| 作者四态矩阵 | 128 PASS：中英×320/390/768/1280×亮/暗/高对比/跟随系统 | 实际截图、控件边界/字号/命中区、无溢出/裸key/overlay/pageerror |
| 作者状态/交互 | 43 PASS：恢复7、onShow恢复2、文字/指针13、flow15、controls2、race4 | 成功/错误/读取/持久目标读回、键盘ARIA、旧中心0/160ms、拖离/可信取消、禁用后启用及secondary、busy与晚回调 |
| 作者真实SVG边界 | 8 PASS | 原父盒文字色指标作废，实际tick paint测量取代；框对页底最小5.504:1，实际tick对填充最小7.969:1 |
| 独立当前八源 | 视觉14、risk16、pointer/文字18 PASS | 真正checkbox边界、320/390/1280英文200%、权限/403一次刷新零签署、输入/目标/退出与手势 |
| 独立九源补验 | 恢复3、Gate键盘3、登录标题8、三auth定向15 PASS | 包含已推登录标题0c5窄修；所有当前组pageerror0，旧标题异常没有免除 |
| 真实模块 | Root9文件43 PASS、独立gateway/resume29 PASS | 新增4条refresh/restore等待及401/owner晚回调，非浏览器/真实后台签收 |
| 编译 | 当前组合typecheck/H5 build PASS | 含登录onReady后最终日志，不代替上述运行验收 |

测试最终源码d0fe8157只修正真实SVG测量，矩阵/43交互执行版本8397、边界8执行d0fe；两版分别保存，没有给未执行版本编造结果。200%为浏览器实际字体翻倍，CDP touchCancel为浏览器可信取消；不提升为OS原生缩放或真机触控认证。

Root已对照[概念](concept.png)与当前390中文及320英文200%真实gate/goal截图进行view_image复核；独审还目检当前四态320/390/1280英文200%。Browser插件/skill本会话未提供，使用既有Playwright Chromium，未安装新依赖。

| 对照点 | 已落实与必要差量 |
| --- | --- |
| 容器与主次关系 | 开放单列、字段到主动作、底部出口，无嵌套装饰框/默认等待卡；四态沿同一系统 |
| 字体与图标 | 正常无衬线及上述字号，沿正式AppIcon的25px品牌图标；不把概念生成的星形当新logo |
| 文案 | 年份只采年份说明，英文示例缩短为e.g.1995；缺合法发布目录改为查看同意状态，不能照概念自造签署正文 |
| 颜色与轮廓 | 消费仓库v2语义Token；真实checkbox补到可见框，checked/unchecked与焦点均可辨，四主题实际度量 |
| 响应式 | 桌面保留三列进度；移动改紧凑三行number+整词文字，关闭200%拆词实际FAIL，时长列随字体增长收缩为更少列 |
| 状态/交互 | 初始无错误大框；真实错误保留必要自然高度，pointerdown到click几何稳定；禁用末端释放且即时blur启用仍保留快照 |

## 安全与业务事实

当前权限来自契约化principal/me及明确PASSED+ELIGIBLE；UNKNOWN/RESTRICTED/网络失败不授予学习资格，也不伪造成REJECTED。成人事实成功后复用IAM刷新JWT；目标403保留真实IAM同意事实，typed sessionRefreshRequired只请求一次同owner刷新再读，持续拒绝仍blocked零签署。目标编辑仅写目标，不再PATCH回默认偏好；owner/version/idempotency和服务PEP不移到客户端。

实际restore成功误跳登录已以同revision时序复现并修复：restore等已有refresh判定再判断身份，refreshing期间仍不授予认证/学习权限。退出/换号/隐藏后迟到响应不改他人事实。登录标题异常已独立定位并以onReady窄修，提交54f5ac0e02a529635eefb3b7c55dd3cd7d33a71f已核远程同SHA。

继承R1-006/007/008/010/011/013/016/017与BC/IC映射，详见[实施计划](implementation-plan.md)。未改契约、服务器、生产数据或阶段Gate。旧显式签署fallback/409自动重签仍GAP，当前页不调用；待签发布目录和真实后台/native证据仍独立保留，当前UI通过不改变它们的状态。

源的raw/LF hash、私有备份与保护核对见本目录20261015-root-final-1735/final-source-snapshot.json；正式源已按白名单单页提交并核远程，原始FAIL、诊断、错误测试注入与旧矩阵都保留。

发布记录检查：16份本页正式源/测试严格diff空白检查，Git index逐字节等于已验raw的LF归一化；56保护文件hash无漂移。原始归档执行脚本仅免除EOF空行、原始控制台日志仅免除EOL空格/EOF空行，保留其执行字节与失败输出，不以此放宽正式源检查。
