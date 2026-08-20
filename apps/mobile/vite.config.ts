import path from 'node:path'
import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'

export default defineConfig({
  resolve: {
    alias: {
      // DCloud's current compiler references an internal Vue symbol that is
      // not part of the public Vue 3.5 runtime export surface. H5/App builds
      // use this narrow adapter; application code continues importing Vue normally.
      vue: path.resolve(__dirname, 'src/compat/vue.ts'),
    },
  },
  plugins: [uni()],
})
