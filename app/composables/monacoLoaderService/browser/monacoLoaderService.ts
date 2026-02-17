import type * as monaco from 'monaco-editor'
import type { MonacoLoaderService } from '../common/protocol'
import loader from '@monaco-editor/loader'
import { PostConstruct } from '~/composables/inject'
import { Deferred } from '~/utils/deferred'

/**
 * Monaco Loader 服务实现
 */
export class MonacoLoaderServiceImpl implements MonacoLoaderService {
  /**
   * Monaco 实例加载的 Deferred
   */
  private readonly _deferred = new Deferred<typeof monaco>()

  /**
   * 是否已加载
   */
  get isLoaded(): boolean {
    return this._deferred.settled
  }

  /**
   * 是否正在加载
   * 注：由于我们在 PostConstruct 中启动加载，这个状态基本总是 true（直到加载完成）
   */
  get isLoading(): boolean {
    return !this._deferred.settled
  }

  /**
   * 初始化方法，在实例化后自动执行
   * 配置并启动 Monaco Editor 的加载
   */
  @PostConstruct
  initialize(): void {
    this.loadMonaco()
  }

  /**
   * 加载 Monaco Editor
   */
  private async loadMonaco(): Promise<void> {
    try {
      loader.config({
        paths: {
          vs: __MONACO_BASE_PATH__,
        },
      })

      const monacoInstance = await loader.init()
      this._deferred.resolve(monacoInstance)
    }
    catch (error) {
      this._deferred.reject(error)
    }
  }

  /**
   * 获取 Monaco Editor 实例
   * 如果未加载，会等待加载完成
   */
  async getMonaco(): Promise<typeof monaco> {
    return this._deferred.promise
  }
}

/**
 * 创建 Monaco Loader 服务实例
 */
export function createMonacoLoaderService(): MonacoLoaderService {
  return new MonacoLoaderServiceImpl()
}
