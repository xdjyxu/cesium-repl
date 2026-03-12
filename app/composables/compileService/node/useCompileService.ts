import { createPluginService, createUseService } from '../../inject'
import { CompileService } from '../common/protocol'
import { ServerCompileServiceImpl } from './compileService'

export const useCompileService = createUseService(CompileService)

export const registerServerCompileService = createPluginService(
  CompileService,
  ServerCompileServiceImpl,
)
