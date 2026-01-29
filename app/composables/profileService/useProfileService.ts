import { createProvideService, createUseService } from '../inject'
import { ProfileServiceImpl } from './profileService'
import { ProfileService } from './protocol'

export const useProfileService = createUseService(ProfileService, { autoDependencies: true })

export const provideProfileService = createProvideService(ProfileService, ProfileServiceImpl)
