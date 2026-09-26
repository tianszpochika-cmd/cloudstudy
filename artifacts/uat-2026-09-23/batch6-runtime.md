# 第六批本地媒体与内容运行回归（2026-09-23）

> 后续第七批已关闭当时的 Saga 补偿契约校验失败，当前 `contracts:validate` 通过；见[工作流运行回归](batch7-workflow-runtime.md)与[媒体上传契约边界](media-upload-url-contract-boundary.md)。本文件以下保留第六批当时的部署和检查边界。

本批只集中更新本任务的 `content-service`、`media-service` JAR；16 个 Java 服务经本任务 runner 统一短暂停启，其余五个 Docker 基础设施容器和四个前端服务始终保持运行。迁移前保留 16 个 JAR 于 `C:\Temp\cloudstudy-uat-runtime-backup-20260923-batch6`，并保留内容、媒体 schema 导出 `C:\Temp\cloudstudy-uat-db-backup-20260923-batch6\content-media-before.sql`（1,649,363 字节，SHA-256 `53561029a1db85bcc39ffb39b8cef3db61820afe28d7d386894113b03487ed21`）。媒体激活修复前的单独回退 JAR 另存 `C:\Temp\cloudstudy-media-before-activation-fix-20260923.jar`（SHA-256 `a20226b68faea0315574abf7f607c5c13c9fe3610cdbab34f09386fd98d915c0`）。

媒体 owner `p1r_schema_history` 从 V6 应用 V7，当前 1–7 完整、无待迁版本；新建 `media_write_idempotency_record`。旧 Flyway 自身记录只有 0–3，不能把两套账本混说成一致。本地迁移由管理凭据执行，运行服务没有获得 DDL。最终构建 JAR 的 SHA-256：content `5c377da4d9fd9e29c5aabc63002c3812b5c662fe174b39bb2e6e7051d4846541`，media `12eed9a413f9a352ac7c44cc39b4e2a7a5f7fd455652f2a8cf3fd153c73db7f6`。本机固定 16 个 Java 端口与四个前端端口均处于监听状态；runner 报告 16/16 就绪。

## Gateway → owner 实测

- [内容草稿与自动校验原始记录](content-cas-runtime.json)：合成 staff 经 Gateway 完成 **19/19** 项检查。原 14 项内容 CAS/分页检查继续通过；新增自动校验缺键 400、同键同体报告及 `checkedAt` 原样回放、同键异体 409、恰好一条 owner 持久收据。测试草稿 1 条、版本 2 条、收据 6 条精确删除，账号禁用且活动会话 0；回读内容定义 103、版本 101、测试内容 0。
- [媒体原始记录](media-idempotency-runtime.json)：合成成人经 Gate 与三项同意后再取得权限 JWT，经 Gateway 对注册、字幕和失败任务重试执行 **21/21** 项检查；同键同体原回执、异体 409、缺键 400 均经运行验证。重试所需的 FAILED 任务由已鉴权的媒体 owner 内部接口设置；该处理回调没有公开 Gateway 路由，不能把设置失败态描述为管理 UI 操作。测试媒体资产 1、rendition 1、outbox 4、幂等收据 3、旧注册收据 1 均精确清除，账号禁用且活动会话 0；回读媒体资产 100、V7 写收据 0、测试资产 0。
- 激活路径先重现了**严重错误**：从未上传字节、仅在请求体重复声明元数据散列和大小的资产竟可被标记为 `ACTIVE`。失败记录保留于 [修复前激活记录](media-idempotency-runtime-phantom-activation.json)。修复后，在 `local-real` 对象存储未配置时，激活返回 503 `MEDIA_OBJECT_STORE_NOT_CONFIGURED`，资产保持 `UPLOADING`，幂等收据与激活 outbox 都不提交；对象存储已配置时必须核对指定 bucket、版本、完整 SHA-256、大小及 MIME 才能激活。针对性测试及媒体服务完整测试 82 项无失败、3 项跳过。

上述媒体请求只验证元数据、权限、幂等和拒绝边界。上传 PUT 授权、真实音视频字节、转码、播放器与跨端播放仍未验收；管理媒体页面不能据此改判 PASS。媒体四项写操作中的激活只验证拒绝路径，尚无真实对象的正向激活与幂等回放证据。

## 契约、容器与剩余边界

`pnpm contracts:merge`、`contracts:merge:check` 通过；全量 `contracts:validate` 在 Saga 补偿路由缺持久幂等声明处失败，仍是发布门禁。`infra/docker/clyunedev` 已补独立 owner 迁移和运行权限收敛的脚本，14 项静态测试通过；目前没有在服务器或 Docker 应用容器中执行迁移、恢复或权限验收。镜像是否完成当前源码的整批构建，另以 Docker 构建记录为准，不能从本地 JAR 推断。
