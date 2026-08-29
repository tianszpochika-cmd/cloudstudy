# 自有 JWT 认证中心本地运行验证（2026-08-28）

## 1. 本轮结论

本轮目标是自有账号密码认证中心与 JWT/JWKS Resource Server 模式。所有业务 API 使用统一 audience `yuxuexing-api`；由 IAM 签发的 Access Token 可以被 Gateway 和各领域服务独立验证，但每个服务仍执行 issuer、签名、算法、audience、时间窗口、token type、scope、permission、角色、tenant、资源 owner、阶段和内容权利检查。Token 不因此获得无边界的全权限。

四个前端保持独立应用边界，通过同一 IAM 账号体系完成登录；不共享 Refresh Token，不把 Access/Refresh Token 写入 URL、Web storage、日志、事件或埋点。`official-site` 只保持公开站点和受控登录链接，不建立登录后业务会话。

## 2. 运行证据

| 检查 | 结果 | 证据 |
|---|---|---|
| IAM login/refresh/logout/password-reset/JWKS | PENDING | 代码已实现；需在本机 JVM/基础设施可运行后使用真实 IAM 运行态补证 |
| Gateway、IAM、Core API、11 个领域服务与四前端固定端口 | PENDING | 18070、18080、18087–18098、18180–18183；本轮需重新启动并核对 |
| JWT issuer/audience/algorithm/JWKS 静态检查 | PENDING | 需执行新的认证边界测试 |
| 每个 Resource Server audience 约束 | PASS | `pnpm test:b35` 5/5；新增 JWT audience contract 回归覆盖 12 个服务模板/实例 |
| 认证后全域读取 | PENDING | 旧证据基于已废止登录方案，本轮不继承其结论 |
| 异常与基础设施回归 | PENDING | 需重新验证 401/403、密码错误/锁定、刷新重放和设备撤销 |
| 权限与 owner 隔离 | PASS | `b35-authz-20260827155405`，6/6；伪造 owner/tenant/role 头无效，普通学习者访问后台返回 403 |
| 重启后持久化事实 | PENDING | 需验证 IAM account、refresh history、session revoke 与领域事实 |
| 本地合成内容 fixture | PASS | `pnpm db:seed:local-10x`，118 项检查通过；payload hash 与现行 content-service 规范化算法、版权状态枚举已对齐 |
| 四端构建与仓库门禁 | PASS | learner/admin/official build、Mobile H5 build、typecheck、contracts、G 41/41、DoD strict、v2 design verification |

## 3. 浏览器边界

待重新验证 `http://127.0.0.1:18180/login` 的自有登录页。验证时手动输入测试账号密码，不读取或输出密码/Token；必须确认登录后不离开应用到外部认证页面，并检查受保护页面、刷新、401、403、退出和 Console。

## 4. 剩余 Gate

1. 需要在可运行的 JVM/基础设施环境补齐 IAM 自有 JWT 的运行态、JWKS 双钥轮换、设备踢出、撤销即时阻断和审计证据。
2. 需要在自有登录页手动完成一次登录，补齐浏览器认证后页面、刷新、退出/重登及 401/403 UI 证据。
3. 生产发布前仍需确认 KMS/secret manager 注入、密码策略、限流锁定和真实部署环境证据。
