import { registerProfileService } from '~/composables/profileService/browser/useProfileService'
import { registerStoreService } from '~/composables/storeService/browser/useStoreService'

/**
 * Register StoreService and ProfileService at the Nuxt app root level so that
 * they are available in every page — including the Sandcastle iframe and the
 * Standalone page — without requiring the full workspace service stack.
 *
 * In the main workspace the component-level registrations in useServices.client.ts
 * shadow these app-level instances for that subtree, so there is no conflict.
 */
export default defineNuxtPlugin((nuxtApp) => {
  registerStoreService(nuxtApp.vueApp)
  registerProfileService(nuxtApp.vueApp)
})
