# 贡献指南

1. 从需求或用户故事开始，避免直接堆 UI。
2. 每个变更保持小而可回滚。
3. 提交前运行格式化、类型检查和相关测试。
4. 新增 AI 行为时，同时新增评测样例和失败降级路径。
5. 不提交密钥、生产数据、未经授权的音频或教材内容。

## 文档与交付规范

- 文档事实源优先级、Phase 1 范围冻结、跨域数据所有权与**文件命名规范**见 [docs/00-vision/document-governance.md](docs/00-vision/document-governance.md)。文档之间出现冲突时，按其中定义的优先级解释。
- 交付前运行文档门禁：`node scripts/check-dod.mjs --json`；`--strict` 会把"仅有说明文件"的警告提升为 Gate 失败。
- 目录索引统一命名 `README.md`；新增文档优先使用英文 kebab-case，且不得与同目录既有风格混用。
- 每条 `CHANGELOG.md` 记录必须包含可追溯标识（任务 ID / ADR / 审核记录）、影响范围、兼容性提示、验证命令、回滚方式与未覆盖事项。
- 任务状态以 [requirements/backlog/v2-phase1-rebaseline/02-编号任务台账.md](requirements/backlog/v2-phase1-rebaseline/02-编号任务台账.md) 为唯一事实源；实现者只能提交到"待验收"，由独立评审核验证据后才标记完成。
