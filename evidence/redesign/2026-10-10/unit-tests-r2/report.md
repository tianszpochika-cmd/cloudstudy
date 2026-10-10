# r2 顶层 Node 测试

命令与 r1 收口相同，只跑两处 `tests/*.mjs` 顶层文件，不含 `tests/b10|b11|b12` 嵌套目录。

```sh
node --test apps/mobile/tests/*.mjs apps/learner-web/tests/*.mjs
```

Node v20.19.5。基线 `e7cd6dd1` 同样是 292 项、26 失败，与 r1 结束日志里的失败名单一致，不是本轮两处 Vue 差异引入的。

## 已修复（断言未放宽、用例未删）

| 组 | 原因 | 处理 |
|---|---|---|
| learner-web 刷新 | 刷新走 IAM Secure Cookie，不带 Access Token | 夹具改为断言无 Authorization，保留换主体后的 fail-closed |
| b1 主体隔离 | 会话模块依赖真实 `access-token` 与 `auth-failure-copy` | 夹具加载这两个真模块 |
| profile-target | `b1.ts` 引入 `./unavailable` | 补模块桩，行为断言不动 |
| B11 边界 | `/sync/changes` 与 `/speaking/recordings` 被收成不可用桩 | 恢复真实 POST/GET 与幂等键 |
| C08 阅读（Web/H5） | 阅读进度与挖矿路由被收成不可用桩 | 恢复 PUT `/reading/progress` 与 POST `/reading/mining` |
| H5 刷新 | 同上，刷新不带 Bearer | 断言 IAM origin、无 Authorization、withCredentials |
| 四个 H5 夹具 e2e | 页面要先读 `/iam/principal/me`、偏好 `stateVersion`，工单页在会话未稳时就把读取失败画成错误 | 夹具补齐成人门/同意/目标/版本；资料失败时不展示账号卡；工单页等会话恢复后再读 |

四个夹具 e2e 在 H5 `127.0.0.1:18183` 与本机 Playwright Chromium 上复跑通过：`b4-avatar-display`、`mobile-experience`（160 项检查）、`mobile-state-boundaries`、`support-state-fixture`。

## 仍失败

`apps/mobile/tests/support-real-gateway.e2e.mjs`。预检在 Gateway `http://127.0.0.1:18070/actuator/health` 返回 200 后进入注册，注册按钮等待 IAM 响应超时。`pnpm services:run -- --all` 把 IAM 开在 `http://127.0.0.1:18087`（HTTP 健康检查 200）。学习端密码只提交到 `https://127.0.0.1:18087`。本机没有 r1 那份测试 CA/PKCS12，本轮不把证书写入 macOS 钥匙串。账号未注册，清理查询为 ACCOUNT:0。详见台账第 4 节。

收口计数：292 项，291 通过，1 失败。`lunaStamp` 仍为 false。
