# Batch18 官网与移动 H5 隔离复测（2026-09-25）

## 范围和结论

本批只在私有 Compose 项目 `cloudstudy-uat-isolated-3c94b27160` 替换官网与移动 H5；IAM 保持已验证的 V17 镜像，其他服务未替换。隔离项目仍为 26 个 Compose 服务、零宿主机映射端口，升级前后共享 Docker 项目指纹一致。[升级助手](../../scripts/runtime/batch18-private-site-promotion.mjs)已完成 `dry-run → preflight → promote → refresh-proxy → readiness → verify`，专项测试 8/8 通过。候选镜像标签同为 `583ab627-uat-batch18-202609250315`；官网镜像 ID 为 `sha256:b0d1d3aec170e032b0587cb6095030b15f88dd74d5e3945f4e45f7ca9eb05537`，移动 H5 为 `sha256:278caaf12ba7193c9055be386dd7293644ff84f6f93bb1eec4f42d39acb745aa`。

这次修复了上一批官网手机学习入口指向访客本机的问题，并复测四端匿名入口。56 个 PAGE-P1 家族的严格业务验收仍为 **PASS 0 / PARTIAL 29 / BLOCKED 27**；页面可访问、交互脚本通过和空数据投影均不能代替授权业务闭环。

## 已验证

- 私有栈官网、学习 Web、管理 Web、移动 H5、Gateway、IAM 与 13 个 owner 的就绪探针 **19/19** 为 HTTP 200。私有 HTTPS 浏览器[四端矩阵](docker-isolated-browser-batch18/evidence.json)的 11 个页面样本及 11 个 Gateway CORS 请求均通过，页面错误和失败请求为 0，390/1280px 样本未见横向溢出。
- 官网[完整交互与布局复测](docker-isolated-browser-batch18/official-interactions-internal-recheck/browser-checks.json)通过 **11/11 交互组、152/152 布局组合、0 页面/控制台错误**。覆盖词卡、搜索/清空、FAQ、世界房间、2D/3D、句子游戏、主题、高对比、四级画质、减弱动效、触摸滚动、旧路由、404、SSR 偏好隔离及公开投影空态。[公开 HTTPS 域名复测](docker-isolated-browser-batch18/official-interactions-public-origin/browser-checks.json)也为同样结果；仅对私有代理的临时自签证书使用浏览器测试容错。
- 官网“免费开始”实际指向 `https://mobile.clyunedev.com/#/pages/register/register`，导航登录指向 `https://mobile.clyunedev.com/#/pages/login/login`，并保留语言、主题与返回路径参数。手机访客不再被引向 `127.0.0.1:18183`。内网初次执行时测试脚本把内部访问地址误当作公开 canonical 地址，[原始失败记录](docker-isolated-browser-batch18/official-interactions/browser-checks.json)已保留；[测试脚本](../../apps/official-site/tests/browser/website-runtime.cjs)现支持独立传入公开 canonical 地址，内网原脚本重跑全通过。
- [移动 H5 旅程](docker-isolated-browser-batch18/mobile-journey-batch18.json)操作登录、注册、重置入口及返回，今日、设置、设备三个匿名深链均回到登录并保留原目标；无页面异常、请求失败或外部 CDN 请求。无效 `.invalid` 账号提交到 Gateway 后 IAM 返回 503，页面显示简短不可用提示；唯一控制台 503 与该预期响应对应。
- [私有库只读数据核查](batch18-private-data-audit.md)确认业务主表基本没有可供正向验收的事实，同时发现 113 条错误标为已发布的 B3 旧素材和两条缺版本/单元关联的词条；前者当前被 owner 门禁挡住，B25 词条存在已认证按 ID 直取的潜在风险。尚未写库下线。
- [截图目录](docker-isolated-browser-batch18/)可复核四端首屏和登录页的桌面/手机布局；这轮截图只支持匿名视觉结论。

## 尚未通过及下一批

1. 私有 IAM 当前 **没有 ACTIVE 的正式同意文档**。注册/登录无法形成新的合法授权会话，不能为跑通测试而伪造批准版本或降低准入。登录后的移动设置、设备、学习和管理动作仍需实际浏览器取证。
2. 官网公开课程投影仍从 Gateway 诚实返回空数据；缺版权、审校、双审与发布完成的真实内容。首日计划、五技能素材及可信 attempt 仍不能完成正向链。
3. B3 语法目录的精确 GET owner 路由与契约已在源码整理，但 legacy 行缺可核验的 canonical 内容版本绑定，owner 仍关闭旧行读取；[Gateway 冻结基线核对](gateway-baseline-reconciliation.md)还有多族未逐项促升的差异，未随本批发布 Gateway/content。
4. 通知偏好的 M1-016 owner/客户端契约仍在修复和审核中，本批未发布 notification。原生 App、iPad、小程序、真实麦克风和断网恢复不在本次 H5 证据内。

下一批继续聚合可审查的 owner、客户端和 Gateway 修复，再构建并做授权业务复测；上述外部正式内容与法律文本需独立取得批准事实。
