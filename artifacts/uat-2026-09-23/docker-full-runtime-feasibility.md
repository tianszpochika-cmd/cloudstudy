# 第八批镜像：独立 Docker 全栈验收可行性

核查时间：2026-09-23。范围仅为本机只读核查与 Compose 配置解析；**没有启动容器、执行迁移、接入或改写现有数据库**。

## 当前事实

| 项目 | 已核查结果 |
| --- | --- |
| 镜像 | `583ab627-uat-batch8-202609231700` 的 20 个应用/迁移镜像均在本机；Compose 解析后也引用 20 个该标签镜像。 |
| 已运行容器 | 只有原有 `yuxuexing-local` 的 MySQL、Redis、MinIO、RabbitMQ、Kafka 五个基础设施容器；其网络是 `yuxuexing-local_yuxuexing-local`。 |
| 端口 | `18070`、`18087`、`18180`、`18181`、`18182`、`18183` 均已有监听者，直接启动 `clyunedev` Compose 会冲突。 |
| 数据隔离 | 现有 Docker 网络/卷中没有 `cloudstudy-clyunedev` 或 `cloudstudy-uat-isolated` 名称；新项目可用独立命名网络和四个全新数据卷。 |
| 环境 | 两份 Compose 共引用 30 个必填变量；仓库本地 `.env` 只提供其中 1 个变量名。缺少 14 个 owner 密码、测试 RSA 私钥路径、审计客户端凭据、Kafka 集群 ID、四个 CORS origin 等。仅核对变量名，未读取或记录值。 |
| 基础镜像 | `mysql:8.4` 与 `redis:7.4-alpine` 尚未在本机缓存，正式启动前需单独拉取并固定镜像来源；现有本地基础设施运行的是 MySQL 8.0、Redis 7。MinIO、MinIO mc 与 Kafka 的 Compose 镜像已缓存。 |
| 资源 | Docker Desktop 约 32 GB 内存、20 CPU；C 盘约 306 GB 可用。资源看似足够，尚无 26 服务并发启动的实际数据。 |

来源：`infra/docker/clyunedev/docker-compose.core.yml`、`docker-compose.full.yml`、`deploy-full.sh`、`README.md`；当前容器/监听端口/镜像只读清单。`docker compose` 为 v5.4.0。

## 已验证的隔离方式

将两份原 Compose 与下面的**临时、只用于 UAT 的第三层 override**一起加载。以无效占位变量仅做 `docker compose config --format json` 解析，得到项目名 `cloudstudy-uat-isolated`、26 个服务、20 个第八批镜像、**0 个宿主机发布端口**、指定独立网络和四个独立卷。`!reset []` 的端口重置在本机 Compose v5.4.0 下已验证；此检查没有运行服务。

```yaml
name: cloudstudy-uat-isolated
services:
  iam-service:
    ports: !reset []
  api-gateway:
    ports: !reset []
  official-site:
    ports: !reset []
  learner-web:
    ports: !reset []
  admin-web:
    ports: !reset []
  mobile-h5:
    ports: !reset []
networks:
  clyunedev:
    name: cloudstudy-uat-isolated
    driver: bridge
    internal: true
volumes:
  clyunedev-mysql:
    name: cloudstudy-uat-isolated-mysql
  clyunedev-redis:
    name: cloudstudy-uat-isolated-redis
  clyunedev-minio:
    name: cloudstudy-uat-isolated-minio
  clyunedev-kafka:
    name: cloudstudy-uat-isolated-kafka
```

`internal: true` 是建议的附加隔离：容器仍能通过服务名互通，测试不应访问外部 `clyunedev.com`。需要在真正启动前再解析一次最终配置，并确认 `internal=true`、0 个发布端口、全新网络/卷名称、20 个目标镜像及所有密钥挂载都指向临时测试位置。不要把此项目接入原有 `yuxuexing-local` 网络/卷，也不要使用当前本地 `.env` 中的现有数据库凭据。

## 安全启动与验收路径（尚未执行）

1. 在受限权限的临时目录创建**本次专用**环境文件和 RS256 私钥。为 14 个 owner、Redis、MySQL、MinIO、IAM 幂等保护和 Gateway 审计客户端生成独立随机凭据；仅记录变量名、文件位置与散列，不输出密钥/密码。设置 `RELEASE_TAG=583ab627-uat-batch8-202609231700` 和五个 `https://*.clyunedev.com` 测试域名 origin。生产/服务器密钥与现有本地基础设施凭据均不复用。
2. 先拉取/核验本机缺少的 MySQL 8.4 和 Redis 7.4 基础镜像。证明四个 UAT 数据卷全新、无共享写入方，再备份可恢复的空实例并满足迁移脚本要求的 `P1R_EXTERNAL_MIGRATION_WRITERS_DRAINED` 与 `P1R_EXTERNAL_MIGRATION_BACKUP_READY` 门槛。用带临时 override 的独立 Compose 命令启动其 MySQL/Redis/MinIO/Kafka；对 13 个外部 owner 执行只读 `mysql-migrate --preflight`。源码确认空 schema 的只读预检可将全部迁移标为待执行。
3. 仅在此独立项目中运行 `mysql-init` 和 `mysql-migrate`；记录每个 one-shot 退出码、13 个迁移账本及 owner 权限。迁移成功才按 `deploy-full.sh` 的顺序启动 IAM、Audit、Workflow、11 个领域服务、Gateway 和四个前端。原脚本硬编码两份 Compose 文件且会对同项目执行停止操作，**不能原样用于本机隔离项目**；需由受控包装脚本统一追加第三层 override，不得对原项目名执行 `up`、`stop` 或 `down`。
4. 在隔离网络中放置一次性探针容器，对官网 `official-site:18182`、学习 Web `learner-web:8080`、管理 Web `admin-web:8080`、移动 H5 `mobile-h5:8080` 测 HTTP 根页；对 Gateway、IAM 和各 owner 测健康、JWKS、401/403、路由、数据库读写与审计/事件。现有 `local-real-10x` 种子默认拒绝非 `127.0.0.1:13306` 写入；不能把它直接指向现有共享库，也不能无审查地把其中 `bulk-*` 社群假数据作为“拟真”验收依据。应在隔离项目内先准备经审查的合成业务数据。
5. 四端浏览器 E2E 需再放一个**仅连接此内部网络**的 HTTPS 反向代理及浏览器测试容器。批次八前端把 Gateway URL 编译成 `https://api.clyunedev.com/api/v1`，IAM/Gateway 的 issuer 也是该域名；只打开容器名的 HTTP 根页无法证明登录、CORS、Secure Cookie 或跨端交互。测试代理应对 `clyunedev.com`、`learn.`、`admin.`、`mobile.`、`api.clyunedev.com` 使用临时测试证书和网络别名，分别代理到上述四端与 `api-gateway:18070`，由测试浏览器信任该临时 CA。不得把这些域名流量发往公网真实站点，也不得将代理发布到宿主机端口。浏览器容器必须处于隔离网络，才能核验真实构建镜像中的请求链路。
6. 记录镜像 ID、容器健康、迁移结果、匿名/授权 Gateway→owner→MySQL 证据、四端截图/Console/响应式结果和最终清理清单。验收后仅清理经确认属于 `cloudstudy-uat-isolated` 的容器/网络/卷；先留存必要的合成证据和可恢复备份。不能用 Docker 构建成功、前端 HTTP 200 或本地 JAR 运行结论替代这一步。

## 当前阻塞与可做的烟测

- **不能直接运行完整 Compose：**6 个固定宿主端口被当前服务占用，服务器专用环境文件与 RSA 私钥路径缺失，MySQL 8.4 与 Redis 7.4 镜像未缓存；直接套用原 `deploy-full.sh` 不会加载隔离 override。
- **可以无干扰验证：**镜像存在、Compose 解析/网络和卷隔离、四个前端单镜像根页、代码与契约测试。四个前端的单容器根页 HTTP 200 已在本轮主记录中独立验证，但不代表 Docker 全栈或四端业务通过。
- **启动后仍须单列 GAP：**全新空库需要可信合成内容与学习链数据；媒体对象与部分领域事实目前不具备完整链路，无法凭环境隔离将功能状态判成 PASS。移动 Docker 镜像仅是 H5，不验证原生 iOS/Android/iPad。

结论：**技术上可建立不会干扰本机共享服务/数据的独立容器全栈**，目前只完成配置层证明。服务运行、迁移、真实 HTTPS 浏览器和四端功能验收均未执行，故 Docker 全栈状态仍为 **未验收**。
