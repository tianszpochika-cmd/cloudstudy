# 语学星官方网站

已按用户确认的官网提案 06 改造 `apps/official-site`，采用 Vue 3、TypeScript、Nuxt SSR。首页、学习内容、学习世界、练习示例、帮助、开放情况与公开说明共 14 类页面、19 个公开内容地址。详细交付与验证见[官网正式实现记录](../../docs/06-design/v2-980plus/official-site-experience-proposal-2026-09-21/implementation/README.md)。

## 本地启动

在仓库根目录运行：

```text
pnpm --filter @englishflow/official-site dev
```

访问 `http://127.0.0.1:18182/`。端口从 `config/local-ports.json` 读取并检查，冲突时退出。设计稿保留在 `18185/official/`。完整后端并非浏览官网、操作示例的前提。

```text
pnpm --filter @englishflow/official-site build
pnpm --filter @englishflow/official-site exec nuxi typecheck
pnpm --filter @englishflow/official-site test:website
node apps/official-site/tests/browser/website-runtime.cjs
```

最后一条需要官网已在 18182 运行，使用仓库现有 Playwright Chromium；报告和截图写入设计目录的 `implementation/`。这里验证官网前端，不执行注册、成人资格校验、学习结算或真实资产写入。

## 公开路由与内容

| 路由 | 内容 |
|---|---|
| `/` | 首页、公开练习、学习世界、FAQ |
| `/courses` | 六类学习方法与组合筛选；展示公开投影中实际存在的课程，并提供空状态与失败重试 |
| `/courses/:id` | 六种静态学习结构介绍，不是课程详情 API 的替代实现 |
| `/world` | 2D / CSS 立体空间、氛围、角色与装扮、两轮拼句 |
| `/method` | 翻词卡、词句理解、复习与重置 |
| `/start` | 学习账号注册与登录状态、公开示例入口及换设备浏览说明 |
| `/help` | 八个常见问题、分类、搜索与分段回答；首页精选其中四个 |
| `/about` | 产品与成人学习定位 |
| `/announcements`、`/compliance` | 既有公开接口返回的公告、公示 |
| `/privacy`、`/terms`、`/minors`、`/status` | 公开说明、成人范围、状态与恢复出口 |
| `/pricing`、`/download` | 301 至 `/start`，保留查询参数 |
| `/robots.txt`、`/sitemap.xml` | 抓取规则与 19 个 canonical 地址 |

当前官网提供无需登录的浏览示例；学习账号注册与登录暂不可用。首期免费为计划安排，开放时间与范围以公告为准；当前不展示未获批的付费套餐或尚未开放的 App 下载。公开课程/公告/公示仍来自 Gateway；无法加载时显示可重试状态。

## 配置

| 环境变量 | 默认值 / 用途 |
|---|---|
| `NUXT_PUBLIC_SITE_URL` | `http://127.0.0.1:18182`，canonical 与换设备地址 |
| `NUXT_PUBLIC_LEARNER_WEB_URL` | `http://127.0.0.1:18180`，电脑学习端 |
| `NUXT_PUBLIC_MOBILE_H5_URL` | `http://127.0.0.1:18183`，手机学习端 |
| `NUXT_PUBLIC_GATEWAY_BASE_URL` | `http://127.0.0.1:18070/api/v1` |
| `NUXT_PUBLIC_PROJECTION_PATH` | `/public/site/projection` |
| `NUXT_PUBLIC_LINK_ORIGINS` | 额外允许的公告/下载来源，逗号分隔 |

官网不接收登录密码，不建立业务会话。`utils/public-links.mjs` 保留学习端注册/登录链接的安全构造，但当前页面不展示这些不可用入口；公开接口只读，每次上游请求超时为 2.5 秒。备案与完整法律文件仍须以正式核实、公示版本为准。

## 共享基础与维护

- 原子色板：`packages/design-tokens/src/official-site.ts`；官网 CSS 适配语义，不影响其他三端。主题支持浅色、深色、跟随系统与高对比。
- UI 文案：`packages/i18n/src/official-site.ts`；当前完整中文 UI，英文资源尚待翻译并回退中文，不在设置中承诺英文界面。英文学习例句保持内容语言；可用共享 i18n 的伪本地化检查。
- 性能：`@englishflow/performance` 提供 Ultra / High / Medium / Performance。页面动效默认开启，顶部不再提供开关，也不继承旧按钮的暂停偏好；轻量减少装饰，省电采用静态 2D，继续尊重系统减少动态效果。
- Nuxt 插件按请求创建主题/语言实例；公开 HTML 使用 SSR，不缓存个性化 HTML。仅 robots 与 sitemap 预渲染，避免不同访问者的主题/语言串用。
- 学习示例是本页内存交互；角色为本地 SVG，空间为 CSS 透视分层。正式 Three.js 模型、账号装扮和游戏结算仍由学习端实现。
