import { createPluginService, createUseService } from '../../inject'
import { CompileService } from '../common/protocol'
import { CompileServiceImpl } from './compileService'

export const useCompileService = createUseService(CompileService)

export const registerCompileService = createPluginService(CompileService, CompileServiceImpl)
