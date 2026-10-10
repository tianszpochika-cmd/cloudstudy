# r7 IT-7 收口浏览器与全链冒烟

日期：2026-10-11。结论：FAIL。链路：FAIL。`accepted` / `it7Outbound` / `lunaStamp` 都是 false。

IAM 使用本轮临时测试证书监听 `https://127.0.0.1:18087`。Chrome 临时 profile 只放行该证书的 SPKI。没有调用 `security`，没有改系统钥匙串。六个 owner schema 前缀是 `r7_it7_20261011_`，结束后删除。保留库没有删除。qida 容器没有操作。收口台状态在 admin-ops 进程内存里，干净重放会重启 admin-ops。

剩余 GAP：smoke-it1-target、closure-web-1280、closure-web-390、closure-h5-390、closure-h5-1280。

| 步骤 | 结果 |
|---|---|
| ports-free | PASS |
| dedicated-schemas | PASS |
| iam-https | PASS |
| staff-sessions | PASS |
| smoke-it1-target | FAIL |
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
| admin-login | PASS |
| admin-governance | PASS |
| admin-risk-redirect | PASS |
| admin-audit | PASS |
| overflow-admin-1280 | PASS |
| register-web-1280 | PASS |
| smoke-it4-practice | PASS |
| closure-web-1280 | FAIL |
| overflow-web-1280 | PASS |
| register-web-390 | PASS |
| closure-web-390 | FAIL |
| overflow-web-390 | PASS |
| register-h5-390 | PASS |
| closure-h5-390 | FAIL |
| overflow-h5-390 | PASS |
| register-h5-1280 | PASS |
| closure-h5-1280 | FAIL |
| overflow-h5-1280 | PASS |
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
| clean-replay | PASS |
| smoke-it6-replay | PASS |
| node-suite | FAIL |
| schemas-dropped | PASS |
| qida-unchanged | PASS |
