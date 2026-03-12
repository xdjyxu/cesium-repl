import { registerServerProfileService } from '~/composables/profileService/node/useProfileService'
import { registerServerStoreService } from '~/composables/storeService/node/useStoreService'

/**
 * Register server-side stub implementations of StoreService and ProfileService.
 * These provide default values for SSR rendering without accessing browser APIs.
 */
export default defineNuxtPlugin((nuxtApp) => {
  registerServerStoreService(nuxtApp.vueApp)
  registerServerProfileService(nuxtApp.vueApp)
})
