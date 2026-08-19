# 统一跨端多平台架构与自适应画质降级引擎 (Unified Cross-Platform & Adaptive VFX Engine)

> **设计目标**：
> 1. **一套代码体系打通全平台**：PC Web、iPad (平板大屏与触控笔)、Windows 桌面客户端、移动端 (iOS/Android) 及 微信小程序。
> 2. **全配置兼容自适应**：从千元低配机/老旧电脑到旗舰 iPad Pro / 高配 PC，根据硬件算力与实时帧率动态无缝缩放特效，确保 100% 不卡顿。

---

## 1. 跨端统一架构终极解选型分析 (Cross-Platform Architecture)

为了实现 **“一套核心体系覆盖 Web + iPad + Windows 桌面 + 手机 + 小程序”**，我们对比业界三种主流方案：

| 方案对比 | 技术栈组成 | iPad (平板生态) 体验 | Windows 桌面端表现 | 微信小程序兼容度 | 总体评分与推荐度 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **方案 A (推荐)：Web 统一核心 + Tauri 2.0 跨端壳 (Monorepo)** | React (Next.js / Vite) + **Tauri 2.0** (跨桌面与移动) + Uni/Taro | 🌟🌟🌟🌟🌟 原生支持 Split-View 分屏、Pencil 触控 | 🌟🌟🌟🌟🌟 **内存占用极小 (~30MB)**，安装包 <15MB，无 Electron 臃肿感 | 🌟🌟🌟🌟 共享业务 Hooks 与状态管理 | 🏆 **9.8分（现代全端最优解）** |
| **方案 B：React Native 矩阵 (RN + RN Windows + RN Web)** | React Native + Microsoft RN for Windows + Expo | 🌟🌟🌟🌟 良好 | 🌟🌟🌟 依赖微软 C++ 运行时，Windows 桌面生态库较少 | 🌟🌟🌟 需要单独适配 Taro 编译器 | 8.5分 |
| **方案 C：Flutter 全家桶 (Dart)** | Flutter for Desktop + Mobile + Web | 🌟🌟🌟🌟 良好 | 🌟🌟🌟🌟 良好 | 🌟🌟 小程序支持度差，国内生态受限 | 8.0分 |

### 🏆 最优推荐组合：统一 React 生态 Monorepo + Tauri 2.0 (全端原生化)

```
                                +--------------------------------------------+
                                |  packages/ui-core & packages/contracts     |
                                |  (全端统一业务状态 Pinia/Zustand、AI 契约)   |
                                +--------------------------------------------+
                                                      |
        +---------------------------------------------+---------------------------------------------+
        |                                             |                                             |
        v                                             v                                             v
+-----------------------+                 +-----------------------+                 +-----------------------+
| 1. PC Web / 官网       |                 | 2. Windows 桌面客户端  |                 | 3. iPad / 平板客户端   |
| (Next.js / React 18+) |                 | (Tauri 2.0 + Rust 核心)|                 | (Tauri 2.0 / Capacitor) |
| - Chrome/Edge 全面支持 |                 | - <15MB 极小体积包     |                 | - 支持 Apple Pencil    |
| - GPU 3D 沉浸全开     |                 | - 极速冷启动 & 离线缓存 |                 | - 支持 Split-View 分屏 |
+-----------------------+                 +-----------------------+                 +-----------------------+
        |                                             |                                             |
        v                                             v                                             v
+-----------------------+                 +-----------------------+                 +-----------------------+
| 4. 移动端 App         |                 | 5. 微信小程序 (Miniapp)|                 | 6. macOS 桌面客户端   |
| (iOS / Android)       |                 | (Taro / Vue3 编译层)  |                 | (Tauri 2.0 原生构建)   |
+-----------------------+                 +-----------------------+                 +-----------------------+
```

---

## 2. 硬件算力自适应与特效分级降级引擎 (Adaptive Graphics & VFX Engine)

为了让低配老电脑、千元安卓机与高配旗舰机都能极致流畅，系统建立 **四级画质梯队 (Graphic Tiers)** 与 **动态帧率监测状态机 (Dynamic FPS Watcher)**。

### 2.1 四级画质梯队规范 (Four-Tier Quality Matrix)

| 画质档位 | 目标设备定位 | 3D 口腔发音实验室 | 卡通伴学数字人 (Mimi/Bolt) | 长难句 X 光机 & 知识图谱 | 游戏与答题粒子特效 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Ultra (极致沉浸)** | 独立显卡 PC、iPad Pro (M系列芯片)、旗舰手机 | 3D 高精解剖 + 呼吸泛光 Shader + 360°自由光影 | Rive 60/120fps 全骨骼物理动效 + 实时视线跟随 | React Flow WebGL 模式 + 动态力导向流光粒子 | 5000+ 粒子爆炸、光晕特效全开 |
| **High (标准高质)** | 普通轻薄本 (核显)、主流中端手机、普通 iPad | 3D 基础解剖 (关闭后处理泛光，固定主光源) | Rive 基础骨骼状态机 | React Flow Canvas 模式 + 连线高亮 | 1000 粒子、标准金币动画 |
| **Medium (平衡省电)** | 入门级笔记本、低功耗移动端 | **智能降级为 2.5D SVG 动态矢量剖面图** | Rive 降帧至 30fps 简化动画 | 静态树形分层 DOM 展开 | 仅保留轻量 CSS 缩放反馈 (无粒子) |
| **Performance (极速性能/极简)** | 老旧机型、教室老旧教学大屏、弱网极低配 | **纯 2D 精美手绘解剖切片图 (0 GPU 负载)** | 静态立绘表情包 (按情绪切换静态帧) | 极简折叠式文本大纲 (零 Canvas) | 完全关闭所有动效 (纯文字与色块变化) |

---

### 2.2 自动性能探测与动态降级算法实现 (Benchmark & Auto-Scaler)

系统包含**两道防线**：
1. **冷启动 1 秒离屏渲染基准测试 (Off-screen Benchmark)**：探测 GPU 跑分，初次启动自动设置最佳档位。
2. **运行时动态帧率巡检 (Runtime FPS Guard)**：连续 3 秒检测到 FPS < 35 自动触发平滑降级，并提醒用户。

```typescript
// 画质级别与性能状态定义
export type GraphicQualityTier = ''ultra'' | ''high'' | ''medium'' | ''performance'';

export interface SystemPerformanceConfig {
  currentTier: GraphicQualityTier;
  targetFps: number;
  enable3DWebGL: boolean;
  enableRiveBonePhysics: boolean;
  enableParticleVFX: boolean;
  enablePostProcessingGlow: boolean;
  particleLimit: number;
}

export class AdaptivePerformanceEngine {
  private currentTier: GraphicQualityTier = ''high'';
  private frameCount = 0;
  private lastTime = performance.now();
  private lowFpsStreak = 0; // 低于 35 帧的持续次数

  // 1. 运行时帧率巡检
  public monitorFrame() {
    this.frameCount++;
    const now = performance.now();
    
    if (now - this.lastTime >= 1000) {
      const currentFps = this.frameCount;
      this.frameCount = 0;
      this.lastTime = now;

      this.evaluateHealth(currentFps);
    }
  }

  // 2. 动态健康度评估与平滑降级
  private evaluateHealth(fps: number) {
    if (fps < 35) {
      this.lowFpsStreak++;
      if (this.lowFpsStreak >= 3) {
        // 连续 3 秒卡顿，自动降一档
        this.degradeTier();
        this.lowFpsStreak = 0;
      }
    } else {
      this.lowFpsStreak = Math.max(0, this.lowFpsStreak - 1);
    }
  }

  private degradeTier() {
    const tierMap: Record<GraphicQualityTier, GraphicQualityTier> = {
      ultra: ''high'',
      high: ''medium'',
      medium: ''performance'',
      performance: ''performance''
    };

    const nextTier = tierMap[this.currentTier];
    if (nextTier !== this.currentTier) {
      this.currentTier = nextTier;
      this.applyConfig(this.currentTier);
      this.notifyUserDegraded(nextTier);
    }
  }

  public applyConfig(tier: GraphicQualityTier): SystemPerformanceConfig {
    switch (tier) {
      case ''ultra'':
        return { currentTier: ''ultra'', targetFps: 120, enable3DWebGL: true, enableRiveBonePhysics: true, enableParticleVFX: true, enablePostProcessingGlow: true, particleLimit: 5000 };
      case ''high'':
        return { currentTier: ''high'', targetFps: 60, enable3DWebGL: true, enableRiveBonePhysics: true, enableParticleVFX: true, enablePostProcessingGlow: false, particleLimit: 1000 };
      case ''medium'':
        return { currentTier: ''medium'', targetFps: 60, enable3DWebGL: false, enableRiveBonePhysics: false, enableParticleVFX: false, enablePostProcessingGlow: false, particleLimit: 200 };
      case ''performance'':
        return { currentTier: ''performance'', targetFps: 30, enable3DWebGL: false, enableRiveBonePhysics: false, enableParticleVFX: false, enablePostProcessingGlow: false, particleLimit: 0 };
    }
  }

  private notifyUserDegraded(newTier: GraphicQualityTier) {
    console.info(`[PerformanceGuard] 检测到设备硬件负载较高，已智能切换至【${newTier.toUpperCase()}】流畅模式。`);
  }
}
```

---

## 3. 设置面板中的画质与性能控制 (User Settings UX)

在产品任意端的 **「设置 -> 显示与画面」** 中，提供直观的画质调节卡片：

```
+-----------------------------------------------------------------------+
|  画面与动效表现 (Graphics & Effects)                                    |
|                                                                       |
|  [●] 智能自适应 (推荐 - 根据设备性能与电量自动匹配)                     |
|  [ ] 极致沉浸 (3D 解剖全开 + 全光影粒子 + 120Hz 高刷)                   |
|  [ ] 平衡流畅 (标准 3D / 适度动效 - 兼顾画质与耗电)                      |
|  [ ] 极速省电 / 极简 (2D 平面切片 + 静态图表 - 适配老旧电脑与千元机)    |
|                                                                       |
|  高级开关：                                                           |
|  - 3D 口腔实验室硬件加速 (开启/关闭)             [ ON ]               |
|  - AI 数字人骨骼动态跟随 (开启/关闭)             [ ON ]               |
|  - 答题爆破粒子与连击震动                        [ ON ]               |
+-----------------------------------------------------------------------+
```

---

## 4. iPad 与 Windows 桌面客户端专项优化设计

### 4.1 iPad 大屏与交互专属优化 (iPad Pro & Air)
1. **Split-View 分屏与多任务**：支持左侧观看 3D 音标/微课视频，右侧打开手译本或笔记应用分屏互动。
2. **Apple Pencil 深度整合 (PencilKit)**：
   - 考研手译本与高考读后续写真实手写输入（OCR 实时转文字并批改）；
   - 在长难句 X 光机上直接使用 Apple Pencil 画圈标记主谓宾与划掉修饰成分。

### 4.2 Windows 桌面端专属优化 (Windows 10/11)
1. **全局划词与即时 AI 伴学热键 (Global Shortcut)**：
   - 按下 `Alt + Space` 呼出 EnglishFlow 悬浮助手，随手选中文档即可进行长难句 X 光机秒拆或商务邮件重写。
2. **离线资源预载与本地硬件加速**：
   - 利用 Windows 本地存储预下载 1080P 教材音视频与 3D 模型资产，实现 0 缓冲秒开。

