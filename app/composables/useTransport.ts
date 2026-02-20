import type { Ref } from 'vue'
import type { ITransport, ParentToSandboxMessage, SandboxToParentMessage } from '~/utils/sandcastle/transport'
import { tryOnScopeDispose } from '@vueuse/core'
import { IframeTransport, ParentTransport } from '~/utils/sandcastle/transport'

/**
 * Wraps `ParentTransport` for use in a Vue component.
 * Disposes the transport automatically when the scope is destroyed.
 *
 * Returns a `shallowRef` to the current transport instance (or `null`).
 */
export function useParentTransport(iframeRef: Ref<HTMLIFrameElement | undefined>): Ref<ITransport<SandboxToParentMessage, ParentToSandboxMessage> | null> {
  const transport = shallowRef<ITransport<SandboxToParentMessage, ParentToSandboxMessage> | null>(null)

  watch(iframeRef, (el, _, onCleanup) => {
    if (!el)
      return
    const t = new ParentTransport(el)
    transport.value = t
    onCleanup(() => {
      t.dispose()
      if (transport.value === t)
        transport.value = null
    })
  }, { immediate: true })

  tryOnScopeDispose(() => transport.value?.dispose())

  return transport
}

/**
 * Wraps `IframeTransport` for use in a Vue component.
 * Instantiated only on the client side; returns `null` during SSR.
 * Disposes the transport automatically when the scope is destroyed.
 *
 * Returns a `shallowRef` to the transport instance (or `null`).
 */
export function useIframeTransport(): Ref<ITransport<ParentToSandboxMessage, SandboxToParentMessage> | null> {
  const transport = shallowRef<ITransport<ParentToSandboxMessage, SandboxToParentMessage> | null>(null)

  if (import.meta.client) {
    const t = new IframeTransport()
    transport.value = t
    tryOnScopeDispose(() => t.dispose())
  }

  return transport
}
