import { useArtifactService } from '~/composables/artifactService/common/useArtifactService'
import { useShareService } from '~/composables/shareService/common/useShareService'

export function useShareData() {
  const artifactService = useArtifactService()
  const shareService = useShareService()

  function getCompressed(): string | null {
    const artifact = artifactService.getArtifact()
    if (!artifact)
      return null
    return shareService.compress(artifact)
  }

  return { getCompressed }
}
