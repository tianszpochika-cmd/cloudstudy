# 官网风格移动端 UI 改造记录

日期：2026-09-22。范围：`apps/mobile` 当前 `pages.json` 注册的全部 31 页及其共享功能组件。用户授权为依照官网改造整个移动端 UI，含登录和各功能页面。

## 设计与实现

- 直接消费官网 `officialSitePalette`，通过 `packages/design-tokens/src/mobile.ts` 输出移动端语义变量。紫色主按钮、薰衣草/鼠尾草绿/杏色辅助卡片、深紫品牌区、柔和圆角、线形底部导航和清晰标题统一应用到各页。
- `MobilePageHeader`、`MobileFeatureGrid`、`useMobileExperience` 提供共同页面结构、六类练习入口、主题/画质/动效。页面标题和公共文案由共享 i18n 的 mobile namespace 提供中文/英文资源；旧业务模块继续使用现有语言适配，本轮不是全部遗留业务文案的国际化验收。
- 主题覆盖浅色、深色、跟随系统、高对比；按页面根绑定变量，避免 uni-app 页面不属于 App 模板子树导致主题失效。底部原生导航通过 uni API 同步颜色、标题与图标；H5 图标使用根路径，防止嵌套路由解析错误。
- 动效默认开启，可在设置减少/关闭；接入既有四级 AdaptivePerformanceEngine，Performance 与系统减少动态效果会停用装饰动画。使用 CSS 书本装饰，不引入新渲染框架。
- 登录补齐显示/隐藏密码、注册和找回密码入口、错误反馈；公开路由允许匿名注册/重置。重置成功显示明确结果并清理输入，支持带 token 的深链接。保留现有 IAM 提交和密码规则。
- 首页保留真实任务/课程读取，增加六类练习入口；个人页整理资料与服务导航；设置支持即时主题/动效预览，内容语言与 UI 语言继续分离；修正发音偏好与工单分类 picker 的索引映射。
- H5 原有 stock Vue 适配未调用 uni 的 `$applyOptions`，导致页面显示但 `onLoad/onShow` 不执行。新增 H5 专用初始化桥接，调用官方逻辑并依据 `__isVisible` 防重复。浏览器检查用明确任务、昵称与重置查询参数验证生命周期实际生效。
- 保留鉴权、答题、媒体授权、录音、离线、权益、成长与恢复的数据链路。没有新建第二套移动项目，没有修改接口/数据库契约，没有开启 Phase 2 AI 或生产支付。

## 页面库存与上游映射

`PAGE-P1-` 前缀以下省略。范围由现有页面注册表计数，不等同于业务设计中所有待实现页面族均已完成。P1R 承接依据 [追溯覆盖矩阵](../../../../requirements/backlog/v2-phase1-rebaseline/04-追溯覆盖矩阵.md)；UI 修复归入相关既有实现任务，不把旧 B/DEV 编号升级为新计划验收。

| 页面路由名 | 页面/功能 | PAGE 页面族 | P1R 承接 |
|---|---|---|---|
| home | 首页任务、课程与练习入口 | LEARN-HOME | M4-008 |
| learn | 课程与学习流 | COURSE-SHELF | M4-008、M5-001 |
| practice | 多技能练习入口 | PRACTICE-HUB | M5-006 |
| b2-vocabulary | 词汇与复习卡片 | VOCAB、SRS | M5-003/007/008 |
| b2-practice | 练习会话与答题反馈 | PRACTICE-SESSION | M5-002/006 |
| b3-grammar | 语法与长难句 | GRAMMAR | M5-003 |
| b3-writing | 写作练习 | WRITING | M5-005 |
| b3-listening | 听力精练 | LISTENING | M5-004 |
| b3-reading | 阅读精练 | READING | M5-004 |
| b3-speaking | 口语与音标 | SPEAKING | M5-005 |
| b11-listening | 授权音频、字幕与 Language Clips | LISTENING | M5-004 |
| b11-reading | 分级阅读与进度恢复 | READING | M5-004 |
| b11-speaking | 音标、录音与影子跟读 | SPEAKING | M5-005 |
| world | 成长与奖励 | WORLD | M7-003/004 |
| b5-commerce | 学习权益 | COMMERCE | M7-006…009 |
| b6-platform | 画质与设备 | DEVICES、SETTINGS | M4-002、M6-004 |
| b4-games | 游戏大厅 | GAME | M7-002 |
| b4-social | 虚拟自习室 | SOCIAL | M7-004/005 |
| b4-avatar | 形象与衣柜 | AVATAR-REWARD | M7-003 |
| b4-offline | 离线学习 | SYNC-OFFLINE | M5-008、M6-003 |
| profile | 个人资料与服务导航 | SETTINGS | M6-004 |
| login | 登录与密码可见性 | AUTH-LOGIN | M4-001/002 |
| register | 成人账号注册 | AUTH-REGISTER-RESET | M4-001 |
| reset-password | 重置指引与设置新密码 | AUTH-REGISTER-RESET | M4-001 |
| forbidden | 权限不足与返回 | AUTH-LOGIN 的权限分支 | M4-002 |
| onboarding | 目标、每日时长、成人同意 | ONB-GOAL、ADULT-CONSENT | M4-003/004 |
| assessment | 规则化测评 | ASSESSMENT | M4-005 |
| today | 今日任务与进度 | TODAY | M4-008、M5-012 |
| b10-report | 学习报告与错题恢复 | REPORT、MISTAKES-MASTERY | M5-006/009…012 |
| settings | 主题、动效与内容语言 | SETTINGS | M6-004 |
| support | 帮助与工单 | SUPPORT | M6-006 |

需求来源：沿用 [980 功能登记册](../08-980plus-功能点设计登记册.md) 的 FEAT、PRD 来源列及其原子追溯关系，不创建新功能编号或篡改范围计数。涉及 ONB `V2-980-0001…0022`、VOC/GRM/LST/RDG/SPK/WRT/ASM `0023…0266`、GAM/SOC `0267…0358`、USR/INF `0359…0460`、COM `0461…0492` 的现有 UI；例如资料表单承接 `FEAT-USR-006`。这不是对上述所有原子范围的实现声明。

架构仍遵守 `ARCH-PLAT-001` 的追溯基线及既有 IAM/Gateway/领域 owner 边界。参与者 `ACT-P1-VISITOR/LEARNER`；旅程 `JNY-P1-01…12/14`；成人同意、规则评测、SRS、奖励和权益规则使用既有 RULE 包。INT 与 E2E 精确编号继续引用上游矩阵与 [业务运行设计](../phase1-business-operation/README.md)，本轮 UI 证据不替代 AUTH-LIFECYCLE、FIRST-DAY、TODAY-SESSION、MULTISKILL/SRS、REWARD/SOCIAL、ENTITLEMENT、SUPPORT 的真实联调与端到端证据。

## 验证与复跑

命令均在仓库根执行：

```powershell
pnpm --filter @englishflow/mobile typecheck
pnpm --filter @englishflow/design-tokens typecheck
pnpm --filter @englishflow/i18n typecheck
pnpm --filter @englishflow/mobile build:h5
node scripts/dev/run-node-tests.mjs apps/mobile/tests
pnpm --filter @englishflow/mobile dev:h5
# 18183 启动后，另一个终端运行：
node apps/mobile/tests/mobile-experience.e2e.mjs
```

- 移动端与两个共享包类型检查通过，移动 H5 生产构建通过。
- 现有移动端回归 40/40 通过。B11 口型降级断言由旧英文展示词改为口型容器与真实参数绑定，保留性能档位、波形和降级标记检查。
- 浏览器矩阵为 31 页 × 5 组合 = 155：浅色 320/390/768 宽，深色 390，高对比 390；检查唯一页面标题、无嵌套页面容器、无横向溢出、当前路由、实际主题背景，5 个 tab 的图标全部加载。
- 14 类交互覆盖公开认证导航、必填反馈、重置分步、密码可见性、uni form 提交、跨 tab 课程参数、即时深色、关闭动效、重置请求/成功反馈、重置深链接、系统主题、默认动效、系统减少动态效果、键盘提交。
- 输出：`artifacts/mobile-experience-2026-09-22/results.json`、主要页面三种主题截图、`build.log` 与 `regression.log`。浏览器成功结果中的 `errors` 仅指页面运行异常，不代表所有 API 请求成功。

证据边界：测试在独立 Chromium 上下文拦截 API，首页/资料/目标/设置使用合成数据，其余多数业务页面使用接口不可用或空态。密码重置和登录成功也仅为受控 UI fixture；没有发出真实邮件、更改真实密码或生成真实学习记录。此次没有启动 Gateway/IAM，也没有 iOS/Android/iPad 真机、麦克风/后台音频、原生安全存储、支付、离线冲突及所有业务成功分支验收。结论仅为当前 31 页 UI 改造和上述 H5 验证完成，不能标记业务全量 ACCEPTED 或生产可发布。

本地依赖曾存在失效 pnpm junction；已修复移动端解析并将 Pinia alias 指向实际入口，没有停止其他项目服务，没有改依赖版本。现有 uni 编译器/Vite 兼容提示不影响本轮 H5 构建，但原生发行仍需独立验证。开发服务保留在固定 `127.0.0.1:18183`，未部署公网。
