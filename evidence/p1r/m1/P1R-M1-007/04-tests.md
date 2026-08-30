# 测试证据

最终源码 `6ce98a95b75e7efca05cc511f5f773dbf2be08a4` 的记录：

- 主评审 reliability 对抗测试：78/78；
- 二次评审 reliability + Saga 联合测试：89/89；
- `pnpm test:p1r`：276/276；
- G1：6/6，canonical JSON Schema 数为 13；
- 契约：377 operations / 536 OpenAPI schemas / 154 events / 104 payload schemas / 7 channels / 21 operations / 13 JSON Schemas；
- `pnpm typecheck`：7/7；B26 定向测试：13/13；
- auth、IAM、Gateway、data owner、event governance、reliability、Saga、Redis、B25 static、plan、CI、diff 与 compatibility 均通过。

完整历史 `pnpm test:g` 仍为 39/41，仅有既存 G0/G3 source-marker 断言失败；任务相关 G1 为 6/6，该历史缺口未被掩盖或记作全绿。

独立主评审先后三次给出 `REWORK`，最终在 `6ce98a9` 接受；二次 Luna Max 复核同一源码并接受。详见 manifest 的 `statusTrajectory` 与 `reviewHistory`。
