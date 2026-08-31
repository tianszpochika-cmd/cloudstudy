# 测试与门禁

- `pnpm p1r:gamification-social-contract:check -- --json`：PASS；28 canonical routes、10 canonical events、8 fragment events。
- `tests/p1r/p1r-gamification-social-contract.test.mjs` 与 `p1r-gamification-social-generated-types.test.mjs`：161/161 PASS。
- 契约 merge/generate/validate：23 个 OpenAPI fragments、16 个 event fragments、401 operations、682 OpenAPI schemas、166 events、116 event payload schemas、25 AsyncAPI channels、93 AsyncAPI operations，全部 PASS；固定 compatibility 无 breaking change。
- 全量 `pnpm test:p1r`：721 个 subtests / 1002 tests PASS；workspace typecheck 7/7 PASS。M1-008 content lifecycle、M1-012 placement、M1-013 learning-loop、Gateway、event governance/reliability 与 B26 static current-source 回归均通过。

C 阶段的 `p1r:evidence:check` 只允许保留 M1-010 的已知摘要绑定残留；该 manifest 需要在后续 D 阶段绑定到包含 GAP 关闭的提交后再通过全量 Evidence Gate。
