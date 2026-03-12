import { createPluginService } from '../../inject'
import { LockServiceImpl } from '../common/lockService'
import { LockService } from '../common/protocol'

/**
 * 注册锁定服务（浏览器端）
 */
export const registerLockService = createPluginService(LockService, LockServiceImpl)
