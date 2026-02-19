import type { InjectionKey } from 'vue'
import type { UseServices } from './useServices.protocol'
import { provide } from 'vue'
import { registerServerCompileService } from './compileService/node/useCompileService'
import { registerServerEditorService } from './editorService/node/useEditorService'
import { registerFileService } from './fileService/common/useFileService'
import { registerServerMonacoLoaderService } from './monacoLoaderService/node/useMonacoLoaderService'
import { registerServerProfileService } from './profileService/node/useProfileService'
import { registerShareService } from './shareService/common/useShareService'
import { registerServerStoreService } from './storeService/node/useStoreService'
import { registerTabService } from './tabService/common/useTabService'

const useServices: UseServices = () => {
  const p = {
    provide: (key: InjectionKey<unknown> | string, value: unknown) => {
      provide(key as InjectionKey<unknown>, value)
    },
  }

  registerFileService(p)
  registerShareService(p)
  registerTabService(p)
  registerServerStoreService(p)
  registerServerProfileService(p)
  registerServerMonacoLoaderService(p)
  registerServerCompileService(p)
  registerServerEditorService(p)
}

export default useServices
