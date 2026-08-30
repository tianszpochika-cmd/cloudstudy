# 恢复与回滚

同一 plan/task、assessment session 与内容/规则 pin 必须按版本恢复；重放同一幂等输入返回既有结果，异 payload、旧 baseStateVersion、倒序 clientSeq、内容 pin 冲突和终态写入必须显式冲突。离线事件只能经 owner API 安全重放，不能静默合并 mastery、XP、权益或跨域事实。

SRS/repair/mastery 的恢复必须保留 sourceAssessmentEventId、itemAssessmentId、queue/projection 版本、time policy、reasonTrace 和 watermark。重复、乱序、迟到或失败不能创建第二个 SRS state、重复奖励或覆盖更晚事实；D1/D7 和 REOPENED 必须可解释。report 重建与对账不得篡改原始 assessment 结果。

如需撤销本次静态契约，先回退 a7f92095323f2afc4e6d28eeaff977e2197fcd0c，再回退 66640174b3073af0dabc7412a55d5edc45e9b535，然后重跑 learning-loop、generated types、merge/generate/validate、两条 fixed compatibility、P1R、Gateway、event、B26、typecheck、Evidence 与 diff 门禁。不得移动不可变基线，也不得把源码回滚解释为数据库、Kafka 或 Saga 数据回滚。
