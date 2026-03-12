import { createPluginService, createUseService } from '../../inject'
import { TabService } from './protocol'
import { TabServiceImpl } from './tabService'

export const useTabService = createUseService(TabService)

export const registerTabService = createPluginService(TabService, TabServiceImpl)
