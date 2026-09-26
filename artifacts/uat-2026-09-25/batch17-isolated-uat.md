# Batch17 四端候选隔离复测（2026-09-25）

## 口径

本轮只替换私有 Compose 项目 `cloudstudy-uat-isolated-3c94b27160` 中的官网、content-service、学习 Web、移动 H5。它有 26 个容器、零宿主机映射端口；[运行快照](docker-isolated-runtime-state-batch17.json)的共享项目指纹未变化。源码检查、构建、匿名页面与拒绝边界均不等于授权业务闭环。56 个 PAGE-P1 家族仍为 **PASS 0 / PARTIAL 29 / BLOCKED 27**。

## 已验证

- 四个候选镜像使用同一 `583ab627-uat-batch17-202609250206` 标签构建并在私有项目替换。部署前核对 content-service 的 Flyway 关闭及私有库 V22 校验值；`mysql-migrate` 与 IAM 未随本次替换启动。发布护栏定向测试 **21/21** 通过。
- [健康探针](docker-isolated-stack-probe-batch17.json)覆盖四端、Gateway、IAM 和 13 个 owner，**19/19** 为 HTTP 200。[HTTPS 浏览器矩阵](docker-isolated-browser-batch17/evidence.json)的 11 项页面和 11 项 Gateway CORS 预检通过，页面脚本错误为 0。
- [官网课程与管理治理专项](docker-isolated-browser-batch17/batch17-public-governance.json)中，中英文公开投影均从 Gateway 返回真实空课程（0 项）；官网课程页在 390/1280px 无横向溢出或脚本错误。管理治理页匿名访问转登录。举报列表匿名 401，处置 POST 在 Gateway 仍为 404。
- [移动 H5 入口](docker-isolated-browser-batch17/mobile-journey-batch17.json)操作登录、注册、重置和失败提示，三个受保护深链“今日、设置、设备”均转登录并保留回跳目标；页面错误为 0。唯一控制台 503 与无效账号登录的预期 IAM 503 对应。该记录没有登录后的设置保存或设备踢出证据。
- [注册拒绝边界](docker-isolated-registration-boundary-batch17.json)三次尝试返回 503，账号 8→8、会话 10→10；[数据库探针](docker-isolated-db-probe-batch17.json)确认 ACTIVE 同意文档为 0、13 个 owner 迁移账本存在。[B3/B9 匿名探针](docker-isolated-b3-b9-anonymous-batch13-batch17.json)继续确认五个 B3 目录在 content owner 为 401、Gateway 为 404。
- [官网完整交互脚本](docker-isolated-browser-batch17/official-interactions/browser-checks.json)在私有 Docker 内通过前五组：词卡、课程搜索与清空、帮助搜索、世界房间和主题/高对比/四级画质。第六组发现移动学习入口指向访问者本机 `127.0.0.1:18183`，因此本次脚本为 **FAIL**；随后已补官网镜像构建参数与针对性检查 **5/5**，仍需下一批镜像运行复测。
- [IAM V17 私有迁移](docker-isolated-iam-v17-batch17.json)在独立全库备份后完成：14 项 canonical 学习者权限绑定到 learner 角色，9 个 ACTIVE learner 账号均无缺项；非 learner/停用账号与受信事件权限未扩权。原 14 个非 IAM 写服务恢复，19/19 就绪探针通过，共享 Docker 指纹未变化。完成态二次核验通过。这只证明权限事实与私有栈恢复，不证明新令牌或社群/成长正向业务操作。
- 本次源码层面完成移动设置的性能自动档恢复、设置/设备跨账号异步响应隔离，以及学习 Web/移动今日不可用态优化；相应类型检查、构建与定向测试通过。上述页面目前仅有匿名 H5 运行证据，登录后的业务动作待合法会话复测。

## 仍未通过

1. **授权正向链路**：IAM 没有正式生效的同意文档，注册与无效账号登录均 503。未取得可用于本轮四端授权浏览器操作的合法新会话，不把空态、HTTP 200 或匿名 401 记为页面 PASS。
2. **真实内容与任务**：公开课程仍为 0，缺版权和审核完成的发布内容；没有可用的计划、首日任务及五技能可信 attempt。`B3ContentJdbcController` 仍因旧行缺少与 canonical 内容版本的可验证绑定而保持不可用，即使补 Gateway 路由也不会产生可学习素材。
3. **路由与管理命令**：五个 B3 目录 Gateway 404；管理治理处置 POST Gateway 404。需要契约、owner 与授权事实一起核对，不能只改代理状态码。
4. **设备与平台**：移动设备页、设置保存、IAM 设备撤销尚无合法登录运行证据；本轮只测 H5，没有原生 App、iPad、小程序、真实麦克风或断网恢复。
5. **IAM V17 业务链**：V17 已在私有库完成迁移与回读验证，但 ACTIVE 法律同意文档仍为 0，不能在本轮签发并操作新的合法学习者会话；14 项权限的数据库事实不等于社群/成长 API 的授权正向链。
6. **通知偏好契约**：当前移动设置向 canonical `PUT /notifications/preferences/{notificationType}/{channel}` 发送旧式简短请求，而 M1-016 契约要求分类、同意版本、勿扰窗口、频率策略及期望版本；notification owner 和持久化表也只支持旧字段。现有跨端开关实测不能证明正式契约闭环，需先迁移 owner 数据模型与分类映射，再更新客户端。
7. **官网跨端移动链接**：Batch17 私有镜像中仍为 loopback 地址，手机访客点击会访问自己的设备而无法进入学习端。源码和镜像构建参数已修，需新镜像替换后再次运行跨端交互矩阵。

后续修复继续批量集成后构建复测；PAGE-P1 状态只有获得相应 owner 事实、操作和恢复证据才调整。
