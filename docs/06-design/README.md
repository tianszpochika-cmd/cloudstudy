# 设计文档总索引

> 需求基线：[PRD v3.2（四层基础设施 + 3D 成长系统全量版）](../../requirements/product-requirements.md)。Phase 1 UI/UX 设计包已交付（v1.0）；Phase 2/3 设计待对应阶段启动后交付。

## 当前可用文档

```
docs/06-design/
├── design-system.md                      # 全局设计系统（品牌、体验关键词、跨端原则，历史基线）
├── immersive-frontend-architecture.md    # 沉浸式前端与动效渲染架构
├── ux-flows.md                           # 早期用户流草稿（历史）
└── phase-1/                              # ⭐ 第一阶段 UI/UX 设计包 v1.0（本次交付）
    ├── README.md                         # 阶段索引与阅读顺序
    ├── 语学星_Phase1_UIUX设计总册_v1.0.md  # 设计总册（总则，优先阅读）
    └── uiux-specs/                       # 20 份分册（设计系统/信息架构/各功能模块/组件库/动效/验收清单）
```

## 后续交付预告（依据 PRD v3.2）

- **Phase 2 设计**：AI Tutor、语音评测、数字人、雅思/托福等界面与交互，待 Phase 2 启动后交付。
- **Phase 3 设计**：未成年人/K12 受监管扩展，资质允许后交付。

## 阅读约定

1. **需求溯源**：每份设计文档头部注明对应的 PRD 章节。
2. **阶段边界**：Phase 1 不含任何生成式 AI 功能；依赖 AI 的能力以"Phase 2 预留"标注降级形态。
3. **线框表示**：ASCII 线框图表达布局骨架；具体视觉稿以 Figma（packages/design-tokens 令牌）为准。
4. **画质降级**：所有动效描述默认遵循四级画质引擎，Performance 档一律退化为静态/文字反馈。
5. **全局规范**：见 [design-system.md](./design-system.md)、[immersive-frontend-architecture.md](./immersive-frontend-architecture.md) 与 [cross-platform-and-performance-adaptive.md](../02-architecture/cross-platform-and-performance-adaptive.md)。
