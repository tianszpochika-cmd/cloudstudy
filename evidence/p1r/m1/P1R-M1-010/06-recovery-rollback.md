# 恢复与回滚

M1-010 源码位于来源检查点 `760621e...` 之后的任务启动、契约冻结和 review-fix 提交中。若需撤销静态契约，按相反顺序回退 `cd92378...`、`3bfc63d...`、`02cebc9...`，再重新运行 merge、generate、validate、固定 compatibility、assessment、generated-types、P1R、typecheck 和 diff 检查。

不得移动不可变 compatibility/gov baseline，也不得把源码回滚解释为数据库、对象存储、Kafka、运行中 checkpoint、浏览器数据或真实用户数据的回滚。真实恢复责任仍归 M2-004/005/006。
