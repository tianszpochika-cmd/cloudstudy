# 第十五批四端内容与媒体只读核查（2026-09-23）

范围：当前私有 Docker 项目 `cloudstudy-uat-isolated-3c94b27160`、其独立 MySQL/MinIO、四端页面入口和当前源码。未登录受保护页面、未上传媒体、未写数据库、未停止或重建容器。共享 `yuxuexing-local` 与本私有项目的数据不可混算。

## 运行与数据事实

| 边界 | 只读结果 | 可下结论 |
| --- | --- | --- |
| 镜像 | 四端与领域容器 running；当前学习 Web、管理 Web、移动 H5 为 batch14，官网和 media-service 为 batch9，content-service 为 batch13。 | 镜像来自不同修复批次；不能用最新工作树替代容器实测。既有私网根页/readiness [19/19 记录](docker-isolated-stack-probe.json)。 |
| 私有内容库 | `content_definition=0`、`content_version=0`、`content_public_projection=0`、`content_public_site_facet=0`、`b25_content_course=0`、`content_item=0`。 | 没有可正式审核、发布和供官网/学习端展示的 canonical 内容。 |
| 私有媒体库/桶 | `media_asset=0`、`media_rendition=0`；MinIO 测试桶 `uat-media-3c94b27160` 的目录为空。 | 当前私有栈没有可播放或可上传后处理完成的教学媒体样本；根页 HTTP 200 不代表听力、跟读或试听可用。 |
| 旧 B3 种子 | `b3_content_experience=113`，全部 `PUBLISHED/content_version_id=301`：GRAMMAR 5、LISTENING 2、PHONETICS 57、PHONETICS-FR 41、READING 3、WRITING 5。canonical 版本 301 不存在。 | 数据库状态字符串不等于正式发布。当前源码通过统一失败关闭读取门禁隐藏旧行；[门禁证据](b3-published-content-gate.md)是源码/局部测试，私有 Docker 正向登录读取未验。不能把这 113 条转成可学课程。 |
| 法务入口 | `iam_consent_document_version` 中 `lifecycle_status=ACTIVE` 为 0。 | 私有栈按现行 IAM 安全边界拒绝正式注册/登录；学习 Web、管理 Web、移动 H5 只能验匿名/登录页，不能把保护页的空态当作已登录可用。既有[第十四批私网证据](docker-isolated-full-runtime.md)亦如此。 |

## 官网实际响应与可批量修复项

官网容器内请求 `GET /api/public-projection?locale=zh-CN` 返回 HTTP 200，但正文为 `state=error`、`source=empty-fallback`、`errorCode=PUBLIC_PROJECTION_UNAVAILABLE`、`courses=0`；响应还设置 `Cache-Control: public, max-age=60, s-maxage=60, stale-while-revalidate=300`。同容器直接走私有 `http://api-gateway:18070/api/v1/public/site/projection?uiLocale=zh-CN` 返回 HTTP 200、`courses=0`；走 `https://api.clyunedev.com/...` 则报 `DEPTH_ZERO_SELF_SIGNED_CERT`。因此私有官网 BFF 的错误态来自测试代理证书信任，而非内容 owner 无法返回空结果。

官网 `/courses` SSR HTML 为 HTTP 200，渲染 **6 张静态学习方式卡、0 张真实公开课程卡**，另有公开投影错误状态。当前文案已有“这里介绍学习方式，具体课程以学习端已开放内容为准”，不用改成虚构课程。建议本批可安全处理：给官网服务端 BFF 配独立内部 Gateway 地址，保留浏览器公开 HTTPS 地址；或只在私有环境让 Node 信任测试 CA。另将无缓存可恢复的错误 fallback 改为短缓存或 `no-store`，避免自签问题修复后仍展示旧错误。需在**新官网镜像**复测 `/api/public-projection` 从 `error` 转为 `empty`、0 公开课程，及课程页不出现错误横幅。不要关闭证书校验，也不要用静态方法卡伪装真实发布。

## 四端验收范围与下一步

- 官网能展示品牌和学习方式说明；真实公开课程、价格、媒体素材均无 owner 数据。上述 BFF 错误有明确环境修复路径。
- 学习 Web 的课程页有诚实空/错误状态，听力和其他 B11 页面需要已认证的版本化内容与媒体 manifest 才能正向验收；当前私有法务门槛和空 owner 库共同阻断。
- 管理 Web 的媒体工作台缺入口和上传/处理操作，见[专项](admin-media-boundary.md)；当前私有内容和媒体库全空，故无正向审核、上传、处理、试听数据可验。
- 移动 H5 学习页仍显示听力/阅读/跟读入口，但私有栈没有相应可用资源，且登录受法务门槛阻断。可以在后续已登录真实空态验收中检查入口文案与禁用/替代行为；本次不能凭匿名页断定其错误。

真实数据的恢复需先取得合法 ACTIVE 同意文档、受审内容版本和版权证据，再生成真实对象版本、字节校验、字幕与处理结果。旧 B3 113 条以及共享本地库 100 条媒体元数据不能经状态字符串或散列格式修饰后冒充这些事实。[本地媒体完整性复核](media-object-integrity.md)和[来源追溯](b3-published-data-provenance-review.md)给出进一步禁区。此轮未提出任何批量改库操作。
