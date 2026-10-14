# 只读复核：重置错误分类及 Web 输运失败提示（2026-10-14）

## 共享 Mobile store 两行差量

结论：该差量可接受，保持已有 allowlist，不扩展认证能力或接口。

`apps/mobile/src/stores/session.ts` 的 requestPasswordReset / confirmPasswordReset catch 仅由原始 error.message 改为 `mobileAuthFailureMarker(error)`；成功路径、adapter 调用、返回 boolean 和 session 状态均未变。

- marker 先检查明确的 `iam.password_reset.invalid`（含 nested details.error），再处理 status；因此明确 reset-invalid 不会被泛化 401 覆盖。
- 未知 401 被归为既有 `iam.credentials.invalid`；resetConfirm copy 仅针对明确 reset-invalid 显示 invalidCode，否则为 failedConfirm。未知 401 没有被猜成 token 过期。
- 429 保留 RATE_LIMITED；503 仅留 UNKNOWN_AUTH_ERROR；诊断原文不进入 UI。
- 两个 catch 使用同一个既有 allowlist，没有新增推断正则、身份提升或权限旁路。

独立运行 `password-reset-failure-marker.test.mjs`（8）、`iam-auth-transport.test.mjs`（3）和 `mobile-gateway-auth-bootstrap.test.mjs`（13）：**24 / 24 PASS**。前者直接覆盖本差量两个 store action 的 nested reset-invalid、429、未知 401、503 与非认证状态；transport 覆盖 IAM TLS 路由与无旧 bearer，bootstrap 覆盖现有身份绑定、owner 切换、迟到响应、401 不重放及 fail closed。对这两行 catch 分类变动，该组合足够；这些是隔离合成测试，不能作真实 IAM / native 验收。

## Web Reset 确认的问题

结论：**已实际复现输运失败使用成功路径反馈，需修复页面提示事实。** 没有据代码猜测，也没有操作真实 IAM 或重置真实账号。

审查源码指纹（前后相同）：

```text
PasswordResetPage.vue  9f42e9bf0e9cfc2090aec7e348810484b9c120c8d6e9b22b26a8335e5947c302
auth-failure-copy.ts   cbc652a07a5602a2cded9ddd893713a9a1e2dac1d2a53b881375e593d6746fd7
```

`outage-audit.cjs` 使用新隔离 Chromium 上下文，所有 `/api/v1/**` 被拦截；390 px、zh-CN / en-US，5 组页面实测与截图。没有读取 request body / header、真实 storage / cookie / token；合成账号值仅用于 UI 填写。

| Fixture | 实际反馈 |
| --- | --- |
| 中文 202，data.accepted=true | “如果该账号可接收重置通知，我们会发送操作说明。”；role=status、alert=0 |
| 中文 503 | 与上行逐字相同；无 error class、alert=0 |
| 中文 connectionfailed | 与 202 逐字相同；无 error class、alert=0 |
| 英文 503 | “If this account can receive a reset notice, we will send instructions.”；role=status、alert=0 |
| 英文 connectionfailed | 与英文 503 相同；role=status、alert=0 |

所有场景 busy 恢复 false，主按钮可重试，只有 1 次合成 reset request，输入没有被误标 invalid，pageerror 为 0。截图已实际查看。

措辞**没有直写“已受理”或“已发送”**，但它承诺后续会发送，并用 status 成功路径隐去了请求未完成。即使账号真实可接收，在这两个 fixture 中也没有取得服务受理证据，用户会等待不会由该失败请求触发的指引。

## 契约对照

`packages/contracts/fragments/b8/b8-auth-iam.openapi.json`：

- 第 958 行开始为 `/api/v1/auth/password-reset/request`，owner 是 iam-service。
- 第 987 行 `accountEnumeration: prohibited`。
- 第 1009–1034 行仅成功 202 定义 Accepted without account enumeration，data.accepted 恒为 true，避免透露账号是否存在。
- 第 1059 行列出 429。该段没有将输运异常或 503 定义为 accepted。

反枚举要求同一被受理结果不透露账号存在性；提示服务 / 网络未完成也不透露账号是否存在。不能用反枚举把未完成的输运变成 accepted。

## 最小修法建议（本 Agent 未实施）

在 PasswordResetPage.vue 的 `send()`，所有 `!ok` 均保持 requestSent=false、errorKind=server 并 return。429 保留现有限流文案；其它失败使用已存在中英资源 `authT('passwordReset.requestFailed')`（中文“发送没有完成，请稍后再试。”）。只有 ok=true 才置 requestSent=true。

注意 `learnerAuthFailureCopy('resetRequest', ...)` 目前非限流 fallback 也是 requestSent。只把页面的 RATE_LIMITED 条件去掉并继续调用同一 helper，仍会显示成功措辞。最小页面修法可明确选 requestFailed；如同时修共享 helper，也应将 resetRequest fallback 改成 requestFailed，再保留页面统一 helper 路径。

现有 `apps/learner-web/tests/ui-reset.e2e.cjs` 第 123–133 行用默认 503 断言成功 receipt，锁住了此前行为。修复时应把反枚举的两合成账号对照换为真正的 202 accepted:true，再独立断言 503 / connectionfailed 为中性失败 alert，429 为限流；不能仅换断言跳过 accepted 成功控制。

当前证据 `results.json` 的结论为 `CONFIRMED_TRANSPORT_FAILURE_USES_SUCCESS_PATH_FEEDBACK`，是缺陷诊断，**不是修复后的 PASS**。本 Agent 未改正式源、契约、原作者证据、服务或 Git。真实 IAM / 后台实现和 native 运行不在本次范围。
