# R1-002 prep-3 独立准备审查

审查时间：2026-10-05（北京时间）。结论：PREPARATION_RECEIVED_NOT_READY。状态墙保持 revision 27 / R1-002 PLANNED；未写 READY/start/ACCEPTED。

## 已具备的输入

- iam-schema-3/iam-schema-3.json 记录专用库 r1_002_iam_t3g 真实 Flyway migrate/info/validate exit 0、原生历史及 V13 最终结构检查通过。无需再新建验收库。
- tls-preflight-3.cjs:14-23 使用指定 PEM 和 HTTPS 默认证书验证；tls-preflight-3.json 记录 TLSv1.3 authorized=true、health 200、JWKS 成功。本地测试信任链可用于本卡预检，生产 CA 不作为本次准备门槛。
- policy-fixture-3/policy-fixture-3.json 已记录三项政策完整读回和用户五表零基线；不应再沿用“尚未插入”的说法。
- 主审当前只读核对：18087/18070/18090 无监听，Java 进程零残留。未重启服务、未访问 DB、未执行注册或产品测试。

## 剩余问题

1. **秘密处理不符合本组要求。** prepare-iam-schema-3.mjs:47 把明文秘密写入本卡 t3-secrets，:75 把密码放入 Maven 命令行。git check-ignore 未匹配该目录及 TLS 私钥容器，git status 显示未跟踪。Windows 下 mode 0600 不构成已核验的 NTFS ACL 证据。主审未读取秘密值。应采用受控内存/系统凭据存储，禁止明文 JSON 和含秘密 argv；保留库，仅针对本卡资源修正秘密生命周期。
2. **Gateway 路径不可执行。** launcher-3:55 仍把 IAM/JWKS 指向 HTTP 18087，但同端口实际启用 TLS。不能以“生产终止点”解释本地配置冲突。改为自有进程专用 HTTPS 与测试证书信任配置，保持固定端口、JWT issuer/audience，补公开 GET 可达证据。
3. **Secure 与进程停止证据不足。** launcher safeEnv 记录 IAM_REFRESH_COOKIE_SECURE=true，但 start childEnv 未注入该值；该名称也不是明确的 iam.jwt 配置路径。tls-preflight:65-66 只读默认 YAML。应显式覆盖正确属性，将默认值检查与有效配置、READY 后实际 Set-Cookie 检查区分。launcher:85 仅按 pid.json 杀进程，需先核进程身份和创建时间，终止后确认退出和端口释放。
4. **TC03 方案仍有错误预期。** prep-report-3:39、tc03-plan-3.json 仍要求重复账号 409 后删除冲突、同键必得 201。幂等保存的业务拒绝可能合法重放，不能规定这一结果。将业务冲突与真实事务内必要写入失败分开；提交具体故障点、事务边界、前后读回和恢复计划。relay 故障不得改变已提交的注册 201。
5. **Outbox 提案仍待闭合。** prep-report-3:24 已指出裸 UUID 与 prn_ 契约冲突，但未给出保持 JWT/owner/消费映射一致的闭合方案；JdbcAuditFactPort.append 返回 void，未使用 generated-key 返回审计 ID，不能按提案声称 INSERT 返回键。提案 schemaVersion=1.0.0 不符合事件 canonical catalog.json:530-532 的命名式版本 pattern（API meta 版本不可直接代替事件 envelope 版本）。应核对 canonical envelope/payload、实际 audit decision ID 及完整装配/依赖文件清单；原卡四文件范围尚未扩围。
6. **准备快照未固化。** source-and-inputs-3 的 16 个条目中 13 个匹配；tls-preflight-3.cjs、tls-preflight-3.json、launcher-3/launcher-3.json 已变化。报告仍引用旧 PID、未插入 fixture、旧 TLS 表述，inputs 仍引用 policy-fixture-2 而非本轮 fixture。交付新版准备报告与完整哈希快照；失败尝试若原始证据缺失应如实声明，不能仅凭命令表声称独立保留。

## 下一步边界

限定修正准备脚本、安全启动配置、故障方案、Outbox 扩围提案与准备证据。不重新迁移已通过库，不修改产品注册实现、核心身份设计、契约或共享配置；不提交注册 POST，不推进 R1-003～005。可按既有授权短时启动并停止身份核验过的自有准备实例，仅作 TLS/health/JWKS GET 验证。完成新版准备包后，主审再确定源规格扩围及 READY。
