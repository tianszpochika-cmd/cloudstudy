import type { App } from 'vue'

/**
 * The stock Vue adapter does not invoke DCloud's $applyOptions extension.
 * Complete the page lifecycle once, after setup registered onLoad/onShow.
 * DCloud runtimes that already initialized the page set __isVisible and skip it.
 */
export function installUniPageLifecycle(app: App): void {
  app.mixin({
    beforeMount() {
      const vm = this as unknown as {
        $mpType?: string
        $: { __isVisible?: boolean }
        $options: unknown
        $applyOptions?: (options: unknown, instance: unknown, proxy: unknown) => void
      }
      if (vm.$mpType === 'page' && vm.$.__isVisible !== true) vm.$applyOptions?.(vm.$options, vm.$, vm)
    },
  })
}
