# 本地最终运行只读烟测（2026-09-23 10:59 CST）

本次只访问既有本地 HTTP 入口、读取本地夹具状态和进程/JAR 日志；未重启服务、提交业务请求、读取用户凭据或构建 Docker。以下均为**本机当前进程**证据，不代表公网部署版本。

## 入口和健康

- 15 个服务的 `/actuator/health` 均返回 HTTP 200、`UP`：Gateway、IAM、learner、content、learning、assessment、media、notification、gamification、social、commerce、admin-ops、analytics、workflow、audit。`core-api` 的健康路径是 `/api/v1/health`，返回 HTTP 200、`data.status=UP`；其 `/actuator/health` 为 404，是该旧服务的路径差异。合计 **16/16 既有 Java 进程健康入口可达**。
- 四个本地前端根路径均返回 HTTP 200：学习 Web `18180`、管理 Web `18181`、官网 `18182`、移动 H5 `18183`。这只证明页面入口返回内容，不证明脚本执行、登录、表单或完整业务链路。

## 公开投影和已撤下夹具

- Gateway `/api/v1/public/site/projection?uiLocale=zh-CN` 和 `en-US` 均返回 HTTP 200、`source=CONTENT_SERVICE`；两种语言各有课程 **0**、下载渠道 **3**、公告 **0**、公示 **2**。Gateway `/api/v1/public/content/catalog` 返回 HTTP 200、`items=0`。
- 官网 BFF `/api/public-projection?locale=zh-CN` 返回 HTTP 200、`state=ready`、`stale=false`、`source=gateway`；归一化后仍是课程 0、下载渠道 3、公告 0、公示 2、价格方案 0。0 项是明确空态，不能算课程发布或购买链路通过；3 个下载渠道的安装包真实性没有在本烟测中验证。
- 只读本地 MySQL 聚合查询显示：指定 `local-real-10x-v1` B3 体验 **140 条 UNPUBLISHED**、B2 内容块 **10 条 UNPUBLISHED**；指定站点占位信息 **12 条 UNPUBLISHED**；无有效分片的 `OFFLINE-B4-FOUNDATION` **1 条 DELETED**。三个精确范围脚本的 dry-run 均报告仍可公开的候选数为 0。notification 查询代码排除 `DELETED`；由于离线包列表需要授权，本烟测未以用户身份调用该列表，因此不把数据库状态等同于已完成客户端可见性验收。

## 当前进程字节码

四个服务的监听端口所属 Java 进程均在 2026-09-23 10:37–10:38 CST 启动；其 `-jar` 指向本仓库 `services/*/target`，文件 SHA-256 与本轮隔离构建产物逐字节相同：

| 服务 | 当前运行 JAR SHA-256 |
| --- | --- |
| content `18089` | `6BE05593022319B1891C28A46DE0BAE42419F577D4B8BBC7E0E987086804BB9E` |
| assessment `18091` | `3F913E08FA3BC8F14E05F19E24784C2FE8D445F21F12623EFA9E9C73A60D0652` |
| media `18092` | `71541DE83EDB8DBE7D142043F51FE15D57C1DBD74E7279C1F26AC100A29E01EC` |
| admin-ops `18097` | `30836234C44F6156C9A2E45F1FC39573A2934C0AF776ABDCFC6B870856E109B6` |

共享启动日志还出现新的 assessment 单条汇总告警：跳过 **489** 条无效旧评测行，数据保留且未进入当前评测状态。这证明兼容加载器确实执行；**不**证明真实测评流程、媒体播放或客服结案可用。

## 验收边界

当前结果支持“本地服务和前端入口存活、官网公开空态/投影符合当前发布数据、指定合成占位记录已下线、四个修复版 JAR 正在运行”。授权学习、管理写入、移动端真实交互、媒体对象完整性、离线下载、课程发布及公网镜像版本仍需各自的功能证据；HTTP 200 与空列表不能提升为全功能通过。
