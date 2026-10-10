# IT-2 浏览器真实身份走查

日期：2026-10-10。本轮后缀 `5e3c868e`。身份是 IAM RS256，不是临时 JWKS。Chrome 按系统证书校验，没有 `ignoreHTTPSErrors`，没有关闭证书检查，没有 SPKI 例外。临时钥匙串已还原，只剩登录钥匙串和系统钥匙串。本轮四个库已删除。原先保留的两个 IT-1 库还在。固定端口已无监听。qida 容器没有变化。

这不是 Luna 终审，也不是 IT-2 出站。`accepted`、`it2Outbound`、`lunaStamp` 都是 false。Luna 对基线 `69bea68b` 的 IT-2 BLOCKED 原件没有改写。

## 走到哪

| 步骤 | 结果 |
|---|---|
| 注册 `POST https://127.0.0.1:18087/api/v1/auth/register` | 201，进入 `/onboarding` |
| 成人门 `POST http://127.0.0.1:18070/api/v1/iam/adult-gate` | 200 |
| 三项同意 `PUT http://127.0.0.1:18070/api/v1/iam/consents` | 三次 200 |
| 刷新 `POST https://127.0.0.1:18087/api/v1/auth/token/refresh` | 两次都是 200 |
| 学习目标 | 保存前读取是 404，保存 `PUT /api/v1/learner/targets` 为 200，进入 `/assessment` |
| 定级 | 开场 `POST .../placement/sessions` 201，随后 10 次作答都是 200 |
| 报告 | 页面显示「报告已生成」，答对 3 题，共 10 题 |
| 公开重测 `POST .../retest` | 201 |

截图在 `screenshots/report.png` 和 `screenshots/retest.png`。请求清单在 `calls.json`。汇总在 `http-result.json`，`summary` 是 PASS。

## 这次为什么能过刷新

学习页是 `http://127.0.0.1:18180`，IAM 是 `https://127.0.0.1:18087`。浏览器把这次刷新当成跨站。刷新 Cookie 现在是 `HttpOnly; Secure; SameSite=None; Partitioned; Path=/api/v1/auth`。JSON 里仍然没有 refreshToken。

SameSite 不能代替来源校验。IAM 对带着这张 Cookie 的非安全 `/api/v1/auth/` 请求做精确来源校验，只接受学习端 `127.0.0.1` 和 `localhost` 的 `18180`、`18183`。来源不对、缺失，或和 Referer 冲突，返回 403。管理端和官网不在这个名单里。经 Gateway 的请求仍由 Gateway 做原来的来源校验。

合同、ADR、网关事实源和浏览器检查一起改了。历史 R1-002、R1-004 收据里记下的 Lax 没有改成新值。

## 还没完成

这一次浏览器链走通了，不能写成 IT-2 出站或整站验收。IT-1 仍是 REJECT。没有补造 R1-030。没有 commit。
