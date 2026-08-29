# B24 前端登录边界与交互逻辑验证

本记录对应 `V2-B24-FE-001` 至 `V2-B24-FE-007`。本轮完成代码层和确定性逻辑验证，不把静态断言、测试替身或本地缓存解释为真实登录、真实数据库数据或浏览器验收。

## 本轮交付

- Mobile H5 在 App shell 安装统一导航门禁，并为直接深链保留 `ensureMobilePageAccess` 兜底；未认证回登录，成人 Gate 未通过回 onboarding，401/403 分别进入会话恢复/权限页。
- learner-web/admin-web 统一受保护路由、深链 `returnTo`、刷新/登出/过期和服务端权限边界；learner-web 根路径改为登录边界，Admin 菜单只由服务端 permissions 快照决定。
- Web/Admin/Mobile 均在统一登录页提交账号密码到 Gateway/IAM；认证结果是普通 JSON JWT 登录响应，不跳转外部页面，也不接受客户端提交的角色、tenant、owner、permission 或内部会话事实。
- Mobile H5 通过 `/login` 完成登录和会话恢复；不保留认证回调页、不从 URL 读取凭证，原生端 Refresh Token 只进入 Keychain/Keystore。
- onboarding 写入前调用服务端成人 Gate；Gate 拒绝时为 `REJECTED`，不进入测评或创建可学习 onboarding 状态；取消会话时退出登录。
- 共享 `packages/i18n`、`packages/design-tokens` 和 `packages/api-client` 增加 locale fallback、非法格式安全回退、主题系统监听、对比度/焦点/非颜色状态语义，以及 401/403/offline/retry/empty 分类。
- 官网保持公开只读，不持有登录后业务 session；仅生成受控 learner 登录链接。

## 已执行证据

| 验证 | 结果 |
|---|---|
| `pnpm test:b24` | 14/14 通过，0 TODO，0 skipped |
| `pnpm test:b7` | 28/28 通过 |
| `pnpm test:b8` | 30/30 通过 |
| `pnpm test:b18` | 7/7 通过 |
| `pnpm test:b23` | 4/4 通过 |
| learner-web typecheck/build | 通过 |
| admin-web `vue-tsc --noEmit`/build | 通过 |
| mobile TypeScript/H5 build | 通过 |
| official-site Nuxt build | 通过 |
| `git diff --check` | 无空白错误；仅有工作区既有 LF/CRLF 提示 |

可复核的机器配置和测试入口见 [config/b24-frontend-auth.json](../../config/b24-frontend-auth.json) 和 [B24 测试](../../tests/b24/b24-fe-007.test.mjs)。

## 仍未取得的运行证据

1. **自有 IAM JWT 运行 Gate 尚未取得完整运行证据**：当前需要启动 IAM/Gateway、JWKS、MySQL 会话和合成账号，完成登录、刷新、登出、设备撤销和权限回放。详见 [b23-validation.md](./b23-validation.md)。
2. **真实 HTTP/API 会话闭环仍待复测**：前端已按契约使用 `/auth/login`、`/auth/token/refresh`、`/auth/logout`、`/iam/principal/me` 和权限接口；需要在固定端口环境中补齐真实 API、Cookie、安全存储和数据库回放，不能把静态测试宣称为业务会话成功。
3. **正式浏览器/H5/真机验收不在 B24-FE-007**：Chrome/Edge/Firefox、移动 H5 网络面板、Console、弱网、响应式、iOS/Android/iPad/小程序和真实数据旅程留到 B26/B27，不用源码测试替代。

## 结论

B24 的四端登录边界、成人 Gate、401/403 语义、国际化/主题和构建逻辑已完成并通过本轮代码验证；B24 不能宣告为真实运行完成，也不能据此直接进入正式测试阶段。下一前置是启动自有 IAM JWT/JWKS 和 Cookie/session HTTP 闭环；完成 B25 本地真实数据后，再进入 B26 正式浏览器/H5 测试。
