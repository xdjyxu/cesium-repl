/**
 * Sandcastle module declaration — single source of truth for the Sandcastle API shape.
 *
 * This file is used in three ways:
 *   1. Automatically included in the app TypeScript project as an ambient declaration.
 *   2. Imported as raw text in index.ts (`?raw`) for Monaco Editor type injection.
 *   3. Referenced by examples/tsconfig.json so example files share the same IntelliSense.
 */
declare module 'Sandcastle' {
  export interface SelectOption {
    text: string
    value?: string
    onselect: () => void
  }

  interface SandcastleAPI {
    declare: (key: any) => void
    highlight: (key: any) => void
    finishedLoading: () => void
    addToolbarButton: (text: string, onclick: () => void, toolbarId?: string) => void
    addToggleButton: (text: string, checked: boolean, onchange: (newValue: boolean) => void, toolbarId?: string) => void
    addToolbarMenu: (options: SelectOption[], toolbarId?: string) => void
    addDefaultToolbarButton: (text: string, onclick: () => void, toolbarId?: string) => void
    addDefaultToolbarMenu: (options: SelectOption[], toolbarId?: string) => void
    /** No-op by default. Override in user code to reset Cesium viewer state. */
    reset: () => void
  }

  const _default: SandcastleAPI
  export default _default
}
