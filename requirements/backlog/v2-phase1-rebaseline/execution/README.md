# P1R 执行记录

本目录是 Phase 1 重基线计划的当前执行日志入口。任务状态只以 `../02-编号任务台账.md` 为准，验收结论只以 `evidence/p1r/` 下通过校验的 canonical manifest 为准；旧 B0–B36、DEV、G 与旧 Evidence 只能作为 `historical-candidate`。

## 当前检查点

- 工作分支：`dev`。
- 当前台账计数：`21 ACCEPTED / 1 BLOCKED / 1 IN_PROGRESS / 85 PLANNED`（共 108 项）。
- M0 实现范围已经完成统一集成；`P1R-M0-001`、`002`、`003`、`004`、`005`、`007`、`008` 已接受。
- `P1R-M0-006` 的版本清单、锁文件、许可证与 SBOM 机制已完成，但严格安全 Gate 保持 `BLOCKED`：移动端 uni-app 工具链仍带有 1 个 Vite high 漏洞，未添加豁免、未强制覆盖不兼容的编译器 peer dependency。
- M1 只允许从已接受的 `P1R-M0-008` 依赖边界开始做契约工作；M0 安全红灯解除前，不得把整个 M0 或任何发布 Gate 宣告为 PASS。
- `P1R-M1-001` 已由独立评审接受；原实现源为 `96e1b541cdda8e9e5ad02bc79ea0c5b9032064c4`，共享制品已在 `aab1fa24bb7d46e3dd730fe3801ab2e986301e0d` 完成 M1-014 current-source revalidation，canonical manifest 位于 `evidence/p1r/m1/P1R-M1-001/manifest.json`。
- `P1R-M1-002` 已由独立 Terra Ultra 评审接受；原最终实现源为 `25705c4caab46449cfaa577db08bd13c8ad13fba`，共享制品已在 `aab1fa24bb7d46e3dd730fe3801ab2e986301e0d` 完成 M1-014 current-source revalidation，canonical manifest 位于 `evidence/p1r/m1/P1R-M1-002/manifest.json`；M1 后续任务仍未完成。
- `P1R-M1-003` 已由独立 Luna Max 评审接受；原最终实现源为 `82b27f4108cfb976a274c2ac0cc34b1c9460a7a7`，共享制品已在 `aab1fa24bb7d46e3dd730fe3801ab2e986301e0d` 完成 M1-014 current-source revalidation，canonical manifest 位于 `evidence/p1r/m1/P1R-M1-003/manifest.json`；只证明 IAM 权限、成人 Gate、consent、tenant、admin policy 与 PEP/PDP D2 契约，不冒充 M2 运行实现。
- `P1R-M1-004` 已由独立 Luna Max 终验接受；Gateway D2 原实现源为 `e4618b324e5a93926da0750a8100fc9377ac97ec`，共享制品已在 `aab1fa24bb7d46e3dd730fe3801ab2e986301e0d` 完成 M1-014 current-source revalidation，canonical manifest 位于 `evidence/p1r/m1/P1R-M1-004/manifest.json`。真实 WebFlux CORS/CSRF、public-path、Redis 限流、持久审计、网络直连隔离和跨进程证据仍属于 `P1R-M2-001`。
- `P1R-M1-005` 已由独立 Luna Max 终验接受；原最终实现源为 `21cdd3a94d0c721c96f5257d26efbb0c1b9354fb`，共享制品已在 `aab1fa24bb7d46e3dd730fe3801ab2e986301e0d` 完成 M1-014 current-source revalidation，canonical manifest 位于 `evidence/p1r/m1/P1R-M1-005/manifest.json`。本任务只冻结 D2 数据所有权与迁移政策。
- `P1R-M1-006` 已由独立 reviewer `agent:m1_005_independent_review:gpt-5.6-luna:max` 接受原最终实现源 `3e4ba856742f28ba9d3fc4a3264c4b24c1cafc5a`；共享制品已在 `aab1fa24bb7d46e3dd730fe3801ab2e986301e0d` 完成 M1-014 current-source revalidation。输出保持 `NOT_RUNTIME_VERIFIED`；真实 Kafka 运行验证仍归 M2-005。
- M1-014 接受后，`P1R-M1-001` 至 `P1R-M1-009`、`P1R-M1-011` 至 `P1R-M1-013` 的 canonical manifest 已统一绑定 `aab1fa24bb7d46e3dd730fe3801ab2e986301e0d`；原始实现源、完成时间、reviewer、兼容基线与历史复核链仍保存在 manifest `provenance`，没有被改写成 M1-014 的实现成果。唯一的 M1-010 GAP registry 摘要例外已在 post-C D 阶段绑定至 `36a2103b0dc9497a6421bbbf99627e10c7a88c50`。
- `P1R-M1-007` 已由独立 reviewer `agent:m1_007_independent_review:gpt-5.6-luna:max` 终验接受原最终源码 `6ce98a95b75e7efca05cc511f5f773dbf2be08a4`，另一位 Luna Max 交叉复核亦接受；共享制品已在 `aab1fa24bb7d46e3dd730fe3801ab2e986301e0d` 完成 M1-014 current-source revalidation，canonical manifest 位于 `evidence/p1r/m1/P1R-M1-007/manifest.json`。结论仅为 `D2_CONTRACT_READY` / `NOT_RUNTIME_VERIFIED`；B26 仍为 `static-only` / `runtimeStatus=pending` / `defaultDecision=NO-GO`，真实 owner schema/事务、Kafka/consumer 与 Saga/人工恢复分别归 M2-004/005/006。
- `P1R-M1-008` 已由三条 Luna Max 只读轨道一致接受原最终源码 `e05c774b02ece081a5c05145b623f39d1ecd39e1`；共享制品已在 `aab1fa24bb7d46e3dd730fe3801ab2e986301e0d` 完成 M1-014 current-source revalidation，canonical manifest 位于 `evidence/p1r/m1/P1R-M1-008/manifest.json`。11 个内容 command、双审身份与阶段集合、排期发布、公开/学习投影、B10 pin/fallback、5 个 canonical content 事件及 composed TypeScript 生成均通过失败关闭验收；结论仍只为 `D2_CONTRACT_READY` / `NOT_RUNTIME_VERIFIED`。
- `P1R-M1-009` 已由独立 reviewer `agent:m1_009_contract_audit:gpt-5.6-luna:max` 接受原最终源码 `2e7304a12c297d4c7bcad22b41cdb373b6030033`；共享制品已在 `aab1fa24bb7d46e3dd730fe3801ab2e986301e0d` 完成 M1-014 current-source revalidation，canonical manifest 位于 `evidence/p1r/m1/P1R-M1-009/manifest.json`。14 个 canonical routes、30 个 closed schemas、录音专用 consent、媒体/assessment owner、短时 grant、处理 retry、exact fallback、历史兼容与 Phase 1 无 AI/ASR/RTC 均通过失败关闭验收；真实对象存储、worker、数据库、Kafka、浏览器/设备仍未验证。
- `P1R-M1-010` 已由独立 reviewer `agent:m1_009_contract_audit:gpt-5.6-luna:max` 绑定最终源码 `cd92378bd8ba0c57c920fc6e79db52de717b0b05` 接受，首轮 `3bfc63d` 的 raw-answer audit redaction 与 `ASSESSED.assessedAt` nullability 两项缺口已完成返工；post-C D 阶段已将其当前-source manifest 与全部 artifactDigests 绑定至 `36a2103b0dc9497a6421bbbf99627e10c7a88c50`，审计实现源仍为 `aab1fa24bb7d46e3dd730fe3801ab2e986301e0d`，canonical manifest 位于 `evidence/p1r/m1/P1R-M1-010/manifest.json`。结论只冻结 assessment session/checkpoint/attempt、确定性判分摘要、报告快照、版本与幂等 D2 契约；placement、learning 下游和真实运行仍由后续任务负责。
- `P1R-M1-011` 已由独立 reviewer `agent:m1_011_independent_review:gpt-5.6-luna:max` 绑定最终源码 `daa543b369c0e369a8f70e2f79278eb934ff9a09` 接受；首轮 `5b6a3d5` 的 eligibility pin、goal exactly-once、If-Match/幂等、event allow-list 与 legacy mapping 缺口已完成返工。共享制品已在 `aab1fa24bb7d46e3dd730fe3801ab2e986301e0d` 完成 M1-014 current-source revalidation，canonical manifest 位于 `evidence/p1r/m1/P1R-M1-011/manifest.json`；结论只冻结 learner/profile/target/preferences、planning-input pin、首日投影与目标事件 D2 契约。
- `P1R-M1-012` 已由独立 reviewer `agent:m1_012_independent_review:gpt-5.6-luna:max` 绑定最终源码 `aac5c3462e01f3b3bec34bb13e7cd9f74ff34f72` 接受，P1/P2 为 `0/0`；共享制品已在 `aab1fa24bb7d46e3dd730fe3801ab2e986301e0d` 完成 M1-014 current-source revalidation。四维 10 题 placement、不可变 result/report、`SKIPPED + UNVERIFIED`、canonical completion event、placement→plan Saga 与生成类型均通过静态失败关闭验收；真实数据库/Outbox/Kafka/workflow/browser/E2E 仍未验证。
- `P1R-M1-013` 已接受：不可变来源检查点 `a07a58a7d245295c54d39487a6669545d077c513`，原最终源码 `a7f92095323f2afc4e6d28eeaff977e2197fcd0c`，共享制品已在 `aab1fa24bb7d46e3dd730fe3801ab2e986301e0d` 完成 M1-014 current-source revalidation；原独立 reviewer `agent:m1_013_evidence_plan:gpt-5.6-terra:max` 判定 `ACCEPT`，P1/P2=`0/0`。结论仍仅为 `D2_CONTRACT_READY` / `NOT_RUNTIME_VERIFIED`；B26 继续 pending/NO-GO，M0-006 继续 `BLOCKED`。
- `P1R-M1-014` 已接受：最终源码 `aab1fa24bb7d46e3dd730fe3801ab2e986301e0d`，独立 reviewer `agent:m1_014_final_review:gpt-5.6-luna:max` 判定 `ACCEPT`，P1/P2=`0/0`；28/28 canonical routes、10/10 canonical events 与定点 161/161 通过。三项 GAM/SOC GAP 已按 D2 Evidence 关闭，M1-010 的 post-C 绑定已在 `36a2103b0dc9497a6421bbbf99627e10c7a88c50` 完成，D 阐明提交为 `76ca7806c7c19cb10ce1eb28aaf60a4cc3eec078`，全局 Evidence Gate 已 PASS；B4/B12 v1 仍为 historical-only，真实 schema/Outbox/Kafka/WebSocket/browser/E2E 均未验证。
- `P1R-M1-015` 已从干净且同步的 `dev@5d0bb3a0651d9205a942eca9d8e1c56b538ed73f` 启动；只冻结商品/价格快照、激活码、sandbox 验签、权益版本/失效/grace、退款/撤销/对账与生产支付 OFF 的 D2 契约。B5/B13 v1 和 B20 不作运行证明，B20/B21/B26 继续 `BLOCKED`/`NO-GO`/`pending`。

## M0 记录索引

| 任务 | 执行记录 | canonical 状态 |
|---|---|---|
| `P1R-M0-001` | `P1R-M0-001.md` | `ACCEPTED` |
| `P1R-M0-002` | `P1R-M0-002.md` | `ACCEPTED` |
| `P1R-M0-003` | `P1R-M0-003.md` | `ACCEPTED` |
| `P1R-M0-004` | `P1R-M0-004.md` | `ACCEPTED` |
| `P1R-M0-005` | `P1R-M0-005.md` | `ACCEPTED` |
| `P1R-M0-006` | `P1R-M0-006.md` | `BLOCKED` |
| `P1R-M0-007` | `P1R-M0-007.md` | `ACCEPTED` |
| `P1R-M0-008` | `P1R-M0-008.md` | `ACCEPTED` |

统一命令、结果、并行轨道、阻塞和下一台电脑的恢复步骤见 `M0-execution-log.md` 与 `CURRENT-HANDOFF.md`。

## M1 记录索引

| 任务 | 执行记录 | canonical 状态 |
|---|---|---|
| `P1R-M1-001` | `P1R-M1-001.md` | `ACCEPTED` |
| `P1R-M1-002` | `P1R-M1-002.md` | `ACCEPTED` |
| `P1R-M1-003` | `P1R-M1-003.md` | `ACCEPTED` |
| `P1R-M1-004` | `P1R-M1-004.md` | `ACCEPTED` |
| `P1R-M1-005` | `P1R-M1-005.md` | `ACCEPTED` |
| `P1R-M1-006` | `P1R-M1-006.md` | `ACCEPTED` |
| `P1R-M1-007` | `P1R-M1-007.md` | `ACCEPTED` |
| `P1R-M1-008` | `P1R-M1-008.md` | `ACCEPTED` |
| `P1R-M1-009` | `P1R-M1-009.md` | `ACCEPTED` |
| `P1R-M1-010` | `P1R-M1-010.md` | `ACCEPTED` |
| `P1R-M1-011` | `P1R-M1-011.md` | `ACCEPTED` |
| `P1R-M1-012` | `P1R-M1-012.md` | `ACCEPTED` |
| `P1R-M1-013` | `P1R-M1-013.md` | `ACCEPTED` |
| `P1R-M1-014` | `P1R-M1-014.md` | `ACCEPTED` |
| `P1R-M1-015` | `P1R-M1-015.md` | `IN_PROGRESS` |
