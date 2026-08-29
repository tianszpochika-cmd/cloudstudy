# 本地开发

## 目标

任何新成员或编码 Agent 都能在不接触生产数据的情况下启动基础服务、运行测试和查看样例内容。

## 本地依赖

- Node.js 与 pnpm。
- MySQL。
- Redis。
- Kafka。
- MinIO。
- 可选对象存储模拟服务。
- 可选的模型 mock provider。

## 本地环境原则

- 使用 `.env.example` 复制出的本地环境文件。
- 默认关闭实时语音、支付和社区功能。
- 使用合成用户和课程种子。
- 日志中隐藏手机号、邮箱、密码、Token、音频原文和模型密钥。
- 端口以 `config/local-ports.json` 为唯一事实源；Gateway 和新服务必须先登记固定端口，禁止自动递增。
- `iam-service` 是平台自有账号密码认证中心，监听 `18087` 并在 `/api/v1/auth/jwks` 发布 RS256 公钥；不启动外部身份服务。

## 启动顺序

1. 复制 `.env.example` 为未提交的 `.env`，为本地 IAM 设置一次性测试密码或使用临时密钥；不要提交 `.env`、私钥或密码。
2. 执行 `pnpm ports:check`，确认 `18070`、`18080`、`18087`、`18088–18098` 和四个前端固定端口未被占用；端口冲突时停止占用进程，不改端口。
3. 启动本地依赖：`docker compose -f infra/docker/docker-compose.dev.yml up -d`。IAM 私钥在开发环境可使用进程内临时 RSA key；生产必须由 KMS/Secret 注入。
4. 准备数据库迁移和合成种子。
5. 启动 v2 Gateway/IAM/领域服务：`pnpm services:run -- --all --timeout-ms 90000`。Gateway 和每个领域服务均从 IAM JWKS 独立校验 issuer、RS256、audience、时间窗口、token type 和权限声明。
6. 启动四个冻结前端项目；微信小程序只通过 `apps/mobile` 条件编译输出。
7. 在 `http://127.0.0.1:18180/login` 或对应 Admin/Mobile 登录页手动注册合成测试用户；不要使用生产账号或把测试密码写入仓库。
8. 用测试账号完成登录、成人 Gate、测评到复习的完整路径。

## 认证接口与存储边界

登录使用 `POST /api/v1/auth/login`，刷新使用 `POST /api/v1/auth/token/refresh`，退出使用 `POST /api/v1/auth/logout`，设备撤销使用 `POST /api/v1/auth/sessions/{sessionId}/revoke`，公钥使用 `GET /api/v1/auth/jwks`。Web Access Token 只在内存，Refresh Token 由 HttpOnly/Secure/SameSite Cookie 承载；原生移动端只使用 Keychain/Keystore 等安全存储，安全存储不可用时不得降级到普通 storage。官网只生成公开登录入口，不保存业务 Token。

认证失败返回结构化 `401`；身份有效但权限不足返回 `403`；错误 issuer、audience、签名、算法、过期、token type 或 scope 都必须拒绝。任何客户端 role、tenant、owner 或 permission 头/字段都不是权限事实。

运行证据只能记录脱敏状态、requestId/traceId、JWKS `kid` 和数据库摘要，不记录密码、Access Token、Refresh Token、Cookie、重置凭证或私钥。
