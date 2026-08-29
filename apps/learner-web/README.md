# @englishflow/learner-web (语学星学员端 Web)

## 项目定位
- 采用 **Vue 3 + Vite + Pinia + TypeScript** 构建。
- **Web 工作台设计**：面向 PC 桌面大屏与平板浏览器，支持双栏/三栏工作台、PWA 和触控适配。
- 移动 H5 业务页面归属 `apps/mobile`；本项目不再复制一套移动 H5 页面。
- 学习者免安装即可在浏览器中完成今日学习流、单词记忆、句子听力、语法解析、复习刷题与自测。

## 目录结构
- `src/api/`: 封装经 api-gateway `/api/v1` 边界的请求客户端；`core-api` 只作为迁移兼容目标，不是新业务入口
- `src/components/`:
  - `player/`: 沉浸式音频播放与波形控制器
  - `learning/`: 学习流控制器、打卡组件
  - `cards/`: 单词卡片、长难句拆解卡片
  - `quiz/`: 题型交互组件（拼写、连线、选择、填空）
- `src/layouts/`: 响应式多栏布局（PC 宽屏适配 vs 手机端底部 Tab 栏）
- `src/pages/`: 学习看板、核心学习室、艾宾浩斯复习流、错题集、个人中心
- `src/stores/`: 状态管理（当前学习进度、播放器状态、会话 Token）

## B10 Learning / Assessment 前端切片

- `src/api/b10.ts` 是本 app 的 B10 Gateway 相对路径 seam：学习/SRS/进度/报告走 learning owner，练习提交与规则反馈走 assessment owner，词汇、阅读、语法和写作题面走 content owner；客户端不接收或保存答案规则正文。
- `src/domain/b10.ts` 只建模题面、内容版本、服务端反馈码和报告快照；`src/stores/b10.ts` 统一处理服务端状态、403、内容版本失效、离线队列、断点、草稿恢复、幂等提交和 Performance 降级。
- B10 页面覆盖 `/vocabulary`、`/practice`、`/reports/weakness`、`/reader`、`/grammar` 和 `/writing/practice`。UI `locale` 与学习内容 `contentLocale` 通过共享 i18n 独立传递，页面只消费 design-token 语义变量。
- `tests/b10-boundaries.test.mjs` 是不依赖后端运行态的最小静态边界测试。

## 本地验证

```bash
pnpm typecheck
pnpm build
node --test tests/b10-boundaries.test.mjs
```

## B8 认证边界

- 登录、回调、刷新、登出、成人 Gate、权限快照和深链恢复通过 Gateway/IAM 适配器处理。
- 浏览器只把短时访问凭证放在受控会话上下文；Refresh credential 不写入普通 Web storage，权限和角色由服务端快照驱动。
- B8 使用平台 IAM 的账号密码登录和自有 RS256 JWT；Web Access Token 只在内存中存活，Refresh Token 只由 HttpOnly Cookie 承载，JWKS 由 IAM 发布。
