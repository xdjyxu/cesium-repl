import { createPluginService, createUseService } from '../../inject'
import { ProfileService } from '../common/protocol'
import { ProfileServiceImpl } from './profileService'

export const useProfileService = createUseService(ProfileService)

export const registerProfileService = createPluginService(ProfileService, ProfileServiceImpl)
