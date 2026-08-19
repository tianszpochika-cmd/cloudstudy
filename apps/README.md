# 应用端

| 目录 | 作用 | 建议阶段 |
| --- | --- | --- |
| learner-web | 学习者 Web 应用 | P0 |
| official-site | 官网、SEO、转化落地页 | P0 |
| admin-web | 内容、用户、运营和客服后台 | P0 |
| miniapp-wechat | 微信小程序学习端 | P0 |
| mobile | uni-app 移动端原生配置与打包（iOS/Android/iPad，见 ADR-0004） | P1 |

业务规则不要复制到各端，优先放在 packages/domain 和 packages/api-client。
