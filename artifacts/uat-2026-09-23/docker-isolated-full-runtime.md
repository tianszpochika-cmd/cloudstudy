# 第九至十五批 Docker 私有全栈运行验收（阶段记录）

记录日期：2026-09-23。项目名 `cloudstudy-uat-isolated-3c94b27160`。此记录只描述**无宿主机发布端口的私有 Docker 项目**；共享的 `yuxuexing-local` 容器、网络、卷及本地 Java/四前端进程未用于本次隔离验收。第九批为初始部署；后续各批只替换明确列出的私有应用容器；第十五批替换 Gateway、社群服务、管理 Web、官网。

## 隔离启动与数据迁移

- 使用第九批标签 `583ab627-uat-batch9-202609231740` 的 20 个镜像、临时随机测试凭据及私钥、单独的 Compose 项目名、内部 bridge 网络和四个新卷。最终 Compose 解析为 26 个服务、**0 个宿主机端口**；owner 密码、MySQL/Redis/MinIO/Kafka 凭据均逐项与本次私有环境文件比对。所有私有凭据只保存在操作系统临时目录，未写入 Git 或测试报告。
- 首次尝试的项目 `cloudstudy-uat-isolated-df5eba1f43` 因迁移前置门槛未满足而停止在基础设施阶段；没有执行迁移。检查项目标签和共享资源指纹后，仅将该首次私有项目的容器、网络和卷移除。
- 第二个项目先对空实例完成可恢复备份，大小 **3,780,440 字节**、SHA-256 `e9738cbd9f39a56d9510f0c39e9d53bd0884f6024ce8adeca3656baf02e24334`，随后才设置迁移门槛并执行 13 个 owner 的只读预检、`mysql-init`、`mysql-migrate`、history/grant 校验和 `minio-init`。三个 one-shot 容器均 exit 0。
- 13 个外部 owner 的迁移账本存在；IAM Flyway 在原第九批镜像下为 15 条成功迁移。账本细项见 [数据库探针](docker-isolated-db-probe.json)。后来单独构建的 IAM 候选镜像包含仓库当前 V16 迁移；不能把原计数当成候选镜像的最终迁移数。
- 当前共有 26 个该项目 Compose 容器：23 个 running、3 个 one-shot exit 0；另有 1 个仅连私有网络的 HTTPS 代理 running。四卷、网络、各容器标签、镜像 ID、无端口发布和共享指纹见 [第十三批运行状态快照](docker-isolated-runtime-state-batch13.json)。第十三批内容服务、管理 Web、移动 H5 镜像 ID 分别为 `sha256:f4ccf798d40abfcd02090b4ac85e33d06dc8e255c3ead701f5ae3ad2fa8f58a7`、`sha256:2971f0a37403a2927e238d82c675778e619489df684d2e81b42138201f2b8f5f`、`sha256:f4396db0b6402e91d581789738a53e969ea9ea7005c1fa9198086c2b2d1d7c8b`，共享指纹 `sharedUnchanged=true`。项目**按协作安排暂时保留**，尚未清理。

## 实际运行范围

| 验证层 | 结果 | 边界 |
| --- | --- | --- |
| 私网 HTTP 探针 | 官网、学习 Web、管理 Web、移动 H5 根页，加 IAM、Gateway、13 个 owner 的 readiness，共 **19/19 HTTP 200**。第九批原镜像与单独 IAM 候选镜像的记录分别见 [原批次](docker-isolated-stack-probe-batch9.json) 和 [候选复测](docker-isolated-stack-probe.json)。 | 仅证明进程和根页，不能推出授权业务功能可用。 |
| Gateway/IAM/owner 匿名链 | Gateway→IAM JWKS 为 HTTP 200、1 个公钥；匿名访问社群房间为 HTTP 401。原第九批 Gateway 注册与直连 IAM 注册均返回 503 `iam.consent.version_unavailable`，无 access token，见 [API 探针](docker-isolated-api-probe.json)。 | 空库未发布正式 ACTIVE 同意文档，这是正确的法务门槛；成人 Gate、授权 owner 读取和完整学习链被阻断。 |
| 私有 HTTPS 浏览器 | 同一内部网络上的 HTTPS 代理和 Chromium 覆盖四端根页的 1280/390 两种宽度及学习/管理/移动登录，共 **11 页 HTTP 200**；Gateway JWKS CORS 11/11 为 200；全部无水平溢出。官网、学习 Web、管理 Web 页面无 browser page error。截图与明细见 [第九批浏览器证据](docker-isolated-browser-batch9/evidence.json)。 | 自签测试证书只在私有浏览器容器中忽略验证；不代表生产证书链。移动 H5 虽返回 200，却出现运行时异常，不能算页面通过。 |
| 移动 H5 运行时 | 根页与登录页均出现 `TypeError: P(...)?.setStorageSync is not a function`，首个堆栈指向 `assets/session.5Mcj2KiO.js:1:8273` 的 `setReturnTo`，经 `assets/pinia.ygb8TPrx.js:1:4534` 与 `assets/index-CK68FPpd.js:2:221425` 触发。另有 DCloud WebTrack.gif 的 DNS 请求失败。 | 私网没有外部 DNS；移动源码修复由主任务负责，本阶段未修改移动端。Docker 只覆盖移动 H5，不覆盖原生 iOS/Android/iPad。 |
| 离线包路径基线 | 第九批 Gateway 对匿名 `GET /api/v1/sync/offline-packages?limit=20` 返回 404，notification owner 内部同路径返回 401，移动 Origin 的 GET OPTIONS 预检返回 403，见 [离线包基线](docker-isolated-offline-gateway-before.json)。 | 待下一批 Gateway 镜像复测路由和预检；授权空列表仍需正式 ACTIVE 同意文档才能取得真实 IAM token。 |

## IAM 注册/登录半提交：发现、修复与回归

原第九批镜像在空库上先返回注册 503，换幂等键重试同一账号却返回 409；当次测试中合成账号 **7→8**、会话 **7→9**，证明法务门槛失败后仍提交了账号和会话。正确密码登录继续返回 503，但还留下会话。修复前原始对照见 [注册边界探针](docker-isolated-registration-boundary.json)。

原因是控制器在 `passwords.register/authenticate`、设备注册、会话建立之后才在令牌资格计算中读取正式同意文档；`IdempotencyService` 把 `POLICY_UNAVAILABLE` 当成可提交的业务拒绝。现在注册、登录、刷新在写入前检查 5 类已发布文档；注册和登录先校验设备输入，`establish` 在持久化设备/会话前算好资格声明。凭证 scope 的 `POLICY_UNAVAILABLE` 在 IAM 事务内抛出以回滚；注册/登录在成功认证后的其他策略失败，以及刷新旋转后资格/令牌失败，也经 rollback wrapper 传出事务，再恢复原策略响应。刷新现有的设备绑定失败撤销分支保持原有语义。

单独构建的候选镜像 `cloudstudy-clyunedev/iam-service:iam-atomic-3c94b27160-20260923` 先只替换了这个私有项目的 IAM 容器。真实 MySQL 复测：直连注册首次、相同幂等键重试、新幂等键重试、已有账号登录、Gateway 注册均为 **503 `iam.consent.version_unavailable` 且无 token**；账号 **9→9**、设备 **10→10**、会话 **10→10**、幂等记录 **11→11**，见 [候选镜像原子性证据](docker-isolated-iam-atomicity-batch9candidate.json)。该候选镜像构建于最后一处刷新 wrapper 源码修改之前；第十批正式 IAM 镜像包含该修改并再次通过相同原子性探针，见 [第十批 IAM 原子性证据](docker-isolated-iam-atomicity.json)。

最新 IAM 源码执行 `mvn -f services/iam-service/pom.xml test -q`：**107 项、0 failure、0 error、22 项可选集成跳过**。另在本私有 Docker 网络中对真实 IAM MySQL 单独执行 opt-in JDBC 回归：在刷新 token 已旋转后模拟同意策略 503，首次事务回滚且 rotation 不变、旧 refresh token 仍可用、幂等 claim 为 0；同一 token 换键重试成功旋转。候选镜像阶段与第十批镜像阶段分别见 [首次刷新回滚](docker-isolated-iam-refresh-rollback-batch9candidate.json)、[第十批刷新回滚](docker-isolated-iam-refresh-rollback.json)。`git diff --check` 通过。

## 第十批四镜像复测

四个私有容器替换为标签 `583ab627-uat-batch10-202609231841`，其余 22 个 Compose 容器不重建。重新执行私网 HTTP 探针仍为 **19/19 HTTP 200**。第十批离线包匿名路径经 Gateway 从 404 变成 401，owner 保持 401；移动 Origin 的 GET OPTIONS 预检从 403 变成 **200**，见 [第十批离线包探针](docker-isolated-offline-gateway-after.json)。正式 ACTIVE 同意文档仍为 0，授权空列表依旧无法以真实 IAM 登录链验证。

首次第十批浏览器复测有移动 H5 三页 502；代理日志证实私有 Nginx 仍缓存旧移动容器 IP，属于测试代理状态，不是新移动镜像自身返回 502。原始错误记录保留为 [代理旧 IP 证据](docker-isolated-browser-batch10-stale-proxy.json)。仅重启私有 HTTPS 代理刷新上游解析后，**11/11 页面 HTTP 200、11/11 JWKS CORS 200、0 水平溢出**。官网、学习 Web、管理 Web、移动登录页均无 pageerror/console error；移动 H5 根页在 1280/390 两种宽度各出现 2 个 `TypeError: t.navigateTo is not a function`，见 [第十批浏览器证据](docker-isolated-browser-batch10/evidence.json)。

移动只读能力探针记录：浏览器从无 hash 的 `/` 自动落到 `#/`，没有点击即于 2026-09-23T10:53:26.294Z 和 10:53:26.324Z 抛错，首栈 `assets/index-BDbXKfp3.js:2:219069`，第二栈经 `assets/pages-home-home.C4ukY-1B.js:1:1154`；登录页 `#/pages/login/login` 的 pageerror/console error 均为 0。两页 `window.uni` 为 object，但 `navigateTo`、`reLaunch`、`redirectTo`、`switchTab`、`addInterceptor`、`getStorageSync`、`request`、`showToast`、`getSystemInfoSync`、`setTabBarStyle`、`getLaunchOptionsSync` 均为 `undefined`，`window.plus=false`；未读取任何存储值或凭证，见 [H5 能力与堆栈](docker-isolated-browser-batch10/mobile-runtime-types-batch10.json)。只读源码指向首页 `onShow → ensureMobilePageAccess → showLogin → relaunchOrNavigate`，缺失 `reLaunch` 后调用同样缺失的 `navigateTo`。该源码修复由主任务处理，本隔离任务未改移动端。

## 第十一批移动 H5 复测

只在本私有项目替换移动 H5 为 `583ab627-uat-batch11-202609231858`，其余服务未替换；重启本私有 HTTPS 代理刷新上游解析。私网根页与 readiness 仍为 **19/19 HTTP 200**；四端 11 页均 HTTP 200、Gateway JWKS CORS **11/11 为 200**、无水平溢出，见 [第十一批浏览器证据](docker-isolated-browser-batch11/evidence.json)。移动根页现在自动转至登录，登录直达页单独加载为 **0 pageerror、0 console error**。根页在 1280/390 两种宽度各有 1 个未处理异常，因此移动首页仍未通过无错误验收。

[移动 H5 API 能力探针](docker-isolated-browser-batch11/mobile-runtime-types-batch11.json) 在根页、登录页分别确认 `navigateTo`、`reLaunch`、`redirectTo`、`switchTab`、`addInterceptor`、`getStorageSync`、`request`、`showToast`、`getSystemInfoSync`、`setTabBarStyle`、`getLaunchOptionsSync` 全为 function，`window.plus=false`；只读类型与布尔值，未读取任何 storage 内容、Cookie 或凭证。根页新异常的 `unhandledrejection` reason 只有 `errMsg: reLaunch:fail`，发生于已跳到 `#/pages/login/login?returnTo=%252Fpages%252Fhome%252Fhome` 后；Playwright pageerror 的 message 为 `Object`、无 stack。`returnTo` 此时双重编码，需下一批复测路由和返回地址。

[第十一批移动交互证据](docker-isolated-browser-batch11/mobile-journey-batch11.json) 覆盖根页自动跳登录、登录→注册→登录→密码重置→登录，五次到达 URL 与页面标题匹配。使用临时生成且不存在的 `.invalid` 账号提交登录，浏览器确实向私有 Gateway 发出 `POST /api/v1/auth/login`，返回 503，页面显示“服务暂时不可用，请稍后重试。”。这与隔离空库无正式 ACTIVE 同意文档的策略门槛一致，不能作为正向登录通过。另在全新无会话浏览器上下文直达受保护的 `#/pages/today/today`，登录页返回地址在 URL 中仍双重编码：`returnTo=%252Fpages%252Ftoday%252Ftoday`，URL 查询解码后还要再解一次才恢复原路径；该深链也出现 1 个同类 pageerror，连同根页共 2 个。交互时两条 console error 分别是该预期 503 资源日志及 `cdn.dcloud.net.cn/img/shadow-grey.png` 的私网外部 DNS 失败；后者与认证服务无关。根页 `reLaunch:fail` 是真实前端未处理拒绝，不能归入预期网络日志。本次脚本只记录响应状态、路径、错误摘要，没有保存虚构账号、密码、请求体或浏览器存储。

## 第十二批移动 H5 与学习 Web 复测

仅在本私有项目将学习 Web、移动 H5 替换为 `583ab627-uat-batch12-202609231918`，Gateway、IAM 和其余容器未替换；刷新本私有 HTTPS 代理。私网根页与 readiness **19/19 HTTP 200**，四端 **11/11 页面 HTTP 200**、JWKS CORS **11/11 HTTP 200**、0 水平溢出、**0 pageerror**，见 [浏览器截图与 JSON](docker-isolated-browser-batch12/evidence.json)。

[移动运行时能力](docker-isolated-browser-batch12/mobile-runtime-types-batch12.json) 确认根页与登录直达页的 11 个已列 uni API 均为 function，均 **0 pageerror、0 console error**。根页自动跳登录；[移动实际交互](docker-isolated-browser-batch12/mobile-journey-batch12.json) 中登录→注册→登录→密码重置→登录五步均到达预期页。全新无会话上下文直达 `#/pages/today/today` 后到登录页，根页和深链两条入口总计 **0 pageerror**；URL 中 `returnTo` 仍双重编码，但两次解码可恢复 `/pages/today/today`，且登录页源码调用 `safeMobileRouteReturnTo`。没有正式 ACTIVE 同意文档，所以本次无法用合法正向登录验证最终跳回深层页面。外部 `cdn.dcloud.net.cn` 请求 **0**、失败请求 **0**。虚构 `.invalid` 账号的登录 POST 仍到 Gateway，返回 503 并有短提示；交互记录的唯一 console error 是这次预期 HTTP 503 的浏览器资源日志。

[学习 Web B11 匿名路由证据](docker-isolated-browser-batch12/learner-b11-anonymous-batch12.json) 覆盖听力、阅读、阅读器、口语、Clips、录音 6 条路径，其中三个主路径另测 390 宽度，共 **9/9 HTTP 200 后转登录**，每条 `redirect` 参数均保留原路径、登录表单均可见；B11 页面渲染数、音视频/练习等受保护控件数、向 Gateway 的 B11 API 请求数均为 **0**，pageerror/console error/水平溢出均为 **0**。登录页的 [1280](docker-isolated-browser-batch12/learner-b11-anonymous-1280-batch12.png) 与 [390](docker-isolated-browser-batch12/learner-b11-anonymous-390-batch12.png) 截图已人工查看。私有空库没有正式 ACTIVE 同意文档，原子性探针生成的测试账号无法合法取得学习会话；**B11 授权空态及隐藏控件的真实账号 E2E 未执行**，匿名门禁通过不等于正向 B11 通过。

## 第十三批内容服务、管理 Web、移动 H5 复测

标签 `583ab627-uat-batch13-202609232012` 的三个新镜像仅替换本私有项目中 `content-service`、`admin-web`、`mobile-h5`；逐项核对其镜像 ID，另 23 个 Compose 容器 ID 不变。私网 **19/19 HTTP 200**；刷新仅私有 HTTPS 代理后，[四端浏览器入口](docker-isolated-browser/evidence.json) **11/11 页面 HTTP 200**、JWKS CORS **11/11 HTTP 200**、0 水平溢出、0 pageerror。[移动运行时](docker-isolated-browser/mobile-runtime-types-batch13.json) 的根页与登录直达页均 0 pageerror/console error；[移动交互](docker-isolated-browser/mobile-journey-batch13.json) 的登录、注册、重置往返和 `today` 无会话深链均可导航，根页/深链 0 pageerror、外部 CDN 请求 0。虚构 `.invalid` 登录请求到私有 Gateway 返回 503 并显示短提示；唯一 console error 是这次预期 503 的浏览器资源日志。`returnTo` 在 URL 中仍双重编码；实际登录后跳回因法律门槛未验。

[B3/B9 私网匿名 API 证据](docker-isolated-b3-b9-anonymous-batch13.json)：内容 owner 的语法、听力、阅读、写作、音标五个 `/internal/v1/content/learner/...` GET 均 **401 UNAUTHENTICATED**；Gateway 对对应五个公开 B3 路径均 **404**、没有返回内容数据，和现有未开放执行路由一致。内容 owner 和 Gateway 的 B9 管理列表 GET、针对不存在内容编码的匿名 `SUBMIT_REVIEW` POST 均 **401**。[管理 `/content` 匿名浏览器证据](docker-isolated-browser/admin-content-anonymous-batch13.json) 在 1280/390 两宽度均转登录，提交双审按钮与管理 API 请求各 0，pageerror/console error/溢出均 0；[390 截图](docker-isolated-browser/admin-content-anonymous-390-batch13.png)已目视检查。

这证明匿名边界，没有证明 **PENDING 草稿的授权 `SUBMIT_REVIEW` 返回 409**，也没有证明登录后“提交双审”按钮对 PENDING 关闭。私有 IAM 没有正式 ACTIVE 法律文档，无法取得合法编辑者会话；本批没有伪造 JWT、发布法律文档或制造版权授权。[本机局部修复证据](admin-review-submit-gate-postfix.md) 的 owner/前端测试和已清理合成草稿的 UI 截图须与此次私有 Docker 匿名证据分开解读。B3 正向授权读取同样未验，旧种子和 PENDING 内容继续保持不可用。第十三批管理内容探针使用固定文件名，后续第十四批复跑曾覆盖其逐视口 JSON 和截图；[第十三批 JSON](docker-isolated-browser/admin-content-anonymous-batch13.json)现只保留从私有状态事件恢复的原始时间与汇总，原逐视口文件不再作为该批视觉证据。

## 第十四批游戏化服务、学习 Web、管理 Web、移动 H5 复测

镜像标签 `583ab627-uat-batch14-202609232058` 仅在本私有项目替换 `gamification-service`、`learner-web`、`admin-web`、`mobile-h5`；逐项核对镜像 ID，另 22 个 Compose 容器 ID 不变。[状态快照](docker-isolated-runtime-state-batch14.json)记录 **26 个私有容器、4 个私有卷、0 宿主机端口**，共享环境指纹不变。私网[健康探针](docker-isolated-stack-probe.json) **19/19 HTTP 200**；刷新仅私有 HTTPS 代理后，[四端浏览器入口](docker-isolated-browser/evidence.json) **11/11 HTTP 200**、JWKS CORS **11/11 HTTP 200**、0 水平溢出、0 pageerror。

[B4 匿名边界](docker-isolated-b4-anonymous-batch14.json)覆盖 owner 和 Gateway 的任务、成就、收藏、角色素材及资料五类读取，以及任务领取和角色资料写入，共 **14/14 返回 401**、未暴露道具数据；这不能证明已登录用户看到真实空态或写入 503。[管理治理/权限匿名浏览器](docker-isolated-browser/admin-governance-permissions-anonymous-batch14.json)在 390/1280px 四次均跳登录，0 受保护视图/API、0 溢出/pageerror/console error；[权限路径 390px 截图](docker-isolated-browser/admin-permissions-anonymous-390-batch14.png)已目视检查。管理内容匿名入口在本批[复测](docker-isolated-browser/admin-content-anonymous-batch14.json)两宽度仍转登录，0 双审按钮/管理 API、0 页面错误。以上均为匿名门禁，不是后台治理或策略配置正向验收。

[移动运行时](docker-isolated-browser/mobile-runtime-types-batch14.json)根页与登录直达页的 11 个关键 uni API 均是 function，0 pageerror/console error。[移动交互](docker-isolated-browser/mobile-journey-batch14.json)登录→注册→登录→重置→登录及无会话 `today` 深链共 6 步可达，根页/深链 0 pageerror、0 外部失败请求；虚构 `.invalid` 账号提交到私有 Gateway 仍返回 503 和简短提示，唯一 console error 是浏览器记录该预期 HTTP 503。`returnTo` 在 URL 中双重编码，脚本解码两次可还原目标，但正式登录后跳回仍未验证。[学习 Web B11 匿名路由](docker-isolated-browser/learner-b11-anonymous-batch14.json) 9/9 返回 200 后转登录，0 受保护控件/API、0 页面错误。

第十四批也通过服务层 MockMvc 验证 B4 无事实写入的 503 包络和零 JDBC；该测试不等于私有 Docker 的授权 HTTP 503。IAM 缺正式 ACTIVE 同意文件，B4 任务领取/装扮装备、管理 `/permissions` 策略列表、`/governance` 举报队列及 B3/B9 正向链均没有合法授权会话实测。旧 JSON 被保留但本批 owner 源码不再将其当作获得事实；恢复功能仍需可信事件、版权/目录、权益账本和正式审批。

## 第十五批 Gateway、社群服务、管理 Web、官网复测

标签 `583ab627-uat-batch15-202609232208` 的四个新镜像只替换本私有项目 `api-gateway`、`social-service`、`admin-web`、`official-site`。[20 项镜像 ID](docker-isolated-batch15-images.json)和[替换前后 26 个容器 ID](docker-isolated-batch15-replacement.json)确认目标 **4 个容器及镜像 ID 改变**、其他 **22 个 Compose 容器及镜像 ID 不变**。最终 core+full+私有 override 解析为 26 个服务、20 个已存在镜像、**0 个宿主机端口**；私有社群游标密钥与私有环境文件逐值匹配且未写入报告，官网服务端 BFF 地址固定为容器内 `http://api-gateway:18070/api/v1`。私有项目有 4 个独立卷、23 个运行容器和 3 个成功退出的一次性容器，代理仍在私有网络。[最终状态快照](docker-isolated-runtime-state-batch15.json)含容器/镜像完整 ID 和共享 `yuxuexing-local` **容器及网络**指纹 SHA-256 `569d30013daff715f02546488d6dfbb449e81b4b009de0154bdbb22ed1545b2b`；替换前后共享指纹一致。

[私网健康探针](docker-isolated-stack-probe-batch15.json)为 **19/19 HTTP 200**。刷新仅私有 HTTPS 代理后，[四端浏览器入口](docker-isolated-browser-batch15/evidence.json)为 **11/11 页面 HTTP 200、11/11 Gateway JWKS CORS 200、0 控制台/页面错误、0 失败请求、0 水平溢出**。这证明匿名入口加载与基本响应式，不证明登录后业务链。第十四批通用浏览器及健康 JSON 已另存至 `docker-isolated-browser-batch14/`、`docker-isolated-stack-probe-batch14.json`，未被第十五批覆盖。

[官网公开投影及管理治理 JSON](docker-isolated-browser-batch15/batch15-public-governance.json)显示 `zh-CN`/`en-US` BFF 均 HTTP 200、`state=empty`、`source=gateway`、`stale=false`、`errorCode=null`、公开课程 0，`x-public-projection-commerce=gateway`，完整空态响应的共享缓存为 60 秒。官网 `/courses` 的 [1280px](docker-isolated-browser-batch15/official-courses-1280-batch15.png)和[390px](docker-isolated-browser-batch15/official-courses-390-batch15.png) 截图已目视检查：六张“学习方式”介绍卡与“暂时没有公开内容”的课程空态分开呈现，无错误横幅、错位、溢出或冗长报错。公开课程为 0 是当前空库事实，不能把介绍卡当作已发布课程。

管理 `/governance` 的 [1280px](docker-isolated-browser-batch15/admin-governance-anonymous-1280-batch15.png)和[390px](docker-isolated-browser-batch15/admin-governance-anonymous-390-batch15.png) 截图显示匿名进入登录页并保留 `/governance` 返回地址，0 治理 API 请求、0 控制台/页面错误或溢出；两种宽度没有可见布局漂移，登录提示简短。[治理和权限路由匿名检查](docker-isolated-browser-batch15/admin-governance-permissions-anonymous-batch15.json) 4/4 转登录，0 受保护视图和 API。私网 API 边界中，Gateway 举报队列 GET 匿名为 **401 `AUTH_REQUIRED`**，社群 owner 同路径 GET/命令 POST 匿名各为 **401 `UNAUTHENTICATED`**。Gateway 命令 POST 匿名为 **404 `NOT_FOUND`**：Gateway 当前只有举报队列 GET 的可执行投影，命令 POST 虽在契约及社群 owner 中存在，却尚无 Gateway 执行路由；外部错误码由 Gateway 包络规范化。这是后续合法授权管理操作的路由缺口，不能误判成命令权限通过。

私有库仍无正式 ACTIVE 同意文档，不能取得合法管理员或学习者会话。本批没有伪造文档、Token、举报事实或审批数据；**B12 授权分页、加密游标、治理命令及四端登录后 E2E 未验**。私有项目按主任务要求继续保留，不执行 cleanup。

## 当前验收结论与后续动作

本次已证明**隔离全栈可启动**、私网 19/19 健康、匿名 Gateway→IAM JWKS/401 链、四端入口的私有 HTTPS 加载，以及 IAM 空库失败原子性修复。第十批补上 Gateway 离线包路由和移动 GET CORS 预检。第十二批起移动根页/深链的运行时错误及外部 CDN 请求已消除，登录/注册/重置导航可操作，登录请求能到达 Gateway；学习 Web B11 匿名门禁按预期工作。第十三批 B3 五类内部读取与 B9 管理命令对匿名请求拒绝；第十四批 B4 的 14 条匿名读写也拒绝，新增管理治理/权限页匿名入口无泄漏；第十五批官网 BFF 恢复容器内 Gateway 公开空态，B12 举报 GET 匿名拒绝，同时识别命令 POST 的 Gateway 执行路由缺口。**四端授权业务 E2E 仍为 BLOCKED**：空库没有正式发布的 ACTIVE 同意文档，不能用 `localCandidate` 测试稿冒充法律版本；移动深链跳回、B11/B4 授权空态、B3 正向内容读取、B9 PENDING 409、B12 授权治理及后台策略列表仍缺合法会话实测。公开页面 HTTP 200、浏览器入口截图或 Java 单测都不能替代登录后的真实业务验收。

私有项目按协作安排暂留，供主任务复核；建议复核镜像 ID、匿名边界和法务阻断后，再执行已有 cleanup 护栏，仅移除 `cloudstudy-uat-isolated-3c94b27160` 容器、代理、网络与四卷，并保存清理后共享指纹证明。复跑脚本为 [uat-isolated-compose.mjs](../../scripts/runtime/uat-isolated-compose.mjs)、[uat-isolated-browser.cjs](../../scripts/runtime/uat-isolated-browser.cjs)、[uat-isolated-mobile-runtime.cjs](../../scripts/runtime/uat-isolated-mobile-runtime.cjs)、[uat-isolated-mobile-journey.cjs](../../scripts/runtime/uat-isolated-mobile-journey.cjs)、[uat-isolated-learner-b11-anonymous.cjs](../../scripts/runtime/uat-isolated-learner-b11-anonymous.cjs) 与 [uat-isolated-admin-content-anonymous.cjs](../../scripts/runtime/uat-isolated-admin-content-anonymous.cjs)。
