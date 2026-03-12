import { createPluginService, createUseService } from '../../inject'
import { LockService } from '../common/protocol'
import { ServerLockServiceImpl } from './lockService'

export const useLockService = createUseService(LockService)

export const registerServerLockService = createPluginService(LockService, ServerLockServiceImpl)
