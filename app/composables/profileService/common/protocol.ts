import type { Observable } from 'rxjs'
import type { InjectionKey } from 'vue'

/**
 * 主题类型
 */
export type Theme = 'light' | 'dark' | 'auto'

/**
 * 用户配置接口
 */
export interface Profile {
  /**
   * 主题设置
   */
  theme: Theme
}

/**
 * 配置服务接口
 * 管理用户的个人配置（主题、编辑器设置等）
 */
export interface ProfileService {
  /**
   * 当前配置状态流
   */
  profile$: Observable<Profile>

  /**
   * 当前实际应用的主题（解析 'auto' 后的结果）
   */
  resolvedTheme$: Observable<'light' | 'dark'>

  /**
   * 获取当前配置
   */
  getProfile: () => Profile

  /**
   * 获取当前实际应用的主题
   */
  getResolvedTheme: () => 'light' | 'dark'

  /**
   * 设置主题
   * @param theme - 主题类型
   */
  setTheme: (theme: Theme) => Promise<void>

  /**
   * 释放所有资源
   */
  dispose: () => void
}

// eslint-disable-next-line ts/no-redeclare
export const ProfileService = Symbol('ProfileService') as InjectionKey<ProfileService>
