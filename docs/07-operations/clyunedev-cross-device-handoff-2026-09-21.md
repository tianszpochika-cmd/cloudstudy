# clyunedev 单机预发布跨电脑交接（2026-09-21）

> 截止状态：**全量单机栈、Nginx 入口和五域名 TLS 已部署并取得运行证据；不是正式 `clyune.com` 生产发布，也不是 Phase 1 业务验收结论。**
>
> 本文件替代 [2026-09-20 旧交接](clyunedev-cross-device-handoff-2026-09-20.md) 作为下一台电脑继续操作的基线。只记录已回传的脱敏事实、已知 GAP 和安全顺序；不得据此清理、重置或删除状态数据。

## 环境与入口快照

| 项目 | 截止时已确认的值 |
| --- | --- |
| 环境 | `clyunedev`，用于 `dev` 分支联调和预发布演练 |
| 正式生产域名 | `clyune.com`；本轮没有配置、解析或申请其证书 |
| 服务器 | 一台 Debian 13 Netcup VPS，公网 IPv4 `37.120.160.36` |
| 服务器目录 | `/srv/cloudstudy/app` |
| 服务编排 | 单台 Docker Engine，联合加载 core/full 两份 Compose 文件 |
| 服务器已拉取提交 | `5a25e4ae159d3825d77efe1e9d4069c5011d7bd7`（Nginx ingress 基线） |
| 管理账户 | `root`；没有额外 `deploy` Linux 用户 |
| 持久化状态 | MySQL、Redis、Kafka、MinIO 使用命名 Docker volume |

公网递归 DNS 已将以下五个名称解析为 `37.120.160.36`：

| HTTPS 域名 | 回环上游 |
| --- | --- |
| `clyunedev.com` | `official-site`，`127.0.0.1:18182` |
| `learn.clyunedev.com` | `learner-web`，`127.0.0.1:18180` |
| `admin.clyunedev.com` | `admin-web`，`127.0.0.1:18181` |
| `mobile.clyunedev.com` | `mobile-h5`，`127.0.0.1:18183` |
| `api.clyunedev.com` | `api-gateway`，`127.0.0.1:18070` |

服务器本机默认 resolver 曾继续返回旧根记录或无法解析子域名；这是该 resolver 的缓存/上游状态，**不能作为公网 DNS 或 ACME 成功与否的判定依据**。证书签发已证明公开 DNS 和 TCP/80 ACME 验证可达。

## 已完成的部署证据

### 服务器、秘密与静态检查

- Docker、Docker Compose、Git 与基础运维工具已安装；资源检查时主机为 8 vCPU、15 GiB 内存、约 300 GiB 可用磁盘。
- `/srv/cloudstudy/env/clyunedev.env` 已创建，权限为 `0600 root:root`；IAM RSA 私钥仅允许容器运行 UID 读取，权限为 `0400 10001:10001`。
- 环境文件含服务器随机数据库、Redis、MinIO、Kafka、服务间与 IAM 秘密；其值从未记录到 Git、本文档或聊天。
- core/full Compose 联合 `config --quiet` 已成功，静态服务清单为 25 项。

全量操作固定使用：

```bash
docker compose --env-file /srv/cloudstudy/env/clyunedev.env \
  -f infra/docker/clyunedev/docker-compose.core.yml \
  -f infra/docker/clyunedev/docker-compose.full.yml
```

### 数据、服务和前端

- 已分批构建 IAM、Gateway、Audit、Workflow、11 个领域服务及四个前端的部署镜像；构建成功不等于业务验收。
- MySQL、Redis、MinIO 已取得 `healthy`；Kafka 进程处于运行状态。
- `mysql-init` 退出码为 `0`，已验证 14 个 owner schema：`iam_service`、`learner_service`、`content_service`、`learning_service`、`assessment_service`、`media_service`、`notification_service`、`gamification_service`、`social_service`、`commerce_service`、`admin_ops_service`、`analytics_service`、`audit_service`、`workflow_service`。
- `minio-init` 最终退出码为 `0`；`clyunedev` bucket 已创建且为 private。
- IAM 的回环 readiness 与 `/api/v1/auth/jwks` 已通过；Audit、Workflow 与 11 个领域服务均在私有 Compose 网络通过各自 readiness。
- Gateway 的回环 readiness、`/api/v1/health` 与 `/api/v1/auth/jwks` 已通过；四个前端上游均在宿主回环可达。
- 官网曾因 Nitro 默认监听 `3000` 而失败，已修复为监听 `0.0.0.0:18182`，容器直连和经 Nginx 的根路径检查均为 HTTP 200。

容器来自分阶段部署的标签：多数已启动服务仍可见 `7b754b74`，官网容器为 `419bcdfa`；`5a25e4ae` 仅增加宿主 Nginx 基线，不表示所有容器已重建为相同标签。**不要为了统一标签执行无范围的 `docker compose up -d` 或重建全部服务。**先读取 `RELEASE_TAG`、容器镜像和日志，再升级明确范围内的服务。

### Nginx 与 TLS

- Nginx、Certbot 和 Nginx 插件已安装；`nginx -t` 已通过，Nginx 已启用并运行。
- [`nginx-host.conf`](../../infra/docker/clyunedev/nginx-host.conf) 已安装为 `/etc/nginx/sites-available/clyunedev` 并启用，只反代到上述回环上游。MySQL、Redis、Kafka、MinIO、IAM 与领域服务端口未发布到公网。
- `api.clyunedev.com/actuator` 及 `/actuator/*` 由 Nginx 返回 HTTP 404，管理健康端点不对公网开放。
- Let’s Encrypt 已为五个 `clyunedev.com` 名称签发并部署名为 `clyunedev` 的证书；证书位于 `/etc/letsencrypt/live/clyunedev/`，到期日为 **2026-12-19**。绝不读取、复制或提交证书私钥。
- Certbot 的自动续期计划已安装，`certbot renew --dry-run` 已成功。
- HTTPS 复核通过：五个站点握手成功，Gateway `/api/v1/health`、`/api/v1/auth/jwks` 通过，公开 `/actuator` 仍被拒绝。

`certbot --nginx --redirect` 已在宿主 `/etc/nginx/sites-enabled/clyunedev` 写入 TLS listener、证书路径和 HTTP 到 HTTPS 重定向。仓库里的 `nginx-host.conf` 是**HTTP 基线**，不是该 Certbot 管理文件的逐字镜像。后续修改 ingress 前先备份并检查已安装配置；不得用基线文件覆盖 TLS 段。若确需重新安装基线，之后必须重新运行 Certbot 并复核证书。

## 明日开始时的只读核验

新电脑必须使用自己的 SSH 密钥；不要复制旧电脑私钥。若临时使用已授权的 root 登录方式，登录后再将新电脑独立生成的 Ed25519 公钥加入 `/root/.ssh/authorized_keys`。不要传输服务器密码、环境文件、证书或私钥。

登录后先只执行以下命令，不要直接拉取、重建或清理：

```bash
cd /srv/cloudstudy/app

printf 'HEAD: '; git rev-parse HEAD
printf 'branch: '; git branch --show-current
git status --porcelain=v1
git fetch --prune origin
printf 'origin/dev: '; git rev-parse origin/dev
git log -1 --format='when: %cI%nsubject: %s'

env_file=/srv/cloudstudy/env/clyunedev.env
docker compose --env-file "$env_file" \
  -f infra/docker/clyunedev/docker-compose.core.yml \
  -f infra/docker/clyunedev/docker-compose.full.yml \
  ps

echo '=== permissions only; do not print secret contents ==='
stat -c '%a %U:%G %n' \
  /srv/cloudstudy/env/clyunedev.env \
  /srv/cloudstudy/secrets/iam-rsa-private.pem

echo '=== ingress and certificate ==='
systemctl is-active nginx
nginx -t
certbot certificates
```

预期：Git 工作树无输出、服务状态与本文一致、Nginx 为 `active`、`nginx -t` 成功，且证书仍列出五个域名。若工作树有改动、服务退出、证书异常或任一命令失败，停止后记录输出；**不要**用 `git reset --hard`、`git clean`、`docker system prune`、`docker compose down -v` 或无范围的重建来“修复”。

## 未完成验收与明确 GAP

以下事项不能由容器 health、HTTPS 或证书签发推出，继续时不得改写为“系统已完整可用”：

1. **浏览器端到端验收尚未完成。**需从外网浏览器检查四个前端的加载、Console、CORS、登录、错误态和响应式，并验证请求经 `api.clyunedev.com` -> Gateway -> 领域服务 -> owner schema。
2. **没有默认业务账户或已验证的首管理员。**数据库、Redis、MinIO 随机密码只供服务内部连接，绝不能作为网站账号。
3. **普通注册不等于完整学习可用。**源码审查表明公开注册只创建 `learner`；生产 profile 禁用本地成人 gate，且同意书控制表不植入 fixture 文档。缺失真实法律文档/可信年龄证据时，相关权限会失败关闭或被收窄；这尚未完成公网浏览器验证。
4. **首管理员/策略操作员的生产初始化流程未实现或验证。**本地/测试专用 policy bootstrap 被生产启动保护拒绝；不得直接修改 `iam_account`、伪造 JWT、启用 local profile 或暴露内部端口绕过。
5. **运维闭环未验收。**曾观察到服务尝试向 `localhost:4318` 导出 metrics 而连接失败；未部署 collector 或明确关闭相应导出。异机备份、恢复演练、容量/告警、WAF/DDoS、防火墙审计及 HSTS 浏览器验证也没有证据。
6. **正式生产与 Phase 1 Gate 未关闭。**本环境仅为 `dev` 单机预发布，不能当作 `clyune.com` 正式生产、合规上线或 P1R 完成证明。

## 建议继续顺序与边界

1. 先完成本文件的只读快照和外网浏览器入口验证；不要依赖服务器本机 `getent` 的旧 DNS 缓存。
2. 进行最小浏览器链路：官网 -> 学习端注册/登录页 -> Gateway 公开 health/JWKS；记录 HTTP、Console 与服务日志，但不泄露 Cookie、Token、密码或用户数据。
3. 设计并实现可审计、一次性、生产可用的首管理员与角色授权初始化流程，同时确定真实成人证据与法律同意文档发布方案。
4. 明确处理 OpenTelemetry metrics 的 `localhost:4318` GAP，随后验证日志、指标和告警。
5. 制定加密备份、异机保存与恢复演练；清理镜像前只允许先预览 `scripts/deploy/prune-clyunedev-images.sh`，确认准确后才加 `--apply`。

不可突破的边界：不触碰 `clyune.com`；不公开 DB、Redis、Kafka、MinIO、IAM 或领域服务；不读取/打印/提交环境文件、RSA 私钥、证书私钥、Token 或 Cookie；不使用 `infra/docker/docker-compose.dev.yml` 启动服务器；不将 healthcheck、镜像构建或证书成功夸大为业务、合规或 Phase 1 验收。
