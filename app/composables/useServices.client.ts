import type { InjectionKey } from 'vue'
import type { UseServices } from './useServices.protocol'
import { provide } from 'vue'
import { registerArtifactService } from './artifactService/common/useArtifactService'
import { registerCompileService } from './compileService/browser/useCompileService'
import { registerEditorService } from './editorService/browser/useEditorService'
import { registerFileService } from './fileService/common/useFileService'
import { registerLockService } from './lockService/browser/useLockService'
import { registerMonacoLoaderService } from './monacoLoaderService/browser/useMonacoLoaderService'
import { registerProfileService } from './profileService/browser/useProfileService'
import { registerStoreService } from './storeService/browser/useStoreService'
import { registerTabService } from './tabService/common/useTabService'

const useServices: UseServices = () => {
  const p = {
    provide: (key: InjectionKey<unknown> | string, value: unknown) => {
      provide(key as InjectionKey<unknown>, value)
    },
  }

  registerArtifactService(p)
  registerFileService(p)
  registerLockService(p)
  registerTabService(p)
  registerStoreService(p)
  registerMonacoLoaderService(p)
  registerCompileService(p)
  registerEditorService(p)
  registerProfileService(p)
}

export default useServices
