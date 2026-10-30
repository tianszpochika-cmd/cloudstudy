# 功能交付工作流 — dev 迭代 2

1. 先读[当前进度](../../docs/06-design/v2-980plus/redesign/CURRENT-PROGRESS.md)、[根交接](../../CURRENT-HANDOFF.md)和[R1 卡计划](../../docs/06-design/v2-980plus/redesign/dev-plan-R1.md)，核对当前卡、依赖和开放 GAP；IT-1 未签出站不进入 IT-2。
2. 补齐该卡 BC/IC、FEAT/PRD-ATOM/V2-980、ARCH、ACT/JNY/PAGE/RULE/INT/E2E、服务及 data owner 映射；旧 P1R 仅作复用与冻结来源，不继承状态。
3. 先在 packages/contracts/ 定义 API/事件，再在 owning service 的数据库迁移中定义数据与种子；不跨服务写表。
4. 在对应 v2 领域服务实现逻辑，经 Gateway 对外；core-api 仅用于有明确迁移/回滚依据的兼容任务，不作为新增业务默认落点。
5. 在对应 apps/ 实现平台交互；原型改动与正式应用分别说明交付范围，遵守 i18n、Token、主题、性能与权限边界。
6. 运行该卡单元/集成测试、当前环境干净库闭环与前端读回，保留失败/跳过、API/数据/事件/恢复证据；不以健康探针代替业务验收。
7. 更新对应卡证据、[唯一进度页](../../docs/06-design/v2-980plus/redesign/CURRENT-PROGRESS.md)、文档和 CHANGELOG；由独立评审签收后升级验收状态，再解锁后续卡或站。
