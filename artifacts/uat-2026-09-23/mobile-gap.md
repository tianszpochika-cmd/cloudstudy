# 移动端 H5 验收记录（2026-09-23）

本次运行对象是本机 `127.0.0.1:18183` 的 uni-app H5 开发服务及 `18070` Gateway；不是 Docker 前端镜像、iOS/Android 原生包、iPad 实机或微信小程序。以 Phase 1 四端页面登记册为功能口径。页面渲染、接口可达和学习闭环分开判定。

| 范围 | 实测或修复 | 当前判定 |
| --- | --- | --- |
| 页面与视觉 | 浏览器夹具覆盖 31 个页面 × 5 组视口/主题 = 155 次渲染，页面错误 0；复核 390px 首页亮色/暗色/高对比及课程、阅读截图。截图在 `screenshots/mobile/`，其内容是显式合成夹具。 | 页面壳/基本布局通过；不代表接口或内容可用。 |
| 真实首次登录 | 在本机 IAM 创建一名 `@local.invalid` 合成成人账号；H5 表单登录后原先被 learner 的 `CONSENT_REQUIRED` 403 全局跳到“访问权限”。修复后，同一账号经真实 Gateway 登录进入 `/pages/onboarding/onboarding`，显示出生年份、成人确认、隐私和服务条款、进度与退出入口；390px 截图目视无横向溢出。 | 入口通过；条款同意与后续学习未代替用户操作。 |
| 首次设置数据 | 将预同意状态的 `CONSENT_REQUIRED` 留在引导页处理；同意记录先写 IAM，随后刷新会话，读取 learner owner 当前版本，只补写缺失/改变的 target 与 preferences。修正 IAM 成人 Gate 响应 `status=PASSED/NOT_EVALUATED` 的解析及 refresh 成功后会话状态。分步提交丢失响应后重试不再固定用版本 0；移除客户端传标题/内容码创建“今日任务”的旧调用。 | 两个丢失响应重试行为测试通过；真实同意/目标保存未操作，不能判完整通过。 |
| 密码重置 | 确认请求补齐 IAM 要求的账号、重置凭据和新密码字段，表单做非空/长度检查；浏览器夹具检查确认请求形状。 | 代码与夹具通过；未获取真实重置凭据，运行链路待验。 |
| 课程与今日任务 | 只读课程不再直接把今日任务标完成；今日/首页的任务操作指向课程。真实公开课程目录目前为 0，首日计划没有可靠任务链。 | 功能未通过。 |
| 测评与技能 | 缺失或跳过的测评结果不再呈现为已评分等级；Gateway 定级及五技能规范路由仍有 404，见 `assessment-gap.md`、`skills-gap.md`。 | 阻断。 |
| 媒体清单 | 移动 B11 适配器改按 media owner 的 `assetStatus`、`rightsStatus`、`items` 和签名地址响应解析；拒绝或错误授权不复用旧地址。B11 定向测试 12/12。 | 适配器通过；服务当前签名地址未指向真实 object key，音频播放未通过，见 `media-learning-gap.md`。 |
| 商品展示 | 移动端只读公开 `plans`，不显示内部 `/commerce/skus` 合成货架；新 commerce 服务已把无发布批准的商品从公开目录移除，当前 `plans=0`。 | 安全空态通过；购买链未开放。 |

验证：`pnpm --filter @englishflow/mobile typecheck` 通过；最新 `node scripts/dev/run-node-tests.mjs apps/mobile/tests` 48/48（含 B11 定向 13/13、引导分步重试 2/2）；`pnpm --filter @englishflow/mobile build:h5` 通过。浏览器夹具 `apps/mobile/tests/mobile-experience.e2e.mjs` 为 155/155、0 页面错误；B11 阅读/听力/口语错误态截图见 `screenshots/mobile/b11-ui-after/`。真实新账号通过 Gateway 的 `/iam/permissions` 为 200，预同意 `/learner/profile`、`/learner/targets`、`/learner/preferences` 均为 403 `CONSENT_REQUIRED`，`/onboarding/options` 为 200；这组拒绝是权限边界的预期事实。测试账号已经退出并禁用，6 个会话中活动数为 0。服务重启后 16/16 健康，公开课程与商品目录均为 200 且 0 项。

后续仍需从合法版权与独立审核后的课程开始，接通定级、首日计划、任务完成证据及真实报告；同时在真实设备验证网络切换、麦克风权限、断点恢复、iPad 和小程序降级。不能把 155 次合成渲染计作这些能力的验收通过。
