# clyunedev 单机预发布 Docker 资产

本目录承载 `clyunedev` 的受版本控制单机预发布编排。它服务于 `dev` 分支联调，不替代 Kubernetes/GitOps 目标架构，也不构成正式 `clyune.com` 生产发布。

跨电脑继续服务器操作时，先读 [2026-09-21 clyunedev 单机预发布交接快照](../../../docs/07-operations/clyunedev-cross-device-handoff-2026-09-21.md)。其中将“仓库已提交”与“服务器已回传验证”分开记录。

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

管理举报只读队列还要求服务器注入稳定的 `SOCIAL_MODERATION_CURSOR_KEY`（至少 32 字节随机值）。它用于加密分页游标及生成租户内脱敏引用，应通过服务器 secret 管理而非写进仓库、镜像或日志。缺失或过短时队列会返回 503，不能将其误判为“没有举报”；轮换密钥后旧游标会失效，管理员需重新加载第一页。此配置不开放举报处置写命令。

管理审计列表按租户分页，还要求稳定的 `ADMIN_OPS_AUDIT_CURSOR_KEY`（至少 32 字节随机值）。密钥只放在服务器环境文件或 secret 管理器，并在所有 admin-ops 副本间保持一致。缺失或过短时审计读取返回 503；轮换后旧游标失效，管理员重新加载第一页。

全量 Compose 仍只将 Gateway、IAM、官网、学习 Web、管理 Web 和移动 H5 绑定到 `127.0.0.1`。领域服务、MySQL、Redis、Kafka、MinIO 与 Audit/Workflow 均不发布宿主端口；宿主 Nginx 才是将来唯一的公网入口。移动 H5 预留 `mobile.clyunedev.com`，在 DNS/TLS 就绪前保持回环可达、不可公网访问。

## 领域数据运行模式

全量 Compose 为 `media-service`、`gamification-service`、`social-service`、`commerce-service`、`admin-ops-service` 和 `analytics-service` 显式启用 `v2,local-real`。这些服务的代码使用 `local-real` 选择 owner JDBC 实现；只提供数据库连接变量仍会落到内存实现或示例控制器。`notification-service` 的管理恢复接口也只在该模式下加载，其业务存储另外由 `NOTIFICATION_PERSISTENCE_MODE=jdbc` 选择。此配置随 Compose 部署生效，单独构建镜像不会改变现有容器。

切换前先核对每个 owner schema 的实际表结构、迁移历史和权限，并备份数据；Compose 的 `config --quiet` 只能验证配置解析，不能证明已有数据能被新实现读取。当前媒体服务未配置可供浏览器使用的私有 MinIO 访问入口和专用对象存储凭据，签名播放应保持失败关闭；不能以成功连接 `media_service` 数据库代替对象存在性、版本、校验和授权验证。

### 外部 owner 迁移与运行凭据

全量部署先用一次性 `mysql-migrate --preflight` 对 13 个外部 schema 做只读核验，通过后才由 `mysql-init` 收敛运行账号权限到各自 schema 的 `SELECT/INSERT/UPDATE/DELETE`。迁移任务为每个 owner 临时创建只拥有该 schema 权限的账号，以此执行该 owner SQL，随即删除；管理员账号仅负责账号、账本和权限核验。11 个领域服务以及 Audit、Workflow 均禁用运行时 Flyway，并等待迁移任务成功结束才启动。IAM 是独立例外：`svc_iam` 只在 `iam_service` 范围保留 DDL，服务自身的 `IAM_FLYWAY_ENABLED=true` 保持启用。管理员密码只传给两个一次性任务，不能传入领域服务或镜像层。

迁移任务使用现有 `p1r_schema_history` 作为版本和 SHA-256 校验和的权威账本。空 schema 从 V1 逐版执行；已有账本的 schema 必须是当前文件序列的前缀，校验和完全一致，才允许执行待迁版本。无账本的存量表、未知或跳跃版本、Flyway 已执行但未记入 p1r、失败 Flyway 记录，以及遗留的 `p1r_migration_guard` 均直接阻断。每版执行前写入 guard、成功后立即记账并清除 guard；MySQL DDL 非事务化，失败后必须先根据备份和实际表结构由 owner 人工修复，不得盲目重跑或按表名补记历史。当前本地 `reconcile-owner-schemas.mjs` 的自动 baseline 行为不适用于本服务器路径。

部署前排空 13 个 owner 的所有写入方，并在服务器验证可恢复备份；仅本次计划迁移期间在服务器 env 文件中设置 `P1R_EXTERNAL_MIGRATION_WRITERS_DRAINED=true` 和 `P1R_EXTERNAL_MIGRATION_BACKUP_READY=true`。完成后恢复为 `false`。从仓库根目录调用下面的部署脚本；它先构建整批镜像、运行全库只读预检，再停止旧写入进程并重做预检，最后强制重建两个一次性任务。迁移成功才按明确服务名单启动应用，避免常规 `up` 重启迁移任务。任何迁移失败均保持外部写入进程停止。

14 个数据库密码均需是服务器生成的非占位值；bootstrap 会在任何账号变更前拒绝空值、单引号、反斜杠和换行，以免 SQL 字符串被截断或转义。

```bash
sh infra/docker/clyunedev/deploy-full.sh /srv/cloudstudy/env/clyunedev.env
```

同一 release 的后续正常开机使用 `sh infra/docker/clyunedev/deploy-full.sh /srv/cloudstudy/env/clyunedev.env --start-existing`；此模式只读验证 13 份完整历史与运行权限，确认没有待迁版本，再启动应用，不执行 `mysql-init` 或 SQL 迁移。发现未清理的临时迁移账号时同样阻断，需人工核对。

脚本要求服务器有 Docker Compose、Node.js 和 POSIX shell。已有业务表但缺少 `p1r_schema_history` 的首次接入不在自动路径内：先由各 owner 对照实际 DDL、历史迁移和备份完成专门的人工采纳记录，不能将所有文件版本直接标为已执行。当前仓库仅完成脚本/Compose 静态验证，尚未在 clyunedev 服务器对空库、存量库、权限、回滚或备份恢复执行验收；这些仍是正式部署门槛。

## 公网入口与 TLS

[`nginx-host.conf`](nginx-host.conf) 是宿主机 Nginx 的 HTTP 基线：它只将五个 `clyunedev.com` 域名转发到已绑定在 `127.0.0.1` 的上游，并明确拒绝公网访问 Gateway 的 `/actuator`。在 Debian 宿主机将其安装为 `/etc/nginx/sites-available/clyunedev`、启用站点并通过 `nginx -t` 后，使用 Certbot 为五个名称一起签发证书。证书申请的联系邮箱只在服务器的交互提示中输入，不写入此仓库或环境文件。

容器启动和 health endpoint 仅表示该进程与其已接入的 owner 依赖存活；它不替代 Gateway/PEP、跨服务事件、浏览器、备份恢复、安全或 Phase 1 发布验收。
