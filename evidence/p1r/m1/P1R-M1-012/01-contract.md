# 契约验收

`P1_PLACEMENT_V1` 固定为词汇、基础语法、阅读、听力四维各 25%，题量为 `3/3/2/2`。正确得 1，错误或未答得 0；耗时只能用于解释或同分参考，不能进入正误或总分。总分使用冻结 rounding，并固定 `0–39=A1`、`40–59=A2`、`60–74=B1`、`75–84=B2`、`85–92=C1`、`93–100=C2`。

五条 B10 route 覆盖创建/恢复 session、提交 response、创建 skip baseline 和读取 report。manifest、内容、answer-rule、主体、tenant、owner、分数、等级、置信度与推荐均由服务端产生或可信上下文派生；客户端只能提交闭合作答、耗时、期望版本和幂等输入。

首次持久化的 result/report 不可变；同 key 同 payload 重放原结果，异 payload 返回冲突。skip 只能生成 `SKIPPED + UNVERIFIED + coverage=0 + aggregateScore/referenceLevel=null`；可选起始等级只允许 `USER_SELECTED_NON_AUTHORITATIVE`，不得伪造精确词汇量或官方 CEFR 认证。

生成 TypeScript 已保留 B10 assessed/skipped 分支和 B9 first-day 状态分支。READY 的 `tasks` 为非空 tuple；`taskCount >= 1` 以及与 `tasks.length` 相等仍由 OpenAPI、checker 与服务实现共同执行。降级原因字段唯一命名为 `degradedReason`。
