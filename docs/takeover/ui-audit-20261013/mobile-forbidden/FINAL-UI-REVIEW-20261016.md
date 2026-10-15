# MB005 正式访问受限页 — 当前H5 UI验收

**UI_VERIFIED_LOCAL / 远程待推。** 正式Vue页面已全面重排，当前C4通过独立H5界面验收；GitHub连接失败，不能称已推送。真实IAM/后台、native与辅助设备仍NOT_RUN，不升级R1业务或发布状态。

## 用户可见变化

取消重复Header、原因大卡和装饰层，使用轻品牌、小锁、一个原因标题及短说明；管理账号为主动作、帮助为次动作、退出单独置于末尾。正常字号/行高与共享四主题语义色、图标和触控区域统一，英文经现有i18n完整显示。未知状态与成人拒绝分开；无owner的暂停marker只呈现中性暂停，不伪造当前用户撤回事实。

页面内pending防重、失败反馈和owner/可见性守卫覆盖账号/帮助/退出。真实uni导航被取消时不再永久锁住全部按钮：有限等待后给一条可读提示并恢复操作，移除取消后可真重试。该等待不能撤销已dispatch的平台导航，不声称底层请求已取消。退出失败区分本设备清理与请求未确认，提示使用人话。

320px/200%实测发现unavailable、confirmed拆词，分别改为This content is not available.和We cannot confirm access，不降低放大字号；当前全文自然换行、可滚动到动作。

## 当前版本与实现边界

正式改动仅forbidden.vue、mobile-experience.ts本页键及两个直接测试。页面raw d38dd97ccb717d3b477327cef5af49fa84d265df0a0032a17e2725ad6e85e718；copy cb47a78d810e2c2b08fc280f237cae726ee7a66cc2c0bf2dccf7c1112baaca83；e2e 04ff778848e3f8746430b1579feff2e4d27ec75b9415928a021e178a6588b2de。完整8源raw/LF及保护核验见20261016-root-final/final-source-snapshot.json。

共享session/gateway/navigation/pointer helper保持，不造授权/法律发布版本，不开放Phase1外能力。沿R1-007/009/013、BC门禁链及ARCH-IAM-002/ARCH-API-001与既有B8契约；只重设计本页并保留明确GAP。

## 实际环境与证据

URL为http://127.0.0.1:18183/#/pages/forbidden/forbidden。Browser插件/browser技能不在能力列表，使用项目已有Playwright Chromium，无依赖安装。各context隔离，API均为合成拦截；不读真实凭据、Cookie/storage或敏感请求内容。390×844对应概念原生宽度；另有320/768/1280与320×460文本200%短屏。文本放大和CDP touchCancel不等于OS缩放或真机验收。

[独立最终报告](20261016-independent/final-0342/review.md)、[签名](20261016-independent/final-0342/candidate4/final-signature.json)绑定当前C4八源，当前52项具名记录：

| 当前C4组 | 范围 | 结果 |
|---|---|---|
| visual22 | 五态/四主题、中英选宽度；真实控件、焦点、标题和布局 | PASS |
| text10 | 200%整词/短屏、选语言与宽度、英文generic四主题 | PASS |
| pointer/keyboard16 | 三动作0/160ms、drag/cancel、帮助/退出Enter/Space | PASS |
| owner/query2 | 新登录进行中不被旧退出打断；恶意query后真登录到固定设置页 | PASS |
| closure2 | 真实runtime取消恢复/真重试；退出503新文案/安全登录 | PASS |

所有当前组pageErrors为空，无overlay、裸key、横向溢出；真实[role=button]精确非空数量断言后测58个控件，最小文字和主/次动作识别边界均5.504:1，主动作至少48px、触控至少44px。文字型退出按文字与焦点识别，不伪造边框测量。

Root当前C4完整typecheck、直接3项检查和H5 build通过，日志20261016-root-final/candidate4。作者C2的128矩阵/12smoke/8text/3pointer、独审C2十一风险仍按其原copy2a版本保留，不重标当前。C2到C4仅两条英文H1及测试预期变化，page d38和安全依赖完全相同；当前C4另实际检查新标题、剩余交互、query/new-login、取消及退出false。

## 概念与真实图核对

Root在同次view_image中查看完整concept.png、当前C4成人390中文亮色、generic/unknown320英文暗色200%实际图，独审也完成同次比较。

1. 开放单列、单标题和短原因，外层框/重复宣言已移除。
2. 正常28px标题、14px说明及相应行高，短屏文本200%保持整词和自然滚动。
3. 账号主动作/帮助次动作/独立退出层级明确，放大后按钮可增高换行。
4. 采用既有语义紫色/四主题与正式outline品牌和22px锁；这是DESIGN-SPEC预先规定的设计系统适配，不复制生成图的光晕/大锁。暗色按钮使用现有on-brand颜色以保持对比。
5. 常规24px边距、最大420px列和可收敛留白；200%不机械复制概念固定留白，没有固定底栏遮挡。
6. 顶部可见文案差异均有原因：暂停归因必须中性；两条英文短标题修复真实拆词；未知/匿名扩展同一控件族且只给实际可用出口。未添加装饰badge/艺术字或虚构功能。

按已接受的概念及书面规格核对，当前签收范围内无未解决的实质视觉/交互差异。

## 旧失败与限制

保留candidate1真实导航取消卡死、C2/C3真实拆词及原图/Range证据。旧空数组控件对比声明已单独erratum撤回，不能算PASS。错误uni host选择器、原生标题假设、raw编码比较和1px按压精确相等断言均按harness分类保留；当前实际中心仍命中、click/request数量未放宽。旧两次作者smoke没有保存精确脚本字节，保留结果/hash并诚实列证据GAP，当前脚本不冒充旧源。部分raw scope沿用CANDIDATE2模板文字，实际完整hash与渲染事实标识当前C4，原始文件不改。

真实后台业务/审计、native、物理触摸/读屏、OS缩放、生产性能及发布验收未签。GET consents仍只有历史元数据，缺待签发布投影、owner撤回权威与旧显式签署GAP未因本页UI通过消失。未改生产服务器/数据或阶段门。当前自有service10670/PID36440、Creation2026-10-16 03:55:51.253027，固定18183；无测试inflight，不停止unknown/shared服务。
