/**
 * Shared composable for Cesium + Sandcastle execution environment.
 *
 * Encapsulates:
 *  - Cesium script loading and readiness polling
 *  - window.Sandcastle API setup and cleanup
 *  - Loading overlay state
 *  - Code execution via injected <script> tag
 *  - Pending execution queue (for code arriving before Cesium is ready)
 *
 * Used by both:
 *  - Sandcastle.vue  — iframe sandbox driven by postMessage transport
 *  - standalone.vue  — full-page mode driven by URL hash decompression
 */

import type { SandcastleShareData } from '~/composables/shareService/common/protocol'
import type { SandcastleAPI } from '~/utils/sandcastle'
import type { SandboxToParentMessage } from '~/utils/sandcastle/transport'
import { useScriptTag } from '@vueuse/core'
import { useObservable } from '@vueuse/rxjs'
import { map } from 'rxjs'
import { createSandcastleAPI, wrapCodeInESModule } from '~/utils/sandcastle'

// #region Global type augmentation

declare global {
  interface Window {
    Cesium: any
    Sandcastle: SandcastleAPI
    startup?: (Cesium: any) => Promise<void>
    startupCalled?: boolean
  }
}

// #endregion

export interface UseCesiumSandboxOptions {
  /**
   * Called to forward messages to the parent window (iframe mode).
   * When omitted, lifecycle messages (ready, reload, highlight) are silently dropped.
   */
  postToParent?: (msg: SandboxToParentMessage) => void
}

export function useCesiumSandbox(options: UseCesiumSandboxOptions = {}) {
  const { postToParent } = options

  const profileService = useProfileService()

  const isCesiumReady = ref(false)
  const isLoadingOverlayVisible = ref(true)
  const pendingExecution = shallowRef<SandcastleShareData | null>(null)

  let currentScriptElement: HTMLScriptElement | null = null
  let currentHtmlElement: HTMLElement | null = null
  let clearUI: (() => void) | undefined

  // #region Sandcastle API

  onMounted(() => {
    const runtime = createSandcastleAPI({
      onLoadingChange: (visible) => {
        isLoadingOverlayVisible.value = visible
      },
      postToParent: postToParent ?? (() => {}),
    })
    window.Sandcastle = runtime.api
    clearUI = runtime.clearUI
  })

  // #endregion

  // #region Code execution

  function executeCode(data: SandcastleShareData): void {
    try {
      clearUI?.()

      // Remove previously injected HTML element from body (for re-execution in iframe mode)
      if (currentHtmlElement) {
        currentHtmlElement.parentNode?.removeChild(currentHtmlElement)
        currentHtmlElement = null
      }

      // Inject HTML into document.body — mirrors Sandcastle's bucket and standalone behavior:
      // both inject the HTML editor content as a <div> appended to <body>.
      if (data.html) {
        const htmlElement = document.createElement('div')
        htmlElement.innerHTML = data.html
        document.body.appendChild(htmlElement)
        currentHtmlElement = htmlElement
      }

      currentScriptElement?.remove()
      currentScriptElement = null

      postToParent?.({ type: 'reload' })

      const script = document.createElement('script')
      script.type = 'module'
      script.textContent = wrapCodeInESModule(data.code)
      document.body.appendChild(script)
      currentScriptElement = script
    }
    catch (err) {
      console.error(`Failed to execute code: ${err}`)
    }
  }

  /**
   * Execute the code immediately if Cesium is ready, otherwise queue it.
   * The queued code will run automatically once Cesium finishes loading.
   */
  function executeOrQueue(data: SandcastleShareData): void {
    if (isCesiumReady.value) {
      executeCode(data)
    }
    else {
      pendingExecution.value = data
    }
  }

  // #endregion

  // #region Cesium loading

  useHead({
    link: [{ rel: 'stylesheet', href: '/lib/cesium/Widgets/widgets.css' }],
  })

  function applyAccessToken(token: string | undefined): void {
    if (typeof window.Cesium !== 'undefined' && window.Cesium.Ion) {
      window.Cesium.Ion.defaultAccessToken = token ?? ''
    }
  }

  // Keep token in sync when user updates it after Cesium is already loaded
  const cesiumAccessToken = useObservable(
    profileService.profile$.pipe(map(p => p.cesiumAccessToken)),
  )
  watch(cesiumAccessToken, token => applyAccessToken(token))

  function pollForCesium() {
    if (typeof window.Cesium !== 'undefined') {
      isCesiumReady.value = true
      applyAccessToken(profileService.getProfile().cesiumAccessToken)
      postToParent?.({ type: 'ready' })

      if (pendingExecution.value) {
        executeCode(pendingExecution.value)
        pendingExecution.value = null
      }
    }
    else {
      setTimeout(pollForCesium, 100)
    }
  }

  const { load } = useScriptTag(
    '/lib/cesium/Cesium.js',
    () => pollForCesium(),
    { manual: true, async: true },
  )

  onMounted(() => {
    load(true)
  })

  // #endregion

  return { isCesiumReady, isLoadingOverlayVisible, executeCode, executeOrQueue }
}
