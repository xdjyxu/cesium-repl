import { createPluginService, createUseService } from '../../inject'
import { MonacoLoaderService } from '../common/protocol'
import { ServerMonacoLoaderServiceImpl } from './monacoLoaderService'

export const useMonacoLoaderService = createUseService(MonacoLoaderService)

export const registerServerMonacoLoaderService = createPluginService(
  MonacoLoaderService,
  ServerMonacoLoaderServiceImpl,
)
