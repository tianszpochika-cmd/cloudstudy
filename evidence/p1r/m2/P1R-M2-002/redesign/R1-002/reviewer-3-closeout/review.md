# R1-002 prep-4 独立审查及主审收口（2026-10-06）

结论：**PREPARATION_PARTIAL_NOT_READY**。保持本地状态墙 revision27 / R1-002 PLANNED；不登记 READY/start/ACCEPTED，不提升 P1R 父状态，不进入003～005。

## 提交实际情况

执行 Agent 留下版本4脚本及部分运行结果，未生成最终 prep-report-4/source-and-inputs-4/commands-4，也未闭合 Outbox 身份兼容提案与 TC03。原 config-check-4 如实记录 Secure 未暴露/401与早期Gateway连接失败；后续 start 收据不代表统一复验成功。主审完成版本4准备工具的小范围修正与归档，不替执行 Agent 实现注册业务。

## 本次修正

1. DPAPI CurrentUser 加密库仍在工作区外；补 NTFS 受保护 DACL，仅允许当前用户、SYSTEM、Administrators。私钥容器同步收紧；没有读取或输出秘密值。
2. keytool 使用 `-storepass:env/-keypass:env`；Flyway 使用子进程 FLYWAY_PASSWORD，移除明文临时配置和密码 argv。只读验库改用本卡 runner，不使用共享 root 默认口令。
3. IAM/Gateway 准备脚本恢复原 JWT issuer 标识，与 HTTPS 传输地址分离；显式传入正确 Secure 配置。修正 Actuator 解析，禁止对整份 JSON 搜索 true 冒充选中属性值。
4. 统一进程守卫：核对 PID、完整 jar 路径/哈希、端口及 OS 创建时间；停止后等待同一进程退出并确认端口释放。新收据记录 OS 创建时间；后台包装器复用统一生命周期。
5. 新增校正后的 Outbox 提案与 TC03 方案，保留身份表示和实现扩围待签收事项；不改正式契约、核心设计或注册代码。

## 独立验证

- 版本4准备脚本语法检查通过。
- 受控 DACL 设置及核验通过；DPAPI 元数据存在、秘密独立，不输出值。
- 新 `validate/validate-4.json`：Flyway validate exit0、17条迁移历史、用户五表零基线、三项 ACTIVE 政策均通过（6项）。无 migration、用户注册或共享写入。
- `runtime-and-cleanup.json`：指定测试 CA 且证书验证开启，IAM HTTPS health200、JWKS200；Gateway公开JWKS转发**502**，不记PASS。
- 停止前验证两个遗留自有进程的收据及实际创建时间；14项身份/受控拒绝检查通过。只停止 PID45288（Gateway）及25732（IAM）。18070/18087/18090已释放。
- Secure启动参数确存在；Actuator受保护，未注册取得真实Set-Cookie，所以运行Cookie验收仍未执行。
- 本地计划结构检查通过：114卡、569步、593测试定义；状态工具67/67通过。工具/准备通过不等于注册产品验收。

## 剩余开工条件

- 修复并分别验证 Gateway路由回源与独立JWT JWKS客户端的HTTPS信任；主审本轮实测转发502。
- 签收 UUID/prn_ 的身份兼容方案、完整事件样例及精确 Outbox 实现范围；更新源规格前不得实现。
- 注册TC01～03及真实受限JWT→领域403、Set-Cookie均待READY后实施/验收；不要求准备阶段提前注册以制造PASS。

## 发布边界

本次远程提交只归档R1-002准备工具、必要公开证书、非秘密证据、收口报告与新增文档摘要。前序R1-001产品改动、全量规划/原型及其他共享dirty保留在本地，不在本次提交中；这不是完整产品或全量验收快照。现有状态墙只作本地上下文说明，没有发布或提升其状态。接手机器须重新准备专用库、系统凭据及本地私钥，不复制本机DPAPI文件或target jar。
