# 管理端媒体工作台边界验收（2026-09-23）

`PAGE-P1-ADMIN-MEDIA` 建议判定 **BLOCKED**。这次实际打开了管理端页面，也通过 Gateway 请求媒体 owner，但未找到可由运营人员完成“上传→校验→处理→READY/CLEAN→预览或失败重试”的页面操作链。16 项安全边界检查通过，只能证明既有入口和拒绝行为，不能替代媒体功能验收。

## 设计与实际页面

- [逐页功能登记册](../../docs/06-design/v2-980plus/phase1-business-operation/03-全端页面功能登记册.md) 的 `PAGE-P1-ADMIN-MEDIA` 要求上传意图、完成校验、处理任务、rendition、字幕、版权、授权访问、隔离与重试；媒体处理流程还要求源资产满足 `READY/CLEAN`、rights 和官方字幕/文本替代，才能进入内容发布。
- 真实浏览器访问设计地址 `/admin/content/media` 后落到 `/dashboard`。当前管理端路由表和侧边导航均无媒体工作台。`/content` 的编辑页只有“版权编码”、内容配置和内容命令；没有文件选择、上传、任务、字幕或隔离控件。[1280 页面](screenshots/admin-media-boundary/content-1280.png)、[内容编辑](screenshots/admin-media-boundary/content-editor-1280.png)、[设计地址结果](screenshots/admin-media-boundary/canonical-route-redirect.png)。
- `/lexemes` 有手填“音频资产 ID”和试听组件，但这是发音引用入口，不能代替资产上传与处理工作台。试听组件的正向授权播放未在本次验证。
- [390 页面](screenshots/admin-media-boundary/content-390.png)无整页横向溢出，表格有页内横向滚动提示；1280/390 均无页面脚本异常。匿名访问转登录，[无内容权限访问](screenshots/admin-media-boundary/content-permission-390.png)进入 403 页。通过浏览器拦截**模拟**内容列表 503/空结果时，分别显示[恢复提示](screenshots/admin-media-boundary/content-error-simulated.png)和[空态](screenshots/admin-media-boundary/content-empty-simulated.png)，恢复后可刷新；这两张截图只验证现有 `/content` 壳的 UI 状态，不是媒体 owner 的真实空态或错误态。

## Gateway 与数据事实

- [原始记录](admin-media-boundary.json)中，匿名读取不存在的媒体是 401；只有内容权限的 staff 读取一个现有 `ACTIVE` 媒体是 403 `MEDIA_READ_FORBIDDEN`；有媒体权限的 staff 对不存在的资产、处理任务、上传意图均收到 404，未发放对象授权，也未写媒体行。
- 只读聚合：媒体表有 100 条元数据，56 条标 `ACTIVE`、44 条 `UPLOADING`；仅 22/100 的 SHA-256 字段符合 64 位十六进制格式，`ACTIVE` 中仅 15/56 符合。格式符合也不证明对象字节一致。此前[对象完整性复核](media-object-integrity.md)发现桶内 5 个对象仅 3 个和表内大小、散列一致，且 5 个都没有对象版本和存储端 SHA-256 校验值；现有数据不能当作真实可播放资产。
- [第六批媒体运行记录](batch6-runtime.md)验证了元数据幂等和未上传对象不能激活；[上传地址契约边界](media-upload-url-contract-boundary.md)确认真实 PUT 授权尚无成功路径。没有上传字节、转码 worker、病毒扫描、字幕 artifact、真实源版权链和跨端播放的运行证据。

## 处理建议与范围

先建立媒体工作台与内容草稿的明确入口，复用 canonical media 契约；实现私有对象存储的授权上传、版本/全对象校验、处理任务与失败恢复、字幕和 rights 证据，再用可审校的媒体样本做浏览器→Gateway→media/content owner→MySQL/MinIO→发布 Gate 全链验收。`ACTIVE` 不应只靠元数据和页面文案宣称可以播放。

本次只创建一个 `.invalid` 合成 staff，最终账号为 `DISABLED`、活动会话 0；没有上传或改动媒体对象、现有 rights、处理任务。脚本为 [uat-admin-media-boundary.mjs](../../scripts/runtime/uat-admin-media-boundary.mjs)，运行结果 16 项检查均符合预期，页面缺失导致功能判定为 **BLOCKED**。浏览器错误/空态使用本地拦截模拟，和真实运行证据分开记录。
