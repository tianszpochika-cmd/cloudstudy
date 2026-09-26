# 媒体对象与短时地址真实性复核（2026-09-23）

## 已修复的假成功

旧 `local-real` 适配器把 `assetId` 拼成 `http://127.0.0.1:19000/yuxuexing-local/{assetId}?token=...`。这个 token 只存在服务内存，MinIO 不承认，也不对应 `media_asset.object_key`。客户端收到 200 和地址仍无法播放。

现在所有运行 profile 默认返回 `MEDIA_OBJECT_STORE_NOT_CONFIGURED`，不再发假地址。只有显式配置私有桶、内部与浏览器可达的端点及密钥后，服务在现有资源 PEP 之后核对 bucket、精确对象版本、HEAD 大小、MIME、存储端**全对象** SHA-256 与资产事实；通过后使用 MinIO SDK 生成真实 GET 预签名 URL。无版本或无存储端校验值会拒绝。录音上传不复用 GET 签名；没有独立 object key 的 rendition 也没有被宣称可播放。实现依据为 [MinIO Java SDK 对预签名 GET 与对象 HEAD 的接口说明](https://minio-java.min.io/io/minio/MinioClient.html)。

## 本地只读证据

本地 MinIO 健康端点 200；`yuxuexing-local` 私有桶现有 **5** 个对象，均为音频 MIME，且其 key 能对应 `media_service.media_asset` 的 ACTIVE 行。只读读取并计算 SHA-256 后，只有 **3/5** 同时符合媒体表的大小和 SHA-256；另 **2/5** 不符合。桶未开启对象版本管理，5/5 对象没有 versionId，也没有存储端 SHA-256 校验 metadata。因此当前 5 个对象均不满足新签发门槛；未修改、上传或发布任何对象。

使用已有对象做仅一字节的只读传输测试：真实预签名 GET 配合 `Range: bytes=0-0` 返回 **206** 和 1 字节；显式签名 `bytes=0-0` 时，相同 Range 返回 **206**，改成 `bytes=1-1` 返回 **403**。测试未打印凭据、预签名 URL 或音频内容。该结果只证明 MinIO 连接与签名正确，不证明教学内容、版权、账户授权或浏览器播放器通过。

媒体 Java 测试 **76 项、0 失败、0 错误、3 跳过**；新增对象事实不一致、错误桶、无版本、录音误走 GET、grant 撤销和默认未配置拒发用例。真实 MinIO 只读集成测试在显式传入本地测试环境变量时单独通过；常规测试不读取本地存储。独立 Boot JAR：`C:\Temp\cloudstudy-uat-media-20260923-v4\target\media-service-0.1.0-SNAPSHOT.jar`。该 JAR 已在 2026-09-23 10:37 CST 集中重启中部署到本地 media-service，字节散列与构建产物相同，健康检查通过；尚无授权成人账号的播放器或媒体签名端到端测试。Docker 应用镜像尚未重建。

## 剩余验收边界

- 需把经授权、审校、实际存在的音频以版本化对象和由存储验证的 SHA-256 纳入媒体 owner，再使 content 发布引用与字幕/文本替代一致。现有 2 份字节不符对象须查明并重建或下线，不能靠改数据库散列绕过。
- MinIO 直发的短时 URL 在到期前仍可能可用，服务内撤销 grant 只能阻断新签发/validate；即时版权撤销需要边缘鉴权代理或支持撤销的 CDN，并验证撤销后实际 GET 拒绝。现行最大 TTL 15 分钟，默认 5 分钟。
- 需给 rendition 存储独立 object key/version/integrity，补齐上传完成、扫描/转码、官方字幕、录音同意与本人回放；通过成人 Gate 的真实 Web/移动播放器仍未验收。B11 页面状态应保持 **BLOCKED**。
- clyunedev Docker full overlay 现在给 media-service 及其他六个领域服务设置 `SPRING_PROFILES_ACTIVE=v2,local-real`，其 Compose 配置检查已通过。这是待构建镜像的配置修复；应用容器未启动，MySQL owner 数据路径、对象存储配置与浏览器播放仍无容器运行证据。不得将 Docker 镜像存在视为媒体事实持久化通过。
