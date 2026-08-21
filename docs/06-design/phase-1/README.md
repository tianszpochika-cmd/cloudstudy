# Phase 1 UI/UX 设计文档（v1.0）

> 依据 [PRD v3.3](../../../requirements/product-requirements.md) 交付的第一阶段完整 UI/UX 设计包。设计边界：18 岁及以上成人用户、无生成式 AI、Study Room 低 UGC、随机奖励仅学习行为免费获得（不可付费抽取）。

## 目录结构

```
docs/06-design/phase-1/
├── README.md                              # 本索引
├── 语学星_Phase1_UIUX设计总册_v1.0.md      # 设计总册（总则与全局规范，优先阅读）
└── uiux-specs/                            # 分册设计文档（20 份）
    ├── 00_README_设计文档索引.md           # 分册索引与设计目标、一级导航
    ├── 01_设计系统_配色_字体_间距.md
    ├── 02_信息架构_导航_页面框架.md
    ├── 03_AdaptiveHome_学习地图……
    ├── 04_Onboarding_水平测评……
    ├── 05_词汇_短语_SRS_表达库.md
    ├── 06_语法_长难句_写作.md
    ├── 07_听力_阅读_LanguageClips……
    ├── 08_PracticeHub_Checkpoint……
    ├── 09_游戏化_XP_Streak_任务……
    ├── 10_3D人物_衣柜_学习空间_奖励箱.md
    ├── 11_StudyRoom_排行榜_成员……
    ├── 12_个人中心_设置_消息通知.md
    ├── 13_VIP_Household_订单……
    ├── 14_客服_隐私_下载_同步_异常恢复.md
    ├── 15_Admin_教研_运营后台.md
    ├── 16_组件库_按钮_表单_状态规范.md
    ├── 17_动效_声音_触觉_无障碍.md
    ├── 18_设计验收清单.md
    └── SOURCE.md                          # 设计包基线说明
```

## 阅读顺序建议

1. **设计总册**（全局原则、设计语言）→
2. **uiux-specs/00 索引**（设计目标、5 Tab 一级导航）→
3. 01 设计系统 + 02 信息架构（骨架）→
4. 各功能分册（按开发排期取用）→
5. 18 设计验收清单（验收对照）。

## 配套技术文档

- 3D 人物渲染与降级：[avatar-3d-rendering-pipeline.md](../../02-architecture/avatar-3d-rendering-pipeline.md)
- 四级画质引擎：[cross-platform-and-performance-adaptive.md](../../02-architecture/cross-platform-and-performance-adaptive.md)
- 全局设计系统（历史基线）：[design-system.md](../design-system.md)

## 高保真稿件（mockups/）

Aurora 极光工作台视觉方向 · 共享令牌 [tokens.css](./mockups/tokens.css) · 完整索引见 [mockups/README.md](./mockups/README.md)

本地 HTML UI 套件工作记录：[LOCAL_HTML_UIUX_WORK_LOG_2026-08-21.md](./LOCAL_HTML_UIUX_WORK_LOG_2026-08-21.md) · 构建清单：[html-ui-build-manifest.json](./html-ui-build-manifest.json)

| 套件 | 设备视图 | 内容 | 文件 |
| :--- | :--- | :--- | :--- |
| Aurora UI Suite v0.3 | Mobile / Pad / Web | 9 个核心页面族、43 条核心语义路由、54 个页面地图入口、浅色/深色主题与交互状态 | [complete-ui-ux-command-center.html](./mockups/complete-ui-ux-command-center.html) |

旧的分散式 HTML 稿件已收束进主稿，避免多份视觉事实源继续漂移。

