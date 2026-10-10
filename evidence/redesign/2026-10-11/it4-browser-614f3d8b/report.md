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
| session-web-1280 | PASS |
| answer-web-1280 | PASS |
| receipt-web-1280 | PASS |
| mistake-web-1280 | PASS |
| repair-web-1280 | FAIL |
| review-web-1280 | PASS |
| today-web-1280 | PASS |
| register-web-390 | PASS |
| placement-web-390 | PASS |
| session-web-390 | PASS |
| answer-web-390 | PASS |
| receipt-web-390 | PASS |
| mistake-web-390 | PASS |
| repair-web-390 | FAIL |
| review-web-390 | PASS |
| today-web-390 | PASS |
| register-h5-390 | PASS |
| placement-h5-390 | PASS |
| session-h5-390 | PASS |
| answer-h5-390 | PASS |
| receipt-h5-390 | PASS |
| mistake-h5-390 | PASS |
| repair-h5-390 | FAIL |
| review-h5-390 | PASS |
| today-h5-390 | PASS |
| register-h5-1280 | PASS |
| placement-h5-1280 | PASS |
| session-h5-1280 | PASS |
| answer-h5-1280 | PASS |
| receipt-h5-1280 | PASS |
| mistake-h5-1280 | PASS |
| repair-h5-1280 | FAIL |
| review-h5-1280 | PASS |
| today-h5-1280 | PASS |
| db-facts | PASS |
| schemas-dropped | PASS |
| qida-unchanged | PASS |

出站自审：本文件由本轮脚本生成，未签字。`accepted`、`it4Outbound`、`lunaStamp` 都是 false。结论是 FAIL，不是站级签收。

建单、作答、保存回执在 Web 与 H5、1280 与 390 都是 PASS。回执是「已保存」，反馈是「需要再练」，下一题是「本次练习已完成」。库事实：会话 6、作答 4、错题 4、ZERO 4。六个 `r4_it4_` schema 已删除。qida 名称计数前后都是 51，脚本没有改这些容器。

补救四步都是 FAIL：错题页仍是「还没有开始练习」，没有「去练习验证」或「开始订正」。测评库里的 `assessment_mistake` 没有投影到 learning 的错题队列。本轮没有跨库写入，也没有把答案放进密封快照。复习页能读到 `IT4-STAGE-1`，今日页能读到 `SM2_Q03_V1`，这是页面投影，不是补救闭环。

同一天较早的一次走查后缀 `aa28b151` 停在建单 410，目录是 `evidence/redesign/2026-10-11/it4-browser`。那次记录保持 FAIL，不改写成通过。
