import { designTokens } from '@englishflow/design-tokens'

const publicSiteUrl = process.env.NUXT_PUBLIC_SITE_URL || 'http://127.0.0.1:18182'
const learnerWebUrl = process.env.NUXT_PUBLIC_LEARNER_WEB_URL || 'http://127.0.0.1:18180'
const gatewayBaseUrl = process.env.NUXT_PUBLIC_GATEWAY_BASE_URL || 'http://127.0.0.1:18070/api/v1'
const publicProjectionPath = process.env.NUXT_PUBLIC_PROJECTION_PATH || '/public/site/projection'
const publicLinkOrigins = (process.env.NUXT_PUBLIC_LINK_ORIGINS || '').split(',').map((value) => value.trim()).filter(Boolean)

export default defineNuxtConfig({
  compatibilityDate: '2024-04-03',
  devtools: { enabled: false },
  ssr: true,
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    public: {
      siteUrl: publicSiteUrl,
      learnerWebUrl,
      gatewayBaseUrl,
      publicProjectionPath,
      publicLinkOrigins,
      downloadEnabled: process.env.NUXT_PUBLIC_DOWNLOAD_ENABLED !== 'false',
    },
  },
  app: {
    head: {
      htmlAttrs: { lang: 'zh-CN' },
      meta: [
        { name: 'theme-color', content: designTokens.semantic.light.color.action.primary },
        { name: 'format-detection', content: 'telephone=no' },
      ],
      link: [
        { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
      ],
    },
  },
  nitro: {
    prerender: {
      routes: [
        '/',
        '/courses',
        '/pricing',
        '/download',
        '/about',
        '/compliance',
        '/robots.txt',
        '/sitemap.xml',
      ],
    },
  },
})
