# 测试与门禁

- learner planning CLI：10 个 canonical routes、145 个 adversarial cases，结果 `PASS`，运行状态 `NOT_RUNTIME_VERIFIED`。
- learner planning 与生成类型定点组合：`150/150 PASS`；独立 reviewer 的 planning 专项视图为 `149/149 PASS`。
- P1R 全集：`589/589 PASS`；contract tooling：`40/40 PASS`；workspace typecheck：`7/7 PASS`。
- contracts merge/generate/validate 通过：22 fragments、357 routes、388 operations、608 schemas、154 events、104 payload schemas、13 AsyncAPI channels、48 operations、13 JSON schemas。
- 固定 contract/governance compatibility 全部 compatible，0 breaking；IAM、Gateway、data ownership、content/media/assessment、event governance/reliability 与 B26 static 均通过。

完整历史 G 保持 `39/41`，仅既有 G0/G3 stale marker 失败；它没有被写成 M1-011 的全绿结论。既有 admin content publish-task envelope 问题也不归入本任务验收。
