import { createPluginService, createUseService } from '../../inject'
import { StoreService } from '../common/protocol'
import { ServerStoreServiceImpl } from './storeService'

export const useStoreService = createUseService(StoreService)

export const registerServerStoreService = createPluginService(StoreService, ServerStoreServiceImpl)
