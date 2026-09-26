# 学习 Web 设置页显示偏好验收（2026-09-23）

## 范围与结论

- `PAGE-P1-SETTINGS` 的 Web `/settings` → `/settings/profile` 与 `/platform` 显示偏好子链：**局部通过**。使用独立合成成人账号，经真实 Gateway 登录后在浏览器操作。后端健康、成人 Gate 和同意均成功。
- UI 语言、内容语言、高对比、深色、跟随系统、手动减少动效、Performance 画质与刷新持久化通过。390px、320px 页面无横向溢出。设置页英文正文已补齐。
- 显示选择只在当前浏览器本地保存。服务端 `/api/v1/learner/preferences` 测前测后仍为 `zh-CN/en-US/SYSTEM/FULL`；显示选择期间浏览器没有向 profile、targets、preferences 发写请求。设置页明确提示“仅在当前浏览器生效”。
- **整项 PAGE-P1-SETTINGS 尚未完成**：服务端偏好同步、通知偏好、恢复默认、保存后返回路径与离线待同步未在本纵切实现或验收。每日目标的服务端保存另见 `learner-profile-settings.md`。

## 修复

- `packages/i18n/src/adapters.ts`：适配器订阅初始化时跳过首次默认值回写，避免刷新时覆盖已保存的两种语言。此逻辑共享给 Vue Web、Nuxt、uni-app、Element Plus。
- `packages/i18n/src/learner-experience.ts`、`apps/learner-web/src/pages/SettingsPage.vue`：设置页资料、隐私、设备和显示说明随 UI 语言切换；显示偏好说明只承诺浏览器本地保存。资料读取失败时只显示一条本地化错误，不重复输出中文原始错误。

## 真实浏览器证据

| 场景 | 结果 |
| --- | --- |
| 390px 深色 → 高对比，UI `en-US`，内容 `zh-CN` | DOM 状态与页面文案一致；截图 `learner-display-390.png` |
| 系统主题 | 浏览器深色时 `dark`，切浅色后 `light`，切回深色后 `dark` |
| 关闭界面动画并刷新 | 控件保持关闭，根节点 `data-motion=off` |
| 刷新后语言与高对比 | `en-US/zh-CN/high-contrast` 保持；本地语言分离 |
| 320px 设置页与性能页 | 两页 `scrollWidth=320`；四档画质控件可见，选 Performance 后刷新仍选中；截图 `learner-display-320.png`、`learner-display-platform-320.png` |
| 注入目标 GET 503 | 显示英文错误与 Reload；不展示目标选择器或保存成功；滚动后错误可见，恢复接口后读回 30 分钟；截图 `learner-display-error-viewport-320.png` |
| 浏览器运行异常 | 未观察到 page error |

机器证据：`learner-display.json`；可重跑脚本：`learner-display-live.mjs`。脚本不记录凭证或 Token。账号清理已核对：IAM 账号与主体 disabled、活跃会话/设备为 0、B9/B25 owner 表残留行数为 0。首轮发现语言刷新丢失的失败账号也已同样精确清理；最终运行成功。

## 最小验证

- `@englishflow/i18n` TypeScript 检查通过；`@englishflow/learner-web` Vue TypeScript 检查通过。
- Node 24 运行 i18n 测试 11/11，通过四种共享适配器恢复测试。系统默认 Node 20 执行仓库原 `pnpm --filter @englishflow/i18n test` 因无法直接加载 `.ts` 失败，属于测试运行时版本问题；换 Node 24 后同文件通过。

## 未覆盖边界

- 当前只验证 Web 的 320/390px 与浏览器持久化。移动 uni-app 的真实运行、高对比视觉对比度量化、跨设备同步、通知与恢复默认仍需独立验收。
- 高对比截图显示文字、表单边框和选中态，未做 WCAG 自动测量或人工辅助技术验收。
