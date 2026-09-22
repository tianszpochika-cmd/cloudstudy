import path from 'node:path'
import { createRequire } from 'node:module'
import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'

const require = createRequire(import.meta.url)
const vueRouterPublicEntry = require.resolve('vue-router/dist/vue-router.mjs')

const vueRouterPublicEntryPlugin = {
  name: 'englishflow-vue-router-public-entry',
  enforce: 'pre' as const,
  resolveId(id: string) {
    return id === 'vue-router' ? vueRouterPublicEntry : undefined
  },
}

export default defineConfig({
  optimizeDeps: {
    exclude: ['@englishflow/design-tokens/mobile', '@englishflow/i18n/mobile-experience'],
  },
  resolve: {
    alias: {
      // Resolve Pinia at its real package location so its transitive imports work
      // with uni-app's preserved symlinks on Windows/pnpm.
      pinia: require.resolve('pinia/dist/pinia.mjs'),
      // DCloud's current compiler references an internal Vue symbol that is
      // not part of the public Vue 3.5 runtime export surface. H5/App builds
      // use this narrow adapter; application code continues importing Vue normally.
      vue: path.resolve(__dirname, 'src/compat/vue.ts'),
    },
  },
  plugins: [vueRouterPublicEntryPlugin, uni()],
})
