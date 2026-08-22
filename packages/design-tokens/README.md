# design-tokens

框架无关的语学星设计令牌运行时。`designTokens.color`、`radius`、`breakpoint` 和
`accessibility` 保留原有 API；新代码优先消费 `atomicTokens`、`semanticTokens`
和主题 CSS 变量。

```ts
import {
  createThemeController,
  getThemeCss,
  designTokens,
} from '@englishflow/design-tokens'

const controller = createThemeController({ initialTheme: 'system' })
const css = getThemeCss(controller.theme, { selector: ':root' })
const primary = designTokens.color.brandPrimary
```

主题模式为 `light`、`dark`、`system` 和 `high-contrast`。包本身不依赖 DOM：Nuxt、Vue Web、
uni-app 和 Element Plus 适配层可把 `getThemeVariableMap` 或 `getThemeCss` 注入各自的运行时。
`createThemeController` 只管理状态、系统偏好、持久化和订阅，不直接修改页面，便于 SSR 首屏使用
同一份初始主题数据，避免 hydration 闪烁。

平台适配器从 `@englishflow/design-tokens/adapters` 引入：`createNuxtThemeAdapter`、`createVueWebThemeAdapter`、`createUniAppThemeAdapter` 和 `createElementPlusThemeAdapter`。四端消费同一套语义 CSS 变量，业务页面不得新增品牌色或状态色硬编码。
