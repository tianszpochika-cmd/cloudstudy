# 本地开发

## 目标

任何新成员或编码 Agent 都能在不接触生产数据的情况下启动基础服务、运行测试和查看样例内容。

## 本地依赖

- Node.js 与 pnpm。
- MySQL。
- Redis。
- Docker Desktop（本地 Keycloak 标准 OIDC 测试 IdP 和其他依赖）。
- 可选对象存储模拟服务。
- 可选的模型 mock provider。

## 本地环境原则

- 使用 .env.example 复制出的本地环境文件。
- 默认关闭实时语音、支付和社区功能。
- 使用合成用户和课程种子。
- 日志中隐藏手机号、邮箱、音频原文和模型密钥。
- 端口以 `config/local-ports.json` 为唯一事实源；Gateway 和新服务必须先登记固定端口，禁止自动递增。
- 本地 OIDC 测试提供方固定为 `127.0.0.1:18099`；只使用标准 Keycloak，不在仓库内实现 Token Server。

## 启动顺序

1. 复制 `.env.example` 为未提交的 `.env`，替换 `OIDC_BOOTSTRAP_ADMIN_PASSWORD` 为一次性本地密码；不要提交 `.env`。
2. 执行 `pnpm ports:check`，确认 `18099` 等固定端口未被占用；端口冲突时停止占用进程，不改端口。
3. 启动本地依赖和 OIDC IdP：`docker compose -f infra/docker/docker-compose.dev.yml up -d`，或单独执行 `node scripts/runtime/local-oidc-idp.mjs up`。
4. 准备数据库迁移和种子。
5. 启动 v2 Gateway/IAM/领域服务模板。仅做匿名 readiness 检查时使用 `pnpm services:run -- --all`；要进行本轮登录后真实数据测试，必须使用 `pnpm services:run:oidc -- --all --timeout-ms 90000`，它会为 Gateway 和各领域服务启用本地 Keycloak JWT/JWKS 校验。迁移期可启动 `core-api` 兼容入口和 Worker。
6. 启动四个冻结前端项目；微信小程序只通过 `apps/mobile` 条件编译输出。
7. 通过 `yuxuexing-local` realm 注册合成测试用户；不要使用生产账号或把测试密码写入仓库。
8. 用测试账号完成测评到复习的完整路径。

本地 IdP 的 discovery、授权码端点、token 端点、JWKS、logout 和四个 public PKCE client 的回调地址见
[`config/local-oidc.json`](../../config/local-oidc.json)。停止 IdP 时执行
`node scripts/runtime/local-oidc-idp.mjs down`，该命令保留本地 Keycloak 卷；需要清理合成账号时使用 Keycloak 管理台逐个删除，避免误删其他本地依赖数据。
