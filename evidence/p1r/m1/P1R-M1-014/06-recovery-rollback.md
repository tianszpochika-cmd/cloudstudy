# 恢复与回滚

奖励账本不可改写；重复事实返回原 settlement，冲突去重键失败关闭，纠正只能新增补偿分录。lease、focus 与榜单只接受服务端时钟和已结算版本化事实；断线、离线成功页和 heartbeat 不得补学习分钟或触发奖励。

如需回退 D2 源码，按反向顺序回退 `aab1fa24bb7d46e3dd730fe3801ab2e986301e0d` 及启动边界提交，重跑专项 checker、generated types、contracts、固定 compatibility、P1R、B26、GAP、Evidence 与 diff 门禁。源码回退不得被解释为数据库、Kafka 或运行态数据回滚。
