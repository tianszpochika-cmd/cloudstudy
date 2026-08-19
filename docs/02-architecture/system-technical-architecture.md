# EnglishFlow 全栈技术架构设计说明书 (System Technical Architecture)

> **文档版本**：v2.1 (全平台统一架构与自适应引擎版)  
> **面向对象**：全栈开发 Agent、系统架构师、全端/前端/移动端/后端开发工程师、AI 算法工程师  
> **设计目标**：构建覆盖全阶段（K12、高中/大学升学、职场出海）、“一套核心代码打通全平台（PC Web / Windows 客户端 / iPad / 移动 App / 微信小程序）”、具备硬件自适应画质与超低延迟（<800ms）AI 伴学的现代化技术体系。

---

## 1. 总体架构拓扑 (Overall Architecture Topology)

EnglishFlow 采用 **“全端统一 Monorepo 内核 + Tauri 2.0 原生外壳 + 模块化单体业务核 (Core API) + 专用低延迟实时媒体引擎 (WebRTC) + 统一 AI 智能编排中心 (AI Orchestrator) + 自适应性能调控”** 的现代化架构。

```
+---------------------------------------------------------------------------------------------------+
|                                 1. 全平台客户端交互矩阵 (一套核心体系)                              |
|  [PC Web / 官网]     [Windows 桌面客户端]    [iPad / 平板端]       [移动端 App]       [微信小程序]  |
|  (Next.js / React)   (Tauri 2.0 + Rust内核)  (Tauri 2.0 / Pencil)  (Tauri / RN)      (Taro 编译层)  |
|   - 浏览器全平台访问   - <15MB 极小安装包      - Apple Pencil 手写   - 随时随地语音对讲 - 碎片化打卡刷词 |
|   - GPU 全沉浸渲染     - 内存占用仅 ~30MB      - Split-View 分屏      - 触感震动反馈     - 战队排行榜单 |
+---------------------------------------------------------------------------------------------------+
                                                  | (HTTPS / WSS / WebRTC)
+---------------------------------------------------------------------------------------------------+
|                                      2. 边缘接入与流量网关                                         |
|  [Cloudflare / 腾讯云 CDN] -> [WAF 防火墙 / DDoS 防护] -> [Envoy / APISIX API Gateway]             |
|   - 动态路由分发 & 负载均衡           - 全局 SSL 终止 & HTTP/3 握手       - 统一 JWT / 微信 OAuth 鉴权     |
|   - IP 频控与反作弊 (Rate Limit)     - 请求耗时追踪 (Trace ID 注入)       - 敏感数据加解密与解包         |
+---------------------------------------------------------------------------------------------------+
             |                                    |                                    |
+----------------------------+   +----------------------------+   +---------------------------------+
|  3. 业务服务中心 (Core API)  |   | 4. 实时媒体引擎 (Realtime) |   | 5. AI 智能编排层 (AI Orchestrator)|
|  (Node.js/NestJS / Go)     |   | (LiveKit / Mediasoup)      |   | (Python FastAPI / LangGraph)    |
|  - 统一用户与鉴权中心       |   | - WebRTC 信令与媒体分发    |   | - 提示词生命周期与版本治理中心  |
|  - 课程体系与教材同步中心   |   | - 双向低延迟音频流通道     |   | - 多模型网关 (Qwen/DeepSeek/GLM)|
|  - 答题评测与作业批改系统   |   | - 服务端 VAD / 打断检测    |   | - 结构化 JSON Schema 强校验     |
|  - 班级小队与社交排行榜     |   | - 实时 ASR 音素转写引擎    |   | - 内容安全合规过滤 (网信办双审) |
|  - 积分商城、订单与订阅结算 |   | - 情感感知 TTS 流式下发    |   | - 成本限额、降级策略与回放评测 |
|  - 错题集与记忆曲线调度     |   | - 3D 数字人 Lip-Sync 驱动  |   | - 依存句法分析与长难句拆解引擎  |
+----------------------------+   +----------------------------+   +---------------------------------+
             |                                    |                                    |
             +------------------------------------+------------------------------------+
                                                  | (Event Bus / RPC)
+---------------------------------------------------------------------------------------------------+
|                                      6. 异步任务与数据管道 (Workers)                               |
|  [BullMQ / Redis Streams / Kafka]                                                                 |
|   - Content-Worker (教材/音频入库与预处理)        - Eval-Worker (机考离线打分与作文深度精修)        |
|   - Notification-Worker (推送与上课提醒)          - Analytics-Worker (用户能力雷达图与漏斗计算)     |
+---------------------------------------------------------------------------------------------------+
                                                  |
+---------------------------------------------------------------------------------------------------+
|                                      7. 基础设施与数据持久层                                       |
|  [PostgreSQL 16]         [Redis 7.x Cluster]       [Milvus / pgvector]        [S3 / 腾讯云 COS]    |
|   - 关系型业务数据主库     - 缓存、分布式锁、会话   - 语法图谱/真题向量检索     - 教材音视频、录音存档 |
|   - Row-Level Security     - 每日打卡 BitMap 统计   - 语义相似度判重与推荐      - 3D 模型资产与图片   |
+---------------------------------------------------------------------------------------------------+
```

---

## 2. 全平台统一架构方案 (Web + Windows + iPad + Mobile + 小程序)

本系统坚决规避“多端多套代码独立维护”的高昂成本，采用 **“内核 100% 共享 + 视图响应式自适应 + 平台外壳分发”** 的一体化体系：

1. **核心共享层 (`packages/contracts` & `packages/memory-engine`)**：
   - 全端统一的数据契约 (TypeScript/Zod)、状态流、SuperMemo-2 记忆算法、长难句解析逻辑与 AI 流式打字机控制器。
2. **视图与动效层 (`packages/ui-components`)**：
   - 基于 Tailwind CSS 响应式断点 (sm/md/lg/xl) 实现单列手机流、iPad 分屏（Split-View）与 PC 巨幕看板自适应。
   - 3D 口腔发音模型 (Three.js) 与数字人动画 (Rive) 跨端同构。
3. **平台分发外壳**：
   - **PC Web / 官网**：Next.js / React 18+ 直接运行于浏览器。
   - **Windows / macOS 桌面客户端**：通过 **Tauri 2.0 (Rust 内核)** 封装，体积 <15MB，内存占用仅 ~30MB（杜绝 Electron 臃肿），支持 `Alt+Space` 全局划词伴学热键。
   - **iPad / 平板端**：基于 Tauri 2.0 / Capacitor 封装，原生适配 **Apple Pencil 原生手写真题手译本** 与分屏多任务。
   - **移动端 App (iOS / Android)**：Tauri 2.0 / React Native 跨平台封装，具备 Taptic 震动与硬件降噪。
   - **微信小程序**：通过 **Taro** 将核心逻辑编译为小程序同构页面。

---

## 3. 硬件算力自适应与画质分级降级引擎 (Adaptive Graphics & VFX Engine)

为了让低配老旧电脑、千元安卓机与旗舰设备（iPad Pro、独显 PC）均能流畅运行，系统实现 **四级画质梯队** 与 **动态帧率监测状态机 (FPS Guard)**：

### 3.1 四级画质梯度规范 (Four-Tier Quality Matrix)
| 画质档位 | 设备画像 | 3D 口腔发音实验室 | 卡通伴学数字人 (Live2D) | 长难句 X 光机 & 知识图谱 | 答题与游戏粒子特效 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Ultra (极致沉浸)** | 独显 PC、iPad Pro (M系列)、旗舰手机 | 3D 高精解剖 + 呼吸光晕 Shader + 360° 全景光影 | Rive 120fps 全骨骼物理动效 + 视线鼠标/触控跟随 | WebGL 模式 + 动态力导向连线流光粒子 | 5000+ 粒子爆炸、光晕全开 |
| **High (标准高质)** | 普通轻薄本 (核显)、主流手机、普通 iPad | 3D 基础模型 (关闭抗锯齿与后期泛光) | Rive 60fps 基础骨骼状态机 | Canvas 模式 + 连线高亮 | 1000 粒子、标准金币动画 |
| **Medium (平衡省电)** | 入门级笔记本、低功耗移动设备 | **自动降级为 2.5D SVG 动态矢量剖面图** | 降至 30fps 简化动画 | 静态树形分层 DOM 展开 | 仅保留轻量 CSS 缩放反馈 (无粒子) |
| **Performance (极速极简)** | 老旧机型、学校旧教学大屏、弱网机型 | **纯 2D 精美手绘解剖切片图 (0 GPU 负载)** | 静态立绘表情包 (按情绪切换静态帧) | 极简折叠式大纲 (0 Canvas) | **完全关闭所有动效** (纯文字与色块) |

### 3.2 运行机制
- **首次冷启动**：后台执行 1 秒离屏渲染 Benchmark 评估设备算力，自动匹配最佳档位。
- **运行时动态调控**：若连续 3 秒检测到画面帧率低于 **35 FPS**，触发平滑降级并弹窗提示。
- **用户自由开关**：用户随时可在「设置 -> 显示与画面」中自由锁定画质级别或开关 3D/粒子特效。

---

## 4. 核心技术栈规范矩阵 (Tech Stack Matrix)

| 领域 | 选型与框架 | 版本/协议 | 职责定位 |
| :--- | :--- | :--- | :--- |
| **全端统一 UI** | React 18+ / Next.js 14+ / Tailwind CSS | LTS | 统一全端业务交互组件、响应式布局与 SSR/SSG 渲染 |
| **桌面与移动外壳** | **Tauri 2.0 (Rust Core)** | v2.0+ | Windows 客户端、macOS、iPad、iOS/Android 超轻量跨端原生外壳 |
| **小程序端编译** | **Taro 3.x** | v3.6+ | 编译输出微信小程序与多端轻量容器 |
| **2D/3D 特效引擎** | **Three.js (R3F) + Rive + React Flow + Pixi.js** | 最新稳定版 | 3D 口腔解剖、矢量骨骼数字人、动态长难句语法树与粒子特效 |
| **核心业务后端** | **Node.js (NestJS)** 或 **Java (Spring Boot 3)** | Node 20 LTS / Java 17+ | 模块化单体 DDD 架构，负责用户、课程、答题流水、记忆调度、订单 |
| **AI 编排服务** | **Python 3.11+ (FastAPI + LangGraph + LiteLLM)** | Python 3.11 | 大模型网关路由、长难句依存句法分析、读后续写三阶升格、安全风控 |
| **实时低延迟媒体** | **LiveKit SFU + WebRTC + Silero-VAD** | LiveKit 1.6+ | 端到端 <800ms 实时语音对讲、随时打断 (Barge-in)、流式 TTS 下发 |
| **数据库与缓存** | **PostgreSQL 16 (pgvector) + Redis 7.x** | PG 16 / Redis 7 | 强关系型业务持久化、向量语义检索、排行榜 ZSet、打卡 BitMap |
| **异步任务流** | **BullMQ (Redis-based)** | 最新稳定版 | 异步削峰、AI 作文深度批改、机考离线打分、定时推送 |

---

## 5. 工程 Monorepo 目录结构规范

```
├── apps/
│   ├── api-gateway/            # 边缘网关与安全鉴权
│   ├── core-api/               # 业务核心服务 (NestJS/Node.js)
│   ├── ai-orchestrator/        # AI 智能编排中心 (FastAPI/Python)
│   ├── realtime-server/        # 实时 WebRTC 语音服务 (LiveKit/Go)
│   ├── web-learner/            # 统一核心 Web 学习端 (Next.js / React)
│   ├── desktop-windows/        # Windows 桌面应用外壳 (Tauri 2.0)
│   ├── tablet-ipad/            # iPad 平板应用外壳 (Tauri 2.0 / PencilKit)
│   ├── mobile-app/             # 移动手机客户端 (Tauri 2.0 / React Native)
│   ├── miniapp/                # 微信小程序客户端 (Taro)
│   └── web-admin/              # 教研与运营风控中台 (Vite + React)
├── packages/
│   ├── contracts/              # 跨端强类型契约 (TypeScript/Zod/OpenAPI)
│   ├── ui-components/          # 共享响应式 UI 组件库 (Tailwind)
│   ├── vfx-adaptive-engine/    # 硬件性能探测与 4 级画质自适应引擎
│   ├── memory-engine/          # SuperMemo-2 / FSRS 记忆算法调度库
│   └── syntax-parser/          # 语法树与长难句解析共享工具
├── services/
│   ├── content-worker/         # 教材导入与音频切片 Worker
│   └── eval-worker/            # 异步作业深度精修与模考评测 Worker
└── database/
    ├── migrations/             # PostgreSQL 数据迁移
    └── seeds/                  # 初始词库、语法节点与真题数据
```

