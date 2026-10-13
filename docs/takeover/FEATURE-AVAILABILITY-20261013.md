# 功能可用性矩阵 — 2026-10-13

状态：可用 / 已修复 / 已补数据 / 即将开放（原因） / 设计如此（原因）。
测试账号：学员 e2e-20261013-learner，管理员 e2e-20261013-admin。截图在 box 的 `/workspace/e2e-usable/`：
`mobile-dark/`（29 个路由，暗色，宽 390，附 `report.json`）、`learner-before|after|after2/`、`admin-before/`、`mobile-world-season-before|after.png`。

## 移动端 H5（mobile.clyunedev.com）——最终部署 6bbfa5c1 → 21bd7e4a（+ 本次 rank 修复）

| 功能 / 页面 | 状态 | 证据 / 说明 |
|---|---|---|
| 全站暗色模式 | 已修复 | v2-tokens 暗色选择器同时作用于 uni `page`；29 个路由的浅色背景/低对比 = 0（world 插画、settings 按钮各 1 处属设计元素） |
| 学习页复习行（原“暂不可操作”） | 已修复 1c6c50b8 | 新内容 →「去学习」，其他 →「去练习」，并显示可见原因；40 条历史合并为一行摘要 |
| 旧版练习入口 b2-practice（410） | 已修复 e1e30e81 | 固定 contentVersionId 25001 已无可判分题；改为说明并指向「练习」 |
| 成长 · 赛季 | 已补数据 + 已修复 | 40 条 SEED-20261013 season_fact 从 `season-2026-autumn` 改为 `SEASON_2026_Q4`（先备份 `backups/gamification_service-pre-season-rebind-20261013093039.sql`）。前端修复：标题改为「2026 年第四季度赛季」，状态显示“进行中”。现显示 850 赛季点 |
| 成长 · XP / 等级 | 已修复 6bbfa5c1 | 前端没识别 `/gamification/me/summary` 的字段（subjectRef/serverScore），导致显示“—”；现显示 XP 880 · Lv.4 |
| 成长任务、连续学习为空 | 设计如此（学员还没有任务或连续学习记录） | 空态文案已写明 |
| “部分功能暂不可用”横幅（world/games/social） | 已修复 f08fcb56 | 来源是离线包接口在客户端被硬编码为不可用；不再计为读取失败 |
| 听力（b3/b11） | 即将开放（权限与配置未开放） | 已用 `say` 生成 12 条 TTS（`.seedwork/tts/`，含 sha256 清单）。但上传必需的 `media:write` 不在任何账号角色里，学员播放也需要 `IAM_MEDIA_LEARNER_CONTENT_RIGHTS`，该项在生产配置里为空（故意 fail-closed）。开放它属于授权/配置变更，不在本轮范围 |
| 跟读（b3/b11） | 即将开放（无实现） | 网关把 `/speaking/recordings` 路由到 media-service，`/speaking/*` 路由到 assessment-service，但两个服务都没有录音或评分接口 |
| 写作 | 即将开放（批改是占位） | learning-service `writingResult(..., answered ? 80 : 0)` 是固定分 |
| 小游戏 ×6 | 即将开放（关卡在开发） | 只显示目录，用徽标加原因代替禁用按钮 |
| 离线内容包 | 即将开放（下载服务未上线） | |
| 自习室快照为空 | 设计如此（当前无人专注） | |
| 设置 · 保存按钮 | 设计如此（未修改时禁用） | 显示可见提示 |
| 报告页 MASTERED 标签 | 已修复 | 改用 closureLabel（「本次补救已通过」），测试 240 通过 |
| 页面英文眉题 | 已修复 | 31 个页眉在 zh-CN 下用中文（ZH_KICKERS），en-US 保留英文；DEMO AUDIO 等模板标签已中文化 |
| 首页/今日/单词/阅读/语法/测评/我的/设备/支持等 | 可用 | 扫描没有不可用标记 |

## 学员网页端（learn.clyunedev.com）——部署 92174796

| 功能 | 状态 | 说明 |
|---|---|---|
| /listening（B11ListeningPage） | 已修复 → 即将开放（同移动端原因） | 原来显示真实播放器和“授权已过期”（manifest 404）；现为关闭卡片、徽标和原因，不再请求媒体 |
| /speaking（B11SpeakingPage） | 已修复 → 即将开放 | 原来显示“服务暂时不可用”和 8 个禁用按钮；现只剩关闭卡片和返回链接 |
| /writing、/writing/practice | 已修复 → 即将开放 | 不再加载写作会话，失效状态面板已隐藏 |
| 今日/基础练习/测评「提交答案」禁用 | 设计如此（需先选答案） | 显示可见提示「先选择一个答案，再提交。」 |
| 阅读：提交、下一段、同步离线队列（0） | 设计如此 / 已修复 | 显示可见原因；队列为 0 时不显示同步按钮 |
| 设置：保存每日目标 | 设计如此（未修改） | 显示可见提示 |
| 学习权益：兑换 | 设计如此（需输入激活码） | 显示可见提示 |
| 学习权益：无可购买方案 | 设计如此（真实支付未开放） | 页面已说明 |
| 首页/今日/世界/消息等英文眉题 | 已修复 | YOUR DAILY PLAN、DAILY STREAM、STAR COIN、QUESTS、INBOX、PLANS 等已中文化 |
| 学习页内容类型/状态 | 已修复 | GRAMMAR/SENTENCE/VOCABULARY/MASTERED 映射为中文（不用“已掌握”） |
| 语法易错点标签（REVIEW/ARTICLES 等）、条目代码 IT4-* | 设计如此（这是学习内容数据，不翻译） | |
| 其余 20 个路由 | 可用 | `learner-before/report.json` |

## 管理后台（admin.clyunedev.com）——代码 2ba46350 已推送，**未部署**（见下方说明）

| 功能 | 状态 | 说明 |
|---|---|---|
| 内容发布面板：初审/终审 | 设计如此（只在双审模式下可用） | 新增可见提示 |
| 词条：一审/二审 | 设计如此（作者与审核分离；种子由本账号提交） | 原因原来只在 tooltip 里，现在显示在行内 |
| 排期：创建排期 | 设计如此（需要发布权限并勾选条目） | 显示可见原因 |
| 商业：预检退款 | 设计如此（需输入订单号） | 显示可见提示；“真实支付尚未开放”已有说明 |
| 审计导出 | 即将开放（后端是 AuditExportUnavailableController 占位） | 徽标加原因 |
| 客服工单处理 | 即将开放（分派/回复/关闭未接入） | 文案已改得具体 |
| 音标资料库 | 即将开放 → 待部署 | 线上 admin-web 是旧镜像 ba346d44，那个版本没有音标读取路径；新读取路径在并行分支 V33（已合入 dev-redesign），要等 content-service 和 V31–V34 迁移一起部署 |
| 主题/画质/语言菜单里“✓”项禁用 | 设计如此（当前选项） | |
| 状态枚举英文（READY/CREATED/PAID…） | 设计如此（后台运营术语，不面向学员） | |
| 仪表盘/学员/权限/发布/治理/恢复 | 可用 | `admin-before/report.json` |

**admin-web 未部署的原因：** dev-redesign 已合入并行分支 `feat/v2-content-ops`（3e77e636，含 content-service 与数据库迁移 V31–V34）。现在重建 admin-web 会把依赖新后端的前端一起发出去，而本任务不能改数据库结构。admin 的修复已推送，等那边部署时一起上线。

## 测试基线
- learner-web：从仓库根目录运行 `node --test apps/learner-web/tests/*.test.mjs` 为 240/240（之前的“19 个失败”是在 app 目录下运行导致的路径问题）。
- mobile：132/132。
- admin-web：47 通过、3 失败（audit store 并发用例），本轮前后相同，属已有问题。
- packages/i18n：Node 不能直接加载 .ts，本轮前后相同。
