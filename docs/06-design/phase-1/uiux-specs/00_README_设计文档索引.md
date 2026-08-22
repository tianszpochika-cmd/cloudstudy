# 语学星 Phase 1 UI/UX 设计文档索引

> **状态：历史 v1 索引。** 仅用于迁移、术语和既有实现核对；下一轮任务必须从 [`../../v2-980plus/README.md`](../../v2-980plus/README.md) 和 v2 架构映射开始，不得以本索引替代 v2 的业务设计或验收。
>
> **文档类型**：UI/UX Design Specification  
> **版本**：v1.0  
> **基线 PRD**：`requirements/product-requirements.md`（PRD v3.3）
> **适用阶段**：Phase 1（含 P0 / P1 / P1.5 中属于第一阶段的能力）  
> **用户边界**：18岁及以上成人 / 大学生  
> **AI边界**：不提供生成式 AI、不提供 AI 发音评分、不提供 AI 实时陪练  
> **社交边界**：Study Room 仅低 UGC；无私聊、无自由文本评论、无用户自由发帖  
> **随机奖励边界**：仅学习行为免费获得随机奖励箱；不可付费抽取、不可充值货币抽取、不可交易/提现

---

## 0. 前端项目冻结

Phase 1 UI/UX 设计映射到四个前端项目：

| 项目 | 负责端 | 设计实现边界 |
|---|---|---|
| `apps/mobile` | 移动 H5、iOS、Android、iPad；后续微信小程序 | 同一套 uni-app 学习业务与状态语义，按平台做布局、能力和性能降级 |
| `apps/learner-web` | PC Web、平板浏览器、PWA | 独立 Web 导航壳和宽屏工作台，不复制移动 H5 页面 |
| `apps/admin-web` | 教研、审核、运营、商业化和客服后台 | 独立信息架构、权限模型和高密度工作台，不进入学习者五 Tab |
| `apps/official-site` | 官网公开内容 | 独立品牌、SEO、价格、下载和合规页面，不进入登录后的学习路由 |

四个项目共享设计语言、Token、状态命名和可访问性要求，但不要求跨 `uni-app` / Web 直接复用 DOM 或页面代码。`apps/miniapp-wechat` 不是独立业务项目。

---

## 1. 设计目标

第一阶段视觉与交互目标不是“小型 MVP”，而是一个可以正式商业化的成熟语言学习产品：

1. **成年人也愿意长期使用**：视觉不幼稚，不做低龄卡通化。
2. **学习本身有游戏感**：通过地图、等级、任务、角色、收藏、连击、反馈强化沉浸感。
3. **每个按钮都服务学习闭环**：学习 → 反馈 → 复习 → 奖励 → 回到学习。
4. **复杂功能易理解**：通过渐进披露、上下文入口、统一组件降低认知负担。
5. **低成本可实现**：Phase 1 不依赖 LLM，推荐逻辑可解释、可配置。
6. **跨端统一**：Android / iOS / H5 / iPad / Web 共享同一设计语言；项目边界仍按四个前端项目执行。
7. **可扩展到 Phase 2 / 3**：AI、未成年人、K12 入口均预留组件能力，但第一阶段不展示。

---

## 2. 一级导航建议

移动端使用 5 Tab：

| Tab | 名称 | 核心职责 |
|---|---|---|
| 1 | **学习** | Adaptive Home、今日任务、学习地图、Continue Learning |
| 2 | **练习** | Practice Hub、Mistake Repair、Quick Practice、Checkpoint、CET |
| 3 | **世界** | 游戏岛、3D人物、学习空间、收藏、Study Room |
| 4 | **课程** | Scenario Packs、分级阅读、Language Clips、专题课程 |
| 5 | **我的** | 个人中心、报告、会员、订单、设置、消息、客服 |

Web / iPad 使用左侧导航 + 顶部状态区；核心信息架构保持一致。

---

## 3. 设计文档清单

| 文件 | 模块 | 优先级 |
|---|---|---|
| `01_设计系统_配色_字体_间距.md` | 全局设计系统 | P0 |
| `02_信息架构_导航_页面框架.md` | IA / 导航 / 页面容器 | P0 |
| `03_AdaptiveHome_学习地图_ContinueLearning.md` | 首屏与学习地图 | P0 |
| `04_Onboarding_水平测评_StudyPlan.md` | 新手引导/测评/计划 | P0 |
| `05_词汇_短语_SRS_表达库.md` | Vocabulary / Phrase / Sentence Mining | P0 |
| `06_语法_长难句_写作.md` | Grammar / Sentence / Writing | P0 |
| `07_听力_阅读_LanguageClips_口语.md` | Listening / Reading / Speaking | P0/P1 |
| `08_PracticeHub_Checkpoint_CET_学习报告.md` | 练习/修复/考试/报告 | P0 |
| `09_游戏化_XP_Streak_任务_成就.md` | Gamification | P0 |
| `10_3D人物_衣柜_学习空间_奖励箱.md` | Avatar / Wardrobe / Reward | P0/P1 |
| `11_StudyRoom_排行榜_成员展示.md` | 轻社交/学习室 | P1 |
| `12_个人中心_设置_消息通知.md` | 第四层基础设施 | P0 |
| `13_VIP_Household_订单_权益.md` | 商业化 | P0 |
| `14_客服_隐私_下载_同步_异常恢复.md` | 客服/隐私/同步/异常 | P0 |
| `15_Admin_教研_运营后台.md` | Admin | P0 |
| `16_组件库_按钮_表单_状态规范.md` | UI组件规范 | P0 |
| `17_动效_声音_触觉_无障碍.md` | Motion / Audio / Accessibility | P0/P1 |
| `18_设计验收清单.md` | QA / Design Review | P0 |

---

## 4. 通用页面标注模板

所有模块设计文档按以下字段标注：

```text
[页面编号]
页面名称：
所属阶段：
用户目标：
进入入口：
主按钮：
次按钮：
危险操作：
空状态：
加载状态：
错误状态：
权限要求：
Deep Link：
埋点：
```

开发 Agent 可以直接把该结构映射到：

- route
- component
- API contract
- analytics event
- permission
- feature flag

---

## 5. 第一阶段视觉关键词

**成熟、轻盈、星海、成长、沉浸、专注、可探索。**

避免：

- 低龄儿童插画风
- 过度荧光色
- 赌场/老虎机式奖励视觉
- 满屏红点与营销弹窗
- 过多同时动画
- 复杂玻璃拟态导致可读性下降
- “AI老师”“名师”“高考提分”等越界文字

