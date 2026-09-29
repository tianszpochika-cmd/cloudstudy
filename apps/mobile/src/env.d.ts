interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_GATEWAY_BASE_URL?: string
  readonly VITE_RUNTIME_MODE?: string
  readonly VITE_MOBILE_API_MODE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'

  const component: DefineComponent
  export default component
}
