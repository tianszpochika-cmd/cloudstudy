# clyunedev 单机预发布 / 联调环境运行记录

> 状态：**环境准备中，不是正式生产上线或 Phase 1 验收结论**。
>
> 本文记录 2026-09-20 起为 Cloudstudy 建设的 `dev` 单机预发布环境。它不改变正式生产域名、产品发布 Gate 或任何 P1R 验收状态。

## 1. 环境边界

| 项目 | 已确定值 |
| --- | --- |
| 正式生产域名 | `clyune.com`（本轮不配置、不解析、不接入证书） |
| 当前环境名称 | `clyunedev` |
| 当前代码分支 | `dev` |
| 初始服务器代码提交 | `a0ff89ce43ab940f5932b739dc5e3a4a36babb1f` |
| 服务器公网 IPv4 | `37.120.160.36` |
| 服务器形态 | 一台 Netcup Debian 13 KVM VPS；不创建额外虚拟机 |
| 运行方式 | Docker Compose 单机编排；数据库、对象存储、事件基础设施、后端和 Web 同机容器化 |
| 管理账户 | 服务器以 root 管理；不保留额外 `deploy` Linux 用户 |
| 镜像保留 | 每个可部署组件只保留当前与上一版两个可回退镜像版本 |

这个环境仅用于 `dev` 的联调、预发布验证、浏览器验证和部署流程演练。它不能被称为正式 `clyune.com` 的生产发布，也不能绕过 P1R 仍未关闭的运行、审计、安全、数据恢复和验收 Gate。

## 2. 入口约定

域名解析和 TLS 证书尚未配置时，Nginx 不应把任何入口公开映射为正式生产域名。待 DNS 指向该服务器且证书准备就绪后，入口固定如下：

| clyunedev 域名 | 用途 | 唯一上游边界 |
| --- | --- | --- |
| `clyunedev.com` | 公开官网、SEO、下载和合规公示 | `official-site` |
| `learn.clyunedev.com` | 学员 Web / PWA | `learner-web` |
| `admin.clyunedev.com` | 教研、运营与客服后台 | `admin-web` |
| `api.clyunedev.com` | Web、移动端和后续多端 API 基线 | `api-gateway` |

Nginx 是唯一公网 HTTP 入口。MySQL、Redis、Kafka、MinIO、IAM、Gateway 以外的领域服务和管理端口均不得直接发布到公网。`api.clyunedev.com` 只转发到 Gateway；Nginx 不能绕过 Gateway 直接转发 IAM 或领域服务。

## 3. 已完成的服务器准备

- Debian GNU/Linux 13（Trixie），8 vCPU、15 GiB 内存、约 301 GiB 可用磁盘；NTP 已同步。
- 已安装 `git`、`curl`、`gnupg`、`jq`、`sudo`、`unzip` 和 Vim 基础工具。
- 已通过 Docker 官方 APT 源安装 Docker Engine `29.8.1` 和 Docker Compose v2 `5.5.1`；`docker.service` 已设为开机启动，`hello-world` 验证成功。
- root 密码已由管理员在服务器上更新；root SSH 公钥登录已由管理员验证。
- SSH 交互式 Bash 无输入 20 分钟（`TMOUT=1200`）自动退出；无响应 SSH 客户端按 `ClientAliveInterval=120` 与 `ClientAliveCountMax=10` 在约 20 分钟后断开。
- GitHub 仓库 `tianszpochika-cmd/cloudstudy` 已添加只读 Deploy Key；服务器使用独立的 `cloudstudy_github_ed25519` 私钥和 `github-cloudstudy` SSH 别名拉取代码。
- 仓库已克隆到 `/srv/cloudstudy/app`，工作区干净，`dev` 分支和 `origin/dev` 一致。

## 4. 当前源码事实与禁止项

在 `dev@a0ff89ce`，仓库没有 Dockerfile 或单机生产 Compose 文件；[`infra/docker/docker-compose.dev.yml`](../../infra/docker/docker-compose.dev.yml) 是本地开发依赖栈，不能作为本环境的启动命令。

因此下列命令在本环境建设完成前禁止使用：

```bash
docker compose -f infra/docker/docker-compose.dev.yml up -d
pnpm services:run -- --all
```

前者含本地默认账号、端口与开发依赖假设；后者会启用 `local` / `local-real` 运行路径，可能使用临时 IAM 密钥、本地 Cookie 例外或回环地址。预发布编排必须显式注入 `clyunedev` 域名、受保护密钥、容器内 DNS、HTTPS Cookie 策略和最小权限服务配置。

## 5. 单机编排原则

1. 不创建 VM；Docker 网络仅用于同一台服务器内的进程隔离。
2. 数据库与状态卷持久化在本机受控 Docker Volume 中；备份输出写入 `/srv/cloudstudy/backups`，再由后续的异机/对象存储任务处理。
3. 应用构建使用多阶段容器构建，避免在宿主机长期安装 Java、Maven、Node 或 pnpm 运行时。
4. 所有映像以不可变 Git 提交短 SHA 标记；部署脚本只保留当前和前一版本，删除更早的**已确认不被任何容器使用**的 Cloudstudy 映像，不执行全局 `docker system prune`。
5. `.env`、私钥、数据库密码、服务间密钥、MinIO 凭据和证书仅置于 `/srv/cloudstudy/env` 或 `/srv/cloudstudy/secrets`，权限最小化且不提交 Git。
6. 任何 MySQL migration 必须在独立的受控步骤运行、保留迁移证据和可验证备份；不允许把本地测试 migration 直接当作发布操作。

## 6. 后续执行顺序

1. 在 `dev` 中新增受版本控制的 `clyunedev` 单机预发布 Dockerfile、Compose、Nginx 模板、环境变量说明和双版本镜像清理脚本。
2. 对这些资产运行静态 Compose/配置检查和受限构建验证；不因构建成功声称业务验收通过。
3. 提交并推送部署资产；服务器以只读 Deploy Key 拉取固定提交。
4. 在服务器生成真实 secrets、构建当前 Git 提交的镜像、仅启动受批准的服务集合，并记录镜像/容器/卷清单。
5. 安装并验证 Nginx 的 `clyunedev` HTTP 虚拟主机；DNS 与 TLS 后置，且不影响 `clyune.com`。
6. 域名解析完成后申请证书，切换 HTTPS、Secure Cookie 与 HSTS 策略，并从多地浏览器完成联调证据。

## 7. 回滚和磁盘保留

- 回滚只允许切回上一个已记录 Git 提交和对应的上一版镜像；不得在未知状态下重置代码或删除数据卷。
- 每次部署前记录 `docker compose images`、`docker ps --format`、目标 Git SHA 与当前环境文件校验摘要。
- 清理只针对名称和标签均匹配 `cloudstudy-clyunedev` 的旧映像，且先确认没有运行容器引用它们；数据库、Redis、Kafka、MinIO 卷不属于“镜像两版本保留”范围，不能随镜像清理删除。
