# r8 IT-1 至 IT-7 全链回归

日期：2026-10-11。结论：PASS。`accepted` / `fullChainOutbound` / `lunaStamp` 都是 false。

全链使用另一套干净的 `r8_chain_` schema、同一套最新包和 HTTPS IAM。Web 与 H5 都覆盖 1280 和 390。IT-7 重启指纹不重放命令。node 套件在 H5、Gateway 和 HTTPS IAM 仍在监听时运行。

本文件不是签收。lunaStamp 仍是 false。GAP-WALL-114 仍是 OPEN。R1-029 的 NOT_RUN 没有改写。

| 步骤 | 结果 |
|---|---|
| ports-free | PASS |
| dedicated-schemas | PASS |
| iam-https | PASS |
| staff-sessions | PASS |
| it7-flyway | PASS |
| smoke-it1-target | PASS |
| smoke-it2-placement | PASS |
| smoke-it3-daily-task | PASS |
| smoke-it6-release | PASS |
| smoke-it5-period | PASS |
| lock-read-board | PASS |
| bc085-lock | PASS |
| bc086-file | PASS |
| bc087-triage | PASS |
| bc088-isolate | PASS |
| bc089-escalate | PASS |
| bc090-close | PASS |
| bc091-cases | PASS |
| bc092-route | PASS |
| bc093-reports | PASS |
| bc185-ticket | PASS |
| bc186-visibility | PASS |
| bc188-export | PASS |
| bc189-delete | PASS |
| bc190-audio | PASS |
| bc191-worker | PASS |
| bc192-session | PASS |
| bc193-401 | PASS |
| bc194-correlate | PASS |
| bc195-saga | PASS |
| bc196-outbox | PASS |
| bc197-gate | PASS |
| bc198-rollback | PASS |
| bc208-audit | PASS |
| restart-fingerprint | PASS |
| admin-login | PASS |
| admin-governance | PASS |
| admin-risk-redirect | PASS |
| admin-audit | PASS |
| overflow-admin-1280 | PASS |
| register-web-1280 | PASS |
| smoke-it4-practice | PASS |
| closure-web-1280 | PASS |
| overflow-web-1280 | PASS |
| register-web-390 | PASS |
| closure-web-390 | PASS |
| overflow-web-390 | PASS |
| register-h5-390 | PASS |
| closure-h5-390 | PASS |
| overflow-h5-390 | PASS |
| register-h5-1280 | PASS |
| closure-h5-1280 | PASS |
| overflow-h5-1280 | PASS |
| smoke-it6-replay | PASS |
| node-suite | PASS |
| schemas-dropped | PASS |
| shared-admin-schema-untouched | PASS |
| qida-unchanged | PASS |
