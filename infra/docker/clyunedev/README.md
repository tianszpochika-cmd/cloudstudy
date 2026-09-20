# clyunedev 单机预发布 Docker 资产

本目录承载 `clyunedev` 的受版本控制单机预发布编排。它服务于 `dev` 分支联调，不替代 Kubernetes/GitOps 目标架构，也不构成正式 `clyune.com` 生产发布。

## 不变量

- 仅一台服务器、一个 Docker Engine；不创建额外 VM。
- MySQL、Redis、Kafka、MinIO、Java 服务和四个 Web 进程都在同机容器网络中运行。
- Nginx 是唯一公网入口；服务与数据存储不直接暴露公网端口。
- `clyune.com` 不属于本目录的任何 Nginx 配置；本环境仅使用 `clyunedev.com` 及其子域名。
- 所有秘密保存在服务器 `/srv/cloudstudy/env` 或 `/srv/cloudstudy/secrets`，绝不写入 Compose、Dockerfile 或 Git。
- 应用镜像命名空间固定为 `cloudstudy-clyunedev/*`。部署成功后执行 `scripts/deploy/prune-clyunedev-images.sh` 预览清理，确认无误后才添加 `--apply`；每个仓库最多保留两个最新的未被容器引用版本。

## 当前建设状态

第一批核心编排与多阶段 Dockerfile 已覆盖 MySQL、Redis、Kafka、MinIO、IAM、Gateway、官网、学习端和管理端。除 IAM/Gateway 外的领域服务仍暂不加入首个可运行切片，必须先逐项确认 owner schema、PEP、事件和运行依赖。

后续文件按以下顺序继续加入并验证：

1. 多阶段 Java 25 与 Node 20.19.5 构建镜像；
2. 仅对 `127.0.0.1` 发布 Nginx 上游端口的单机 Compose；
3. 由宿主 Nginx 提供的四个 clyunedev HTTP/TLS 虚拟主机；
4. 不含秘密的环境变量清单和服务器侧生成/校验步骤；
5. 受控启动、健康检查、回滚和双版本清理脚本。
