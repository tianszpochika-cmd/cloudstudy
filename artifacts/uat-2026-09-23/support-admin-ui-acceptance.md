# 管理端客服工单浏览器验收

本轮使用一次性成年合成 staff 账号，经真实管理端登录、Gateway `18070` 与 admin-ops owner 读取；未回复、处理或修改现有工单。现有 27 条平台工单是本地 owner/UAT 记录，不代表真实用户投诉。仅详情失败、列表空态及 503 使用浏览器网络拦截，图像和证据文件均标注 `controlled`。

| 步骤 | 可观察结果 | 截图或机器证据 |
| --- | --- | --- |
| 成人 Gate、三项同意、只读 staff 授权、管理端登录 | 注册 201；Gate、同意 200；管理端进入 `/support`，真实列表显示“当前已加载 27 条”，第一页 10 条 | [机器结果](support-admin-ui-live.json)、[桌面列表](screenshots/admin-support/list-1440.png) |
| 列表桌面、平板、手机 | 1440/768/390 下文档宽度等于视口；手机表格内可左右滚动，首列详情入口仍可见；无页面级横向溢出或页面异常 | [桌面](screenshots/admin-support/list-1440.png)、[平板](screenshots/admin-support/list-768.png)、[手机](screenshots/admin-support/list-390.png) |
| 脱敏详情 | 三种宽度点击列表引用，真实详情均 HTTP 200；弹窗显示工单引用、分类、优先级、状态、时效、截止时间，且明确历史记录无可读原文；未呈现联系人、支付原文或附件内容 | [桌面详情](screenshots/admin-support/detail-1440.png)、[平板详情](screenshots/admin-support/detail-768.png)、[手机详情](screenshots/admin-support/detail-390.png) |
| 第三页 | 真实授权列表进入第 3 页，显示余下 7 条 | [机器结果](support-admin-ui-live.json) |
| 中文筛选与无匹配 | 输入显示值“学习数据”得到 10 条、分页复位；输入不存在分类得到“没有匹配的工单” | [筛选](screenshots/admin-support/filter-390.png)、[无匹配](screenshots/admin-support/no-matches-390.png) |
| 详情失败 | 浏览器将单条详情请求模拟为 404，弹窗显示“详情暂时不可用”，列表仍可用 | [受控 404](screenshots/admin-support/detail-404-controlled.png) |
| 列表空态 | 浏览器将列表响应模拟为空数组，显示“暂无工单”与 0 条；未改 owner 数据 | [受控空态](screenshots/admin-support/empty-390-controlled.png) |
| 列表错误 | 浏览器将列表响应模拟为 503，显示“客服工单暂时不可用，请刷新重试”与重试入口；未泄露旧列表 | [受控 503](screenshots/admin-support/error-390-controlled.png) |
| 环境清理 | 所有探针账户精确设为 `DISABLED`，有效会话 0；工单 owner 前后 `platform=27`、`local-support-fixture=74`；JWT、密码仅留在进程内存 | [机器结果](support-admin-ui-live.json) |

浏览器检查发现初始页面无详情入口、中文显示值不能用于筛选；已在现有只读页面补详情弹窗、显示值筛选和简短空/错态文案。页面仍只读：服务端旧工单仅保存描述摘要，客服消息、附件审阅、接单/回复/升级/关闭及写审计链不具备可验收条件，`PAGE-P1-ADMIN-SUPPORT` 保持 `PARTIAL`。

最终脚本 `node tests/uat/support-admin-ui-live.mjs` 通过；浏览器 `pageerror=0`。`pnpm --filter @englishflow/admin-web build` 通过（现有打包体积提示不影响本功能）。
