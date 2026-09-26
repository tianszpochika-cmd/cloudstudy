# media-service

`media-service` 是语学星 v2 B11 MED-001 的独立媒体边界，目标运行时为 Java 25 LTS + Spring Boot 4.1.x。它只拥有媒体元数据、处理状态、rendition、对象引用和短时交付授权；`content-service` 仍拥有内容语义关联与版权事实。

## MED-001 已实现边界

- 资产元数据：类型、MIME、大小、SHA-256、对象版本、Range 能力、租户和服务端 owner；对象存储 bytes 不进入 domain、HTTP 响应、事件或日志。
- 内容/版权引用：`MediaContentReference` 和 `MediaRightsReference` 保存 content version、许可渠道、有效窗口和授权证据引用；过期、撤销、缺失或渠道不允许时 fail closed。
- 转码/rendition：资产级 `NOT_REQUIRED/QUEUED/PROCESSING/READY/FAILED` 与 rendition 级 `QUEUED/PROCESSING/READY/FAILED/REVOKED` 状态；失败状态不能签发可播放 URL。
- manifest：只返回资产版本、校验和、大小、Range 能力、版权状态和 rendition metadata，不返回媒体 bytes，也不伪造 `206 Partial Content`。
- signed URL：短时 opaque grant 绑定 `assetId + assetVersion + tenant + subject + channel + Range`；内存适配器只用于显式实例化的 smoke。所有运行 profile 默认拒发地址；显式启用对象存储后，必须先核实精确对象版本、大小、MIME 和存储端全对象 SHA-256，再由 MinIO/S3 签发可访问的 GET URL。显式 Range 请求会把 Range 头写入签名；普通浏览器播放请求完整对象授权，由播放器自行发 Range。
- Range：支持单一 `bytes=start-end` 或开放尾部 `bytes=start-`；不支持多段、suffix 或越界请求时返回明确拒绝。Range 校验只操作 size metadata，不读取对象 bytes。
- 撤销：资产撤销同时清除内存授权 grant，后续读取再次校验资产状态、版权窗口、租户、owner/content-right、同意和设备权限。
- 安全：Resource Server 默认关闭时除 `/actuator/**` 外全部拒绝；启用后只接受已验证 JWT JWT。tenant、owner、phase、consent、role、permission 来自认证上下文，客户端请求体/authority header 不能覆盖。
- 幂等：注册 metadata 必须带 `Idempotency-Key`，按已验证 tenant + subject + key 做 metadata fingerprint replay；重复 key 的不同 payload 会拒绝。
- 事件：内存 outbox 只接收 checksum、size、版本和状态等安全 metadata，禁止原始媒体或音频内容进入事件。

## 本地配置

默认绑定 `127.0.0.1:18092`，可用以下环境变量覆盖：

```text
MEDIA_SERVICE_PORT=18092
MEDIA_SERVICE_SERVER_ADDRESS=127.0.0.1
MEDIA_SERVICE_RESOURCE_SERVER_ENABLED=false
MEDIA_SERVICE_SECURITY_ISSUER_URI=http://127.0.0.1:18087
MEDIA_SERVICE_SECURITY_JWK_SET_URI=http://127.0.0.1:18087/api/v1/auth/jwks
MEDIA_SERVICE_OBJECT_STORE_ENABLED=false
MEDIA_SERVICE_OBJECT_STORE_ENDPOINT=http://minio:9000
MEDIA_SERVICE_OBJECT_STORE_PUBLIC_ENDPOINT=https://media.example.com
MEDIA_SERVICE_OBJECT_STORE_BUCKET=private-media-bucket
MEDIA_SERVICE_OBJECT_STORE_ACCESS_KEY=<secret-manager-injected-access-key>
MEDIA_SERVICE_OBJECT_STORE_SECRET_KEY=<secret-manager-injected-secret-key>
MEDIA_SERVICE_OBJECT_STORE_REGION=us-east-1
MEDIA_SERVICE_SIGNED_URL_TTL=PT5M
MEDIA_SERVICE_MAX_SIGNED_URL_TTL=PT15M
```

`MEDIA_SERVICE_RESOURCE_SERVER_ENABLED=false` 时没有本地认证绕过；非 actuator 路由是默认拒绝。对象存储开关保持关闭，直到已有私有桶、存储端 SHA-256、对象版本和浏览器可达的 HTTPS 公共端点均已配置。只允许本机 loopback HTTP 用于本地只读验证。服务会拒绝 bucket 不匹配、无版本、无存储端校验和、大小/MIME/校验和不符的对象。现行 rendition 元数据没有独立对象 key，不能把其 READY 状态当作可播放证明；录音上传需要独立的受控 PUT intent，现行 GET 签名器对此明确拒绝。

MinIO 预签名 URL 由对象存储直接处理，在它到期前，撤销服务端 grant 不能即时使已签发 URL 失效。要求即时撤权的生产交付还需要受控代理/CDN 撤销能力及端到端验证。服务端不应把本地 206 探针当作真实课程或录音验收。18092 的根配置登记、Gateway 路由和数据库迁移属于 B11 集成任务，不在本目录内修改。

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

可运行 Maven 测试；纯 Java smoke 仍可单独执行：

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

本切片不声称 Gateway→成人账号→已发布课程→浏览器/移动端播放、独立 rendition、录音上传、即时撤权或真实版权资产已经通过。已有 MinIO 只读探针只验证预签名 GET、单字节 206 和错误 Range 的 403；缺少对象版本/存储端 SHA-256 的旧对象保持不可签发。生产还需要内容/权利审核、对象版本与校验上传、可信处理 worker、CDN/代理撤销及设备端验收。
