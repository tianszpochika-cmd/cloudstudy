# 测试与门禁

- assessment 专项：`83/83 PASS`。
- assessment CLI：`77` 个 adversarial cases，结果 `PASS`。
- P1R 专项集：`433/433 PASS`；contract tooling：`35/35 PASS`；workspace typecheck：`7/7 PASS`。
- contracts merge/generate/validate 通过；composed contract 为 `386` operations、`601` schemas；两个固定 compatibility baseline 均通过。

完整历史 G 仍为 `39/41`，原因是既有 G0/G3 stale source-marker 断言；它不被写成 M1-010 的全绿或回归通过。直接 API audit 的既有 B9 content-publish-task 200 envelope 问题同样只作历史上下文记录。
