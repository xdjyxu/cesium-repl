import type * as monaco from 'monaco-editor'
import type { InjectionKey } from 'vue'

/**
 * Monaco Loader 服务接口
 */
export interface MonacoLoaderService {
  /**
   * 加载状态
   */
  readonly isLoaded: boolean

  /**
   * 是否正在加载
   */
  readonly isLoading: boolean

  /**
   * 获取 Monaco Editor 实例
   * 如果未加载，会自动触发加载
   * @returns Monaco Editor 实例的 Promise
   */
  getMonaco: () => Promise<typeof monaco>
}

// eslint-disable-next-line ts/no-redeclare
export const MonacoLoaderService = Symbol('MonacoLoaderService') as InjectionKey<MonacoLoaderService>
