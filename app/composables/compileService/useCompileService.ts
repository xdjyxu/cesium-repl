import { createProvideService, createUseService } from '../inject'
import { CompileServiceImpl } from './compileService'
import { CompileService } from './protocol'

export const useCompileService = createUseService(CompileService)

export const provideCompileService = createProvideService(CompileService, CompileServiceImpl)
