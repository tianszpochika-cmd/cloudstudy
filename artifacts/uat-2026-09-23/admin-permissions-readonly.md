# 管理端策略版本只读子页（2026-09-23）

## 范围与事实源

- 设计页：`PAGE-P1-ADMIN-PERMISSIONS`。原登记册指出管理端没有独立权限路由，角色/权限/策略的完整配置与授权审计存在契约缺口。
- 已有可用子链路：B8 OpenAPI 的 `listB8PolicyVersions` → Gateway `/api/v1/iam/policy-versions` → IAM `IamPolicyControlController.list`，由 IAM `PolicyControlService.list` 校验 `iam.policy.read`，租户来自已验证的服务端会话。
- 新增管理端 `/permissions`，菜单仅对服务端权限快照包含 `iam.policy.read` 的会话可见；页面只读展示 IAM 返回的版本、状态、更新时间、角色绑定、规则与审批状态。没有本地样例记录、角色编辑、授权写入或伪造权限请求头。

## 验证

- `node --test apps/admin-web/tests/b8-policy-readonly.test.mjs`：5/5。覆盖真实 Gateway 路径及游标编码、畸形响应拒绝、无权限/403 清除旧数据、空态与网络失败、加载更多、竞态响应、分页时 401 清除旧数据。
- `pnpm --filter @englishflow/admin-web build`：通过（`vue-tsc` 与 Vite）。现存打包大 chunk 警告未改变。
- 此轮是源码和构建证据；尚未进入隔离 Docker 的授权管理员浏览器操作，不计完整页面 UAT PASS。

## 仍未闭合

- 原设计要求的账号角色/权限配置、授权变更审计与双人审批操作没有完整对外契约和页面；本页只解决策略版本可读性，不代表 `PAGE-P1-ADMIN-PERMISSIONS` 完成。
- `PolicyBootstrapService` 的策略控制权限授予只明确作为本地/测试引导入口；此轮没有获得真实授权管理员会话，不能证明生产账号可读取版本。
- B8 契约给列表读取标记 `iam.policy.version.listed.v1` 审计事件；当前 IAM `list` 代码只做权限校验和存储读取，没有看到该读取审计事实。需由 IAM owner 核对契约与运行实现。
