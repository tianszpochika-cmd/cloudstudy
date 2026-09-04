# P1R M2 执行日志

## 2026-09-04 中断恢复与 Gateway 安全收口检查点

- 恢复起点：`dev@9e88958f22a3abff7f4521b819330be84207c0ae`，当时工作区干净且本地远程跟踪为 `0/0`；既有 IAM/Gateway 成果全部保留，没有执行 reset/clean/checkout。
- Gateway 检查点：`acee36a84ee1fd6557ac3b62a41d033622e8da4a`。移除三条尚无 provider-signature 边界的支付回调 execution projection，使其在精确高优先级规则上 404 fail closed；响应提交前把 request/trace header 归一为单值；B12/B13/B14 及未注册的 core-api compatibility 默认关闭。
- 契约投影同步为 `151 projections / 168 available operations / 197 unavailable operations`，execution target digest 为 `5fbbaa85800a951a06251478270fb97ff1a5c61bbada38e62c11823792377af1`，M2-001 的受控 OpenAPI root/full semantic digest 已同步更新。
- 验证：Java 25 Gateway `62/62`、Gateway Node `32/32`、全量 P1R `1416/1416`、contracts merge/validate、Git baseline compatibility、Gateway audit、plan、GAP registry 和 diff PASS。独立只读审查确认支付回调不存在前缀逃逸，但指出 Gateway health 仍错误沿用 `service=core-api`，真实 Netty header-copy 顺序也尚未跨进程验证。
- 状态：`P1R-M2-001` 继续 `IN_PROGRESS / NOT_RUNTIME_VERIFIED`。本轮不关闭任何 runtime GAP，不创建 canonical Evidence，不解锁 M2-003。
- 平台依赖审计确认：durable audit 自然属于 M2-006、NetworkPolicy 运行证明自然属于 M2-008/M2-010；把二者同时作为 M2-001 前置会形成依赖闭环。下一治理检查点须明确实施/Evidence/最终 Gate 责任，不能降低最终标准或提前验收。
- 远程：首次 fetch/push 因 GitHub HTTPS 连接重置/443 不可达失败；本地提交已安全落盘，网络恢复后必须重试推送并记录远程 SHA。

## 2026-09-01 启动

- 前置：M1-018 独立终验 `ACCEPT`、P1/P2=`0/0`；全局 Evidence Gate PASS；远程 `dev` 已包含 `d7fdabb01655e3c2c1e13c076d7ba2bf8281875c`。
- 并行轨道：`P1R-M2-001` Gateway 与 `P1R-M2-002` IAM 转为 `IN_PROGRESS`；`P1R-M2-003` 仅做只读预研，等待两项依赖验收。
- 执行模型：统筹 Agent 独占 Git、台账、Evidence 和公共文件；Gateway 与 IAM 执行 Agent 使用互斥服务目录，不提交、不推送。
- 运行诚实性：当前可完成代码、Java 25 测试和本机可用依赖验证；未实际运行的 Redis/MySQL/JWKS/upstream/浏览器/NetworkPolicy/跨进程链路继续 `NOT_RUNTIME_VERIFIED`。
