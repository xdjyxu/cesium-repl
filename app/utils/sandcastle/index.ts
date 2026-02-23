/**
 * Sandcastle API — runtime factory
 *
 * The canonical type declaration lives in ./sandcastle.d.ts (ambient module declaration).
 * Types exported from this file are derived from that declaration so the implementation
 * is always constrained by the single source of truth.
 *
 * For Monaco Editor type injection, `SANDCASTLE_MODULE_DECLARATION` is the raw text of
 * sandcastle.d.ts imported via Vite's `?raw` suffix.
 */

import type SandcastleModule from 'Sandcastle'
import type { SandboxToParentMessage } from './transport'
// Vite raw import — the string content of sandcastle.d.ts, used by Monaco addExtraLib
import SANDCASTLE_MODULE_DECLARATION from './sandcastle.d.ts?raw'

export { SANDCASTLE_MODULE_DECLARATION }

// #region Constants

/**
 * Number of lines prepended by `wrapCodeInTemplate` before the first line of user code.
 * Used to convert raw script line numbers (from stack traces) into editor line numbers.
 */
export const TEMPLATE_HEADER_LINES = 3

// #endregion

// #region Code template

/**
 * Wraps user code in the Sandcastle startup template.
 * The template header occupies `TEMPLATE_HEADER_LINES` lines before user code,
 * so raw script line numbers need that offset subtracted for accurate editor highlighting.
 */
export function wrapCodeInTemplate(code: string): string {
  return [
    'window.startup = async function (Cesium) {',
    '  \'use strict\';',
    '  //Sandcastle_Begin',
    code,
    '  //Sandcastle_End',
    '  Sandcastle.finishedLoading();',
    '};',
    'if (typeof Cesium !== \'undefined\') {',
    '  window.startupCalled = true;',
    '  window.startup(Cesium).catch(function(error) {',
    '    console.error(error);',
    '  });',
    '}',
  ].join('\n')
}

// #endregion

// #region Types

/** Alias for the Sandcastle module's SelectOption — imported from sandcastle.d.ts. */
export type { SelectOption } from 'Sandcastle'

/**
 * The runtime API shape, derived from the module declaration in sandcastle.d.ts.
 * Keeps the implementation and the Monaco type declaration in sync automatically.
 */
export type SandcastleAPI = typeof SandcastleModule

// #endregion

// #region Factory

export interface CreateSandcastleAPIOptions {
  /** Called whenever the loading overlay should be shown (true) or hidden (false). */
  onLoadingChange: (visible: boolean) => void
  /** Called to send a message to the parent window. */
  postToParent: (msg: SandboxToParentMessage) => void
}

export interface SandcastleRuntime {
  api: SandcastleAPI
  /** 清空 toolbar 并显示 loading，仅供执行新代码前调用 */
  clearUI: () => void
}

export function createSandcastleAPI({ onLoadingChange, postToParent }: CreateSandcastleAPIOptions): SandcastleRuntime {
  const registered = new Map<any, number>()
  let defaultAction: (() => void) | undefined

  function getToolbar(toolbarId?: string): HTMLElement | null {
    return document.getElementById(toolbarId ?? 'toolbar')
  }

  function clearUI() {
    const toolbar = document.getElementById('toolbar')
    if (toolbar)
      toolbar.innerHTML = ''
    onLoadingChange(true)
    registered.clear()
    defaultAction = undefined
  }

  const api: SandcastleAPI = {
    declare(key) {
      try {
        let stack = ''
        try {
          throw new Error('stack trace')
        }
        catch (e) {
          if (e instanceof Error && e.stack !== undefined)
            stack = e.stack
        }

        // Chrome/Edge: dynamically injected scripts appear as "<anonymous>:LINE:COL"
        let needle = '<anonymous>:'
        let pos = stack.indexOf(needle)
        // Firefox: scripts appear as "bucket:LINE:COL" where bucket is the script filename
        if (pos < 0) {
          needle = `${window.location.href.substring(window.location.href.lastIndexOf('/') + 1)}:`
          pos = stack.indexOf(needle)
        }
        if (pos >= 0) {
          const rawLine = Number.parseInt(stack.substring(pos + needle.length), 10)
          registered.set(key, rawLine - TEMPLATE_HEADER_LINES)
        }
      }
      catch {}
    },

    highlight(key) {
      if (key !== undefined) {
        const lineNumber = registered.get(key) ?? registered.get(key?.primitive)
        if (lineNumber !== undefined) {
          postToParent({ type: 'highlight', lineNumber })
          return
        }
      }
      postToParent({ type: 'highlight', lineNumber: 0 })
    },

    finishedLoading() {
      onLoadingChange(false)
      if (defaultAction) {
        api.highlight(defaultAction)
        defaultAction()
        defaultAction = undefined
      }
    },

    addToolbarButton(text, onclick, toolbarId) {
      api.declare(onclick)
      const toolbar = getToolbar(toolbarId)
      if (!toolbar)
        return

      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'stratakit-mimic-button'
      button.textContent = text
      button.onclick = () => {
        api.reset()
        api.highlight(onclick)
        onclick()
      }
      toolbar.appendChild(button)
    },

    addToggleButton(text, checked, onchange, toolbarId) {
      api.declare(onchange)
      const toolbar = getToolbar(toolbarId)
      if (!toolbar)
        return

      const id = `toggle-${Math.random().toString(36).slice(2)}`

      const checkbox = document.createElement('input')
      checkbox.type = 'checkbox'
      checkbox.className = 'stratakit-mimic-switch'
      checkbox.checked = checked
      checkbox.id = id
      checkbox.onchange = () => {
        api.highlight(onchange)
        onchange(checkbox.checked)
      }

      const label = document.createElement('label')
      label.className = 'stratakit-mimic-label'
      label.htmlFor = id
      label.textContent = text

      const field = document.createElement('div')
      field.className = 'stratakit-mimic-field'
      field.appendChild(checkbox)
      field.appendChild(label)

      toolbar.appendChild(field)
    },

    addToolbarMenu(options, toolbarId) {
      const toolbar = getToolbar(toolbarId)
      if (!toolbar)
        return

      const select = document.createElement('select')
      select.className = 'stratakit-mimic-button stratakit-mimic-select'

      for (const [index, option] of options.entries()) {
        api.declare(option.onselect)
        const opt = document.createElement('option')
        opt.value = option.value ?? String(index)
        opt.textContent = option.text
        select.appendChild(opt)
      }

      select.onchange = () => {
        api.reset()
        const item = options[select.selectedIndex]
        if (item)
          item.onselect()
      }

      const root = document.createElement('div')
      root.className = 'stratakit-mimic-select-root'
      root.appendChild(select)
      toolbar.appendChild(root)

      if (!defaultAction && options[0]?.onselect)
        defaultAction = options[0].onselect
    },

    addDefaultToolbarButton(text, onclick, toolbarId) {
      api.addToolbarButton(text, onclick, toolbarId)
      defaultAction = onclick
    },

    addDefaultToolbarMenu(options, toolbarId) {
      api.addToolbarMenu(options, toolbarId)
      if (options[0]?.onselect)
        defaultAction = options[0].onselect
    },

    reset() {
      // no-op by default — user code can override this to reset Cesium viewer state
    },
  }

  return { api, clearUI }
}

// #endregion
