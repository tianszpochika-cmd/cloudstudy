# r4 IT-4 练错复浏览器重放

日期：2026-10-11。结论：FAIL。链路：FAIL。`accepted` / `it4Outbound` / `lunaStamp` 都是 false。

IAM 使用本轮临时测试证书监听 `https://127.0.0.1:18087`。Chrome 临时 profile 只放行该证书的 SPKI。没有调用 `security`，没有改系统钥匙串。六个 owner schema 前缀是 `r4_it4_20261011_`，结束后删除。保留库没有删除。qida 容器没有操作。

| 步骤 | 结果 |
|---|---|
| ports-free | PASS |
| dedicated-schemas | PASS |
| iam-https | PASS |
| content-seed | PASS |
| admin-ops-memory | PASS |
| register-web-1280 | PASS |
| placement-web-1280 | PASS |
| session-web-1280 | FAIL |
| answer-web-1280 | FAIL |
| receipt-web-1280 | FAIL |
| mistake-web-1280 | PASS |
| repair-web-1280 | FAIL |
| review-web-1280 | PASS |
| today-web-1280 | PASS |
| register-web-390 | PASS |
| placement-web-390 | PASS |
| session-web-390 | FAIL |
| answer-web-390 | FAIL |
| receipt-web-390 | FAIL |
| mistake-web-390 | PASS |
| repair-web-390 | FAIL |
| review-web-390 | PASS |
| today-web-390 | PASS |
| register-h5-390 | PASS |
| placement-h5-390 | PASS |
| session-h5-390 | FAIL |
| walk-h5-390 | FAIL |
| register-h5-1280 | PASS |
| placement-h5-1280 | PASS |
| session-h5-1280 | FAIL |
| walk-h5-1280 | FAIL |
| db-facts | PASS |
| schemas-dropped | PASS |
| qida-unchanged | PASS |

出站自审：本文件由本轮脚本生成，未签字。剩余 GAP 以失败步骤和 dbFacts 为准。
