# r3 IT-3 浏览器与工单补跑

日期：2026-10-11。结论：PASS。`accepted` / `it3Outbound` / `lunaStamp` 都是 false。

IAM 使用本轮临时测试证书监听 `https://127.0.0.1:18087`。Chrome 临时 profile 只放行该证书的 SPKI。没有调用 `security`，没有改系统钥匙串。六个 owner schema 前缀是 `r3_it3_20261010_`，结束后删除。admin-ops 默认内存档只为启动连上本轮空库，工单列表不打开 `admin_ops_service`。保留库没有删除。qida 容器没有操作。

| 步骤 | 结果 |
|---|---|
| ports-free | PASS |
| dedicated-schemas | PASS |
| iam-https | PASS |
| content-seed | PASS |
| admin-ops-memory | PASS |
| overflow-logged-out-root-1280 | PASS |
| overflow-logged-out-today-1280 | PASS |
| overflow-logged-out-courses-1280 | PASS |
| overflow-logged-out-login-1280 | PASS |
| overflow-logged-out-root-390 | PASS |
| overflow-logged-out-today-390 | PASS |
| overflow-logged-out-courses-390 | PASS |
| overflow-logged-out-login-390 | PASS |
| support-real-gateway | PASS |
| register-web-1280 | PASS |
| report-web-1280 | PASS |
| banner-web-1280 | PASS |
| overflow-home-web-1280 | PASS |
| today-web-1280 | PASS |
| overflow-today-web-1280 | PASS |
| ensure-web-1280 | PASS |
| replan-web-1280 | PASS |
| register-web-390 | PASS |
| report-web-390 | PASS |
| banner-web-390 | PASS |
| overflow-home-web-390 | PASS |
| today-web-390 | PASS |
| overflow-today-web-390 | PASS |
| ensure-web-390 | PASS |
| replan-web-390 | PASS |
| register-h5-390 | PASS |
| report-h5-390 | PASS |
| banner-h5-390 | PASS |
| overflow-home-h5-390 | PASS |
| today-h5-390 | PASS |
| ensure-h5-390 | PASS |
| replan-h5-390 | PASS |
| register-h5-1280 | PASS |
| report-h5-1280 | PASS |
| banner-h5-1280 | PASS |
| overflow-home-h5-1280 | PASS |
| today-h5-1280 | PASS |
| ensure-h5-1280 | PASS |
| replan-h5-1280 | PASS |
| schemas-dropped | PASS |
| qida-unchanged | PASS |
