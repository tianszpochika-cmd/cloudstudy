# 设计文档总索引

> 按交付阶段分文件夹组织。每个模块文档统一包含两大部分：**功能设计**（功能点、规则、状态、边界情况）与**交互设计**（页面结构、操作流程、反馈与动效）。
> 全局规范见：[design-system.md](./design-system.md)（品牌/体验关键词）、[immersive-frontend-architecture.md](./immersive-frontend-architecture.md)（渲染管线）、[cross-platform-and-performance-adaptive.md](../02-architecture/cross-platform-and-performance-adaptive.md)（四级画质降级）。

## 目录结构

```
docs/06-design/
├── design-system.md                      # 全局设计系统（品牌、体验关键词、跨端原则）
├── immersive-frontend-architecture.md    # 沉浸式前端与动效渲染架构
├── ux-flows.md                           # 早期用户流草稿（历史）
├── phase-1/                              # 第一阶段：标准语言学习 App（无 AI 完全商用版，本次设计重点）
│   ├── README.md                         # 总览：信息架构、全局导航、视觉基调、全局规则
│   ├── 01-account-and-onboarding.md      # 账号、入学引导、监护人模式
│   ├── 02-home-and-daily-task.md         # 首页、今日任务、打卡、学习日历与周报
│   ├── 03-vocabulary-learning.md         # 单词学习（词书库、背词会话、个人词库）
│   ├── 04-grammar-and-sentence.md        # 语法体系与句子拆分
│   ├── 05-speaking-and-phonetics.md      # 口语跟读、48 音标、情景会话
│   ├── 06-writing.md                     # 作文训练（汉译英/仿写/改错）
│   ├── 07-exam.md                        # 考试与成绩报告（四六级模拟）
│   ├── 08-review-and-mistakes.md         # 复习队列、错题本、词库复习
│   ├── 09-gamification-and-leaderboard.md # 排行榜、徽章、战队、能量树、小游戏
│   ├── 10-vip-and-commercial.md          # VIP 权益、支付、激活码、到期策略
│   └── 11-admin-console.md               # 管理后台（内容双审/会员运营/看板）
├── phase-2/                              # 第二阶段：AI 能力层（大纲占位，第一阶段验证后细化）
│   └── README.md
└── phase-3/                              # 第三阶段：升学与职场人群扩展（大纲占位）
    └── README.md
```

## 阅读约定

1. **需求溯源**：每份设计文档头部注明对应的需求文档章节（PRD / mvp-scope / roadmap）。
2. **阶段边界**：第一阶段不含任何 LLM 功能；依赖 AI 的能力在设计中以"第二阶段预留"标注降级形态。
3. **线框表示**：ASCII 线框图表达布局骨架；具体视觉稿以 Figma（packages/design-tokens 令牌）为准。
4. **画质降级**：所有动效描述默认遵循四级画质引擎，Performance 档一律退化为静态/文字反馈。
