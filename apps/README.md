# 应用端

| 目录 | 作用 | 建议阶段 |
| --- | --- | --- |
| mobile | 唯一移动学习端宿主：移动 H5、iOS、Android、iPad；微信小程序由本项目条件编译输出 | P0 |
| learner-web | 学习者 Web 应用 | P0 |
| admin-web | 内容、用户、运营和客服后台 | P0 |
| official-site | 官网、SEO、转化落地页 | P0 |

微信小程序不单列业务项目：仅作为 `apps/mobile` 的 P1.5 条件编译目标；`apps/miniapp-wechat` 仅保留迁移/资源占位，不是第五个业务项目。业务规则不要复制到各端，优先放在 packages/domain 和 packages/api-client。
