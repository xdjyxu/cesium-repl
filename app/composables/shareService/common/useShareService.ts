import { createPluginService, createUseService } from '../../inject'
import { ShareService } from './protocol'
import { ShareServiceImpl } from './shareService'

export const useShareService = createUseService(ShareService)

export const registerShareService = createPluginService(ShareService, ShareServiceImpl)
