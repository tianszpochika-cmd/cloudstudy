import type { ThemeController, ThemeMode, ThemeState } from './index'

export interface ThemeRootAdapter {
  setAttribute?(name: string, value: string): void
  style?: { setProperty(name: string, value: string): void }
}

export interface ThemeBinding {
  sync(): ThemeState
  dispose(): void
}

export interface NuxtThemeAdapter extends ThemeBinding {
  readonly noFlashScript: string
}

export interface UniAppThemeAdapter extends ThemeBinding {
  readonly variables: Readonly<Record<string, string>>
}

function syncRoot(controller: ThemeController, root: ThemeRootAdapter | undefined): ThemeState {
  const state = controller.state
  root?.setAttribute?.('data-theme', state.resolvedTheme)
  for (const [name, value] of Object.entries(state.variables)) root?.style?.setProperty(name, value)
  return state
}

function bind(controller: ThemeController, root?: ThemeRootAdapter): ThemeBinding {
  const unsubscribe = controller.subscribe(() => syncRoot(controller, root))
  return {
    sync() { return syncRoot(controller, root) },
    dispose() { unsubscribe() },
  }
}

function themeNoFlashScript(controller: ThemeController): string {
  const theme = controller.resolvedTheme
  const variables = JSON.stringify(controller.getVariables()).replaceAll('<', '\\u003c')
  return `(function(){var v=${variables};document.documentElement.dataset.theme=${JSON.stringify(theme)};for(var k in v){document.documentElement.style.setProperty(k,v[k]);}})();`
}

/** Vue Web adapter: binds semantic CSS variables to a root element and persists mode via controller. */
export function createVueWebThemeAdapter(controller: ThemeController, root?: ThemeRootAdapter): ThemeBinding {
  return bind(controller, root)
}

/** Nuxt SSR adapter: exposes a no-flash bootstrap script for app.head. */
export function createNuxtThemeAdapter(controller: ThemeController, root?: ThemeRootAdapter): NuxtThemeAdapter {
  const binding = bind(controller, root)
  return {
    ...binding,
    get noFlashScript() { return themeNoFlashScript(controller) },
  }
}

/** uni-app adapter: returns variables for `:style`/global CSS and still responds to mode changes. */
export function createUniAppThemeAdapter(controller: ThemeController): UniAppThemeAdapter {
  const binding = bind(controller)
  return {
    ...binding,
    get variables() { return controller.getVariables() },
  }
}

/** Element Plus adapter: Element Plus consumes the same semantic variables; no business color overrides. */
export function createElementPlusThemeAdapter(controller: ThemeController, root?: ThemeRootAdapter): ThemeBinding {
  return bind(controller, root)
}

export type FrontendThemeMode = ThemeMode

