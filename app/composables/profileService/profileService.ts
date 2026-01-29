import type { Profile, ProfileService, Theme } from './protocol'
import { BehaviorSubject, combineLatest, fromEvent, map } from 'rxjs'
import { Autowired } from '../inject'
import { StoreService } from '../storeService/protocol'

/**
 * 配置服务实现
 */
export class ProfileServiceImpl implements ProfileService {
  @Autowired(StoreService)
  private storeService!: StoreService

  private readonly storageKey = 'profile'

  /**
   * 配置状态的 Subject
   */
  private readonly _profileSubject: BehaviorSubject<Profile>

  /**
   * 系统主题偏好的 Observable
   */
  private readonly _systemTheme$: BehaviorSubject<'light' | 'dark'>

  /**
   * 配置状态流（只读）
   */
  readonly profile$: BehaviorSubject<Profile>

  /**
   * 实际应用的主题流（解析 'auto' 后的结果）
   */
  readonly resolvedTheme$: BehaviorSubject<'light' | 'dark'>

  constructor() {
    // 初始化系统主题检测
    this._systemTheme$ = new BehaviorSubject<'light' | 'dark'>(
      this._detectSystemTheme(),
    )

    // 监听系统主题变化
    if (typeof window !== 'undefined' && window.matchMedia) {
      const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)')
      fromEvent<MediaQueryListEvent>(darkModeQuery, 'change')
        .pipe(map(e => (e.matches ? 'dark' : 'light')))
        .subscribe(theme => this._systemTheme$.next(theme))
    }

    // 从存储加载配置或使用默认值
    const initialProfile = this._loadProfileSync()
    this._profileSubject = new BehaviorSubject<Profile>(initialProfile)
    this.profile$ = this._profileSubject

    // 计算实际应用的主题
    this.resolvedTheme$ = new BehaviorSubject<'light' | 'dark'>(
      this._resolveTheme(initialProfile.theme),
    )

    // 监听配置变化，更新 resolvedTheme
    combineLatest([this.profile$, this._systemTheme$])
      .pipe(
        map(([profile]) => this._resolveTheme(profile.theme)),
      )
      .subscribe(theme => this.resolvedTheme$.next(theme))
  }

  /**
   * 检测系统主题偏好
   */
  private _detectSystemTheme(): 'light' | 'dark' {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return 'light'
    }

    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)')
    return darkModeQuery.matches ? 'dark' : 'light'
  }

  /**
   * 解析主题（将 'auto' 转换为实际主题）
   */
  private _resolveTheme(theme: Theme): 'light' | 'dark' {
    if (theme === 'auto') {
      return this._systemTheme$.value
    }
    return theme
  }

  /**
   * 同步加载配置（用于初始化）
   */
  private _loadProfileSync(): Profile {
    try {
      if (typeof window === 'undefined') {
        return this._getDefaultProfile()
      }

      const stored = localStorage.getItem(`cesium-repl:${this.storageKey}`)
      if (!stored) {
        return this._getDefaultProfile()
      }

      const parsed = JSON.parse(stored) as Partial<Profile>
      return {
        ...this._getDefaultProfile(),
        ...parsed,
      }
    }
    catch (error) {
      console.error('Failed to load profile:', error)
      return this._getDefaultProfile()
    }
  }

  /**
   * 获取默认配置
   */
  private _getDefaultProfile(): Profile {
    return {
      theme: 'auto',
    }
  }

  /**
   * 保存配置到存储
   */
  private async _saveProfile(profile: Profile): Promise<void> {
    if (!this.storeService) {
      console.warn('StoreService not injected, profile will not be persisted')
      return
    }
    await this.storeService.set(this.storageKey, profile)
  }

  getProfile(): Profile {
    return this._profileSubject.value
  }

  getResolvedTheme(): 'light' | 'dark' {
    return this.resolvedTheme$.value
  }

  async setTheme(theme: Theme): Promise<void> {
    const currentProfile = this.getProfile()
    const newProfile: Profile = {
      ...currentProfile,
      theme,
    }

    // 更新状态
    this._profileSubject.next(newProfile)

    // 持久化
    await this._saveProfile(newProfile)
  }

  dispose(): void {
    this._profileSubject.complete()
    this._systemTheme$.complete()
    this.resolvedTheme$.complete()
  }
}
