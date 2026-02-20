/**
 * Sandcastle module declaration — single source of truth for the Sandcastle API shape.
 *
 * This file is used in three ways:
 *   1. Automatically included in the app TypeScript project as an ambient declaration.
 *   2. Imported as raw text in index.ts (`?raw`) for Monaco Editor type injection.
 *   3. Referenced by examples/tsconfig.json so example files share the same IntelliSense.
 *
 * The runtime implementation in index.ts derives its types from this declaration via
 * `import type * as SandcastleModule from 'Sandcastle'`.
 */
declare module 'Sandcastle' {
  export interface SelectOption {
    text: string
    value?: string
    onselect: () => void
  }

  /** Register a code bookmark at the call site; pass the same key to highlight(). */
  export function declare(key: any): void

  /** Highlight the editor line where declare(key) was called. */
  export function highlight(key: any): void

  /** Signal that Sandcastle finished loading and invoke the default action if set. */
  export function finishedLoading(): void

  export function addToolbarButton(text: string, onclick: () => void, toolbarId?: string): void
  export function addToggleButton(text: string, checked: boolean, onchange: (newValue: boolean) => void, toolbarId?: string): void
  export function addToolbarMenu(options: SelectOption[], toolbarId?: string): void
  export function addDefaultToolbarButton(text: string, onclick: () => void, toolbarId?: string): void
  export function addDefaultToolbarMenu(options: SelectOption[], toolbarId?: string): void

  /** Clear toolbar and reset execution state (called before each code run). */
  export function reset(): void
}
