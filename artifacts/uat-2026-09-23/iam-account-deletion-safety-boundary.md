# IAM 账号删除安全边界（2026-09-23）

## 当前判定

`PAGE-P1-PRIVACY` 的账号删除仍为 **BLOCKED**。M1-017 契约要求二次认证、七天冷静期、各领域 owner 删除/匿名化回执、法律保留判定和失败恢复。原 `IamAccountDeletionController` 接受可选且未校验的申请 body、只按幂等键重放，内部执行仅撤销 IAM 会话并把 IAM 账号标为 `DELETED`；没有跨 owner 收据对账，响应状态与契约也不一致。既有静态 `p1r-m6-008-runtime.mjs` 仅检索源码字符串，不能作为真实删除验收。

本机 IAM owner 只读核对：删除请求表共 100 行，`REQUESTED 25 / CANCELLED 38 / EXECUTED 37`；其中与当前账号表能关联的 92 行全部使用本地 `.invalid` 合成标识，另有 8 行找不到当前账号。未读取密码或令牌，未修改这些历史行。这个本地数据分布不能外推到其他环境。

## 本批安全修复

- 新申请和内部执行先验证 access/service principal，再以 HTTP 503 失败关闭，均不访问数据库。这样不会新增无法交付的删除承诺，也不会把仅 IAM 状态变化冒充全域删除。
- 历史请求的本人查询与撤回保留。撤回现在要求 `Idempotency-Key`；已撤回的本人请求重放返回既有状态。首次撤回用 `status='REQUESTED'` 和冷静期未到的 SQL 条件原子更新，状态变化或窗口过期返回 409。
- M1-017 的申请/执行 OpenAPI 响应补 `503`，聚合契约和生成物同步。IAM 源码新增安全测试，证实已认证的申请/执行返回 503 且不取得 JDBC 连接。

## 验证与未完成

`mvn -q -f services/iam-service/pom.xml test` 在 `TEMP/TMP=C:\Temp` 下通过：19 suites、105 tests、0 failure/error、21 条按既有条件跳过；其中两条新安全测试通过。`contracts:merge:check`、`contracts:validate`（455 operations）和 `contracts:generate:check` 通过；定向 `git diff --check` 通过。

16:57 CST 已随第八批将 IAM JAR 投入本地 16 服务运行栈；[Gateway/IAM/数据库真实复测](iam-account-deletion-runtime-batch8.md) 29/29 通过：匿名新申请 401，认证申请和同键重试 503，没有新增删除单或账号/会话状态变化；为新合成主体精确插入的历史待执行记录，本人读取/撤回 200、他人读取/撤回 404、同键撤回重放 200，清理后无残留。历史撤回**接受了不可验证的合成二次认证引用**，不能算 M1-017 完成。第七批 Docker IAM 镜像仍是旧实现；第八批容器构建中，容器内路径未验。内部执行身份与跨 owner 回执尚待运行验证。

正式完成仍需二次认证引用与短时有效性、规范响应状态/摘要幂等、owner receipt 写入与逐 owner 对账、workflow 扇出/重试/法律保留/恢复，以及 Web/移动端的本人操作闭环。现有取消路径仍未验证 `reauthenticationRef`，不能算 M1-017 正式取消语义。Gateway 冻结检查对 `iam-account-deletions` 的失败项应保留，不能仅因路由存在而删去。
