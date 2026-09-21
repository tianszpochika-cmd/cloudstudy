# clyunedev 单机预发布跨电脑交接（2026-09-20，已由后续快照替代）

> **历史记录。** 当前服务器状态、TLS 证据和下一步请使用 [2026-09-21 交接快照](clyunedev-cross-device-handoff-2026-09-21.md)。本文件保留部署准备期的原始事实，不能作为当前运行状态执行依据。

> 状态：**部署准备中；不是正式 `clyune.com` 生产发布，也不是 Phase 1 验收结论。**
>
> 本文用于在另一台电脑上安全继续操作服务器。它只记录已经确认的事实与下一步的核验方法；不要根据它执行清理、重置或删除数据卷的操作。

## 1. 环境与入口已经确定

| 项目 | 值 |
| --- | --- |
| 正式生产域名 | `clyune.com`；本轮不配置、不解析、不申请证书 |
| 当前联调环境 | `clyunedev`，代码来自 `dev` 分支 |
| 服务器 | 一台 Debian 13 VPS，公网 IPv4 `37.120.160.36`；不创建虚拟机 |
| 服务器代码目录 | `/srv/cloudstudy/app` |
| Linux 管理账户 | `root`；不保留 `deploy` 用户 |
| 编排方式 | 同一 Docker Engine 上的 Docker Compose；数据、后端和 Web 同机运行 |
| 镜像策略 | 每个 `cloudstudy-clyunedev/*` 应用仓库仅保留当前和上一版；不执行全局 Docker 清理 |

待 DNS 与 TLS 准备完成后，唯一入口映射为：

| 域名 | 上游 |
| --- | --- |
| `clyunedev.com` | `official-site` |
| `learn.clyunedev.com` | `learner-web` |
| `admin.clyunedev.com` | `admin-web` |
| `mobile.clyunedev.com` | `mobile-h5` |
| `api.clyunedev.com` | `api-gateway` |

宿主 Nginx 将是唯一公网 HTTP(S) 入口。数据库、Redis、Kafka、MinIO、IAM 与 Gateway 不得直接暴露公网端口；`api.clyunedev.com` 只能转发 Gateway，不能绕过它直连 IAM 或任何领域服务。

## 2. 已确认完成的服务器准备

以下项目已经由服务器命令回显确认：

- Docker Engine `29.8.1`、Docker Compose `v5.5.1` 已安装，Docker 已启用，`hello-world` 成功。
- 服务器目录权限：`/srv/cloudstudy` 为 `root:root`/`0755`；`env` 和 `backups` 为 `0750`；`secrets` 为 `0700`。
- root 密码已由管理员更新；当前电脑的 root SSH 公钥登录已经验证。
- Bash 无输入 20 分钟自动退出，SSH 无响应会话约 20 分钟断开。
- GitHub 仓库 `tianszpochika-cmd/cloudstudy` 已配置只读 Deploy Key；服务器 SSH 别名 `github-cloudstudy` 已能读取远程 `dev` 与 `master`。
- 服务器已克隆 `/srv/cloudstudy/app` 的 `dev` 分支。最后一次**有回显佐证**的服务器提交为 `fa867dc15d77d1a8aae3957551c833ba2292b080`，当时部署运行记录和双镜像保留脚本已在服务器，且脚本语法检查通过。

## 3. 仓库中已经提交、但仍须在服务器核验的部署资产

`3ed8d9a70af93f052daaa9d26e5eea62a17d76d2`（`feat(deploy): add clyunedev core single-host stack`）新增了核心切片；后续全量部署提交必须以 `git rev-parse HEAD` 与 `git status --porcelain=v1` 为准，不能将本段固定 SHA 当作当前服务器事实。核心切片新增：

- `infra/docker/clyunedev/docker-compose.core.yml`：首批核心切片，包括 MySQL、Redis、Kafka、MinIO、IAM、Gateway、官网、学习 Web 和管理 Web；仅四个 Web/Gateway/IAM 上游端口发布到 `127.0.0.1`。
- Java 25、Vite、Nuxt 多阶段构建 Dockerfile 与静态 Web Nginx 配置。
- 无秘密的 `clyunedev.env.example`，以及精确命名空间的双版本镜像清理脚本。

本地静态 Compose 配置检查已经通过。**这不等于服务器已拉取本提交、也不等于镜像已构建、容器已启动或业务已通过联调。**

全量目标还需要 `docker-compose.full.yml` 叠加层、`Dockerfile.mobile-h5`、`bootstrap-owner-schemas.sh` 与 `clyunedev.full.env.example`：它们将移动 H5、Audit、Workflow 和 11 个领域服务加入私有 Compose 网络，并为 14 个 owner 创建独立 schema/账号。运行时必须联合加载 core 与 full 两个 Compose 文件；完成文件拉取、服务器环境变量补齐和静态检查前，不能说全量服务已在服务器上部署。

## 4. 当前未确认或刻意未执行的项目

1. 尚未获得“服务器已拉取 `3ed8d9a…`”的回显。
2. 尚未获得“`/srv/cloudstudy/env/clyunedev.env` 与 IAM RSA 私钥已生成、权限正确、Compose 静态预检通过”的回显。若文件已存在，后续命令必须先检查，绝不能覆盖或打印其内容。
3. 尚未拉取/构建任何可部署镜像，尚未创建任何 Compose 容器、网络或数据卷。
4. 尚未安装宿主 Nginx 虚拟主机，未配置 DNS、TLS、HTTPS、HSTS 或正式域名。
5. 全量 overlay 的服务器拉取、每 owner secrets/schema、PEP、事件和运行依赖仍需逐项验证；容器健康不能代替这些证据。
6. IAM 的真实策略/同意数据、完整运行链路、浏览器联调、恢复演练和 P1R 验收均未完成；不得因健康检查或容器启动成功而声称 Phase 1 已验收。

## 5. 在另一台电脑连接服务器

新电脑不会自动拥有旧电脑的 SSH 私钥。优先为新电脑创建**独立**的 Ed25519 密钥，并把新电脑的公钥追加到服务器 `/root/.ssh/authorized_keys`；不要复制旧电脑私钥，也不要把任何私钥、服务器密码或 `/srv/cloudstudy/env/clyunedev.env` 发到聊天、Git 或截图中。

确认新电脑已具备授权私钥后，连接命令为：

```bash
ssh root@37.120.160.36
```

连接成功后，先只读核验当前事实：

```bash
set -Eeuo pipefail

cd /srv/cloudstudy/app
git fetch --prune origin
git switch dev
git status --short
printf '本地提交： '
git rev-parse HEAD
printf '远程 dev： '
git rev-parse origin/dev
git log -1 --format='%cI%n%s'

echo
echo '========== Docker 当前状态（只读） =========='
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}'
docker system df

echo
echo '========== clyunedev 服务器侧秘密文件状态（不显示内容） =========='
for file in /srv/cloudstudy/env/clyunedev.env /srv/cloudstudy/secrets/iam-rsa-private.pem; do
  if [ -e "$file" ]; then
    stat -c '%a %U:%G %n' "$file"
  else
    echo "MISSING $file"
  fi
done
```

预期是本地提交与 `origin/dev` 相同，且包含所需的 core/full Compose 文件。若 `git status --short` 有输出，先停止，不要用 `git reset`、`git clean` 或覆盖文件；记录输出后再判断。

## 6. 恢复执行顺序

按下列顺序继续，每一项都有明确证据后再进入下一项：

1. 拉取 `origin/dev` 并用第 5 节命令确认工作树干净、提交相等。
2. 如果 secrets 文件不存在，按 [单机预发布运行记录](clyunedev-single-host-pre-release-runbook.md) 的环境文件规范生成一次性密码、Kafka KRaft ID 与 IAM RSA 私钥，设置为 root 可读的 `0600`；生成后只检查权限和 Compose 配置，绝不输出值。
3. 将 `clyunedev.full.env.example` 中的每个变量用服务器侧随机值补齐到 `/srv/cloudstudy/env/clyunedev.env`，并保留 `0600`；Gateway audit 明文 client secret 只放在该文件，IAM 只放其 SHA-256 hex digest。
4. 使用 `--env-file /srv/cloudstudy/env/clyunedev.env` 联合加载 `docker-compose.core.yml` 与 `docker-compose.full.yml` 运行 `docker compose config --quiet`；失败时只修正缺失配置，不启动容器。
5. 先做只读磁盘和 Docker 清单检查，再分批受控构建基础设施、平台、领域与前端镜像。构建成功仅代表构建成功，不能作为业务验收。
6. 记录目标 Git SHA、Compose 镜像、容器和卷清单后，启动全量服务集合并逐项获取健康与日志证据。不要公开发布非回环端口。
7. 领域服务默认失败关闭、未接妥 adapter 或缺少 PEP/事件证据时必须记录为运行 GAP，不能因进程存活改写为业务可用。
8. 核心内部上游稳定后，再安装宿主 Nginx 的 HTTP 虚拟主机；只有 DNS 已指向本机且证书准备完成后才切换 HTTPS 与 Secure Cookie 对外联调。
9. 每次确认可回退版本后，先预览执行 `scripts/deploy/prune-clyunedev-images.sh`；只有清单准确时才传 `--apply`。禁止 `docker system prune`、删除 Compose 卷或删除未知镜像。

## 7. 继续前的硬性边界

- 不要触碰 `clyune.com`、其 DNS、Nginx 配置或证书。
- 不要把 DB、Redis、Kafka、MinIO、IAM 或 Gateway 的管理端口暴露给公网。
- 不要提交 `.env`、私钥、密码、证书或任何真实秘密。
- 不要复用本地开发栈 `infra/docker/docker-compose.dev.yml` 作为服务器启动命令。
- 不要用 `docker system prune`、`docker compose down -v`、`git reset --hard` 或 `git clean` 处理不确定状态。
- 任何真实运行结论均需记录命令、时间、Git SHA 和脱敏结果；静态检查、镜像构建、容器存活都不替代 P1R 运行与验收证据。

## 8. 与项目交接入口的关系

本文件只覆盖 `clyunedev` 单机预发布操作。继续 Phase 1 研发、台账或正式验收时，仍应先阅读根目录 `CURRENT-HANDOFF.md`、`requirements/backlog/v2-phase1-rebaseline/execution/CURRENT-HANDOFF.md`、当前任务台账和 Evidence 标准。历史文档中的结论不自动转化为本服务器的当前运行事实。
