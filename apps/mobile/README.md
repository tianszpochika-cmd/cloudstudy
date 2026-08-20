# @englishflow/mobile (语学星主 App / 小程序)

## 项目定位
- 采用 **Vue 3 + TypeScript + uni-app** 构建。
- **一套核心代码**编译输出至 **iOS App、Android App、微信小程序、iPad**。
- 支持移动端特有原生能力：原生后台音频播放与锁屏控制、微信一键登录、微信支付/Apple IAP、离线数据包缓存。

## 目录结构
- `src/pages/`: 移动端核心页面（首页打卡、学习流、AI 对话伴学、个人中心）
- `src/uni_modules/`: uni-app 跨端插件（原生播放器、支付模块、离线存储）
- `src/stores/`: 移动端本地持久化与学习状态
- `android/` & `ios/`: 原生打包配置与证书工程

## B0 本地验证
- H5 固定端口：`18183`；启动前执行根目录 `pnpm ports:check`。
- H5 构建：`pnpm --filter @englishflow/mobile build:h5`。
- TypeScript 检查：`pnpm exec tsc --noEmit -p apps/mobile/tsconfig.json`。
- 当前基座固定使用 DCloud `3.0.0-alpha-4080720251125001`，并通过 `src/compat/vue.ts` 兼容 uni-app 运行时的生命周期注入差异；业务页面接入前不得移除该适配层。
