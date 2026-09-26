# Batch24 私有 HTTPS 浏览器证据

`probe-batch24.cjs` 在固定私有 Compose 网络中的临时 Chromium 容器执行；`evidence.json` 记录逐项浏览器结果，`summary.json` 是汇总，同目录 PNG 是实际页面截图。探针只访问公开入口。四项已知认证失败提示通过浏览器拦截合成 503 响应，未提交到 IAM；测试账号与密码只在本地页面及拦截请求中使用，没有数据库写入。

首次探针用原生 `<input>` 属性寻找移动 uni-app H5 字段，因属性由组件放在包裹层而出现两项脚本选择器失败；`inspect-mobile-inputs.cjs` 用于确认实际 DOM。最终探针改为按移动表单字段顺序定位后完整重跑，最终结果见 `summary.json`。首次失败是探针定位问题，不计为产品功能失败；也不将最终浏览器绿灯视为登录、注册或改密成功。

发布、数据事实与业务边界见[Batch24 报告](../batch24-isolated-uat.md)。
