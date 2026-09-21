# clyunedev 官网 UI 重构发布记录（2026-09-21）

> 范围：将 2026-09-21 官网提案 06 的正式 Nuxt 实现发布到 `clyunedev.com`。本文件只覆盖官网容器的受控更新；不重建数据库、Gateway、IAM、学习端、管理端或领域服务，不改变正式 `clyune.com`、P1R 验收或产品合规 Gate。

## 本次官网重构内容

- `apps/official-site` 从旧的公开展示页升级为包含首页、学习内容与六个详情、学习世界、学习方法、帮助、免费开始和公开说明的 19 个公开路由。
- 新增学习空间、角色/装扮、两轮拼句、词卡练习、FAQ 搜索、电脑/手机入口分流、深浅色/跟随系统/高对比和四档性能降级。
- 官网仍只读取 Gateway 公开投影，不接收账号密码、不建立业务会话、不写入学习、游戏、支付或权限事实。
- 原型与正式实现的差异、页面边界、截图和设计承接见[官网正式前端实现记录](../06-design/v2-980plus/official-site-experience-proposal-2026-09-21/implementation/README.md)。

## 本地发布候选验证

本轮源代码在提交前已完成下列验证：

| 检查 | 结果 | 边界 |
| --- | --- | --- |
| `git diff --check` | 通过 | 检查当前改动的空白/补丁格式 |
| `pnpm --filter @englishflow/official-site test:website` | 12/12 通过 | 公开链接、只读边界、路由、SEO、状态与安全入口的定向检查 |
| `pnpm --filter @englishflow/official-site build` | 通过 | Nuxt SSR/Nitro node-server 生产构建成功；Windows Nitro 的既有外部解析 warning 不阻断构建 |
| `website-runtime.cjs` 记录 | PASS，11 组交互、152 组布局、0 错误 | 本机 Chromium、320/390/768/1440 宽度与深浅主题；不代表真机、Safari、后端业务或注册登录 E2E |

以上验证证明官网 UI 源码可以构建并完成浏览器前端检查，不能推导为 IAM、Gateway、公开投影业务数据、成人 Gate、学习记录或 Phase 1 验收已经通过。

## 发布前提

1. 本次官网 UI 源码与本文档必须先作为独立 `dev` 提交推送到 GitHub。
2. 服务器更新前先检查 `/srv/cloudstudy/app` 工作树，若有未知改动则停止记录，不得 `git reset --hard`、`git clean` 或覆盖文件。
3. 服务器只允许用其只读 Deploy Key 拉取 `dev`；`/srv/cloudstudy/env/clyunedev.env` 及私钥不得打印、复制或提交。
4. 本次只更新 `official-site`，不执行无目标的 `docker compose up -d`，也不重新启动 Nginx。

## 服务器受控更新

在服务器 `/srv/cloudstudy/app` 中执行。此流程会将环境文件中仅用于镜像标签的 `RELEASE_TAG` 更新为当前 Git 短 SHA，但由于 Compose 命令明确只针对 `official-site`，其他运行容器不会自动重建。

```bash
set -Eeuo pipefail

cd /srv/cloudstudy/app

env_file=/srv/cloudstudy/env/clyunedev.env

compose() {
  docker compose \
    --env-file "$env_file" \
    -f infra/docker/clyunedev/docker-compose.core.yml \
    -f infra/docker/clyunedev/docker-compose.full.yml \
    "$@"
}

echo '========== 更新前只读快照 =========='
git status --porcelain=v1
git rev-parse HEAD
compose ps official-site

git fetch --prune origin
git pull --ff-only origin dev

new_release_tag="$(git rev-parse --short=12 HEAD)"

grep -q '^RELEASE_TAG=' "$env_file"
sed -i "s/^RELEASE_TAG=.*/RELEASE_TAG=$new_release_tag/" "$env_file"

echo '========== 仅构建并替换官网 =========='
compose build official-site
compose up -d --no-deps --force-recreate official-site

echo '========== 官网容器核验 =========='
compose ps official-site
curl --fail --silent --show-error --max-time 15 \
  http://127.0.0.1:18182/ \
  >/dev/null

echo "官网容器已更新至 Git 短提交：$new_release_tag"
```

`compose up -d --no-deps --force-recreate official-site` 已经完成官网容器的停止和启动。因为 Nginx 继续代理相同的 `127.0.0.1:18182`，成功后**不要**额外重启官网或 Nginx。

## 发布后检查与两版本保留

从服务器外使用无痕窗口或强制刷新检查 `https://clyunedev.com`，至少访问 `/`、`/world`、`/courses`、`/method`、`/help` 与 `/start`，并查看浏览器 Console。随后在服务器先预览镜像清理：

```bash
cd /srv/cloudstudy/app
bash scripts/deploy/prune-clyunedev-images.sh
```

只有预览确认无误后才执行 `bash scripts/deploy/prune-clyunedev-images.sh --apply`。该脚本只处理 `cloudstudy-clyunedev/*` 中多于当前与上一版、且没有被容器引用的镜像；禁止使用 `docker system prune`、`docker compose down -v` 或删除 Docker volume。

## 本次上线的明确边界

本次发布是 `dev` 分支的 `clyunedev` 单机预发布/联调更新。它不等于正式 `clyune.com` 上线；公开页面可访问、构建成功或容器存活都不等于全站业务、数据恢复、可观测性、成人资格、法律同意、浏览器端到端或 Phase 1 已验收。
