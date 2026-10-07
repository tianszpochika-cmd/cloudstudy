# 独立准备复审返工：权限读回（2026-10-07）

Luna要求：`privateMaterialPermissions` 原为硬编码字符串，不能当作实际权限核验；必须读回stat mode/owner，并在不满足0700/0600时拒绝。本轮按主审具名授权只改专项准备工具与必要测试/证据，不改现有服务或业务代码。

## 实际变更

- `assertExternalDirectory` 改为要求当前uid、准确0700，不再仅检查group/world位（0500也拒绝）。Windows仍拒绝用POSIXstat代替DACL。
- `verifyPrivateMaterialPermissions` 用`lstat`逐项检查外部目录与七个生成文件的实际ownerUid、mode、regular-file/directory类型与symlink；只接受本目录本地filename，拒绝路径逃逸。
- 工具在Java消费保护配置前核验一次，生成成功receipt前再次核验；任何不匹配均抛错exit1，不输出PASSreceipt。新receipt回报逐项OS元数据与expected值，不回报文件内容或秘密。
- public测试证书也收紧0600，因此新材料所有文件均按同一目录权限规则核验。
- 新测试用真实文件chmod0640触发拒绝；实际stat metadata与不匹配expectedUID检验owner拒绝，另覆盖symlink/错误type/pathescape/0500目录。没有为了owner测试chown他人资源。

## 重跑

`prepare.mjs`语法exit0；定向tests **10/10 PASS**；metadata/现有PID只读inspect exit0；Git外**全新**TLS合成准备exit0；专用JVM trust/空库拒绝PASS；新structured权限记录目录+七文件全部PASS；当前Gateway JAR真实Binder新prefix/旧prefix负例/insecure=false仍PASS。

权限返工文件：`inspect-review.json`、`tls-materials-review.json`、`binding-review.json`、`review-command-1～4.log`。旧结果保留其检查事实，随后按Luna要求统一脱敏私密路径；`source-and-inputs-pre-review.json`保存返工前hash；`source-and-inputs.json`保存当前hash与各阶段beforeAfter。最新脱敏终稿见`sanitization-review-rework.md`。

| 文件 | 权限返工前SHA256 | 权限返工后、脱敏改动前SHA256 |
|---|---|---|
| `scripts/redesign/r1-002/prepare.mjs` | ba1f0d1197688be270cb085f0e9bd93e1d66ebecf3611458a9446461f72c0778 | fd579fa6bb4bad18885f85a44acdb8f53c6f1b7957a31ff6f14a613e541adc0e |
| `scripts/redesign/r1-002/prepare.test.mjs` | b1b65b4bd1f68db96a495bdddc8b762e63831714057d4e59cb3dca5a7cb7a6b1 | b2da658cab1d0ae947026fe5edaf17c738b3a5d474a289cf2afb7522a30aa508 |

没有停当前15服务runner，没有新HTTPlistener、DB操作或注册。检查的是POSIXowner/mode，不宣称WindowsACL或macOS扩展ACL已经专项验证。两条真实HTTPS握手仍未执行，身份/Outbox待签与准备部分状态保持 **PREPARATION_PARTIAL_NOT_READY**，不签READY。
