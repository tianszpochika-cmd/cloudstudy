# Gateway public-JWKS 源码与构建收据审查

日期：2026-10-08  
基线：`8215c95d8ad63169a68afb997f2d7ad8bc1b9b71`  
审查结论：**限定范围通过**。本记录只审查 Gateway public-JWKS 生产实现、定向测试及其 Java 25 构建绑定；不代表运行态 TLS 或 R1-002 业务卡验收。

## 核验结果

- 当前 `GatewayIamPublicJwkSource.java` 与 `GatewayIamPublicJwkSourceTest.java` 的 SHA-256 分别为 `54f7befee34c5e4c527bb4845b8599dac9dcd23193845fc43cee7f9472fd2489`、`168f4aa7d91dcbf9cd1f329b9f3fb83c82c8ea693a96d2307a243f7abc4aefad`，均与 [构建收据](../gateway/build-receipt.json) 的 `sourceFiles` 一致。
- 我重新散列了收据列出的输入文件、定向测试/构建日志和 Gateway JAR，均匹配收据。规范化的 `input-snapshot-before.json` 摘要为 `044d1b9befc8bbbeb5c49a4a8ae88075d5cf6ba427d859123a0954b7bc776952`，与 `inputSnapshotSha256` 相同。收据记录的 Java 25 Maven 命令均 exit 0；测试为 24 tests、0 failures、0 errors、0 skipped；Gateway JAR 为 73,128,627 bytes、SHA-256 `db67eeae844ff68b3d2d58d5668151a78bb8a02696a159260b168227b6ace1c3`。
- 生产解析器会在 Nimbus 解析之前递归检查 envelope 全文，拒绝 RSA/EC/OKP/octet 等 JWK 私有成员 `d,p,q,dp,dq,qi,oth,k`；随后再检查解析结果，避免隐藏在混合 key 集或不支持 key 中的私有值被忽略。解析错误不再附带可能保留输入文本的异常 cause；无效文档不会进入缓存。
- 新增定向测试覆盖 bare 与 enveloped private JWK、mixed key set、畸形/null 私有成员、未知 key 类型、额外 envelope/extension、无敏感 parser diagnostic、拒绝后有效文档恢复，以及既有 kid/cache/rotation 边界。测试结果取自已散列绑定的 Maven 日志，本审查未重跑测试。
- 构建收据仅列共享 JDK/Maven toolchain 路径与哈希、当前源码路径、工作区 JAR 路径和命令日志；本审查未发现 Git 外密钥材料、用户凭据或服务 token 字段。

## 边界

`build-receipt.json` 证明本次 Gateway JAR 来自收据所列当前源码和具名构建命令。它没有证明 Gateway 到 IAM 的真实 HTTPS 握手、JWKS 运行请求或注册链路；这些留给运行证据。此审查没有触碰 Docker、数据库或服务进程。
