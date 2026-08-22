# media-service

`media-service` 是语学星 v2 B11 MED-001 的独立媒体边界，目标运行时为 Java 25 LTS + Spring Boot 4.1.x。它只拥有媒体元数据、处理状态、rendition、对象引用和短时交付授权；`content-service` 仍拥有内容语义关联与版权事实。

## MED-001 已实现边界

- 资产元数据：类型、MIME、大小、SHA-256、对象版本、Range 能力、租户和服务端 owner；对象存储 bytes 不进入 domain、HTTP 响应、事件或日志。
- 内容/版权引用：`MediaContentReference` 和 `MediaRightsReference` 保存 content version、许可渠道、有效窗口和授权证据引用；过期、撤销、缺失或渠道不允许时 fail closed。
- 转码/rendition：资产级 `NOT_REQUIRED/QUEUED/PROCESSING/READY/FAILED` 与 rendition 级 `QUEUED/PROCESSING/READY/FAILED/REVOKED` 状态；失败状态不能签发可播放 URL。
- manifest：只返回资产版本、校验和、大小、Range 能力、版权状态和 rendition metadata，不返回媒体 bytes，也不伪造 `206 Partial Content`。
- signed URL：短时 opaque grant 绑定 `assetId + assetVersion + tenant + subject + channel + Range`；内存适配器只保留 token digest，生产适配器替换为 CDN/KMS signer。
- Range：支持单一 `bytes=start-end` 或开放尾部 `bytes=start-`；不支持多段、suffix 或越界请求时返回明确拒绝。Range 校验只操作 size metadata，不读取对象 bytes。
- 撤销：资产撤销同时清除内存授权 grant，后续读取再次校验资产状态、版权窗口、租户、owner/content-right、同意和设备权限。
- 安全：Resource Server 默认关闭时除 `/actuator/**` 外全部拒绝；启用后只接受已验证 OIDC JWT。tenant、owner、phase、consent、role、permission 来自认证上下文，客户端请求体/authority header 不能覆盖。
- 幂等：注册 metadata 必须带 `Idempotency-Key`，按已验证 tenant + subject + key 做 metadata fingerprint replay；重复 key 的不同 payload 会拒绝。
- 事件：内存 outbox 只接收 checksum、size、版本和状态等安全 metadata，禁止原始媒体或音频内容进入事件。

## 本地配置

默认绑定 `127.0.0.1:18092`，可用以下环境变量覆盖：

```text
MEDIA_SERVICE_PORT=18092
MEDIA_SERVICE_SERVER_ADDRESS=127.0.0.1
MEDIA_SERVICE_RESOURCE_SERVER_ENABLED=false
MEDIA_SERVICE_SECURITY_ISSUER_URI=https://idp.example/realms/yuxuexing
MEDIA_SERVICE_SECURITY_JWK_SET_URI=https://idp.example/realms/yuxuexing/protocol/openid-connect/certs
MEDIA_SERVICE_SIGNED_URL_BASE_URL=https://cdn.example.invalid/media
MEDIA_SERVICE_SIGNED_URL_TTL=PT5M
MEDIA_SERVICE_MAX_SIGNED_URL_TTL=PT15M
```

`MEDIA_SERVICE_RESOURCE_SERVER_ENABLED=false` 时没有本地认证绕过；非 actuator 路由是默认拒绝。18092 的根配置登记、Gateway 路由和数据库迁移属于 B11 集成任务，不在本目录内修改。

## 内部 API

外部客户端必须经过 Gateway；以下是服务内部边界：

| 方法 | 路径 | 作用 |
|---|---|---|
| `POST` | `/internal/v1/media/assets` | 注册 metadata/object reference；必须带 `Idempotency-Key`，不接受媒体 bytes、tenant 或 owner |
| `GET` | `/internal/v1/media/assets/{assetId}` | 读取授权 metadata |
| `GET` | `/internal/v1/media/assets/{assetId}/manifest` | 读取 metadata-only manifest |
| `POST` | `/internal/v1/media/assets/{assetId}/signed-url` | 签发短时 URL，可带 `Range` 请求头 |
| `POST` | `/internal/v1/media/signed-urls/{token}/assets/{assetId}/validate` | 校验 grant、过期、撤销、主体和 Range；不返回 bytes |
| `PUT` | `/internal/v1/media/assets/{assetId}/active` | 以可信 object-store callback 校验 checksum/size 后激活 |
| `PUT` | `/internal/v1/media/assets/{assetId}/transcoding` | 更新资产级转码状态 |
| `PUT` | `/internal/v1/media/assets/{assetId}/renditions/{renditionKey}` | 更新 rendition 状态和 integrity metadata |
| `POST` | `/internal/v1/media/assets/{assetId}/revoke` | 撤销资产和已有 grant |

服务没有上传、下载、流式代理或记录原始音频的 controller。真实对象存储/CDN 适配器只消费短时授权和对象引用。

## 结构

```text
domain/       不依赖 Spring 的 metadata、rights、Range、授权和安全事件类型
application/  注册、激活、manifest、签名、转码、rendition、撤销和 PEP
port/         media schema、签名和 metadata-only outbox 适配边界
adapter/      仅用于 smoke 的内存 repository、签名 grant 和 outbox
security/     Resource Server 默认拒绝和客户端 authority 头拦截
web/          只返回 metadata/manifest/signed URL 的内部 HTTP API
```

## 验证

本机当前只有 Java 24 且没有 Maven。纯 Java smoke 不依赖 Spring/Maven：

```powershell
powershell -ExecutionPolicy Bypass -File .\services\media-service\scripts\smoke.ps1
```

或从仓库根目录手动执行：

```powershell
$out = 'services/media-service/.compile-check-b11-med-20260822'
New-Item -ItemType Directory -Force $out | Out-Null
$files = @(rg --files services/media-service/src/main/java services/media-service/src/test/java |
  Where-Object { $_ -notmatch 'MediaServiceApplication\.java|[\\/]web[\\/]|[\\/]config[\\/]|[\\/]security[\\/]' })
javac --release 24 -encoding UTF-8 -d $out $files
java -cp $out com.englishflow.media.MediaDomainSmoke
```

预期输出：`media-service MED-001 smoke: PASS`。smoke 覆盖 metadata 注册、checksum/size、转码失败、短时 URL、Range、manifest、过期 URL、tenant/owner/同意默认拒绝、撤销和事件不含原始媒体。

## 未完成项

本切片不声称 Java 25/Maven/Spring 运行、OIDC/JWKS、Gateway、MySQL/Flyway、Kafka/Outbox worker、S3/MinIO Range、CDN/KMS 签名或跨进程部署已经通过运行态验收。生产适配必须实现 `MediaRepository`/`SignedUrlPort` 的持久化与对象存储版本，同时保持默认拒绝和不记录原始媒体的边界。
