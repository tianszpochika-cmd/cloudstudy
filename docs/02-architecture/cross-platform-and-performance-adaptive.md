# 统一跨端多平台架构与自适应画质降级引擎 (Unified Cross-Platform & Adaptive VFX Engine)

> **设计目标**：
> 1. **一套代码体系打通全平台**：PC Web、iPad (平板大屏与触控笔)、Windows 桌面客户端、移动端 (iOS/Android) 及 微信小程序。
> 2. **全配置兼容自适应**：从千元低配机/老旧电脑到旗舰 iPad Pro / 高配 PC，根据硬件算力与实时帧率动态无缝缩放特效，确保 100% 不卡顿。

---

## 1. 跨端统一架构终极解选型分析 (Cross-Platform Architecture)

为了实现 **“一套核心体系覆盖 Web + H5 + iPad + Windows 桌面 + 手机 + 小程序”**，我们对比业界三种主流方案：

| 方案对比 | 技术栈组成 | iPad (平板生态) 体验 | Windows 桌面端表现 | 微信小程序兼容度 | 总体评分与推荐度 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **方案 A (推荐，主线)：uni-app (Vue3) 统一全端** | Vue 3 + uni-app + Pinia | 🌟🌟🌟🌟 原生渲染编译，适配 Pencil 手写与分屏 | 🌟🌟🌟 Web+PWA 主线；如需全局热键等原生能力可选 Tauri 2.0 壳 | 🌟🌟🌟🌟🌟 条件编译直出小程序，与 App/H5 同套代码 | 🏆 **9.8分（与团队 Vue3 技能匹配，商用落地最成熟）** |
| **方案 B：React 统一核心 + Tauri 2.0 跨端壳 (Monorepo)** | React (Next.js / Vite) + **Tauri 2.0** + Taro | 🌟🌟🌟🌟 良好 | 🌟🌟🌟🌟🌟 内存占用极小 (~30MB)，安装包 <15MB | 🌟🌟🌟🌟 共享业务 Hooks 与状态管理 | 8.5分（团队需从零学 React） |
| **方案 C：Flutter 全家桶 (Dart)** | Flutter for Desktop + Mobile + Web | 🌟🌟🌟🌟 良好 | 🌟🌟🌟🌟 良好 | 🌟🌟 小程序支持度差，国内生态受限 | 8.0分 |

> **Phase 1 端发布优先级（PRD §1.3）**：首发 Android/iOS App + Learner Web/H5 + 官网 + Admin 中台；微信小程序可后置到 P1.5；大屏/教室端 Phase 3 再议。不为“端数量”牺牲主学习链路质量。

### 🏆 最优推荐组合：Vue 3 + uni-app 一套代码多端编译（决策见 ADR-0004）

```
                                +--------------------------------------------+
                                |  packages/ui-web & packages/ui-mobile &    |
                                |  packages/contracts                        |
                                |  (全端统一业务状态 Pinia、AI 契约与设计令牌)|
                                +--------------------------------------------+
                                                      |
        +---------------------------------------------+---------------------------------------------+
        |                                             |                                             |
        v                                             v                                             v
+-----------------------+                 +-----------------------+                 +-----------------------+
| 1. PC Web / 官网       |                 | 2. H5 手机浏览器       |                 | 3. iPad / 平板客户端   |
| (uni-app H5 / Nuxt 3) |                 | (uni-app H5 + PWA)    |                 | (uni-app iOS 编译)     |
| - 响应式大屏自适应     |                 | - 落地页转化入口      |                 | - 支持 Apple Pencil    |
| - GPU 3D 沉浸全开     |                 | - 可安装伪 App        |                 | - 支持分屏多任务      |
+-----------------------+                 +-----------------------+                 +-----------------------+
        |                                             |                                             |
        v                                             v                                             v
+-----------------------+                 +-----------------------+                 +-----------------------+
| 4. 移动端 App         |                 | 5. 微信小程序 (Miniapp)|                 | 6. Windows 桌面端      |
| (iOS / Android)       |                 | (uni-app 条件编译)    |                 | (Web+PWA / Tauri 壳)   |
| (uni-app 原生渲染编译) |                 |                       |                 |                       |
+-----------------------+                 +-----------------------+                 +-----------------------+
```

---

## 2. 硬件算力自适应与特效分级降级引擎 (Adaptive Graphics & VFX Engine)

> 3D Avatar（Avatar Studio / Wardrobe / 学习空间）的渲染与降级策略专项见 [avatar-3d-rendering-pipeline.md](./avatar-3d-rendering-pipeline.md)，与本引擎四档联动。

为了让低配老电脑、千元安卓机与高配旗舰机都能极致流畅，系统建立 **四级画质梯队 (Graphic Tiers)** 与 **动态帧率监测状态机 (Dynamic FPS Watcher)**。

### 2.1 四级画质梯队规范 (Four-Tier Quality Matrix)

| 画质档位 | 目标设备定位 | 3D 口腔发音实验室 | 卡通伴学数字人 (Mimi/Bolt) | 长难句 X 光机 & 知识图谱 | 游戏与答题粒子特效 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Ultra (极致沉浸)** | 独立显卡 PC、iPad Pro (M系列芯片)、旗舰手机 | 3D 高精解剖 + 呼吸泛光 Shader + 360°自由光影 | Rive 全骨骼物理动效（高刷设备最高 120fps）+ 实时视线跟随 | Vue Flow / AntV G6 WebGL 模式 + 动态力导向流光粒子 | 5000+ 粒子爆炸、光晕特效全开 |
| **High (标准高质)** | 普通轻薄本 (核显)、主流中端手机、普通 iPad | 3D 基础解剖 (关闭后处理泛光，固定主光源) | Rive 基础骨骼状态机 | Vue Flow Canvas 模式 + 连线高亮 | 1000 粒子、标准金币动画 |
| **Medium (平衡省电)** | 入门级笔记本、低功耗移动端 | **智能降级为 2.5D SVG 动态矢量剖面图** | Rive 降帧至 30fps 简化动画 | 静态树形分层 DOM 展开 | 仅保留轻量 CSS 缩放反馈 (无粒子) |
| **Performance (极速性能/极简)** | 老旧机型、教室老旧教学大屏、弱网极低配 | **纯 2D 精美手绘解剖切片图 (0 GPU 负载)** | 静态立绘表情包 (按情绪切换静态帧) | 极简折叠式文本大纲 (零 Canvas) | 完全关闭所有动效 (纯文字与色块变化) |

---

### 2.2 自动性能探测与动态降级算法实现 (Benchmark & Auto-Scaler)

系统包含**两道防线**：
1. **冷启动 1 秒离屏渲染基准测试 (Off-screen Benchmark)**：探测 GPU 跑分，初次启动自动设置最佳档位。
2. **运行时动态帧率巡检 (Runtime FPS Guard)**：连续 3 秒检测到 FPS < 35 自动触发平滑降级，并提醒用户。

```typescript
// 画质级别与性能状态定义
export type GraphicQualityTier = 'ultra' | 'high' | 'medium' | 'performance';

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
  private currentTier: GraphicQualityTier = 'high';
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
      ultra: 'high',
      high: 'medium',
      medium: 'performance',
      performance: 'performance'
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
      case 'ultra':
        return { currentTier: 'ultra', targetFps: 120, enable3DWebGL: true, enableRiveBonePhysics: true, enableParticleVFX: true, enablePostProcessingGlow: true, particleLimit: 5000 };
      case 'high':
        return { currentTier: 'high', targetFps: 60, enable3DWebGL: true, enableRiveBonePhysics: true, enableParticleVFX: true, enablePostProcessingGlow: false, particleLimit: 1000 };
      case 'medium':
        return { currentTier: 'medium', targetFps: 60, enable3DWebGL: false, enableRiveBonePhysics: false, enableParticleVFX: false, enablePostProcessingGlow: false, particleLimit: 200 };
      case 'performance':
        return { currentTier: 'performance', targetFps: 30, enable3DWebGL: false, enableRiveBonePhysics: false, enableParticleVFX: false, enablePostProcessingGlow: false, particleLimit: 0 };
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
|  [ ] 极致沉浸 (3D 解剖全开 + 全光影粒子 + 高刷设备满帧渲染)            |
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
1. **分屏与多任务**：支持左侧观看 3D 音标/微课视频，右侧打开手译本或笔记应用分屏互动。
2. **Apple Pencil 手写整合**：
   - 考研手译本与高考读后续写真实手写输入（canvas 手写组件 + OCR 实时转文字并批改，必要时用原生插件增强）；
   - 在长难句 X 光机上直接使用 Apple Pencil 画圈标记主谓宾与划掉修饰成分。

### 4.2 Windows 桌面端专属优化 (Windows 10/11)
1. **Web + PWA 主线**：浏览器直接访问 + PWA 安装，零打包成本；
2. **可选 Tauri 2.0 原生壳增强**（按需启用，严禁 Electron）：
   - 全局划词与即时 AI 伴学热键 (`Alt + Space` 呼出悬浮助手，长难句秒拆或商务邮件重写）；
   - 离线资源预载与本地硬件加速：本地存储预下载 1080P 教材音视频与 3D 模型资产，实现 0 缓冲秒开。

