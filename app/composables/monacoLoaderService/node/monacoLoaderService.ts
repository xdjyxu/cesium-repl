import type * as monaco from 'monaco-editor'
import type { MonacoLoaderService } from '../common/protocol'

/**
 * 服务端 Monaco Loader 占位实现
 * Monaco Editor 依赖 window，无法在 SSR 环境中运行
 * 此实现仅用于避免服务端缺少 provider 报错
 */
export class ServerMonacoLoaderServiceImpl implements MonacoLoaderService {
  readonly isLoaded = false
  readonly isLoading = false

  getMonaco(): Promise<typeof monaco> {
    // Monaco 在 SSR 环境中不可用，返回一个永不 resolve 的 Promise
    return new Promise<never>(() => {})
  }
}
