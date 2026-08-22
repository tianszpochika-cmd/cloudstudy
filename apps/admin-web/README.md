# @englishflow/admin-web (语学星管理后台)

## 项目定位
- 采用 **Vue 3 + Vite + Element Plus + TypeScript** 构建。
- 面向教研团队、课程审核员、运营人员与财务管理的一站式中台。

## 目录结构
- `src/views/content/`: 课程体系、词汇库、语法库、题库录入与多维标签管理
- `src/views/users/`: 学员档案、学习进度轨迹、未成年人家长关联管理
- `src/views/orders/`: 订阅订单管理、退款处理、交易财务对账
- `src/views/audit/`: 敏感词与学习日志合规审计

## B8 认证边界

- 后台登录、会话恢复、刷新、登出和 403 页面经 Gateway/IAM 适配器完成。
- 菜单与操作权限只消费服务端权限快照；客户端角色头、tenant/owner 字段和本地角色事实不参与授权。
- 真实 OIDC/JWKS、工作负载身份和生产 RBAC/ABAC 运行态仍受 G-IDP/后续测试 Gate 约束。
