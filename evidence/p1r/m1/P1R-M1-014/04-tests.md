# 测试与门禁

- `pnpm p1r:gamification-social-contract:check -- --json`：PASS；28 canonical routes、10 canonical events、8 fragment events。
- `tests/p1r/p1r-gamification-social-contract.test.mjs` 与 `p1r-gamification-social-generated-types.test.mjs`：161/161 PASS。
- 契约 merge/generate/validate：23 个 OpenAPI fragments、16 个 event fragments、401 operations、682 OpenAPI schemas、166 events、116 event payload schemas、25 AsyncAPI channels、93 AsyncAPI operations，全部 PASS；固定 compatibility 无 breaking change。
- 全量 `pnpm test:p1r`：721 个 subtests / 1002 tests PASS；workspace typecheck 7/7 PASS。M1-008 content lifecycle、M1-012 placement、M1-013 learning-loop、Gateway、event governance/reliability 与 B26 static current-source 回归均通过。

C/D 阶段已完成：`P1R-M1-010` 的全部摘要已绑定至 GAP/Evidence 集成检查点 `36a2103b0dc9497a6421bbbf99627e10c7a88c50`，并保留 `aab1fa24bb7d46e3dd730fe3801ab2e986301e0d` 为审计实现源。全量 `p1r:evidence:check` 的剩余前提仅是本 D 阶段变更进入干净、已提交的工作树；不得将该机械性前提误写为 runtime Evidence。
