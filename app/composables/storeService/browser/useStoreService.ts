import { createPluginService, createUseService } from '../../inject'
import { StoreService } from '../common/protocol'
import { StoreServiceImpl } from './storeService'

export const useStoreService = createUseService(StoreService)

export const registerStoreService = createPluginService(StoreService, StoreServiceImpl)
