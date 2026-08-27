# B31 内容发布、学习端读取与 MySQL 真实数据验证

> 日期：2026-08-25  
> 模式：`local-real`，真实 Keycloak、Gateway、content-service owner MySQL、公开投影  
> 结论：B31 本机运行切片已通过；未宣称四端浏览器或生产发布完成。

## 运行命令

```powershell
$env:B30_REAL_OIDC = 'true'
pnpm b31:static
pnpm b31:content-runtime
pnpm test:b31
```

`b31-content-runtime.mjs` 通过本地 Keycloak 临时内容角色建立真实 JWT，经 Gateway 调用 content-service 的创建、两级审核、发布、目录/详情读取和取消发布；`b31-learner-runtime.mjs` 使用真实授权码 + PKCE 会话，经 Gateway 完成成人 Gate、同意、目标、偏好写入和读回；脚本只输出状态、版本号、计数和安全标记，不输出密码或 token。

## 最近一次运行证据

| 证据 | 结果 |
|---|---|
| runId | `b31-content-2026082513` |
| 发布版本 | `25004`；创建→提交审核→一级审核→二级审核→发布均为 `202` |
| 幂等重放 | 发布相同命令重放稳定，`idempotentReplay=true` |
| 学习端目录/详情 | 发布后目录与同版本详情 `200`，来源 `mysql`；取消发布后详情 `404` |
| MySQL 持久化 | definition `1`、version `1`、取消发布后 projection `0`、outbox `7`、idempotency `7` |
| 安全边界 | 未认证内容读/管理写均拒绝；`credentialsPersisted=false`、`tokenValuesEmitted=false` |

## 学习者 API→DB→API 证据

最近一次运行：`pnpm b31:learner-runtime`，runId `b31-learner-2026082513`。

| 验证 | 结果 |
|---|---|
| 授权码 + PKCE / IAM principal bootstrap | PASS，Gateway 返回 200；没有使用固定 Token |
| 成人 Gate | PASS，IAM principal 的 `adult_gate_status=APPROVED` |
| 隐私/条款同意 | PASS，IAM owner `iam_consent` 两行 `GRANTED/b30-consent-v1` |
| learner profile/target/preferences 写入 | PASS，`b25_learner_profile`、`b25_learner_goal`、`b25_learner_preferences` 各 1 行 |
| 幂等重放 | PASS，profile、target、preferences 使用同一 Idempotency-Key 重放后仍为单一 owner 行 |
| API 重新读取 | PASS，profile、target、preferences、first-day 均为 200，locale/goal 与提交值一致 |
| 重新建立授权码会话后读回 | PASS，新会话重新读取 profile、target、preferences 均为 200，owner 事实没有依赖上一会话内存 |
| 关联与安全 | PASS，`subjectBound=true`、`credentialsPersisted=false`、`tokenValuesEmitted=false` |

## 本轮修复

- `content-service` 从 provider-signed Keycloak `realm_access/resource_access` 角色映射权限，不信任客户端角色头；
- 跨内容版本 ID 改为 owner repository 的全局递增分配，避免不同内容的 `content_version_id` 主键冲突；
- 公开投影查询补齐 `audience` 参数，真实发布后的学习端读取不再错误返回 `503`；
- 目录合并旧 B25 fixture 时按内容 code 去重，未发布内容不会被静态 fixture 绕过取消发布门禁；
- 只清理了本轮脚本生成的 `b31-live-*` 测试残留，未删除其他业务数据。

## 边界

B31 证明了内容和学习者 onboarding 的 API→owner MySQL→API 真实数据闭环；后台/学习端页面的浏览器交互、四端构建、评测/SRS/通知跨域联调和异常回归属于 B33–B36。认证后的页面提交仍需 Browser MCP 将页面操作与本文件的 owner 事实做最终对账。
