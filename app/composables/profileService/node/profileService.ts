import type { Profile, ProfileService, Theme } from '../common/protocol'
import { BehaviorSubject } from 'rxjs'

const DEFAULT_PROFILE: Profile = { theme: 'auto' }

/**
 * 服务端配置服务实现
 * 用于 SSR 环境，提供默认配置，不依赖 window/localStorage
 */
export class ServerProfileServiceImpl implements ProfileService {
  readonly profile$ = new BehaviorSubject<Profile>(DEFAULT_PROFILE)
  readonly resolvedTheme$ = new BehaviorSubject<'light' | 'dark'>('light')

  getProfile(): Profile {
    return DEFAULT_PROFILE
  }

  getResolvedTheme(): 'light' | 'dark' {
    return 'light'
  }

  async setTheme(_theme: Theme): Promise<void> {
    // noop on server
  }

  dispose(): void {
    // noop
  }
}
