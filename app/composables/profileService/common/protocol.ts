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

  /**
   * Cesium Ion 访问令牌（可选，留空则使用默认公共令牌）
   */
  cesiumAccessToken?: string

  /**
   * 自动编译：保存文件后自动触发编译并更新沙箱
   */
  autoCompile?: boolean
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
   * 设置 Cesium Ion 访问令牌
   * @param token - 访问令牌，传 undefined 则清除自定义令牌
   */
  setAccessToken: (token: string | undefined) => Promise<void>

  /**
   * 设置自动编译开关
   * @param enabled - 是否启用自动编译
   */
  setAutoCompile: (enabled: boolean) => Promise<void>

  /**
   * 释放所有资源
   */
  dispose: () => void
}

// eslint-disable-next-line ts/no-redeclare
export const ProfileService = Symbol('ProfileService') as InjectionKey<ProfileService>
