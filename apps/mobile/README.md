# @englishflow/mobile (语学星统一 uni-app 学习端)

## 项目定位
- 采用 **Vue 3 + TypeScript + uni-app** 构建。
- **一套核心代码**编译输出至 **移动 H5、iOS App、Android App、iPad**；微信小程序作为 P1.5 条件编译目标。
- 本项目是移动 H5、移动 App 与 iPad 的唯一学习端业务项目；PC Web 学习工作台归属 `apps/learner-web`。
- Phase 1 使用平台自有 IAM 账号密码和规则化学习闭环，不启用生成式 AI；支付仅保留 provider、验签、退款与对账沙盒，生产支付和自动续费默认关闭，须通过发布 Gate 后才能开启。
- 支持移动端特有原生能力：原生后台音频播放与锁屏控制、离线数据包缓存，以及小程序条件编译适配。

## 目录结构
- `src/pages/`: 移动端核心页面（首页打卡、规则化学习流、个人中心）
- `src/uni_modules/`: uni-app 跨端插件（原生播放器、支付 provider/沙盒适配、离线存储）
- `src/stores/`: 移动端本地持久化与学习状态

## 自有 JWT 认证边界

- uni-app 的账号密码登录、会话恢复、刷新、登出、设备撤销和成人 Gate 统一经 Gateway/IAM 适配器；不存在浏览器认证回调。
- Access Token 只保存在进程内存；iOS/Android/iPad 原生端的 Refresh Token 只能写入 Keychain/Keystore 等平台安全存储，安全存储不可用或写入失败时拒绝建立可刷新会话，不降级到普通 storage。
- H5 通过 HttpOnly、Secure、SameSite Refresh Cookie 恢复会话；H5 不读取或持久化 Refresh Token。
- JWKS、issuer、audience、RS256、token type 和权限声明由 IAM 签发、Gateway 与每个领域服务独立验证；真机/小程序仍需按设备矩阵取得运行证据。
- `android/` & `ios/`: 原生打包配置与证书工程

## B0 本地验证
- H5 固定端口：`18183`；启动前执行根目录 `pnpm ports:check`。
- H5 构建：`pnpm --filter @englishflow/mobile build:h5`。
- TypeScript 检查：`pnpm exec tsc --noEmit -p apps/mobile/tsconfig.json`。
- DCloud 版本以本项目 `package.json` 与仓库锁文件为准；`src/compat/vue.ts` 兼容运行时导出差异，H5 的 `src/compat/page-lifecycle.ts` 补齐官方页面初始化调用，保证 `onLoad` 参数和 `onShow` 数据加载执行。业务页面接入前不得移除兼容层。

## 官网风格移动端 UI（2026-09-22）

现有 31 个注册页面统一使用官网紫色、薰衣草色与柔和卡片。共享颜色位于 `packages/design-tokens/src/mobile.ts`，页面标题和公共文案位于 `packages/i18n/src/mobile-experience.ts`。页面接入 `useMobileExperience` 和 `MobilePageHeader`，主题/动效设置可即时预览，底部导航同步明暗主题。

启动：`pnpm --filter @englishflow/mobile dev:h5`，固定地址 `http://127.0.0.1:18183/`。登录入口 `/#/pages/login/login`；注册和找回密码无需登录即可进入。应用继续连接 Gateway，后端不可用时显示错误或重试入口，不向正式应用注入示例账号。

```powershell
pnpm --filter @englishflow/mobile typecheck
pnpm --filter @englishflow/mobile build:h5
node scripts/dev/run-node-tests.mjs apps/mobile/tests
# 先启动 18183；浏览器测试在独立上下文拦截 API，不连接真实账号或业务服务。
node apps/mobile/tests/mobile-experience.e2e.mjs
```

浏览器检查覆盖 31 页 × 5 个屏幕/主题组合与认证、表单、主题、动效交互，结果与截图输出至 `artifacts/mobile-experience-2026-09-22/`。详情和业务验收边界见 [移动端改造记录](../../docs/06-design/v2-980plus/mobile-experience-2026-09-22/README.md)。本轮没有原生真机/小程序验收，也不改变 P1R 状态。

## B10-FE-005 / B10-FE-006 移动端切片

- `src/api/b10.ts` 只使用 Gateway 相对路径，分别接入 content、learning 和 assessment seam；UI `locale` 通过 `Accept-Language` 传递，内容语言只通过 `contentLocale` 查询参数传递。
- `src/stores/b10-learning.ts` 持有 SRS 排程、复习待同步队列、练习会话、断点、错题和报告的本地恢复状态；同一卡片不会因重复点击重复推进，待同步不冒充已结算。
- `b2-vocabulary`、`b2-practice`、`b3-reading`、`b3-grammar`、`b3-writing` 已切换到 B10 API seam；`b10-report` 提供错题原因、订正入口和报告证据。
- `B10ExerciseCard` 只提交受支持的用户答案结构，不发送 `correctAnswer`、答案标志或客户端分数；规则反馈显式标注 Phase 1 不使用 AI 评分。
- 所有页面覆盖 loading/empty/error/offline/forbidden/stale/recovery 入口；Performance 档保留答题功能并将句法图降级为线性结构。主题切换与内容语言切换通过 app 内 B10 foundation 适配，不新增 miniapp 业务项目。

验证：

```powershell
pnpm --dir apps/mobile test:b10
pnpm --dir apps/mobile exec tsc --noEmit -p tsconfig.json
pnpm --dir apps/mobile build:h5
```

## B11 FE-003 / FE-004 / FE-006 mobile slice

- `src/pages/b11-listening/b11-listening.vue` covers authorized playback, speed, A-B loop, Language Clips, subtitle timeline, dictation and server-confirmed progress.
- `src/pages/b11-reading/b11-reading.vue` covers version-bound graded reading, block progress, comprehension synchronization and offline recovery.
- `src/pages/b11-speaking/b11-speaking.vue` covers explicit microphone permission, phonetics, shadowing, local playback/retake, SHA-256 lifecycle and self-rating. Phase 1 does not use ASR, AI scoring or a digital human.
- `src/platform/b11-offline.ts` deduplicates by `clientEventId`, preserves a cursor, records version conflicts, protects local storage limits and never persists forbidden media payload fields.
- `src/stores/b11-learning.ts` wires the four performance levels, manual motion disable and network/storage downgrade. Local recording state only contains an opaque secure path plus hash/metadata; server mutations send metadata, never recording bytes.

Validation:

```powershell
pnpm --dir apps/mobile test:b11
pnpm --dir apps/mobile exec tsc --noEmit -p tsconfig.json
pnpm --dir apps/mobile build:h5
```

## 三端统一交付

本次源码、共享资源与验证记录纳入 [2026-09-22 三端 UI 统一交付](../../docs/06-design/v2-980plus/frontend-ui-delivery-2026-09-22.md)。该记录说明提交范围、本地入口及尚未完成的真实后端/真机验收。
