import { createPluginService, createUseService } from '../../inject'
import { MonacoLoaderService } from '../common/protocol'
import { MonacoLoaderServiceImpl } from './monacoLoaderService'

export const useMonacoLoaderService = createUseService(MonacoLoaderService)

export const registerMonacoLoaderService = createPluginService(
  MonacoLoaderService,
  MonacoLoaderServiceImpl,
  { executeLifecycle: true },
)
