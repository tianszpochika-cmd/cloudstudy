# 四端 Docker 集中构建记录（2026-09-23）

## 第十五批 Gateway、社群、管理 Web、官网集中构建（22:08 CST）

使用只供 Compose 解析和镜像构建的占位环境 `C:\Temp\cloudstudy-clyunedev-build-batch9.env`，以 `RELEASE_TAG=583ab627-uat-batch15-202609232208` 一次构建 `api-gateway`、`social-service`、`admin-web`、`official-site` 四个镜像，退出码 0，日志为 `C:\Temp\cloudstudy-docker-batch15-build.log`。其余 16 个服务按第十四批原镜像 ID 重标；[逐镜像 ID 证据](docker-isolated-batch15-images.json)确认新建 4 项 ID 改变、复用 16 项 ID 不变，统一标签 20/20 可 inspect。core+full Compose `config --quiet` 通过，私有 override 由受控脚本另行验证。镜像来自持续变化的未提交工作树，标签本身不等于 Git SHA 可重建发布物；私有容器运行与浏览器证据见[隔离报告](docker-isolated-full-runtime.md)。

## 第十四批游戏化服务与三端界面集中构建（20:58 CST）

游戏化 owner 关闭无可信事实的任务/成就/赛季奖励与装扮权益写链，新增统一 503 错误包络，并将六款游戏的关闭状态与 B4 契约对齐；学习 Web/移动端去除角色和成长区的内部编号与伪装备展示，管理 Web 新增 IAM 策略版本只读页、治理页收为安全只读。相关聚焦/服务测试、契约合并/校验/生成检查、三端构建与移动 H5/App/小程序编译均通过。正式奖励、游戏和权限管理正向链仍未完成。

使用仅供构建解析的占位环境和 `RELEASE_TAG=583ab627-uat-batch14-202609232058`，一次构建 `gamification-service`、`learner-web`、`admin-web`、`mobile-h5` 成功，日志为 `C:\Temp\cloudstudy-docker-batch14-build.log`；其余 16 个第十三批镜像按原 ID 重标，同标签 **20/20 镜像 inspect**、core+full Compose `config --quiet` 通过。镜像仍来自持续变化的未提交工作树，不是 Git SHA 单独可重建的正式发布物。私有 Docker 运行与浏览器复测另见[隔离报告](docker-isolated-full-runtime.md)，不能从构建成功外推业务验收。

## 第十三批内容、管理 Web 与移动 H5 合并构建（20:12 CST）

内容服务新增 B3 旧发布行的临时全拒绝读取门禁、双审提交前的 owner 资格重判；管理端禁用无资格双审提交并修正命令字段；移动 H5 修复开发环境 uni API 注入，把无权益证明的角色套装只作为素材预览，移除误导性的保存和装备操作。三项构建来自当前持续变化的未提交工作树，标签不是 Git 提交快照。B3 学习内容和双审正向链仍被可信发布、版权、校验报告及媒体事实阻断。

移动端最终源码的 H5、App、微信小程序三目标编译成功；App 和小程序仅是编译产物，尚无真机运行或人工视觉验收。B4 角色页 H5 合成夹具 6/6、管理端双审按钮 390/1280px 局部浏览器负向检查通过；这些仍非私有 Docker 正向业务证据。

使用仅供构建解析的占位环境和 `RELEASE_TAG=583ab627-uat-batch13-202609232012`，一次构建 `content-service`、`admin-web`、`mobile-h5` 成功，日志为 `C:\Temp\cloudstudy-docker-batch13-build.log`；其余 17 个第十二批镜像按原 ID 重标，core+full Compose `config --quiet` 和同标签 **20/20 镜像 inspect** 通过。此步骤未替换共享或私有容器；真实运行复测另记，不以镜像存在判定功能通过。

## 第十二批移动 H5 与学习 Web 合并构建（19:18 CST）

移动 H5 修复启动时重复跳转异常、生产路由参数二次编码的回读，以及 uni H5 外部装饰图预载；学习 Web 听力页收紧播放授权、版权/版本/有效期校验，缺音频时隐藏无效控件和听写，隐藏字幕时不提前露出片段原文。两端类型检查通过；移动 H5/App/微信小程序目标编译成功，移动适配器聚焦测试 4/4、学习 Web 听力相关聚焦测试 12/12 通过。这些仍是构建/源码证据，真实播放与操作由隔离浏览器另行取证。

使用占位构建环境和 `RELEASE_TAG=583ab627-uat-batch12-202609231918`，仅重建 `mobile-h5` 与 `learner-web` 两个镜像；构建日志为 `C:\Temp\cloudstudy-docker-batch12-build.log`，退出码 0。其余 18 个第十一批镜像按原镜像 ID 重标，core+full Compose `config --quiet` 通过，**同标签 20/20 镜像可 inspect**。此步没有启停共享服务或替换私有容器；运行结果见[隔离容器报告](docker-isolated-full-runtime.md)。

## 第十一批移动 H5 修复镜像（18:58 CST）

第十批私有浏览器发现生产 H5 的全局 `uni` 仅为空对象，导致首页自动重定向时 `navigateTo` 抛错，`request` 也缺失。源码在 H5 初始化前接入已安装的 `@dcloudio/uni-h5` 模块 API，仅在 H5 环境为缺失导航保留受限 hash fallback，并将手机浏览器设备标记修为 H5。移动聚焦测试 **4/4**、TypeScript 检查和 H5/App/微信小程序三目标编译均通过；编译成功不代表原生真机功能通过。

使用占位构建环境和 `RELEASE_TAG=583ab627-uat-batch11-202609231858`，core+full Compose `config --quiet` 通过，`mobile-h5` 镜像构建成功，日志为 `C:\Temp\cloudstudy-docker-batch11-mobile-build.log`。其余 19 个第十批镜像按原镜像 ID 重标，同标签 **20/20 存在**；没有因此重启共享服务或私有容器。第十一批镜像的浏览器运行复测另见[隔离容器报告](docker-isolated-full-runtime.md)，不能仅据镜像存在宣称移动端通过。

## 第十批集中构建（18:41 CST）

标签 `583ab627-uat-batch10-202609231841` 的 core+full Compose `config --quiet` 通过。Gateway、IAM、学习 Web、移动 H5 四镜像在同一批构建成功，其余 16 个第九批镜像重标，**20/20 存在**；构建日志为 `C:\Temp\cloudstudy-docker-batch10-build.log`，占位 env 只用于 Compose 解析/构建。Gateway 包含离线包精确 GET 路由，IAM 包含注册/登录/刷新失败回滚，前端包包含第十批可见空态和提示修复。本机与私有 Docker 真实回归见[第十批记录](batch10-runtime.md)。移动 H5 首页仍发现导航异常，第十批不能作为四端通过镜像。

## 第九批集中构建（17:40–17:50 CST）

标签 `583ab627-uat-batch9-202609231740` 的 core+full Compose `config --quiet` 通过。content-service、admin-web、mobile-h5 三个镜像重新构建成功，分别包含权限前置、发布按钮/中文空态、社群局部失败状态修复；其余 17 个第八批镜像按既有标签重标，现同标签下 20/20 镜像存在。构建日志保存在 `C:\Temp\cloudstudy-docker-batch9-content-admin.log` 与 `C:\Temp\cloudstudy-docker-batch9-mobile.log`，仅用于构建的占位 env 在 `C:\Temp\cloudstudy-clyunedev-build-batch9.env`。标签仍对应持续变化的未提交工作树，不是可由 Git SHA 单独重建的发布物。

本机内容 JAR/移动开发服务的真正运行回归见[第九批](batch9-runtime.md)；Docker 全栈的独立网络/卷运行取证另行记录，不能把这三项镜像构建判作四端业务验收。

## 第八批集中构建与隔离启动（17:03–17:22 CST）

标签 `583ab627-uat-batch8-202609231700` 对应当前**未提交且持续变化**的工作树，不是 Git 提交本身可重现的发布物。构建专用占位环境 `C:\Temp\cloudstudy-clyunedev-build-batch8.env` 只用于 Compose 解析/构建；core + full `config --quiet` 通过，未用于容器运行。集中构建 Gateway、IAM、content、assessment、学习 Web、管理 Web、官网和移动 H5 **8/8 成功**；其余 12 个第七批镜像在确认各自服务源码修改时间早于原镜像创建时间后复用并重标，当前同一标签下 **20/20** 镜像存在。每个新建镜像日志为 `C:\Temp\cloudstudy-docker-batch8-<service>.log`。

四个前端第八批镜像各自以 `--network none`、无宿主机端口短时启动：官网首页 HTTP 200/114586 字节，学习 Web、管理 Web、移动 H5 首页正文分别 647/467/966 字节。临时容器均已停止并由 `--rm` 清理。这只证明入口静态响应，不代表浏览器交互、Gateway/owner 接通或四端完整验收。

17:20 CST 对 content owner 新发现的未授权资源存在性泄漏做了权限前置源码修复，**晚于第八批 content 镜像构建**；源码测试通过，但第八批 content 镜像和本地运行 JAR 均尚未包含这项后续修复。该修复与社群数据回归将合入下一次集中换包。五个既有基础设施容器和本地固定端口进程没有因第八批镜像构建而停止；Docker 应用全栈仍未运行。

## 第七批源码集中构建（16:06 CST）

标签 `583ab627-uat-batch7-202609231510` 对应本机当前带未提交修改的工作树批次，**不是**只含该 Git 提交的可重现发布物。构建专用环境文件位于 `C:\Temp\cloudstudy-clyunedev-build-batch7.env`，只含占位值，未用于容器启动。core + full Compose 的 `config --quiet` 再次通过。

并行整批重试曾因 Maven Central TLS 握手和 Debian 包仓库临时 502 中断；迁移镜像加入三次下载重试后先定向构建成功，随后 19 个应用镜像按服务顺序构建全部成功。现在同一标签下 **20/20** 镜像存在：19 个应用（Gateway、IAM、13 个领域/平台 Java 服务、四个前端）及一次性 `owner-migrator`。每个服务的日志保留在 `C:\Temp\cloudstudy-docker-batch7-<service>.log`，迁移镜像日志为 `C:\Temp\cloudstudy-docker-batch7-migrator-build.log`。工作流安全源码 15:54:50 更新、镜像 15:56:44 建立；管理客服 UI 15:48:24 更新、镜像 16:04:59 建立，均进入本次批量构建。

当前长驻容器仍只有 MySQL、Redis、MinIO、RabbitMQ、Kafka 五个原有基础设施；这批应用镜像未组成全量服务栈运行，也未推送或部署。构建时没有执行新 owner 迁移容器、容器内 Gateway→owner 业务验收、备份恢复或跨端浏览器验收。本机 Java JAR 的实测见[第六批](batch6-runtime.md)与[第七批](batch7-workflow-runtime.md)，不能自动外推到 Docker 容器。

16:25 CST 又对四个**第七批前端镜像**逐一做了短时隔离启动检查：容器不发布宿主机端口、使用 `--network none`，官网 Node `18182/` 返回 HTTP 200、正文 114586 字节；学习 Web、管理 Web、移动 H5 各自 Nginx `8080/` 均返回 HTTP 200。四个临时容器随后停止并由 `--rm` 清理。该检查仅证实镜像入口可启动并提供首页静态内容，未接 Gateway/owner、未测试浏览器交互，也不含 16:07 之后新增的学习 Web/移动通知 UI 修复；下一批应集中重建这两端再复测。

## 较早的首轮镜像

本轮本地源码使用 Compose core + full overlay，标签 `583ab627-work-20260923105121`。构建前用仅作用于当前构建进程的占位环境变量校验 Compose 配置；这些值**没有**用于启动容器。Docker full overlay 已为七个原先可能落入内存实现的服务指定 `v2,local-real` 运行模式。

首轮集中构建产出 17 个镜像后失败：media-service 在 `dependency:go-offline` 拉取 `logback-classic/core 1.5.38` 时 Maven Central TLS 握手中断；并行中的 admin-web 被取消。随后在 Java Dockerfile 的 Maven 步骤加入 BuildKit 依赖缓存，仅定向重建 media-service 和 admin-web；重试命令退出码为 0，media-service Maven 包装阶段 `BUILD SUCCESS`。现同一标签下 `cloudstudy-clyunedev/*` **19/19 镜像存在**，涵盖 Gateway、IAM、13 个领域/平台 Java 服务和四个前端镜像。

本轮未将镜像推送或部署到公网，也未启动全量 Compose。当前 Docker 仍只有 MySQL、Redis、MinIO、RabbitMQ、Kafka 五个基础设施容器；本地固定 HTTP 端口由现有共享进程占用，容器启动还需要真实受控密钥与环境。19 个镜像及构建成功证明可打包，**不证明容器内授权业务、迁移、媒体访问或四端 E2E 通过**。本地长驻进程的运行核查见[最终本地烟测](final-local-runtime-smoke.md)。
