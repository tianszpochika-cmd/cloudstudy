# 测试与终验证据

- 独立 Luna Max reviewer 绑定 `f7a2e76fcc206c26f296ae6f1c2a4296d0a8a573` 判定 `ACCEPT`，P1/P2=`0/0`，工作树干净且 `git diff --check 5d0bb3a..f7a2e76` 通过。
- commerce checker：13/13 routes、9/9 v2 events，`D2_CONTRACT_READY / NOT_RUNTIME_VERIFIED`。
- commerce 专项与 generated-types：144/144 + 2/2；统筹合并后的定点套件共 146/146。
- 全量 `pnpm test:p1r`：1153/1153；First-day 学习闭环回归：221/221；workspace typecheck：7/7。
- contracts merge/generate/validate、event governance/reliability、B26 static、Gateway audit/test、两条 fixed Git compatibility、plan Gate 与 CI guard 均通过。
- C/D Evidence 集成完成：C=`b41af4af17cf082b038438c2ce3694f95804a5f1`，D=`d0cd4fc812bb2ee20c78375b99f6310e80992237`；全局 Evidence Gate 在干净 D 提交上 PASS，108 tasks、22 ACCEPTED、1 BLOCKED、85 PLANNED、0 errors。
- 完整历史 `test:g` 的既知 G0/G3 stale marker 不在本任务中晋升为 PASS；M1-015 直接影响的 G1 定点测试通过。
