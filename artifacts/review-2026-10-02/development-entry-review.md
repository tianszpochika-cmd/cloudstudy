# R1 开发入口与后续审批审查

> 审查时间：2026-10-02 23:03–23:08 北京时间。分支 `dev-redesign`，HEAD `3d11be3337accd32afbdbe13a218bca38c786043`。
> 用户已将提示词交给执行 Agent，并指定本聊天主导后续测试审批。本记录检查开发入口与协作边界；没有审批执行 Agent 的代码交付，也没有运行产品测试。

## 结论

可以继续现有实现的复用核查、输入准备和按卡增量改造。当前不能把整个 R1 认定为已经 READY，也不能把用户所述“执行 Agent 已开始”直接换算为状态墙已登记开工。优先补具体卡号、唯一执行人、拟修改范围和开工输入记录；符合新要求的旧代码可以无差量交付，但必须重新提供本卡验证证据。

## 本次观察

- 状态文件现场汇总：114 张卡全部 `PLANNED`，执行人为空；无 READY/IN_PROGRESS/REVIEW/ACCEPTED。此事实只说明记录尚未建立，不能判断执行 Agent 没有工作。
- 根目录仍有前序文档、原型与审批工具的未提交改动。本次观察 `git diff --name-only -- apps services packages config requirements` 无输出；这不能证明外部执行者、其他工作区或其他机器未开发。
- 本机版本读取：Node 20.19.5、pnpm 10.19.0、Java 25.0.4.1、Maven 3.9.9、Docker client/server 29.7.2、Compose 5.4.0。前四项满足记录的对应版本/最低版本，Docker/Compose 高于最低版本；未验证所有工具、依赖解析和运行兼容性。
- `yuxuexing-local` 的 MySQL、Redis、Kafka、MinIO、RabbitMQ 容器由 Docker 报告运行且 healthy。健康标签不证明 owner schema、隔离权限、数据或事件业务链可验收。
- 在本机监听清单中，13306/16379/19092 已监听；本次未观察到 18070/18087/18180/18181/18182/18183 的监听。没有启动或重启任何服务，也没有发起 HTTP/数据库/事件验收。
- 另一个项目的 `qida-dev-tsz-identity-service` 占用 18081，`qida-dev-tsz-mailpit` 的 HTTP UI 占用 18025；两端口也登记在本项目中，分别用于 Phase 2 AI 与可选 SMTP。这是运行资源冲突，不是本项目服务可用的证据。

## 需要处理的事项

### F01：开工与认领记录缺失（当前优先）

证据：[子状态文件](../../docs/06-design/v2-980plus/redesign/dev-plan-R1.status.json:2)、[执行手册](../../docs/06-design/v2-980plus/redesign/execution-handbook.md:7)。

执行者先提交当前卡号、身份、对应 P1R 父认领确认、新旧对照与文件边界。由本聊天核对该卡依赖和适用输入，再记录 READY；执行者随后记录 IN_PROGRESS。准备核查和只读盘点可以继续，不能用口头开始代替开工证据，也不应因缺记录认定 Agent 停工。没有指定任务时不按数字自动串行执行 001…114。

### F02：端口检查可能拦住启动或诱发误停服务（使用相关服务前处理）

证据：[端口登记](../../config/local-ports.json:26)、[可选邮件端口](../../config/local-ports.json:49)、[端口检查范围](../../scripts/check-fixed-ports.mjs:44)、[忙端口退出](../../scripts/check-fixed-ports.mjs:69)、[共享环境规则](../../docs/06-design/v2-980plus/redesign/input-gates.md:30)。

现有检查默认要求全部登记端口空闲，既会遇到其他项目端口占用，也会遇到已运行的本项目基础设施；因此全量入口可能退出，当前未执行该检查，结论来自源码与监听/Docker 清单。先确定本卡实际使用的服务与已有实例身份。必要时使用现有按 service 选择的检查和对应应用启动入口，并分别保留本卡适用输入记录；不能把“只检查部分端口”记成全栈门禁通过。

不得停掉另一个项目或本项目共享容器，不自动换端口。不涉及 Phase 2 AI 或可选 SMTP 的卡可以先处理本卡范围；实际需要这些端口时，交本聊天协调占用，未解决则阻塞该服务。

### F03：Java 接口类型生成仍有接线缺口（涉及契约变更时处理）

证据：[现有生成输出](../../scripts/contracts/generate-contracts.mjs:176)、[输入核验](../../docs/06-design/v2-980plus/redesign/input-gates.md:42)、[R1-080 明确缺口](../../docs/06-design/v2-980plus/redesign/tasks/R1-080.md:279)。

已检查的生成脚本输出 TS/API-client，服务 pom/config 搜索未发现已锁定的 Java OpenAPI generator 接线。Java 25 已安装，不代表 Java DTO 已由契约生成。对应契约卡需补工具版本、输入/输出映射、Maven generate-sources 与编译/漂移验证；已有未变契约的复用与只读核查不因此整包停工。不能把 TS 生成成功作为 Java 类型生成证据。

### F04：真实定级/练习依赖内容与媒体发布资格（学习验收前处理）

证据：[种子前置边界](../../docs/06-design/v2-980plus/redesign/input-gates.md:18)、[内容与媒体](../../docs/06-design/v2-980plus/redesign/input-gates.md:68)、[前置供给可先行](../../docs/06-design/v2-980plus/redesign/dev-plan-R1.md:105)。

明确合成内容来源、版本、权利、媒体回执及作者/L1/L2/发布者四主体。管理界面增量回归在 IT-6，不表示真实内容供给可以等到 IT-6 才准备。当前没有新的该卡输入/运行收据，不能以旧 seed、纯文字听力、TTS 演示或容器 healthy 解锁真实定级/练习。仅缺本卡将生成的 fixture 时，不能反过来要求它开工前已存在。

### F05：计划摘要存在可能误读为共享库重建的措辞（隔离重放前澄清）

证据：[IT-7 摘要](../../docs/06-design/v2-980plus/redesign/dev-plan-R1.md:304)、[本计划明确隔离规则](../../docs/06-design/v2-980plus/redesign/dev-plan-R1.md:368)、[专用 schema 规则](../../docs/06-design/v2-980plus/redesign/input-gates.md:31)。

摘要写“删库重建跑全链”，具体卡与当前输入规范要求专用隔离 schema 和共享数据保护。执行必须服从后者；这句话不构成删除共享库、旧数据或真实用户数据的授权。本轮只记录措辞问题，未修改共享计划。R1-097 的旧内容下线另需精确清单、可恢复备份和单独执行授权，不能按 113+2 数量猜对象。

### F06：静态原型与完整产品范围需要持续区分（每次交付核对）

证据：[正式页面与原型端口](../../docs/06-design/v2-980plus/redesign/input-gates.md:77)、[新增分支边界](../../docs/06-design/v2-980plus/redesign/dev-plan-R1.md:74)、[子卡与父验收](../../docs/06-design/v2-980plus/redesign/execution-handbook.md:59)。

正式功能交付到四个既有 apps 和对应服务；18283 原型只作设计对照。客户端演示角色、storage、样例分数不能替代身份、数据库和业务事实。已有冻结学习规则继续复用，未批准的新分享/离线/补偿分支维持约定边界。R2/R3 不自动扩大本卡；AI/K12 不因轮次名称获得 Phase 1 开放许可。R1 只读卡或子卡 PASS 不提升完整写链、父任务或产品上线状态。

## 本聊天的后续审批入口

用户在每张卡交付后提供卡号与 delivery 收据路径。本聊天核对当前文件差量、复用资产、契约、每步产物、适用测试以及失败/恢复证据，实际复测后记录 ACCEPTED、REWORK 或 BLOCKED。开发者自测、旧套件通过、构建成功及 HTTP 200 均不能替代独立业务审批。状态墙不会自动触发本聊天或自动发消息。

首批交付应包含：卡号与执行人、开工输入、新旧对照、修改/生成文件清单、当前源码摘要、自测证据、运行环境、剩余缺口和限定回退说明。共享未提交文件在开始和交付时分别记录，避免把其他 Agent 的改动计入本卡。

## 本次操作边界

本次仅阅读文件、Git、工具版本、监听与 Docker 元数据，新增这份审查记录；未修改实现、契约、任务卡、状态墙或父台账，未运行构建/测试，未改变服务或数据库。没有审查尚未收到的执行 Agent 交付代码，不把本记录作为产品验收或全量开工批准。
