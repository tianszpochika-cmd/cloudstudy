# 验收与交接

`P1R-M1-008` 的最终源码 `e05c774b02ece081a5c05145b623f39d1ecd39e1` 已由以下三条只读轨道独立接受，且均报告当前源码 P1/P2 为 `0/0`：

1. `agent:m1_008_independent_review:gpt-5.6-luna:max`
2. `agent:m1_008_contract_tooling:gpt-5.6-luna:max`
3. `agent:m1_005_independent_review:gpt-5.6-luna:max`

三轮 REWORK 依次关闭：生命周期/退休/文档语义问题；reviewRecords 与 reviewed event 的版本/hash/阶段完整性；composed OpenAPI 生成 TypeScript 丢失公共字段、分支 required/discriminator 与禁止字段的问题。精确中间评审时间未单独持久化，不补造时间。

集成阶段需把 `P1R-M1-001` 至 `P1R-M1-007` 的共享 artifact digest 重新绑定到 `e05c774`，保留各自原始 provenance；随后更新任务台账、状态轨迹和跨电脑交接，并让 `pnpm p1r:evidence:check` 在已提交工作树上通过。

后续必须继续保留：M2-004/005/006 的真实运行责任、B26 pending/NO-GO、M0-006 BLOCKED，以及历史完整 G 39/41 的已知非本任务缺口。只有 Evidence/台账集成提交已推送并核对后，另一台电脑才可从远程 `dev` 继续下一个依赖就绪任务。
