# i18n

框架无关的 UI 国际化运行时。UI `locale` 和内容/学习语言 `contentLocale` 是两套独立状态：
默认 UI 为 `zh-CN`，默认内容语言为 `en-US`，切换内容语言不会改变界面语言。

```ts
import { createI18n } from '@englishflow/i18n'

const i18n = createI18n({
  messages: {
    'zh-CN': {
      welcome: '你好，{{name}}',
      items: { one: '{{count}} 项', other: '{{count}} 项' },
    },
  },
})

i18n.t('welcome', { name: 'Alex' })
i18n.tp('items', 2)
i18n.setContentLocale('en-US')
```

运行时提供受控 locale fallback、嵌套 key、单/双花括号插值、日期/数字/复数格式化、缺失 key
收集与扫描，以及 `en-XA` 伪本地化。fallback 只能来自请求 locale 的基础语言、显式
`fallbackLocale` 和显式默认 locale，不会把 `contentLocale` 当作 UI 文案来源。

平台适配器从 `@englishflow/i18n/adapters` 引入：`createNuxtI18nAdapter`（SSR 状态序列化与 hydration 前无闪烁）、`createVueWebI18nAdapter`、`createUniAppI18nAdapter` 和 `createElementPlusI18nAdapter`。适配器只管理 UI 语言桥接，不持有权限、租户或学习内容事实。
