# r8 IT-2 三套 owner schema 与 IAM 真签

日期：2026-10-11。结论：FAIL。`accepted` / `it2Outbound` / `lunaStamp` 都是 false。

IAM 使用本轮临时测试证书监听 `https://127.0.0.1:18087`，并用真实 RS256 签发。三个领域 owner schema 是 learner、content、assessment，各自独立。Chrome 临时 profile 只放行该证书的 SPKI。没有调用 `security`，没有改系统钥匙串。schema 前缀是 `r8_it2_`，结束后删除。

剩余 GAP：it2-browser-h5-390、it2-browser-h5-1280、it2-browser-h5-390（缺少 PASS）、it2-browser-h5-1280（缺少 PASS）。本文件不是签收。

| 步骤 | 结果 |
|---|---|
| ports-free | PASS |
| dedicated-schemas | PASS |
| iam-https | PASS |
| staff-sessions | PASS |
| it2-three-owner-schemas | PASS |
| it2-bank | PASS |
| it2-gate-closed | PASS |
| it2-adult-gate | PASS |
| it2-target | PASS |
| it2-open-10 | PASS |
| it2-out-of-order | PASS |
| it2-correct-full | PASS |
| it2-wrong-zero | PASS |
| it2-ten-report | PASS |
| it2-report-reread | PASS |
| it2-internal-retest | PASS |
| it2-public-retest | PASS |
| it2-retired-submit-step | PASS |
| it2-retired-skip | PASS |
| it2-interrupt | PASS |
| it2-incomplete-retest | PASS |
| register-web-1280 | PASS |
| it2-browser-web-1280 | PASS |
| overflow-it2-web-1280 | PASS |
| register-web-390 | PASS |
| it2-browser-web-390 | PASS |
| overflow-it2-web-390 | PASS |
| register-h5-390 | PASS |
| it2-browser-h5-390 | FAIL |
| register-h5-1280 | PASS |
| it2-browser-h5-1280 | FAIL |
| schemas-dropped | PASS |
| shared-admin-schema-untouched | PASS |
| qida-unchanged | PASS |
