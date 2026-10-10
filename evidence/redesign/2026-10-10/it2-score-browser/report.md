# IT-2 十题计分与公开重测

日期：2026-10-10。结论：PASS。身份是 IAM RS256。Chrome 使用临时 profile，只放行本轮测试证书的 SPKI，没有改系统钥匙串。

奇数题提交正确选项，偶数题提交错误选项。页面行内反馈与报告计数分开核对。公开重测按钮发出 Gateway `POST .../retest`。

这不是 IT-2 出站。`accepted`、`it2Outbound`、`lunaStamp` 都是 false。

| 步骤 | 结果 |
|---|---|
| placement-answer-key-loaded | PASS |
| it2-ten-item-score | PASS |
| it2-public-retest | PASS |
