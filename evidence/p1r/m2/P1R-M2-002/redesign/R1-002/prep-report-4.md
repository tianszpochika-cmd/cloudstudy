# R1-002 prep-4 收口包（2026-10-06）

主审状态：PREPARATION_PARTIAL_NOT_READY；本地R1-002仍PLANNED/revision27。此包是准备审查与修正交付，不是产品delivery收据。

## 已完成

保留专用验收库t3g的真实Flyway历史；主审只读复验validate、用户零基线及三项ACTIVE政策。秘密已改工作区外DPAPI加密与受保护NTFS权限，密码改子进程环境注入。准备脚本显式Secure配置、保留JWT issuer，增加精确进程身份和终止确认。主审验证IAM TLS/健康/JWKS并关闭两个遗留自有进程；没有注册或共享写入。

## 尚未完成

Gateway JWKS转发主审实测502，独立JWT取钥客户端信任亦待核；UUID/prn_身份兼容、完整事件样例与Outbox精确文件扩围待签收。实际Set-Cookie、注册201/安全拒绝/事务回滚、受限JWT真实领域403均未执行。不能签READY，不能进入003～005。

## 查阅

- [独立收口报告](reviewer-3-closeout/review.md)
- [本轮输入快照](source-and-inputs-4.json)
- [真实GET、守卫及停止证据](reviewer-3-closeout/runtime-and-cleanup.json)
- [只读验库结果](reviewer-3-closeout/validate/validate-4.json)
- [Outbox待决提案](outbox-proposal-4.md)
- [TC03方案，未执行](tc03-plan-4.json)
- [命令与范围记录](commands-4.log)

## 远程接手

准备工具限定Windows本地验收，需本机受控凭据、测试TLS材料和专用数据库。DPAPI不能跨机器解密；已有jar身份不证明新机器构建产物一致。不要运行rotate或TLS rebuild来“自动恢复”未知共享环境，先按工具源代码确认专用资源、固定端口与来源。历史版本4运行JSON记录的是当时快照；本轮主审结果优先，旧失败保留。

本次远程发布范围仅为此准备包及文档摘要，未包含其他Agent共享未提交的全量计划、官网产品改动或原型改动。
