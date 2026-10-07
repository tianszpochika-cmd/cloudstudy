# 29 卡接手索引（来源导航，非状态墙）

来源：`ff0f8057` 的 `dev-plan-R1.md`；共 29 条显式卡定义。原始 owner、依赖、验收文字保留在 JSON；不填 R1-030…114，不迁移 ACCEPTED。

BC/IC 是原卡或源文关联；FEAT/PRD-ATOM/V2-980、ARCH、运行层 ID 和 data owner 均为可审查候选导航，逐卡绑定未签收。完整来源行号、缺口见 [cards-29-index.json](cards-29-index.json)。

| 卡 | 站 | owner（原文） | 依赖（原文） | BC | IC | 当前证据边界 |
|---|---|---|---|---|---|---|
| R1-001 | IT-1 | official-site | 无 | BC-001 | IC-001 | R1-001 原机器摘要；完整交付缺失 |
| R1-002 | IT-1 | iam-service | R1-001 | BC-002 | IC-002, IC-052 | R1-002 准备未 READY |
| R1-003 | IT-1 | iam-service | R1-002 | BC-003 | IC-002, IC-052 | 当前卡验收包未找到；不推断从未实现 |
| R1-004 | IT-1 | iam-service | R1-002 | BC-004 | IC-002, IC-053 | 当前卡验收包未找到；不推断从未实现 |
| R1-005 | IT-1 | iam-service | R1-004 | BC-005 | IC-002, IC-008, IC-035 | 当前卡验收包未找到；不推断从未实现 |
| R1-006 | IT-1 | iam-service | R1-004 | BC-006 | IC-003, IC-005, IC-055 | 当前卡验收包未找到；不推断从未实现 |
| R1-007 | IT-1 | learner-web/mobile | R1-006 | BC-007 | IC-003, IC-005, IC-055 | 当前卡验收包未找到；不推断从未实现 |
| R1-008 | IT-1 | iam-service + learner-web | R1-006 | BC-008 | IC-003, IC-006, IC-056 | 当前卡验收包未找到；不推断从未实现 |
| R1-009 | IT-1 | iam-service | R1-008 | BC-009 | IC-003, IC-006, IC-008, IC-036, IC-056 | 当前卡验收包未找到；不推断从未实现 |
| R1-010 | IT-1 | learner-service | R1-008 | BC-010, BC-202 | IC-004, IC-057 | 当前卡验收包未找到；不推断从未实现 |
| R1-011 | IT-1 | learner-web/mobile | R1-010 | BC-011 | IC-004, IC-009, IC-057 | 当前卡验收包未找到；不推断从未实现 |
| R1-012 | IT-1 | iam-service | R1-002 | BC-012 | IC-002, IC-007, IC-054 | 当前卡验收包未找到；不推断从未实现 |
| R1-013 | IT-1 | iam-service | R1-006 | BC-201 | IC-005, IC-055 | 当前卡验收包未找到；不推断从未实现 |
| R1-014 | IT-1 | QA | R1-001…013 | BC-001, BC-002, BC-003, BC-004, BC-005, BC-006, BC-007, BC-008, BC-009, BC-010, BC-011, BC-012, BC-201, BC-202 | IC-001, IC-002, IC-003, IC-004, IC-005, IC-006, IC-007, IC-008, IC-009, IC-035, IC-036, IC-052, IC-053, IC-054, IC-055, IC-056, IC-057 | 当前卡验收包未找到；不推断从未实现 |
| R1-015 | IT-1 | learner-web | R1-002 | BC-002, BC-003, BC-004, BC-012 | IC-002, IC-007, IC-052, IC-053, IC-054 | 当前卡验收包未找到；不推断从未实现 |
| R1-016 | IT-1 | learner-web | R1-007 | BC-006, BC-007, BC-008, BC-009, BC-201 | IC-003, IC-005, IC-006, IC-008, IC-036, IC-055, IC-056 | 当前卡验收包未找到；不推断从未实现 |
| R1-017 | IT-1 | learner-web | R1-010 | BC-010, BC-011, BC-202 | IC-004, IC-009, IC-057 | 当前卡验收包未找到；不推断从未实现 |
| R1-018 | IT-2 | learner-web/mobile | R1-017 | BC-013 | IC-010, IC-058 | 当前卡验收包未找到；不推断从未实现 |
| R1-019 | IT-2 | api-gateway | R1-018 | BC-019 | IC-010 | 当前卡验收包未找到；不推断从未实现 |
| R1-020 | IT-2 | assessment-service | R1-018 | BC-014 | IC-011, IC-059 | 当前卡验收包未找到；不推断从未实现 |
| R1-021 | IT-2 | assessment-service | R1-020 | BC-015 | IC-011 | 当前卡验收包未找到；不推断从未实现 |
| R1-022 | IT-2 | assessment-service | R1-021 | BC-016 | IC-012 | 当前卡验收包未找到；不推断从未实现 |
| R1-023 | IT-2 | assessment-service | R1-018 | BC-017 | IC-010, IC-058 | 当前卡验收包未找到；不推断从未实现 |
| R1-024 | IT-2 | assessment-service | R1-022 | BC-018 | IC-012 | 当前卡验收包未找到；不推断从未实现 |
| R1-025 | IT-2 | content-service | 无（种子先行） | BC-020 |  | 当前卡验收包未找到；不推断从未实现 |
| R1-026 | IT-2 | content-service | R1-025 | BC-021 |  | 当前卡验收包未找到；不推断从未实现 |
| R1-027 | IT-2 | learner-web | R1-020 | BC-022 | IC-010, IC-011, IC-019, IC-059 | 当前卡验收包未找到；不推断从未实现 |
| R1-028 | IT-2 | learner-web | R1-022 | BC-013, BC-014, BC-015, BC-016, BC-017, BC-018, BC-019, BC-022 | IC-010, IC-011, IC-012, IC-019, IC-058, IC-059 | 当前卡验收包未找到；不推断从未实现 |
| R1-029 | IT-2 | QA | R1-018…028 | BC-013, BC-014, BC-015, BC-016, BC-017, BC-018, BC-019, BC-020, BC-021, BC-022 | IC-010, IC-011, IC-012, IC-019, IC-058, IC-059 | 当前卡验收包未找到；不推断从未实现 |
