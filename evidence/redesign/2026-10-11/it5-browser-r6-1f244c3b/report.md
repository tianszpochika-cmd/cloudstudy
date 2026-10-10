# r6 IT-5 报告浏览器重放

日期：2026-10-11。结论：PASS。链路：PASS。`accepted` / `it5Outbound` / `lunaStamp` 都是 false。

IAM 使用本轮临时测试证书监听 `https://127.0.0.1:18087`。Chrome 临时 profile 只放行该证书的 SPKI。没有调用 `security`，没有改系统钥匙串。六个 owner schema 前缀是 `r6_it5_20261011_`，结束后删除。保留库没有删除。qida 容器没有操作。

| 步骤 | 结果 |
|---|---|
| ports-free | PASS |
| dedicated-schemas | PASS |
| iam-https | PASS |
| content-seed | PASS |
| admin-ops-memory | PASS |
| register-web-1280 | PASS |
| placement-web-1280 | PASS |
| placement-card-web-1280 | PASS |
| overflow-placement-web-1280 | PASS |
| period-web-1280 | PASS |
| digest-web-1280 | PASS |
| overflow-report-web-1280 | PASS |
| weekly-web-1280 | PASS |
| share-issue-web-1280 | PASS |
| share-open-web-1280-active | PASS |
| overflow-share-web-1280-active | PASS |
| share-revoke-web-1280 | PASS |
| share-open-web-1280-revoked | PASS |
| overflow-share-web-1280-revoked | PASS |
| register-web-390 | PASS |
| placement-web-390 | PASS |
| placement-card-web-390 | PASS |
| overflow-placement-web-390 | PASS |
| period-web-390 | PASS |
| digest-web-390 | PASS |
| overflow-report-web-390 | PASS |
| weekly-web-390 | PASS |
| share-issue-web-390 | PASS |
| share-open-web-390-active | PASS |
| overflow-share-web-390-active | PASS |
| share-revoke-web-390 | PASS |
| share-open-web-390-revoked | PASS |
| overflow-share-web-390-revoked | PASS |
| register-h5-390 | PASS |
| placement-h5-390 | PASS |
| placement-card-h5-390 | PASS |
| overflow-placement-h5-390 | PASS |
| period-h5-390 | PASS |
| digest-h5-390 | PASS |
| overflow-report-h5-390 | PASS |
| weekly-h5-390 | PASS |
| share-issue-h5-390 | PASS |
| share-open-h5-390-active | PASS |
| overflow-share-h5-390-active | PASS |
| share-revoke-h5-390 | PASS |
| share-open-h5-390-revoked | PASS |
| overflow-share-h5-390-revoked | PASS |
| register-h5-1280 | PASS |
| placement-h5-1280 | PASS |
| placement-card-h5-1280 | PASS |
| overflow-placement-h5-1280 | PASS |
| period-h5-1280 | PASS |
| digest-h5-1280 | PASS |
| overflow-report-h5-1280 | PASS |
| weekly-h5-1280 | PASS |
| share-issue-h5-1280 | PASS |
| share-open-h5-1280-active | PASS |
| overflow-share-h5-1280-active | PASS |
| share-revoke-h5-1280 | PASS |
| share-open-h5-1280-revoked | PASS |
| overflow-share-h5-1280-revoked | PASS |
| clean-replay | PASS |
| db-facts | PASS |
| schemas-dropped | PASS |
| qida-unchanged | PASS |

## 出站自审

结论：PASS。链路：PASS。lunaStamp=false。本轮没有签字，accepted 与 it5Outbound 都是 false。

剩余 GAP：浏览器链路步骤没有失败。luna 签收仍未发生。
