import { registerShareService } from '~/composables/shareService/common/useShareService'

/**
 * Register ShareService at the Nuxt app root level.
 * Being a pure compression/decompression utility with no browser-specific APIs,
 * ShareService is available on both client and server, and can be injected
 * in any page or component without needing the full workspace service setup.
 */
export default defineNuxtPlugin((nuxtApp) => {
  registerShareService(nuxtApp.vueApp)
})
