# IT-1 复验

日期：2026-10-10。目录：`evidence/redesign/2026-10-10/it1-recheck`。本轮结论：PASS。

这不是 Luna 的签收。`accepted`、`it1Outbound`、`lunaStamp` 都是 false。`station-acceptance/it1/` 和 `review/final-review.md` 没有改写。`screenshots/failure.png` 是通过前一次手机端保存失败的画面；本次通过的画面是 `web-placement.png`、`web-readback.png`、`h5-placement.png` 和 `h5-readback.png`。

本轮覆盖 Web 与 H5、1280×900 与 390×844 的注册、登录、重置申请，密码真实提交到 IAM HTTPS；两个学习端 origin 的 CORS 预检；每端一条连续链：成人门、必要同意、画像写入、停掉 learner 再启动后读回、进入定级第一题。没有做完 10 题，也没有重跑幂等回放、踢设备、未成年拒绝、撤回同意。

| 步骤 | 结果 |
|---|---|
| mysql-identity | PASS |
| ports-free | PASS |
| four-owner-schemas | PASS |
| content-seed-own-schema | PASS |
| browser-ca-installed-without-ignoring-errors | PASS |
| cors-http://127.0.0.1:18180 | PASS |
| cors-http://127.0.0.1:18183 | PASS |
| register-web-390x844 | PASS |
| login-web-390x844 | PASS |
| reset-web-390x844 | PASS |
| register-h5-1280x900 | PASS |
| login-h5-1280x900 | PASS |
| reset-h5-1280x900 | PASS |
| register-web-1280x900 | PASS |
| web-chain-placement-entry | PASS |
| web-profile-readback-after-learner-restart | PASS |
| login-web-1280x900 | PASS |
| reset-web-1280x900 | PASS |
| register-h5-390x844 | PASS |
| h5-chain-placement-entry | PASS |
| h5-profile-readback-after-learner-restart | PASS |
| login-h5-390x844 | PASS |
| reset-h5-390x844 | PASS |
| passwords-and-refresh-stay-off-gateway | PASS |

收尾：{"dropped":["it1_recheck_20261010_iam_ce0aa296=0","it1_recheck_20261010_lrn_ce0aa296=0","it1_recheck_20261010_cnt_ce0aa296=0","it1_recheck_20261010_asm_ce0aa296=0"],"retainedSchemasLeft":"2","listeners":[],"qidaUnchanged":true}
