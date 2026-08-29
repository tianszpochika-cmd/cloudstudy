# @englishflow/official-site (语学星官方网站)

面向游客、搜索引擎与移动端扫码用户的公开官网，采用 Vue 3 + Nuxt 3 SSR/SSG。官网只负责品牌、公开课程、价格、下载、SEO 和合规公示，不承载登录后的学习、订单或权益写入。官网只生成受控的自有登录入口，不保存、解析或转发业务 Access Token/Refresh Token。

## 公开路由

- `/`：品牌首屏、学习闭环和公开课程入口
- `/courses`：公开课程目录与筛选
- `/pricing`：公开价格与权益说明；不创建订单
- `/download`：学习 Web 深链与 App/小程序发布状态
- `/about`：产品使命与阶段边界
- `/compliance`：主体、隐私、成人阶段和未成年人保护公示
- `/robots.txt`、`/sitemap.xml`：搜索引擎抓取入口

## 源码边界

- `pages/`：公开页面
- `components/`：`SiteHeader`、`SiteFooter`、`PublicStatus` 与卡片组件
- `layouts/`：官网公共壳
- `server/routes/`：robots 与 sitemap，只输出公开静态信息
- `utils/`：公开内容、公开状态、受控学习端深链、SEO 和 design-token 适配
- `assets/css/`：只消费语义 CSS 变量；变量由现有 `@englishflow/design-tokens` 注入
- `public/`：仅放公开品牌资源

## 本地运行

```bash
pnpm --filter @englishflow/official-site dev
pnpm --filter @englishflow/official-site build
node --test tests/b7/official-site.test.mjs
```

可用环境变量：`NUXT_PUBLIC_SITE_URL`、`NUXT_PUBLIC_LEARNER_WEB_URL`、`NUXT_PUBLIC_DOWNLOAD_ENABLED`。官网源码不读取 `.nuxt/` 或 `.output/` 生成物；这些目录只可能由 Nuxt 构建过程产生，不能作为源码或测试输入。

B13 公开商业投影只允许读取 Gateway 的公开投影接口。价格、SKU、权益、活动和下载状态都以服务端公开字段为准；官网只生成登录/结算意图的受控跳转，不创建订单、不调用支付或权益写接口。外部活动/下载地址必须配置在 `NUXT_PUBLIC_LINK_ORIGINS`（逗号分隔 allowlist）中，来源查询中的 `utm_source`、`utm_medium`、`utm_campaign`、`utm_content`、`utm_term` 会保留到受控深链。

```bash
pnpm --filter @englishflow/official-site test:b13
```
