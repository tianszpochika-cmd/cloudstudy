# 安全与隐私边界

客户端不能提交或覆盖 tenant、principal、owner、plan、priority、SRS quality、objective outcome、score、EF、interval、dueAt、repair/mastery stage、report watermark、content/rule pin、Kafka 事实或恢复命令。identity、成人 Gate、权限、内容权利、可信 outcome 与所有领域写入均由服务端可信上下文和 owner PEP 决定；Gateway 不替代服务侧鉴权。

assessment-service 仅拥有 session/checkpoint/attempt、确定性 outcome、错因和单次 assessment report，不能直接写 SRS 或 mastery。learning-service 是 plan、SRS、repair、mastery 与 report 聚合的唯一写 owner；workflow-service 只能调用 owner API，禁止跨 schema 写入、Kafka RPC、两阶段提交或通过 recovery 改写原 assessment 事实。

canonical payload 采用 allow-list、版本 pin、root/causation/aggregate lineage、consumer-specific dedupe 与 reason trace。原始作答、答案规则、密码、Token、内部错误、人工恢复命令与未经脱敏的学习数据不得进入事件、普通日志或 learner-safe report。报告比例必须暴露分子/分母与 watermark；缺失事实显示处理中，不能静默归零。
