# R1-014 L1 干净库回归

日期：2026-10-10。结论：PASS。新建四套 owner schema，内容库 Flyway 种子后做 Web/H5、1280×900 与 390×844 回归，结束后删除本轮库。

保留库 `r1_it1_browser_20261010_iam_5d9f4b7e` 与 `r1_it1_browser_20261010_cnt_5d9f4b7e` 未删除。qida 容器未操作。`lunaStamp` 为 false。

| 卡 | 结果 |
|---|---|
| R1-001 | PASS |
| R1-002 | PASS |
| R1-003 | PASS |
| R1-004 | PASS |
| R1-005 | PASS |
| R1-006 | PASS |
| R1-007 | PASS |
| R1-008 | PASS |
| R1-009 | PASS |
| R1-010 | PASS |
| R1-011 | PASS |
| R1-012 | PASS |
| R1-013 | PASS |
| R1-015 | PASS |
| R1-016 | PASS |
| R1-017 | PASS |
| R1-014 | PASS |

IT-2 计分与公开重测：PASS。证据目录 `evidence/redesign/2026-10-10/it2-score-browser`。

收尾：{"dropped":["r1_named_20261010_iam_c08e65d3=0","r1_named_20261010_lrn_c08e65d3=0","r1_named_20261010_cnt_c08e65d3=0","r1_named_20261010_asm_c08e65d3=0"],"retainedSchemasLeft":"2","listeners":[],"qidaUnchanged":true}
