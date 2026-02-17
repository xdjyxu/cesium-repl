import { registerServerCompileService } from '~/composables/compileService/node/useCompileService'
import { registerServerEditorService } from '~/composables/editorService/node/useEditorService'
import { registerFileService } from '~/composables/fileService/common/useFileService'
import { registerServerMonacoLoaderService } from '~/composables/monacoLoaderService/node/useMonacoLoaderService'
import { registerServerProfileService } from '~/composables/profileService/node/useProfileService'
import { registerShareService } from '~/composables/shareService/common/useShareService'
import { registerServerStoreService } from '~/composables/storeService/node/useStoreService'
import { registerTabService } from '~/composables/tabService/common/useTabService'

export default defineNuxtPlugin((nuxtApp) => {
  // 通用服务
  registerFileService(nuxtApp.vueApp)
  registerShareService(nuxtApp.vueApp)
  registerTabService(nuxtApp.vueApp)

  // 服务端专用实现（不依赖 window/localStorage）
  registerServerStoreService(nuxtApp.vueApp)
  registerServerProfileService(nuxtApp.vueApp)

  // 浏览器专用服务的 SSR 占位实现（避免组件注入时 provider 缺失报错）
  registerServerMonacoLoaderService(nuxtApp.vueApp)
  registerServerCompileService(nuxtApp.vueApp)
  registerServerEditorService(nuxtApp.vueApp)
})
