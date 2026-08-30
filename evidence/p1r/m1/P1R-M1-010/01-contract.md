# 契约验收

五个 canonical external operations 为创建/读取 session、session-scoped checkpoint、提交 attempt 和读取 report。所有 canonical operation 默认 `DENY`，并要求服务端 PEP 的 subject、tenant、adultGate、phase、contentRights、entitlement、resourceOwner 与 policyVersion 事实。

session、attempt 与 report 分别使用冻结状态机；attempt 的 `ASSESSED` 分支要求非空 `assessedAt`，生成 TypeScript 保留该窄化。checkpoint 绑定 protected draft、base state version、checkpoint version、client event id/seq 与 digest：同版本同摘要 replay，旧版本、同版本异摘要和终态均失败关闭为 409。

答案为闭合的 CHOICE/MATCHING/ORDERING/CLOZE/TEXT/UNANSWERED 联合，拒绝客户端 score/rule authority。答案 digest 和五类原始载荷在 submit/checkpoint audit 边界被精确脱敏；objective outcome 只输出 learner-safe 分子/分母、bucket、error category、结构化 reason trace 和 outcome digest。report 不拥有 mastery/SRS。
