# EnglishFlow 全栈技术架构设计说明书 (System Technical Architecture)

> **文档版本**：v3.0 (方案 B 落地版：Vue3 + uni-app 全端 + Spring Boot 3 后端)  
> **面向对象**：全栈开发 Agent、系统架构师、全端/前端/移动端/后端开发工程师、AI 算法工程师  
> **设计目标**：构建覆盖全阶段（K12、高中/大学升学、职场出海）、"一套 uni-app 核心代码打通全平台（Web / H5 / iOS / Android / iPad / 微信小程序）"、具备硬件自适应画质与低延迟 AI 伴学的技术体系。版本基调：**以团队现有 Vue3 + Java 技能为地基，商用服务优先，自建组件只做必要补充**。

---

## 1. 总体架构拓扑 (Overall Architecture Topology)

EnglishFlow 采用 **"全端统一 uni-app 内核 + 模块化单体业务核 (Spring Boot 3) + 商业 RTC 实时对话服务 + 独立 AI 智能编排中心 (FastAPI) + 自适应性能调控"** 的架构。

```
+---------------------------------------------------------------------------------------------------+
|                        1. 全平台客户端交互矩阵 (uni-app 一套代码多端编译)                          |
|  [PC Web / 官网]     [H5 手机浏览器]    [iOS / iPad App]      [Android App]      [微信小程序]     |
|  (uni-app H5 编译)   (uni-app H5 编译)  (uni-app 原生编译)    (uni-app 原生编译)  (uni-app 编译)   |
|   - 浏览器全平台访问   - 落地页转化入口    - App Store 上架      - APK 官网分发     - 碎片化打卡刷词 |
|   - GPU 沉浸渲染       - PWA 可安装       - Apple Pencil 适配   - 触感震动反馈     - 战队排行榜单   |
+---------------------------------------------------------------------------------------------------+
                                              | (HTTPS / WSS / RTC SDK)
+---------------------------------------------------------------------------------------------------+
|                                      2. 边缘接入与流量网关                                         |
|  [腾讯云/阿里云 CDN] -> [WAF 防火墙 / DDoS 防护] -> [Nginx / Spring Cloud Gateway]                 |
|   - 动态路由分发 & 负载均衡           - 全局 SSL 终止                       - 统一 JWT / 微信 OAuth 鉴权 |
|   - IP 频控与反作弊 (Rate Limit)     - 请求耗时追踪 (Trace ID 注入)       - 敏感数据加解密          |
+---------------------------------------------------------------------------------------------------+
             |                                    |                                    |
+----------------------------+   +----------------------------+   +---------------------------------+
| 3. 业务服务中心 (Core API) |   | 4. 实时对话接入层 (RTC)    |   | 5. AI 智能编排层 (AI Orchestrator)|
| (Java 17 / Spring Boot 3)  |   | (声网/腾讯云 TRTC 商业服务)|   | (Python FastAPI / LangGraph)    |
|  - 统一用户与鉴权中心       |   | - RTC SDK 房间与鉴权签发   |   | - 提示词生命周期与版本治理中心  |
|  - 课程体系与教材同步中心   |   | - 商业 AI 对话能力接入     |   | - 多模型网关 (Qwen/DeepSeek/GLM)|
|  - 答题评测与作业批改系统   |   |   (ASR/TTS/VAD/打断)      |   | - 结构化 JSON Schema 强校验     |
|  - 班级小队与社交排行榜     |   | - 会话事件回调与留痕       |   | - 内容安全合规过滤 (双审)       |
|  - 积分商城、订单与订阅结算 |   | - 自建 LiveKit 为后续      |   | - 成本限额、降级策略与回放评测 |
|  - 错题集与记忆曲线调度     |   |   降本评估项 (需新增 ADR)  |   | - 依存句法分析与长难句拆解引擎  |
+----------------------------+   +----------------------------+   +---------------------------------+
             |                                    |                                    |
             +------------------------------------+------------------------------------+
                                              | (Event Bus / REST)
+---------------------------------------------------------------------------------------------------+
|                            6. 异步任务与数据管道 (Spring 生态 Workers)                              |
|  [RabbitMQ / Redis Streams]                                                                       |
|   - Content-Worker (教材/音频入库与预处理)        - Job-Runner (机考离线打分与作文深度精修)         |
|   - Notification-Worker (推送与上课提醒)          - Analytics-Worker (用户能力雷达图与漏斗计算)     |
+---------------------------------------------------------------------------------------------------+
                                              |
+---------------------------------------------------------------------------------------------------+
|                                      7. 基础设施与数据持久层                                       |
|  [PostgreSQL 16]         [Redis 7.x]               [pgvector 扩展]            [S3 / 腾讯云 COS]    |
|   - 关系型业务数据主库     - 缓存、分布式锁、会话   - 语法图谱/真题向量检索     - 教材音视频、录音存档 |
|   - Row-Level Security     - 每日打卡 BitMap 统计   - 语义相似度判重与推荐      - 3D 模型资产与图片   |
+---------------------------------------------------------------------------------------------------+
```

---

## 2. 全平台统一架构方案 (Web + H5 + App + iPad + 小程序)

本系统坚决规避"多端多套代码独立维护"的高昂成本，采用 **"一套 uni-app 核心代码 + 条件编译分端适配 + 平台原生能力按需调用"** 的一体化体系：

1. **核心共享层 (`packages/contracts` & `packages/domain`)**：
   - 全端统一的数据契约（OpenAPI 单一事实源 → openapi-generator 生成 Java DTO 与 TS 类型）、领域模型与状态流（Pinia）、长难句解析逻辑与 AI 流式打字机控制器。
   - 记忆算法调度 (SuperMemo-2/FSRS) 与画质自适应引擎 (AdaptivePerformanceEngine) 规划为独立共享包 (`packages/memory-engine`、`packages/vfx-adaptive-engine`)，落地前先以 `packages/domain` 承载过渡实现。
2. **视图与动效层 (`packages/ui-web` & `packages/ui-mobile`)**：
   - 基于 uni-app 响应式断点 + rpx 布局实现单列手机流、iPad 分屏与 PC 大屏看板自适应。
   - 3D 口腔发音模型 (Three.js) 与数字人动画 (Rive) 在 H5/App 端通过 web-view 承载，小程序端条件编译降级。
3. **平台分发与条件编译**：
   - **PC Web / H5**：uni-app H5 编译，同一套代码响应式适配；官网落地页可用 uni-app 或 Nuxt 3（SEO 需求高时）。
   - **iOS / iPad App**：uni-app 原生渲染编译，Xcode 打包上架 App Store（需 Apple 开发者账号）；iPad 适配 Apple Pencil 手写与分屏。
   - **Android App**：uni-app 编译 APK，官网直接分发 + 国内应用市场上架。
   - **Windows 桌面**：Web 版 + PWA 优先；如需原生壳采用 Tauri 2.0（严禁 Electron）。
   - **微信小程序**：uni-app 条件编译输出，重度 3D/游戏页面走降级版。

---

## 3. 硬件算力自适应与画质分级降级引擎 (Adaptive Graphics & VFX Engine)

为了让低配老旧电脑、千元安卓机与旗舰设备（iPad Pro、独显 PC）均能流畅运行，系统实现 **四级画质梯队** 与 **动态帧率监测状态机 (FPS Guard)**（框架无关的 TypeScript 引擎，全端复用）：

### 3.1 四级画质梯度规范 (Four-Tier Quality Matrix)
| 画质档位 | 设备画像 | 3D 口腔发音实验室 | 卡通伴学数字人 (Rive) | 长难句 X 光机 & 知识图谱 | 答题与游戏粒子特效 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Ultra (极致沉浸)** | 独显 PC、iPad Pro (M系列)、旗舰手机 | 3D 高精解剖 + 呼吸光晕 Shader + 360° 全景光影 | Rive 全骨骼物理动效（高刷设备最高 120fps）+ 视线跟随 | WebGL 模式 + 动态力导向连线流光粒子 | 5000+ 粒子爆炸、光晕全开 |
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
| **全端统一前端** | **Vue 3 + TypeScript + uni-app** | Vue 3.4+ / uni-app 3.x | 一套代码编译 Web/H5/iOS/Android/iPad/小程序；Pinia 状态管理 |
| **管理后台** | Vue 3 + Element Plus + Vite | 最新稳定版 | 教研、运营风控、Prompt 灰度与数据看板 |
| **桌面端** | Web + PWA 优先；Tauri 2.0 可选原生壳 | v2.0+ | Windows 场景按需启用 |
| **2D/3D 特效引擎** | **Three.js + Rive Runtime + Vue Flow / AntV G6 + Lottie(受限)** | 最新稳定版 | 3D 口腔解剖(web-view)、骨骼数字人、语法树与知识图谱、轻量动效 |
| **游戏化小游戏引擎** | **Phaser 3**（H5/App web-view 承载） | v3.x | K12 塔防/消消乐/拼句火车/大富翁，受四级画质开关管控 |
| **音频与音效** | **Wavesurfer.js + Howler.js** | 最新稳定版 | 波形精听与变速复读；答题提示音与连击音效 |
| **核心业务后端** | **Java 17 + Spring Boot 3**（决策见 ADR-0004） | Java 17+ / Spring Boot 3.x | 模块化单体，负责用户、课程、答题流水、记忆调度、订单 |
| **AI 编排服务** | **Python 3.11+ (FastAPI + LangGraph + LiteLLM)** | Python 3.11 | 独立服务；大模型网关路由、句法分析、写作升格、安全风控 |
| **实时对话 (P1)** | **商业 RTC AI 对话服务（声网 / 腾讯云 TRTC）** | Java SDK | 低延迟双向对讲、Barge-in、流式 ASR/TTS；自建 LiveKit 为降本备选需 ADR |
| **数据库与缓存** | **PostgreSQL 16 (pgvector) + Redis 7.x** | PG 16 / Redis 7 | 强关系型业务持久化、向量语义检索、排行榜 ZSet、打卡 BitMap |
| **异步任务流** | **RabbitMQ 或 Redis Streams + Spring 集成** | 最新稳定版 | 异步削峰、AI 作文深度批改、机考离线打分、定时推送 |

---

## 5. 工程 Monorepo 目录结构规范

```
├── apps/                        # 平台入口与平台特定配置
│   ├── learner-web/            # uni-app 学习端主工程（编译 Web/H5/App/小程序）
│   ├── official-site/          # 官网与落地页 (uni-app H5 / Nuxt 3)
│   ├── admin-web/              # 教研与运营风控中台 (Vue 3 + Element Plus)
│   ├── mobile/                 # App 端原生配置、打包脚本与端能力封装，含 ios/android 子目录
│   └── miniapp-wechat/         # 小程序端条件编译配置与平台特有页面
│   # 规划中：desktop-windows（Tauri 2.0 原生壳，按需）、tablet-ipad（iPad 专属适配层）
├── packages/                    # 跨端共享的契约、类型、领域函数与观测 SDK
│   ├── contracts/              # OpenAPI 单一事实源 + 生成的 TS/Java 类型
│   ├── domain/                 # 共享领域模型与业务函数
│   ├── api-client/             # 基于 OpenAPI 契约生成的客户端
│   ├── content-schema/         # 课程内容结构校验
│   ├── ui-web/                 # H5/Web 共享组件库
│   ├── ui-mobile/              # App/小程序端共享组件库 (uni-ui 封装)
│   ├── design-tokens/          # 设计令牌
│   ├── ai-prompts/             # 提示词版本资产
│   ├── i18n/                   # 多语言资源
│   ├── telemetry/              # 观测与事件采集 SDK
│   └── config/                 # 共享构建与 Lint 配置
├── services/                    # 可部署的运行时服务
│   ├── core-api/               # 业务核心服务 (Java 17 / Spring Boot 3，按领域模块组织)
│   ├── ai-orchestrator/        # AI 智能编排中心 (FastAPI/Python)
│   ├── realtime-voice/         # 实时对话接入层 (商业 RTC SDK 集成与会话事件留痕)
│   ├── content-worker/         # 教材导入与音频切片 Worker
│   ├── job-runner/             # 异步作业执行 (机考离线打分与作文深度精修)
│   ├── notification-worker/    # 推送与上课提醒 Worker
│   └── analytics-worker/       # 能力雷达图与漏斗计算 Worker
├── database/                    # 数据库 schema、迁移、种子与夹具
│   ├── postgres/               # PostgreSQL 迁移与种子数据 (Flyway)
│   ├── redis/                  # Redis 使用说明
│   ├── vector/                 # 向量检索 (pgvector)
│   └── warehouse/              # 分析仓库 (规划中)
├── content/                     # 课程、评测、评分规则与媒体内容
├── ai/                          # 提示词、评测集、策略与实验（非运行时服务）
├── infra/                       # docker、k8s、nginx、terraform、可观测与安全
├── tests/                       # 单元/集成/契约/E2E/负载/安全测试
└── scripts/                     # 构建与自动化脚本
```

---

## 6. 部署与合规要点（中国大陆商用）

**域名与服务映射**（主体：clyune，公司：深圳云澜深境科技有限公司，产品名：语学星）：

| 域名 | 服务/用途 | 部署形态 |
| :--- | :--- | :--- |
| clyune.com / clyune.cn | 官网（大陆备案主体用 .cn） | 静态托管 + CDN |
| study.clyune.com | Web 学习平台 | uni-app H5 + CDN |
| work.clyune.com | 数据管理平台（教研/运营后台） | Vue 3 + Element Plus |
| api.clyune.com | Core API / OpenAPI 契约入口 | Spring Boot 3（Nginx 网关） |
| clyune.ai / clyune.cloud | AI 专栏 / 数据服务专栏（第二阶段启用） | 静态门户 + FastAPI 能力页 |

> ICP 备案：主域 clyune.com / clyune.cn 先行，子域名随主域备案生效；App 备案与小程序企业主体均以公司主体申报。

1. **资质与备案**：域名 ICP 备案（前置）→ App 备案 → 小程序企业主体注册（教育类目资质）→ 生成式 AI 服务算法备案。
2. **iOS 上架**：Apple 开发者账号（$99/年）+ Mac/Xcode 打包 + App Store 审核（1-3 天）。
3. **服务器**：腾讯云/阿里云单机起步（Docker Compose：Spring Boot + FastAPI + PostgreSQL + Redis + Nginx），验证期无需 K8s。
4. **AI 供应商**：优先国内合规大模型（通义/DeepSeek/智谱），密钥仅存服务端，客户端永不接触。
