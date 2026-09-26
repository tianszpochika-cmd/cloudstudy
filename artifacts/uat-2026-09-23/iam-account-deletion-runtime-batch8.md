# IAM 账号删除运行安全边界：第八批

## 范围与结果

在本机第八批 IAM JAR 启动后，经真实 Gateway `127.0.0.1:18070`、IAM owner `127.0.0.1:18087` 和 MySQL IAM owner schema 完成 **29/29 检查通过**。脚本为 [`scripts/runtime/uat-iam-deletion-failclosed-batch8.mjs`](../../scripts/runtime/uat-iam-deletion-failclosed-batch8.mjs)，机器可读结果为 [`iam-account-deletion-runtime-batch8.json`](iam-account-deletion-runtime-batch8.json)。

本次只创建两个 `@local.invalid` 合成账号，各自走公开注册、成人 Gate、三项同意和登录取得真实 access JWT。另为其中一人精确插入一条 `REQUESTED` 测试记录，`execute_at` 设为七天后；没有接触既有删除单，也没有调用执行删除接口。密码、JWT、数据库口令与完整主体 ID 未写入结果文件。申请与撤回请求体采用符合契约形状但**不可验证的合成二次认证引用**。

| 检查 | 实测 |
| --- | --- |
| Gateway / IAM 健康 | 200 / 200 |
| 注册、成人 Gate、三项同意、登录 | 201 / 200 / 200 ×3 / 200 |
| 匿名 `POST /api/v1/iam/account-deletions` | 401 |
| 本人认证后申请，携带幂等键与规范形状请求体 | 503 |
| 同键重试 | 503 |
| IAM 删除申请记录 | 请求前 0，请求后 0 |
| IAM 账号与活跃会话 | 请求前后均为 1 个活跃账号、2 个活跃会话 |
| 新建的七天冷静期历史记录 | 数据库精确归属本人，`REQUESTED`，执行时间在未来 |
| 本人读取 / 他人读取 | 200 `REQUESTED` / 404 |
| 他人撤回 / 本人缺少幂等键撤回 | 404 / 400 |
| 本人撤回 / 同键再次撤回 / 本人再读取 | 200 `CANCELLED` / 200 `CANCELLED` / 200 `CANCELLED` |
| 数据库撤回状态 | `CANCELLED` 且有 `decided_at`；账号和两个活跃会话保持不变 |
| 测试数据清理 | 两个账号、幂等键、相关主体记录、刷新历史及插入的删除单均为 0 |

清理只针对本次随机前缀的两个账号及其主体 ID，并在删除前校验标识和 UUID。结果文件不含凭据。另一次只读全局前缀检查为账号 0、幂等键 0、插入形式的历史删除单 0。

## 验收边界

这证明第八批**新申请会安全失败且不写删除单**，历史数据的本人读取和撤回在这组条件下可用，但不证明账号删除功能可用。当前历史撤回路径没有核验二次认证引用，合成引用仍能撤回测试行；它返回 `REQUESTED`/`CANCELLED`，与 M1-017 正式状态模型也没有对齐。内部服务身份执行、跨 owner 回执、法定留存、恢复链路和 Web/移动端完整交互未由本脚本验收。正式功能仍为 `BLOCKED`；此前的旧运行脚本曾允许仅 IAM 状态变化，不能沿用其通过结论。
