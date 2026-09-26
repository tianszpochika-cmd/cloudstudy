# Phase 1 英语课程候选包

`phase1-english-units.json` 包含 4 个原创成人学习单元（A1 两个、A2 一个、B1 一个），共 24 个条目。每个单元按目标、示例、表达提示、练习、自检与次日复习组织。练习属于自检，不含自动判分、假音频、外部素材或真实个人资料。

运行只读检查：

```powershell
node scripts/content/prepare-phase1-english-units.mjs --check-public
node --test tests/content/phase1-english-units.test.mjs
```

如需给独立编辑和审核人查看 B9 `CREATE_DRAFT` 输入，可将确定性的命令计划写入指定文件：

```powershell
node scripts/content/prepare-phase1-english-units.mjs --write-plan .\phase1-english-draft-plan.json
```

命令计划**不是发布许可**，不要直接批量执行。当前 `B9ContentAdminController.rights()` 会无条件把草稿版权标记为有效，并写入固定的 `local-b31-rights-evidence`；这无法证明原创来源或授权。B9 的请求契约也没有能由服务端核验的版权证据引用。正式进入 owner 数据库前，需要先补齐可核验的版权事实与校验。`ContentVersion.publish()` 和回滚发布已在本次修正为拒绝作者、一级审核者、二级审核者担任发布人；这只证明源码与单测，当前本地运行服务仍需统一部署和复测。随后由不同的人完成教学一审、版权与合规二审、发布确认；脚本拒绝 `--apply`、`--apply-drafts`、`--publish`，不会创建临时账号或伪造审核决定。

2026-09-23 本地 Gateway `GET /api/v1/public/content/catalog` 返回 0 项，本候选包的 4 项均未发布。这个结果只覆盖当前本地运行时，不证明 Docker 发布物或其他环境状态。
