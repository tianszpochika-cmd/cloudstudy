# R1-002 D1 离线生命周期与双client harness任务

基线：`dev-redesign` / `2ffa2eb2794b32e9f51ee7a1ac5ac4834ec5b7fb`。本轮主审仅授权D1具名离线实施；D2维护窗口、D3身份方案、READY与业务开工没有获批。执行：Sol high；独立复核：待Luna max。本规格不是旧canonical/workflow状态迁移。

## 源码owner与清单

本执行进程只写 `scripts/redesign/r1-002/lifecycle.mjs`、`lifecycle.test.mjs`、`tls-harness.mjs`、`GatewayTlsProbe.java`、`README.md`，及本证据目录。`receipt.mjs`、`process-identity.mjs`及其tests归baseline_recovery执行进程；本模块消费其具名exports，不自造第二身份守卫。不改原prepare、共享progress/changelog、旧证据、服务、契约或通用runner，不提交推送。

## 授权动作与必拒绝边界

本轮只默认preflight、离线stage、编译当前Gateway JAR依赖的Probe、配置/负例测试。预检查使用只读端口归属；不绑定端口，不停止现有服务、不访问DB/Flyway/Kafka、不注册或签发AccessToken。Git外新runartifact独立创建，不覆盖target或旧材料；材料与签名秘密始终Git外，归档路径脱敏。macOS实际验证与Linux/Windows未实跑事实分别记录。

CLI仅 `preflight / stage / launch-harness / probe / stop-owned / restore-verify`，无任意exec、adopt、kill-port或kill-all。未来D2入口必须先检查独立根审窗口签名/有效期、source/artifact/ports绑定、材料实际权限、已登记固定端口空闲；不得用boolean批准flag自授权。没有可信维护批准收据时拒绝，0signal/0listener/0DB。macOS独立CLI没有不可复用process handle时stop拒绝；仅本监督进程拥有child handle且签名receipt/出生事实匹配的toy/harness可进入共享guard。

本轮动态矩阵TLS-01～08全部 `NOT_EXECUTED`；拒绝负例和离线编译不能称TLS动态通过。未来synthetic publisher仅18087的GET health/JWKS，生产SCG/JWKS probe仅18070，明确 `IAM_BUSINESS_RUNTIME=false`；不冒充真实IAM、JWT验签或业务E2E。

## 卡与需求追溯

沿R1-002 / BC-002 / IC-052，owner IAM（认证/JWKS事实）、Gateway（route与独立JWT public key client）、平台运行维护owner（窗口/恢复）、learner-service（身份投影只保留缺口，未实施）。数据owner仍IAM，harness零领域数据写入。

| 维度 | 来源与本轮作用 |
|---|---|
| FEAT / PRD-ATOM / V2-980 | FEAT-USR-001 / PRD-ATOM-1044 / V2-980-0359、0366；仅注册前TLS与受控准备工具 |
| ARCH | ARCH-GW / IAM / SEC / DATA / EVT / REL / OBS；两client独立信任、固定端口、签名/进程身份与可恢复边界 |
| ACT / JNY / PAGE | ACT-P1-VISITOR / LEARNER / SYSTEM；JNY-P1-01；PAGE-P1-AUTH-*；无页面业务变更 |
| RULE | Phase1成人Gate、默认拒绝、07§3.1身份规则；本轮不修改UUID/prn_、JWTsub、PEP与阶段策略 |
| INT / E2E | INT-P1-001/002/017、E2E-INT-P1-001/002/017；只保留追溯，TLS矩阵与业务E2E未执行 |

来源：[R1计划](../../../../../docs/06-design/v2-980plus/redesign/dev-plan-R1.md)、[D1/D2/D3计划](../../R1-002-next-round-plan/execution-plan.md)、[前轮限定终审](../../orchestrator-review/final-scope-review.md)。原114墙/原001独立验收/干净库仍缺；准备通过不解除26治理FAIL/61skip快照、不开003～005或IT-2、不发布百分比。

## 交付与定向验证

测试覆盖未知mode/run、越目录/symlink、缺签名/改签名、artifact漂移、source绑定、端口占用、未批准/过期窗口、危险TLS降级、材料权限、跨CLI processguard拒绝。fixture只表示模拟输入；允许不监听Node toy child验证共享handle守卫，不停止现服务。源码/输入/编译依赖与公开class来源用SHA-256绑定；记录命令退出码、实际平台、未验证项与动态OPEN。新增测试文件必须先具名申请；当前所有harness配置测试放入已批准 `lifecycle.test.mjs`。
