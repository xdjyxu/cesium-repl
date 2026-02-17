import { createPluginService, createUseService } from '../../inject'
import { CompileServiceImpl } from './compileService'
import { CompileService } from '../common/protocol'

export const useCompileService = createUseService(CompileService)

export const registerCompileService = createPluginService(CompileService, CompileServiceImpl)
