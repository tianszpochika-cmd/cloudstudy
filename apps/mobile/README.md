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
- 当前基座固定使用 DCloud `3.0.0-alpha-4080720251125001`，并通过 `src/compat/vue.ts` 兼容 uni-app 运行时的生命周期注入差异；业务页面接入前不得移除该适配层。

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
