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
