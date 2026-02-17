import { registerCompileService } from '~/composables/compileService/browser/useCompileService'
import { registerEditorService } from '~/composables/editorService/browser/useEditorService'
import { registerFileService } from '~/composables/fileService/common/useFileService'
import { registerMonacoLoaderService } from '~/composables/monacoLoaderService/browser/useMonacoLoaderService'
import { registerProfileService } from '~/composables/profileService/browser/useProfileService'
import { registerShareService } from '~/composables/shareService/common/useShareService'
import { registerStoreService } from '~/composables/storeService/browser/useStoreService'

export default defineNuxtPlugin((nuxtApp) => {
  // 通用服务（浏览器和服务端实现相同）
  registerFileService(nuxtApp.vueApp)
  registerShareService(nuxtApp.vueApp)

  // 浏览器专用服务
  registerStoreService(nuxtApp.vueApp)
  registerMonacoLoaderService(nuxtApp.vueApp)
  registerCompileService(nuxtApp.vueApp)
  registerEditorService(nuxtApp.vueApp)
  registerProfileService(nuxtApp.vueApp)
})
