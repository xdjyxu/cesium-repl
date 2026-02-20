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

import type * as SandcastleModule from 'Sandcastle'
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

// #region Types

/** Alias for the Sandcastle module's SelectOption — imported from sandcastle.d.ts. */
export type SelectOption = SandcastleModule.SelectOption

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

export function createSandcastleAPI({ onLoadingChange, postToParent }: CreateSandcastleAPIOptions): SandcastleAPI {
  const registered = new Map<any, number>()
  let defaultAction: (() => void) | undefined

  function getToolbar(toolbarId?: string): HTMLElement | null {
    return document.getElementById(toolbarId ?? 'toolbar')
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
      api.reset()
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
      button.className = 'cesium-button'
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

      const checkbox = document.createElement('input')
      checkbox.type = 'checkbox'
      checkbox.checked = checked
      checkbox.style.pointerEvents = 'none'

      const label = document.createElement('label')
      label.style.pointerEvents = 'none'
      label.textContent = ` ${text}`

      const field = document.createElement('div')
      field.className = 'cesium-button'
      field.appendChild(checkbox)
      field.appendChild(label)

      field.onclick = () => {
        api.reset()
        api.highlight(onchange)
        checkbox.checked = !checkbox.checked
        onchange(checkbox.checked)
      }

      toolbar.appendChild(field)
    },

    addToolbarMenu(options, toolbarId) {
      const toolbar = getToolbar(toolbarId)
      if (!toolbar)
        return

      const select = document.createElement('select')
      select.className = 'cesium-button'

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

      toolbar.appendChild(select)

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
      const toolbar = document.getElementById('toolbar')
      if (toolbar)
        toolbar.innerHTML = ''
      onLoadingChange(true)
      registered.clear()
      defaultAction = undefined
    },
  }

  return api
}

// #endregion
