# 管理端官网风格 UI/UX 改造 · 2026-09-22

本轮已实施到 `apps/admin-web` 的正式 Vue 3 + Element Plus 页面。覆盖现有 12 个业务工作区、登录和无权访问页，共 14 个页面；不是新增独立演示应用。当前结论为 **UI 改造可检查，真实后台联调待验证**。没有据此修改 P1R 状态、Evidence manifest、发布门禁或公网部署。

- [全部页面截图预览](index.html)
- [浏览器交互与布局结果](ui-validation.json)
- [编辑器未保存保护结果](editor-validation.json)
- [基础对比度与键盘检查](accessibility-validation.json)
- [订单权限、错误隔离与退款补充检查](commerce-validation.json)
- 正式本地入口：<http://127.0.0.1:18181/login>

截图中的登录后数据来自浏览器自动化独立拦截的 `UI-*` 合成记录。正式应用没有演示账号、假会话或默认业务数据。真实 Gateway `127.0.0.1:18070` 本轮探测不可达，不能以截图证明真实登录、服务侧权限、双审发布、退款、恢复或审计落库。

## 设计与页面覆盖

复用官网的深紫色、冷白底色、圆角、卡片层次和留白；后台使用适合连续工作的紧凑表格与表单。共享语义 Token 位于 `packages/design-tokens/src/admin.ts`，复用官网色板，不改变官网或学习端的配色入口。公共文案来自 `packages/i18n/src/admin-experience.ts`，UI 语言继续与学习语言分离。

| 页面 | 本次调整 |
| --- | --- |
| 登录 `/login` | 品牌故事与表单分区、账号与密码标签、密码显示、大写锁定提示、缺项聚焦、提交状态、失败保留账号并清空密码、登录后返回可访问页面 |
| 工作台 `/dashboard` | 品牌欢迎区、真实读取的指标状态、按权限显示的常用入口与全部入口；读取失败显示不可用，不制造零数据 |
| 内容与双审 `/content` | 内容库、编辑、审核、回滚四个标签；搜索、明确新建草稿、未保存离开保护、刷新保留编辑值、写入防重复和危险操作确认 |
| 词汇管理 `/lexemes` | 语言/词包/状态筛选与重置、编辑表单分区、审核权限状态、保存中状态、取消/关窗/离开时保护未保存修改 |
| 题目与练习 `/items` | 筛选与重置、游标加载更多、字段校验、符合实际解析格式的双行 JSONL 示例、导入与保存防重复、编辑保护 |
| 音标资料库 `/phonetics` | 统一页面头、语言切换、音素与最小对立词表格、加载/失败状态 |
| 学员工作台 `/learners` | 记录分组展示替代整块 JSON；检索、目标与偏好代管、计划/测评/复习记录保持原接口；保存与读取反馈 |
| 订单与退款 `/commerce` | 当前列表搜索与分页、订单行选取、金额缺失显示、错误重试；订单与工单/指标独立读取，附属摘要按权限展示、工单限 5 条并提供完整页面入口；订单或原因变化即作废旧确认令牌，提交中禁止修改确认依据 |
| 客服工单 `/support` | 当前列表筛选与分页、失败重试、受控处理状态；已结束工单避免重复解决操作 |
| 社群治理 `/governance` | 统一工作区层次、可读字段标题，保留原受控举报处置和恢复命令 |
| 审计记录 `/audit` | 当前列表搜索与分页、脱敏导出状态、失败与真实空记录分离 |
| 发布与质量 `/release` | 重排历史构建与检查信息；明确历史基线的范围，避免误读为当前生产发布或实时监控结果 |
| 人工恢复 `/recovery` | 申请、审批、执行步骤与权限反馈，必填校验、刷新和加载/错误状态 |
| 无权访问 `/forbidden` | 清晰原因、刷新权限、切换账号；避免已登录用户反复跳转登录页 |

全局补齐此前导航未列出的词汇、题目、音标与学员入口；分为工作空间、内容与教研、运营与服务、质量与安全四组。功能搜索支持 Ctrl/Cmd+K，只搜索该账号有权访问的页面。小屏使用抽屉导航，表格保留可横向滚动的完整字段，固定操作列不再遮挡内容。浅色、深色、跟随系统、高对比主题可持久化；接入共享四级性能引擎，尊重系统减少动态效果及 Performance 模式。

定时排期补齐读取失败、未来时间校验、无可排期对象提示和防重复提交；行内音频波形使用共享颜色。所有领域操作继续由既有 API、权限快照、服务侧策略和状态版本负责。

## 需求与架构追溯

这次属于现有 P1R 页面任务的 UI/UX 补强，不新增后端任务或范围计数。

- 主要归属：`P1R-M3-001`；关联 `P1R-M3-009`、`P1R-M6-006`、`P1R-M6-009`、`P1R-M7-009`。本轮浏览器检查可供 `P1R-M8-007/008` 后续验收使用，但不能替代其完整 Gate。
- 功能登记：`FEAT-ADM-001 / V2-980-0493` 词汇编辑，`FEAT-ADM-003 / V2-980-0495` 题库与导入；其 PRD 来源为 §20.1。页面其他功能继续沿用 [980 功能登记册](../08-980plus-功能点设计登记册.md) 和 [后台设计](../04-Phase1-成长社群商业后台功能设计.md)，没有为本轮重编号 PRD-ATOM。
- 参与者：`ACT-P1-CONTENT-EDITOR`、`ACT-P1-REVIEWER-L1/L2`、`ACT-P1-RELEASE-OPERATOR`、`ACT-P1-FINANCE`、`ACT-P1-SUPPORT`、`ACT-P1-AUDITOR`、`ACT-P1-PLATFORM-ADMIN`。
- 旅程与页面：`JNY-P1-13/14`；`PAGE-P1-ADMIN-LOGIN/DASHBOARD/CONTENT/REVIEW/PUBLISH-ROLLBACK/COMMERCE/SUPPORT/GOVERNANCE/AUDIT`。后增词汇/题目/音标/学员页回指现有单租户直营 B1/B2/B3/B4 文档，未声称补齐全部 canonical 页面。
- 规则依据：[后台业务流程](../phase1-business-operation/05-后台内容运营与客服业务流程.md) §2 职责分离、§3.2 状态机、§3.3 导入、§3.6 双审、§3.7.1 排期、§3.8 回滚、§5.4 退款、§6 客服。无学习 `RULE-P1-*` 算法变更。
- 联调与验收关联：`INT-P1-005/011/012`；`E2E-P1-CONTENT-PUBLISH/SUPPORT/RECOVERY`。这里只验证客户端交互，不宣称这些跨服务 E2E PASS。
- 架构约束：`ARCH-IAM-002` 服务侧授权、`ARCH-OBS-001` 审计边界、`ARCH-SEC-001` 凭证边界；无 OpenAPI、数据库 schema、事件或服务 owner 变更。

## 验证与复现

| 检查 | 本轮结果及范围 |
| --- | --- |
| `pnpm --filter @englishflow/admin-web build` | PASS，包含 vue-tsc 与 Vite 生产构建；仍有 Element Plus 主包体积与既有混合导入警告 |
| `pnpm --filter @englishflow/design-tokens typecheck` | PASS |
| `pnpm --filter @englishflow/i18n typecheck` | 早期复核曾被并行 `learner-experience.ts` 重复属性阻断；三端统一提交前已修复并重新 PASS，管理端 build 也复核 PASS |
| 管理端 B12/B13 与共享基础/B18 定向检查 | 5 PASS、3 不匹配项跳过、0 FAIL |
| 主浏览器检查 | 25 PASS，包含交互、权限拒绝、接口失败、断网、主题、减少动效、手机导航与表格可滚动；无浏览器脚本错误 |
| 布局矩阵 | 登录后 13 路由 × 4 宽度 × 3 主题 = 156；真实登录页 12；共 168 组无页面横向溢出 |
| 订单页补充复核 | 4 PASS：附属接口失败不阻断订单、订单专属账号不请求无权附属数据、摘要限量/已结束工单防重复、退款确认失效；改动后另复核 4 个视口 PASS |
| 编辑保护 | 词汇、题目两个编辑器继续编辑/放弃修改均 PASS |
| 基础可访问性 | 15 组核心文本 Token 对比度 ≥4.5:1，系统主题明暗切换、登录字段 Tab 与密码按钮键盘操作 PASS；不是完整 WCAG 审计 |
| 真实 Gateway | 本轮不可达；真实认证、领域写入与持久化未运行 |

浏览器环境为 Windows 上 Playwright 驱动的 Edge。320/390/820/1440 为模拟视口，不代表真实 iPad 或手机设备测试。主检查里的功能测试使用浏览器专用 API 拦截，真实不可用登录检查使用另一未拦截的浏览器上下文。

```powershell
# 使用既有固定端口，不自动改端口
pnpm --filter @englishflow/admin-web dev
node scripts/runtime/admin-ui-experience-check.mjs
node scripts/runtime/admin-ui-experience-check.mjs --editors-only
node scripts/runtime/admin-ui-experience-check.mjs --commerce-only
node scripts/runtime/admin-ui-accessibility-check.mjs
node --test --test-name-pattern="B12|all four|admin-web|B18" tests/b13/b13-frontend-boundaries.test.mjs tests/b18/b18-frontend-matrix.test.mjs apps/admin-web/tests/b12-boundaries.test.mjs
```

曾扩大运行现有 B9/B13 全前端边界检查：9 PASS、2 FAIL。两个失败分别要求旧官网价格卡片、以及假设官网 localStorage 仅出现在旧基础文件；当前官网已有价格重定向与动效偏好实现。这两项不是本轮管理端改动，未修改官网或放宽断言。不能把定向 PASS 描述为整个仓库回归全绿。

## 保留缺口与后续真实联调

1. 内容投影列表没有完整草稿 payload，编辑器会提示核对原稿；本轮修复串用旧值和刷新覆盖问题，但没有发明正文读取契约。完整预览/diff、所见即所得题目编辑和 Excel 导入等原需求仍需独立实现与验收。
2. Dashboard 聚合健康/趋势、客服回复/附件/完整流转、跨服务审计分页/异步导出仍受既有契约和服务能力限制。当前本地搜索与分页仅针对已加载列表。
3. 独立媒体、风控、角色/权限管理页仍是页面登记册中的既有缺口；没有用空页面或客户端授权编辑器伪装完成。
4. 公共导航、登录、基础状态与记录字段纳入共享文案，原有复杂业务字段仍保留中文；法德继续使用已存在的稀疏资源和 fallback，不能声称所有后台业务文案已完整翻译。
5. 下一步用真实 IAM 测试账号覆盖各角色，验证实际内容创建→两次独立审核→发布/排期→审计，以及退款确认失效、人工恢复审批、会话失效和接口异常。需要相应服务和测试数据后才能形成业务 UAT 结论。

工作区存在同时进行的 learner-web/mobile 开发，本轮保留其源码和共享包新增出口。依赖安装一度受到 Windows 锁定二进制影响，已通过隔离安装仅补回缺失文件/链接，未停止其他项目；锁文件的本轮变更仅为管理端新增共享 performance 的 3 行依赖映射。官网 18182 与管理端 18181 实际入口复核正常。现按用户授权纳入[三端统一交付](../frontend-ui-delivery-2026-09-22.md)，包含相关源码与证据；本次不部署。
