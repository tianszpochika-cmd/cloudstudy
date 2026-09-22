# @englishflow/admin-web (语学星管理后台)

## 项目定位
- 采用 **Vue 3 + Vite + Element Plus + TypeScript** 构建。
- 面向教研团队、课程审核员、运营人员与财务管理的一站式中台。

## 目录结构
- `src/views/`: 登录、工作台、内容/词汇/题目/音标、学员、订单、客服、治理、审计、发布与恢复页面
- `src/components/`: 导航、偏好、记录展示、排期与音频等共享界面
- `src/api/`、`src/stores/`: Gateway API 适配与业务状态
- `src/platform/`: 主题、文案、权限入口、交互保护与性能适配

## 官网风格 UI 与本地检查（2026-09-22）

现有 14 页统一使用官网视觉风格，覆盖权限分组导航、功能搜索、登录、业务表单、列表、未保存保护、四种主题与手机抽屉布局。入口为 `http://127.0.0.1:18181/login`，启动 `pnpm --filter @englishflow/admin-web dev`，构建 `pnpm --filter @englishflow/admin-web build`。

页面清单与浏览器结果见[管理端改造记录](../../docs/06-design/v2-980plus/admin-experience-2026-09-22/README.md)，三端提交及真实联调边界见[统一交付记录](../../docs/06-design/v2-980plus/frontend-ui-delivery-2026-09-22.md)。截图使用独立合成数据，不代表 IAM/领域服务联调；生产入口不内置演示会话。

## B8 认证边界

- 后台登录、会话恢复、刷新、登出和 403 页面经 Gateway/IAM 适配器完成。
- 菜单与操作权限只消费服务端权限快照；客户端角色头、tenant/owner 字段和本地角色事实不参与授权。
- 使用平台 IAM 的账号密码登录和 RS256 JWT/JWKS；Web Access Token 只保存在内存，Refresh Token 由 HttpOnly Cookie 承载，管理员权限只取自服务端 claims 与策略。
