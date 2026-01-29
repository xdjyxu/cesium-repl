import { createProvideService, createUseService } from '../inject'
import { StoreService } from './protocol'
import { StoreServiceImpl } from './storeService'

export const useStoreService = createUseService(StoreService)

export const provideStoreService = createProvideService(StoreService, StoreServiceImpl)
