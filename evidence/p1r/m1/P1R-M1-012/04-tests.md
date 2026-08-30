# 测试与门禁

- placement policy：四维、10 题、权重 100、6 个等级边界与 136 个 adversarial cases 通过；placement 测试 `141/141 PASS`。
- P1R 全集：`746/746 PASS`；B26：`27/27 PASS`；contract tooling：`46/46 PASS`；workspace typecheck：`7/7 PASS`。
- contracts merge/generate/validate 通过：23 个 OpenAPI fragments、393 operations、624 OpenAPI schemas、155 events、105 event payload schemas、14 AsyncAPI channels、51 AsyncAPI operations。
- `463c4b2...` 与 `270b0df...` 两条固定 Git compatibility 都在 `868c217...` 治理基线上通过，breaking changes 为 0。
- assessment、learner planning、event governance/reliability、Gateway、Saga、B26 static、plan、CI 与 diff 门禁均通过。

完整历史 G 仍为 `39/41`，只失败于既有 G0/G3 stale source marker；它未被写成 M1-012 全绿或运行证据。
