# 独立准备复审返工：发布证据路径脱敏

Luna追加要求：可提交证据不得包含Git外private材料绝对目录；以`<PRIVATE_MATERIAL_DIR>/...`替代，保留摘要/mode/owner验结果，真实执行路径仅在本机Git外配置中保留。普通源码路径与服务归属事实不脱敏。

本轮增加专用`sanitize-evidence.mjs`；它只处理本卡准备证据目录。`prepare.mjs --out`创建TLS证据时自动对归档副本脱敏，stdout及Git外`transport-plan.json`不变；命令与stdout日志另显式归档脱敏，不能靠人工声称安全。工具没有读取私钥内容或秘密环境。

实际检查了三轮材料对应的`commands.json`、`tls-materials*.json`、command logs及全目录JSON/log/Markdown，目录替换为`<PRIVATE_MATERIAL_DIR>`，专用父目录替换为`<PRIVATE_MATERIAL_PARENT>`；publisher/JVMplan路径只在公开archive副本替换。原检查事实、证书hash、UID/mode、exitcode及普通source路径未改变。

终稿定向测试 **11/11 PASS**，新增sanitization不改变原transportPlan/原对象/普通source路径的检查。metadata、新全独立合成TLS/JVMtrust/actualstat与真实Gateway Binder复跑exit0，目录+七文件的owner/type/mode全部PASS。没有业务服务启动/停止或DB操作；两条真实HTTPS链动态证据仍OPEN。

| 当前工具 | 最终SHA256 |
|---|---|
| `prepare.mjs` | bfb9b91f19f7a50c45c53347549ffbe5ea9d9e9148a5da1ff1f409943258c399 |
| `prepare.test.mjs` | 312182dbaded2ebc0d997b4af5e9e1d6f01f8454e50c880db6ad14afe7a5b9b7 |
| `sanitize-evidence.mjs` | cab2eff3544d128b1586e24170fc4e7a26583d8aabcc449b13254eceec275c00 |

`source-and-inputs-before-sanitize.json`保存权限返工阶段；current manifest保存最终源码hash与sanitization阶段beforeAfter。最终证据为`inspect-final.json`、`tls-materials-final.json`、`binding-final.json`、`final-command-1～4.log`、`sanitization.json`。命令中placeholder只标识本机私密输入，不是可复用路径或可执行配置。

状态保持PREPARATION_PARTIAL_NOT_READY；本轮不继续新增D1生命周期实现，不执行D2维护窗口，不批准D3身份草案。
