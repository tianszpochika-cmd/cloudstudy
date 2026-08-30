# 安全与隐私边界

客户端不能提交或覆盖 principal、tenant、owner、正确答案、dimension score、aggregate score、reference level、confidence、recommendation、manifest/content/answer-rule pin、Outbox/Saga/recovery 控制权。所有 authority 均由服务端可信上下文派生，Gateway 边界不替代 assessment/learning 服务侧 PEP。

placement response 使用闭合作答联合类型与摘要；报告只暴露 learner-safe 四维摘要、覆盖和解释，不暴露正确答案、内部规则、精确词汇量、原始权威事实、内部错误或人工恢复命令。skip 请求不能把自选等级升级为测得等级。

canonical completion event 使用精确 payload allow-list、不可变身份、event/root/aggregate lineage 和 consumer-specific dedupe。workflow 只能协调 owner API，禁止跨 schema 写入、Kafka RPC、两阶段提交或用 recovery 改写原 placement 结果。
