import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    host: '127.0.0.1',
    port: 18180,
    strictPort: true,
  },
  preview: {
    host: '127.0.0.1',
    port: 18190,
    strictPort: true,
  },
})
