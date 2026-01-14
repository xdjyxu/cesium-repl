import { ShareService } from './protocol'
import { ShareServiceImpl } from './shareService'

export function useShareService(): ShareService {
  const shareService = inject(ShareService)
  if (!shareService) {
    throw new Error('ShareService has not been provided')
  }
  return shareService
}

export function provideShareService(): void {
  const shareService = new ShareServiceImpl()
  provide(ShareService, shareService)
}
