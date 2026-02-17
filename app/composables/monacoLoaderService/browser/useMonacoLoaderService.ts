import { createPluginService, createUseService } from '../../inject'
import { MonacoLoaderServiceImpl } from './monacoLoaderService'
import { MonacoLoaderService } from '../common/protocol'

export const useMonacoLoaderService = createUseService(MonacoLoaderService)

export const registerMonacoLoaderService = createPluginService(
  MonacoLoaderService,
  MonacoLoaderServiceImpl,
  { executeLifecycle: true },
)
