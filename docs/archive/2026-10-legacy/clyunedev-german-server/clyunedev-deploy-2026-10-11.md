# clyunedev 部署记录 2026-10-11

- 环境：clyunedev 单机预发布（netcup，德国，37.120.160.36），非正式生产
- 分支：`dev-redesign`；起始 `8f50a20f`，最终运行 `1de5c1d4`（RELEASE_TAG=1de5c1d4）
- 部署前服务器代码：`af4ea883`（2026-09-28，分离头指针）
- 授权：项目负责人确认库内无真实数据，允许清空重建

## 备份与清空
- MySQL 全库导出：`/srv/cloudstudy/backups/pre-redesign-20261011T062200Z.sql.gz`
- 旧 env 副本：`/srv/cloudstudy/backups/clyunedev.env.pre-redesign-20261011T062200Z`
- 已删除卷（仅本项目）：`cloudstudy-clyunedev-mysql`、`-redis`、`-minio`、`-kafka`（`docker compose down -v`）
- 未触碰：`claude-code-router` 及其它无关容器

## 环境变量变更（仅名称）
- 新增 `NUXT_GATEWAY_INTERNAL_BASE_URL`（取 example 默认值）
- `RELEASE_TAG` 更新为 `1de5c1d4`
- `P1R_EXTERNAL_MIGRATION_WRITERS_DRAINED` / `_BACKUP_READY` 仅迁移期间置 true，完成后已恢复 false
- 未新增 secret；IAM RSA 私钥沿用 `/srv/cloudstudy/secrets/iam-rsa-private.pem`

## 部署过程
1. `deploy-full.sh` 首跑：空卷 MySQL 初始化期间健康检查已通过，preflight 连接失败（`temporary account lookup`）。MySQL 正式就绪后重跑 preflight 通过，第二次 `deploy-full.sh` 完成 mysql-init + 13 个 owner schema 迁移，IAM 自身 Flyway 正常。
2. 修复 `e3b93d19`：全量 compose 给 learning-service 打开 `LEARNING_PORTS_MODE=http` 及 learner/content/assessment 地址。此前 `V2PlansController` 缺 `HttpLearnerTargetPort` bean，导致持续重启（旧版本同因）。
3. 修复 `1de5c1d4`：IAM 带 refresh cookie 的认证请求只信任回环 origin，公网 `https://learn.clyunedev.com` 登录被 403 `iam.auth.origin_untrusted`。新增 `IAM_TRUSTED_LEARNER_ORIGINS`（精确 https 白名单，compose 默认 learn/mobile 两个域名）。
4. 空库没有已发布同意文档，注册返回 503 `iam.consent.version_unavailable`。新增 `scripts/deploy/seed-clyunedev-consent-documents.sh`，写入 5 类预发布占位同意文档（`clyunedev-prerelease-v1`，`NOT_RUNTIME_VERIFIED`，不代表法务签收）。
5. 重建后执行 `deploy-full.sh --start-existing`（只读校验迁移历史后启动）。
6. 清理：旧 `cloudstudy-clyunedev/*` 镜像和构建缓存，磁盘占用从 12% 降到 7%。

## 验证结果
- 23 个常驻容器全部 Up（超过 10 分钟），无重启；3 个一次性任务 exit 0
- `nginx -t` 通过
- HTTPS 200：clyunedev.com、learn.、admin.、mobile.、api./api/v1/health；`/actuator` 公网 404 符合预期
- 冒烟：注册 201，登录 200（Origin learn.clyunedev.com），携带 token 访问 learner 接口，返回 403 `CONSENT_REQUIRED`，符合新用户未同意前的预期闸门

## 遗留
- `scripts/deploy/prune-clyunedev-images.sh` 在服务器 mawk 下报 awk 语法错误，这次改为手工清理
- 空库首次部署时存在 MySQL 初始化竞态：`up --wait` 在临时初始化实例阶段就判定健康，可能需要在 deploy-full.sh 里等 TCP 就绪
- 同意文档是预发布占位，正式环境需要替换为法务发布版本
- 尚未做浏览器端全流程验收，也没有内置测试账号（种子目录里没有面向 clyunedev 的账号脚本）

## 2026-10-11 下午：浏览器注册修复、clyune.com 双域名与真实浏览器验收

### 注册失败的根因
浏览器里的注册请求发到了 `https://127.0.0.1:18087`：learner-web 和 mobile-h5 打包时没有传 `VITE_IAM_AUTH_BASE_URL`，代码回退到了本机默认地址，所以请求根本没有到服务器。修好这一处后，又依次暴露出下面几层问题，每一层都会让新用户卡住：

| 问题 | 修复 | 提交 |
|---|---|---|
| 前端把 IAM 地址打包成本机回环地址 | Dockerfile 和 compose 补上 `VITE_IAM_AUTH_BASE_URL=https://api.clyunedev.com/api/v1` | `453e4e34` |
| 网关和 IAM 都返回了 `Access-Control-Allow-Origin`，浏览器因为出现两个值而拦截 | 网关去掉上游返回的 `Access-Control-*` 头 | `1bc789cb` |
| 成人年龄确认返回 403 `trusted_age_required` | 新增显式的非生产 `prerelease` profile，允许出生年份自声明；`prod` 下仍然拒绝 | `7eb40497` |
| 同意书返回 409：前端写死了 `b30-consent-v1`，重试时又复用了同一个幂等键 | 先读取已发布版本，重试时换新的幂等键（web 和 H5 都改了） | `956a815d` |
| 学员接口返回 403 `CONSENT_REQUIRED`：learner-service 的同意复核访问的是容器内回环地址 | 接到 `iam-service`，并新增服务客户端 `learner-service` | `54820415` |
| 开始定级返回 503：题库、学员和内容服务的地址都是回环默认值 | compose 改为连接各个服务 | `1eacdd10` |
| 提交答案返回 503：服务器上没有评分用的服务 token | assessment-service 用 IAM 客户端凭据换取短期 token 并缓存；IAM 新增 `assessment-service` 客户端（权限 `content:answer-rules:read`） | `7902157c` |
| 其余未接上的地址（assessment content、learner plan-view、admin-ops risk） | 在 compose 中补齐 | `ba35ef00` |
| H5 定级分数显示成 7100；H5 退出登录后停在“我的”页 | 分数按 0–100 显示；退出后回到登录页 | `c1a98cb8` |

服务器上新增的密钥（只放在 `/srv/cloudstudy/env/clyunedev.env`，权限 0600，没有输出过）：`LEARNER_CONSENT_RECHECK_CLIENT_SECRET`、`IAM_SERVICE_CLIENT_LEARNER_SECRET_DIGEST`、`ASSESSMENT_PLACEMENT_SCORE_CLIENT_SECRET`、`IAM_SERVICE_CLIENT_ASSESSMENT_SECRET_DIGEST`。

### clyune.com 与 clyunedev.com 并行提供服务
- nginx：`infra/docker/clyunedev/nginx-host-clyune.conf` 已安装为 `/etc/nginx/sites-enabled/clyune`，覆盖 `clyune.com`、`www`、`learn`、`admin`、`mobile`、`api` 这几个域名。官网反向代理时用 `sub_filter` 把 `clyunedev.com` 链接改写成 `clyune.com`。
- 证书：Let's Encrypt 证书 `clyune`，覆盖以上 6 个域名，HTTP 跳转到 HTTPS，由 certbot.timer 自动续期。
- 网关 CORS：每类来源都支持用逗号分隔多个精确来源，并逐个校验（`7cc99cb9`、`bf9ee6b1`；前端运行时选择 api 在 `b9f5cb07`）。服务器 env 已同时放行两个域名族的 learn/admin/mobile/官网来源。
- IAM：`IAM_TRUSTED_LEARNER_ORIGINS` 已加入 `learn.clyune.com` 和 `mobile.clyune.com`。
- 前端不再固定使用 clyunedev 的接口：打包时传入 `VITE_API_DOMAIN_FAMILIES=clyunedev.com,clyune.com`，运行时按当前页面所在的域名族选用 `api.<域名族>`（有白名单）。已验证：从 `learn.clyune.com` 打开时请求发往 `api.clyune.com`，从 `learn.clyunedev.com` 打开时请求发往 `api.clyunedev.com`。
- 这次部署没有设置 CSP，所以不需要改 `connect-src`。Cookie 只作用于当前 api 主机名，不带 domain，两个域名族互不影响。

### 真实浏览器验收（box 上的 headless Chromium / Playwright）
截图在 box 的 `/workspace/clyunedev-browser/`，文件名前缀分别是 `web-dev-*`、`web-clyune-*`、`h5-dev-*`、`h5-clyune-*`、`admin-*`、`site-*`；每次运行的结果在 `results-*.json`。

| 步骤 | web 1280 clyunedev | web 1280 clyune | H5 390 clyunedev | H5 390 clyune |
|---|---|---|---|---|
| 注册 | 通过 | 通过 | 通过 | 通过 |
| 年龄确认 + 同意书 | 通过 | 通过 | 通过 | 通过 |
| 学习目标 | 通过 | 通过 | 通过 | 通过 |
| 定级测评（10 题） | 通过（B1 · 71） | 通过（B1 · 71） | 通过（B1 · 71） | 通过（B1 · 71） |
| 首页 / 今日计划 | 页面正常，没有已发布课程 | 同左 | 同左 | 同左 |
| 练习 / 错题本 | 页面正常，没有已发布练习内容 | 同左 | 练习入口页正常 | 同左 |
| 学习报告 | 通过 | 通过 | 页面正常（没有内容） | 同左 |
| 个人页 / 设置 | 通过 | 通过 | 通过 | 通过 |
| 客服 | 页面正常（提交工单仍按原设计关闭） | 同左 | 同左 | 同左 |
| 退出登录 → 再次登录 | 通过 | 通过 | 通过（退出后回到登录页） | 通过 |

另外：`admin.clyunedev.com` 和 `admin.clyune.com` 的登录页能正常打开；`clyunedev.com`、`clyune.com` 和 `www.clyune.com` 上的“去注册”分别指向各自域名族的 `learn.*/register`。

### 测试账号
`qa.tester1@example.com`、`qa.tester2@example.com`、`qa.tester3@example.com` 三个账号都已完成年龄确认、同意书、学习目标（职场与日常，每天 15 分钟）和定级。密码只保存在服务器的 `/srv/cloudstudy/secrets/clyunedev-test-accounts.txt`（root 所有，权限 0600）。两个域名族共用同一个数据库，所以这几个账号在两边都能登录。

### 遗留问题
- 清空后的数据库里没有已发布的课程或练习内容，所以今日计划、练习和错题本都是空的，“错题复习”这条链路没法在线上走通。仓库里的种子脚本按设计只允许写本机 MySQL；需要在 admin 里发布内容，或者决定是否给预发环境做一份种子数据。
- 客服提交新工单仍然按设计关闭（“受控正文尚未批准”）。
- 年龄确认在 `prerelease` 下用的是出生年份自声明，正式上线前需要接入可信的年龄来源。
- 那 5 份同意书仍然是占位文本。
- 重新部署之后，第一次开始定级曾出现过一次 503，之后没有再复现。
- 自动测试连续跑得太密时，`/iam/permissions` 偶尔会返回 429（网关限流），正常使用不会碰到。
