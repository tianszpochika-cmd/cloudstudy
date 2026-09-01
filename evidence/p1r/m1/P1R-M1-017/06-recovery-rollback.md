# 恢复与回滚证据

- 隐私导出和审计导出以受控状态、重试/撤销/过期、owner receipt 与恢复引用闭环；恢复不能复制原始 payload 或跨 owner 写入。
- 账号删除在冷静期可取消，执行后按 owner receipt 对账；legal hold 未知、receipt 缺失或部分失败时禁止伪装完成。
- analytics 删除抑制与 consent 版本异常必须失败关闭，不能用 Redis TTL 或客户端状态替代 owner fact。
- 源码回滚：先逆序回退 M1-017 Evidence/台账集成，再回退 `600438218b35c1b5a9931dd16fa0ad210050c68d`，随后重跑专项、contracts、compatibility、event、Gateway、B26、P1R、typecheck、plan、gap、Evidence 与 diff 门禁。
- Git 回退不等于数据库、对象、broker、workflow、会话、浏览器或客户端数据回滚；真实恢复仍由后续运行任务验收。
