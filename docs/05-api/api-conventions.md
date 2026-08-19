# API 约定

## 通用规则

- API 版本从 /v1 开始，破坏性变更升级版本。
- JSON 字段使用 camelCase；数据库字段可使用 snake_case。
- 所有请求返回 requestId，错误返回稳定的 errorCode 和用户可理解的 message。
- 写操作支持幂等键；分页使用 cursor 优先。
- 服务端必须校验输入、用户身份、资源归属和操作权限。

## 领域边界

- auth：登录、会话和设备。
- learning：目标、课程进度、今日任务。
- practice：练习提交、答案和反馈。
- review：复习队列、间隔和完成记录。
- assessment：测评和能力画像。
- content：已发布课程和媒体。
- billing：订阅、订单和权益。
- admin：运营后台和审计。

## 事件

事件名称使用 domain.action.vN，事件 payload 必须有 schema、occurredAt、actorId 和 requestId。事件消费要幂等并可重放。
