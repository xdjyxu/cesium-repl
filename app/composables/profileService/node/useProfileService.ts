import { createPluginService, createUseService } from '../../inject'
import { ProfileService } from '../common/protocol'
import { ServerProfileServiceImpl } from './profileService'

export const useProfileService = createUseService(ProfileService)

export const registerServerProfileService = createPluginService(ProfileService, ServerProfileServiceImpl)
