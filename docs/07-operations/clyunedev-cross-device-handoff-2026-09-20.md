# clyunedev 单机预发布跨电脑交接（2026-09-20）

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

本地 `dev` 当前提交为 `3ed8d9a70af93f052daaa9d26e5eea62a17d76d2`（`feat(deploy): add clyunedev core single-host stack`），并已推送到远程。它新增：

- `infra/docker/clyunedev/docker-compose.core.yml`：首批核心切片，包括 MySQL、Redis、Kafka、MinIO、IAM、Gateway、官网、学习 Web 和管理 Web；仅四个 Web/Gateway/IAM 上游端口发布到 `127.0.0.1`。
- Java 25、Vite、Nuxt 多阶段构建 Dockerfile 与静态 Web Nginx 配置。
- 无秘密的 `clyunedev.env.example`，以及精确命名空间的双版本镜像清理脚本。

本地静态 Compose 配置检查已经通过。**这不等于服务器已拉取本提交、也不等于镜像已构建、容器已启动或业务已通过联调。**

## 4. 当前未确认或刻意未执行的项目

1. 尚未获得“服务器已拉取 `3ed8d9a…`”的回显。
2. 尚未获得“`/srv/cloudstudy/env/clyunedev.env` 与 IAM RSA 私钥已生成、权限正确、Compose 静态预检通过”的回显。若文件已存在，后续命令必须先检查，绝不能覆盖或打印其内容。
3. 尚未拉取/构建核心镜像，尚未创建任何 Compose 容器、网络或数据卷。
4. 尚未安装宿主 Nginx 虚拟主机，未配置 DNS、TLS、HTTPS、HSTS 或正式域名。
5. 尚未将未进入首批切片的领域服务接入。它们仍需分别确认 owner schema、最小权限、PEP、事件和运行依赖。
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

预期是本地提交与 `origin/dev` 相同，且至少包含 `3ed8d9a…`。若 `git status --short` 有输出，先停止，不要用 `git reset`、`git clean` 或覆盖文件；记录输出后再判断。

## 6. 恢复执行顺序

按下列顺序继续，每一项都有明确证据后再进入下一项：

1. 拉取 `origin/dev` 并用第 5 节命令确认工作树干净、提交相等。
2. 如果 secrets 文件不存在，按 [单机预发布运行记录](clyunedev-single-host-pre-release-runbook.md) 的环境文件规范生成一次性密码、Kafka KRaft ID 与 IAM RSA 私钥，设置为 root 可读的 `0600`；生成后只检查权限和 Compose 配置，绝不输出值。
3. 使用 `--env-file /srv/cloudstudy/env/clyunedev.env` 对 `infra/docker/clyunedev/docker-compose.core.yml` 运行 `docker compose config --quiet`；失败时只修正缺失配置，不启动容器。
4. 先做只读磁盘和 Docker 清单检查，再受控构建首批镜像。构建成功仅代表构建成功，不能作为业务验收。
5. 记录目标 Git SHA、Compose 镜像、容器和卷清单后，启动首批核心服务并逐项获取健康与日志证据。不要公开发布非回环端口。
6. 核心内部上游稳定后，再安装宿主 Nginx 的 HTTP 虚拟主机；只有 DNS 已指向本机且证书准备完成后才切换 HTTPS 与 Secure Cookie 对外联调。
7. 每次确认可回退版本后，先预览执行 `scripts/deploy/prune-clyunedev-images.sh`；只有清单准确时才传 `--apply`。禁止 `docker system prune`、删除 Compose 卷或删除未知镜像。

## 7. 继续前的硬性边界

- 不要触碰 `clyune.com`、其 DNS、Nginx 配置或证书。
- 不要把 DB、Redis、Kafka、MinIO、IAM 或 Gateway 的管理端口暴露给公网。
- 不要提交 `.env`、私钥、密码、证书或任何真实秘密。
- 不要复用本地开发栈 `infra/docker/docker-compose.dev.yml` 作为服务器启动命令。
- 不要用 `docker system prune`、`docker compose down -v`、`git reset --hard` 或 `git clean` 处理不确定状态。
- 任何真实运行结论均需记录命令、时间、Git SHA 和脱敏结果；静态检查、镜像构建、容器存活都不替代 P1R 运行与验收证据。

## 8. 与项目交接入口的关系

本文件只覆盖 `clyunedev` 单机预发布操作。继续 Phase 1 研发、台账或正式验收时，仍应先阅读根目录 `CURRENT-HANDOFF.md`、`requirements/backlog/v2-phase1-rebaseline/execution/CURRENT-HANDOFF.md`、当前任务台账和 Evidence 标准。历史文档中的结论不自动转化为本服务器的当前运行事实。
