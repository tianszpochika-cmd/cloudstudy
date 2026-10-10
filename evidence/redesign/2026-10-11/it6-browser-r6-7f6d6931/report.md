# r6 IT-6 内容发布浏览器重放

日期：2026-10-11。结论：FAIL。链路：FAIL。`accepted` / `it6Outbound` / `lunaStamp` 都是 false。

IAM 使用本轮临时测试证书监听 `https://127.0.0.1:18087`。Chrome 临时 profile 只放行该证书的 SPKI。没有调用 `security`，没有改系统钥匙串。六个 owner schema 前缀是 `r6_it6_20261011_`，结束后删除。保留库没有删除。qida 容器没有操作。发布台状态在内容服务进程内存里，干净库重放会重启内容服务并重建内容 schema。113+2 只核对迁移清单，没有再次执行下线。

| 步骤 | 结果 |
|---|---|
| ports-free | PASS |
| dedicated-schemas | PASS |
| iam-https | PASS |
| staff-sessions | PASS |
| default-mode | PASS |
| idempotent-read | PASS |
| denial-identical | PASS |
| no-ghost-draft | PASS |
| gaps-listed | PASS |
| version-lock | PASS |
| rights-unbound | PASS |
| simple-publish | FAIL |
| simple-no-second-signature | PASS |
| sync-failed-hidden | PASS |
| switch-dual | PASS |
| report-mode-mismatch | PASS |
| dual-review | FAIL |
| pin-keeps-v1 | FAIL |
| rollback | PASS |
| dashboard-states | PASS |
| media-boundary | PASS |
| b3-roster | PASS |
| admin-login-copy | PASS |
| admin-login-return | PASS |
| walk-admin | FAIL |
| register-web-1280 | PASS |
| shelf-web-1280 | PASS |
| overflow-web-1280 | PASS |
| register-web-390 | PASS |
| shelf-web-390 | PASS |
| overflow-web-390 | PASS |
| register-h5-390 | PASS |
| shelf-h5-390 | PASS |
| overflow-h5-390 | PASS |
| register-h5-1280 | PASS |
| shelf-h5-1280 | PASS |
| overflow-h5-1280 | PASS |
| unpublish-and-force | FAIL |
| clean-replay | FAIL |
| schemas-dropped | PASS |
| qida-unchanged | PASS |

## 出站自审

结论：FAIL。链路：FAIL。lunaStamp=false。本轮没有签字，accepted 与 it6Outbound 都是 false。

剩余 GAP：simple-publish、dual-review、pin-keeps-v1、unpublish-and-force、clean-replay。
