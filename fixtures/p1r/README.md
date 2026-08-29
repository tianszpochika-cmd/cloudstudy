# P1R 合成夹具

`v1/` 是 P1R-M0-007 的版本化、脱敏测试数据基线，覆盖账号、内容、题目、音频元数据、沙箱订单和隐私流程。所有记录都是为本仓库编写的合成数据，不含真实个人信息、登录凭证、支付凭证、外部版权文本或音频二进制。

直接使用 Node.js 运行，无需安装额外依赖：

```text
node scripts/fixtures/p1r-fixtures.mjs validate
node scripts/fixtures/p1r-fixtures.mjs seed
node scripts/fixtures/p1r-fixtures.mjs cleanup
node scripts/fixtures/p1r-fixtures.mjs audit
```

`seed` 只会在 `evidence/p1r/m0/repo-fixtures/runtime/` 生成可再生的规范化 bundle 和清单；`cleanup` 只删除清单中带有同一 cleanup marker 的两个生成文件。它们不会连接 MySQL、Redis、Kafka、支付平台或任何外部服务。后续接入各 owner service 时，应由服务自己的适配器读取本基线，不得跨服务写表。

版本由 `config/p1r-fixtures.v1.json`、各文件的 `fixtureVersion`、源文件 SHA-256 和 seed manifest 中的 Git revision 共同追踪。
