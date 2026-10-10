# IT-1 具名门浏览器证据

日期：2026-10-10。目录：`evidence/redesign/2026-10-10/it1-named-gates`。本轮结论：PASS。

这不是 Luna 签收。`accepted`、`it1Outbound`、`lunaStamp` 都是 false。`station-acceptance/` 原件没有改写。

认证传输沿用 ce0aa296 之后的源码：注册、登录、重置和刷新直达 IAM HTTPS。Chrome 使用 Playwright 临时 profile，只放行本轮测试证书的 SPKI，不调用 security add-trusted-cert，也不改系统钥匙串。本轮证据进程把 Gateway 高风险限额调到 2000/分钟，只作用于这次启动的进程；`/api/v1/iam` 在见到登录用户之前共用一个回环额度，默认 30/分钟会在踢设备前把权限读取打成 429。生产默认值没有改。未成年年份仍被页面拦下，不能从按钮提交；拒绝结论来自同一 Chrome 会话里发往成人门的请求，随后页面进入无权限态并在退出后重进。

| 步骤 | 结果 |
|---|---|
| mysql-identity | PASS |
| ports-free | PASS |
| four-owner-schemas | PASS |
| content-seed-own-schema | PASS |
| placement-answer-key-loaded | PASS |
| gateway-high-risk-budget | PASS |
| browser-ca-pinned-by-spki | PASS |
| official-home-1280x900 | PASS |
| official-about-1280x900 | PASS |
| official-announcements-1280x900 | PASS |
| official-compliance-1280x900 | PASS |
| official-courses-1280x900 | PASS |
| official-download-1280x900 | PASS |
| official-minors-1280x900 | PASS |
| official-pricing-1280x900 | PASS |
| official-privacy-1280x900 | PASS |
| official-status-1280x900 | PASS |
| official-terms-1280x900 | PASS |
| official-cta-home-1280x900 | PASS |
| official-cta-courses-1280x900 | PASS |
| official-home-390x844 | PASS |
| official-about-390x844 | PASS |
| official-announcements-390x844 | PASS |
| official-compliance-390x844 | PASS |
| official-courses-390x844 | PASS |
| official-download-390x844 | PASS |
| official-minors-390x844 | PASS |
| official-pricing-390x844 | PASS |
| official-privacy-390x844 | PASS |
| official-status-390x844 | PASS |
| official-terms-390x844 | PASS |
| official-cta-home-390x844 | PASS |
| official-cta-courses-390x844 | PASS |
| register-web-1280x900 | PASS |
| replay-same-web-1280x900 | PASS |
| replay-conflict-web-1280x900 | PASS |
| copy-gate-web-1280x900 | PASS |
| copy-consent-web-1280x900 | PASS |
| consent-signed-web-1280x900 | PASS |
| profile-fields-web | PASS |
| button-to-placement-web | PASS |
| refresh-web-1280x900 | PASS |
| login-web-1280x900 | PASS |
| guide-bar-web-1280x900 | PASS |
| readback-web-1280x900 | PASS |
| it2-ten-item-score | PASS |
| it2-public-retest | PASS |
| register-h5-390x844 | PASS |
| replay-same-h5-390x844 | PASS |
| replay-conflict-h5-390x844 | PASS |
| copy-gate-h5-390x844 | PASS |
| copy-consent-h5-390x844 | PASS |
| consent-signed-h5-390x844 | PASS |
| profile-fields-h5 | PASS |
| button-to-placement-h5 | PASS |
| refresh-h5-390x844 | PASS |
| login-h5-390x844 | PASS |
| guide-bar-h5-390x844 | PASS |
| readback-h5-390x844 | PASS |
| withdraw-403-h5-390x844 | PASS |
| register-web-390x844 | PASS |
| replay-same-web-390x844 | PASS |
| replay-conflict-web-390x844 | PASS |
| copy-gate-web-390x844 | PASS |
| minor-client-blocked-web-390x844 | PASS |
| minor-server-web-390x844 | PASS |
| minor-forbidden-web-390x844 | PASS |
| minor-exits-web-390x844 | PASS |
| login-web-390x844 | PASS |
| reentry-web-390x844 | PASS |
| minor-db-web-390x844 | PASS |
| register-h5-1280x900 | PASS |
| replay-same-h5-1280x900 | PASS |
| replay-conflict-h5-1280x900 | PASS |
| copy-gate-h5-1280x900 | PASS |
| minor-client-blocked-h5-1280x900 | PASS |
| minor-server-h5-1280x900 | PASS |
| minor-forbidden-h5-1280x900 | PASS |
| minor-exits-h5-1280x900 | PASS |
| login-h5-1280x900 | PASS |
| reentry-h5-1280x900 | PASS |
| minor-db-h5-1280x900 | PASS |
| reset-web-1280x900 | PASS |
| reset-web-390x844-unknown | PASS |
| reset-h5-390x844 | PASS |
| reset-h5-1280x900-unknown | PASS |
| kick-login-web-kicks-h5 | PASS |
| kick-request-web-kicks-h5 | PASS |
| kick-401-web-kicks-h5 | PASS |
| kick-login-h5-kicks-web | PASS |
| kick-request-h5-kicks-web | PASS |
| kick-401-h5-kicks-web | PASS |
| passwords-and-refresh-stay-off-gateway | PASS |

收尾：{"dropped":["r1_named_20261010_iam_c08e65d3=0","r1_named_20261010_lrn_c08e65d3=0","r1_named_20261010_cnt_c08e65d3=0","r1_named_20261010_asm_c08e65d3=0"],"retainedSchemasLeft":"2","listeners":[],"qidaUnchanged":true}
