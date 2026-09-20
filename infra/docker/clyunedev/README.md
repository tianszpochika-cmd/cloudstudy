# clyunedev 单机预发布 Docker 资产

本目录承载 `clyunedev` 的受版本控制单机预发布编排。它服务于 `dev` 分支联调，不替代 Kubernetes/GitOps 目标架构，也不构成正式 `clyune.com` 生产发布。

跨电脑继续服务器操作时，先读 [clyunedev 单机预发布跨电脑交接](../../../docs/07-operations/clyunedev-cross-device-handoff-2026-09-20.md)。其中将“仓库已提交”与“服务器已回传验证”分开记录。

## 不变量

- 仅一台服务器、一个 Docker Engine；不创建额外 VM。
- MySQL、Redis、Kafka、MinIO、Java 服务和四个 Web 进程都在同机容器网络中运行。
- Nginx 是唯一公网入口；服务与数据存储不直接暴露公网端口。
- `clyune.com` 不属于本目录的任何 Nginx 配置；本环境仅使用 `clyunedev.com` 及其子域名。
- 所有秘密保存在服务器 `/srv/cloudstudy/env` 或 `/srv/cloudstudy/secrets`，绝不写入 Compose、Dockerfile 或 Git。
- 应用镜像命名空间固定为 `cloudstudy-clyunedev/*`。部署成功后执行 `scripts/deploy/prune-clyunedev-images.sh` 预览清理，确认无误后才添加 `--apply`；每个仓库最多保留两个最新的未被容器引用版本。

## 当前建设状态

`docker-compose.core.yml` 是首次基础设施、IAM、Gateway 与三个 Web 前端的窄切片。全量预发布必须将它与 `docker-compose.full.yml` 一同加载；后者补齐移动 H5、Audit、Workflow 和 11 个领域服务，并由短生命周期 `mysql-init` 为每个 owner 创建独立 schema 与 MySQL 账号。

```bash
docker compose --env-file /srv/cloudstudy/env/clyunedev.env \
  -f infra/docker/clyunedev/docker-compose.core.yml \
  -f infra/docker/clyunedev/docker-compose.full.yml config --quiet
```

先将 [`clyunedev.full.env.example`](clyunedev.full.env.example) 的变量以服务器生成的值追加到 `/srv/cloudstudy/env/clyunedev.env`。该文件的 Gateway audit client 明文 secret 只保留在服务器环境文件；IAM 使用其 SHA-256 hex digest。不得将任一文件或输出复制回 Git、聊天或日志。

全量 Compose 仍只将 Gateway、IAM、官网、学习 Web、管理 Web 和移动 H5 绑定到 `127.0.0.1`。领域服务、MySQL、Redis、Kafka、MinIO 与 Audit/Workflow 均不发布宿主端口；宿主 Nginx 才是将来唯一的公网入口。移动 H5 预留 `mobile.clyunedev.com`，在 DNS/TLS 就绪前保持回环可达、不可公网访问。

容器启动和 health endpoint 仅表示该进程与其已接入的 owner 依赖存活；它不替代 Gateway/PEP、跨服务事件、浏览器、备份恢复、安全或 Phase 1 发布验收。
