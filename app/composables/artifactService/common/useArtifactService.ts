import { createPluginService, createUseService } from '../../inject'
import { ArtifactServiceImpl } from './artifactService'
import { ArtifactService } from './protocol'

export const useArtifactService = createUseService(ArtifactService)

export const registerArtifactService = createPluginService(ArtifactService, ArtifactServiceImpl)
