# 本地开发基础设施

`docker-compose.dev.yml` 为语学星 Phase 1 提供四项本地依赖：MySQL 8、Redis 7、MinIO 和 RabbitMQ。所有宿主机端口只绑定到 `127.0.0.1`，不会对局域网暴露。

## 固定端口

端口唯一事实源是 [`config/local-ports.json`](../../config/local-ports.json)，本编排与 [`config/local-services.json`](../../config/local-services.json) 必须保持一致：

| 依赖 | 宿主机端口 | 容器端口 | 用途 |
|---|---:|---:|---|
| MySQL | `13306` | `3306` | 业务数据库 |
| Redis | `16379` | `6379` | 缓存、会话与队列 |
| MinIO API | `19000` | `9000` | S3 兼容对象存储 |
| MinIO Console | `19001` | `9001` | 本地对象存储管理台 |
| RabbitMQ AMQP | `15689` | `5672` | 异步消息 |
| RabbitMQ Management | `15690` | `15672` | 消息管理台 |

不得为单个 Agent 自动递增、随机改用或复用其他端口。端口发生变更时必须同步端口注册表、环境变量、启动脚本、Compose 映射和文档；本任务不修改端口注册表。

## 启动

在仓库根目录执行：

```powershell
pnpm ports:check
docker compose -f infra/docker/docker-compose.dev.yml up -d
node scripts/check-local-infra.mjs
```

`minio-init` 会在 MinIO 健康后自动创建 `${OBJECT_STORAGE_BUCKET}` 指定的 bucket，未提供时使用 `yuxuexing-local`。初始化容器是一次性任务，正常执行后会退出，不代表 MinIO 服务停止。

默认本地账号只用于开发：

- MySQL：数据库 `yuxuexing`，用户/密码 `yuxuexing`，root 密码 `root-local-only`；
- MinIO：`change-me` / `change-me-local`；
- RabbitMQ：`yuxuexing` / `rabbitmq-local-only`；
- Redis：仅绑定回环地址，默认不启用密码。

如需修改本地值，请在未提交的 `.env` 中覆盖对应变量；不要把生产密钥写入仓库。

## 停止与数据清理

仅停止容器并保留数据：

```powershell
docker compose -f infra/docker/docker-compose.dev.yml stop
```

停止并移除容器、网络，但保留命名卷：

```powershell
docker compose -f infra/docker/docker-compose.dev.yml down
```

删除本地开发数据前，必须确认不再需要 MySQL、Redis、MinIO 和 RabbitMQ 的数据：

```powershell
docker compose -f infra/docker/docker-compose.dev.yml down -v
```

`down -v` 会删除本 Compose 使用的命名卷，无法通过普通启动恢复，请勿用于生产环境。

## 健康检查

只做静态配置校验，不要求 Docker：

```powershell
node scripts/check-local-infra.mjs --static-only
```

Docker 可用时，默认命令还会输出 MySQL、Redis、MinIO、RabbitMQ 四项运行态状态：

```powershell
node scripts/check-local-infra.mjs
```

需要把“未运行/未健康”作为失败退出码时：

```powershell
node scripts/check-local-infra.mjs --require-healthy
```

脚本会同时校验 Compose 文件、固定回环端口、镜像、健康检查、持久化卷和 MinIO 初始化声明。

## 故障排查

1. 端口冲突：先执行 `pnpm ports:check`，查看占用进程后停止它；不要改 Compose 端口。
2. 容器未启动：执行 `docker compose -f infra/docker/docker-compose.dev.yml ps -a`，再查看 `docker compose -f infra/docker/docker-compose.dev.yml logs <service>`。
3. MySQL 一直不健康：检查 13306 是否被其他 MySQL 占用；首次启动需要初始化数据，等待健康检查完成。
4. MinIO bucket 不存在：查看 `minio-init` 日志；确认 MinIO 已健康后，可重新执行 `docker compose -f infra/docker/docker-compose.dev.yml up minio-init`。
5. RabbitMQ 管理台打不开：确认访问 `http://127.0.0.1:15690`，并使用本地 RabbitMQ 账号；AMQP 客户端使用 `127.0.0.1:15689`。
6. 数据是否持久化：默认数据位于 Compose 命名卷；重建容器不会丢失数据，只有 `down -v` 才会删除这些卷。

更完整的运行时配置见 [`config/local-services.json`](../../config/local-services.json)；应用连接本地依赖时继续使用 `.env.example` 中的固定端口。
