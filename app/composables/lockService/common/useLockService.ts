import type { LockService } from './protocol'
import { createUseService } from '../../inject'
import { LockService as LockServiceKey } from './protocol'

/**
 * 使用锁定服务
 */
export const useLockService = createUseService<LockService>(LockServiceKey)
