# 本地 IAM HTTPS（r3）

学习端把密码只提交到 `https://127.0.0.1:18087`。`pnpm services:run` 在发现 `.runtime/r3-iam-tls/` 时把 IAM 开成 HTTPS，并把各 JVM 的信任库指到同一份测试 CA。没有这份材料时，IAM 仍按原来的 HTTP 本地配置启动。

证书只给回环地址 `127.0.0.1` / `localhost`，有效期两天。私钥、PKCS12 和口令写在仓库忽略目录 `.runtime/r3-iam-tls/`，不进 Git，也不写入 macOS 钥匙串。

## 生成

```sh
node scripts/redesign/r3-local-https/prepare-iam-tls.mjs
```

已有完整材料时不会覆盖。目录不完整时脚本拒绝继续，需要先删掉该目录再生成。标准输出只有目录、SPKI 和监听地址，没有口令。

## 启动

```sh
pnpm services:run -- --all --timeout-ms 120000
```

IAM 监听 `https://127.0.0.1:18087`。令牌 `iss` 仍是已登记的 `http://127.0.0.1:18087`，JWKS 从 `https://127.0.0.1:18087/api/v1/auth/jwks` 读取。Gateway 的 IAM 上游和审计换票地址改为 HTTPS。其他 Java 进程带上这份 PKCS12 信任库，并关闭 Netty OpenSSL，避免它忽略 JSSE 信任库。

Node 访问 IAM 时设置：

```sh
export NODE_EXTRA_CA_CERTS="$PWD/.runtime/r3-iam-tls/test-ca.pem"
```

`NODE_EXTRA_CA_CERTS` 只在进程启动时生效。浏览器不要使用全局忽略证书。Playwright / Chrome 只用本轮 SPKI：

```text
--ignore-certificate-errors-spki-list=<public.json 的 spkiSha256>
```

`public.json` 里的 `spkiSha256` 是测试证书公钥的 SHA-256（base64）。不要把 `local.env`、`test-key.pem`、`iam-signer.pem` 或两个 `.p12` 提交到仓库。
