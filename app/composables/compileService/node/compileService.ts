import type { CompileService, CompileState, RollupOptions, RollupOutput } from '../common/protocol'
import { BehaviorSubject } from 'rxjs'
import { CompileStatus } from '../common/protocol'

/**
 * 服务端 Compile 占位实现
 * Rollup 和 SWC WASM 依赖浏览器环境，无法在 SSR 中运行
 * 此实现仅用于避免服务端缺少 provider 报错
 */
export class ServerCompileServiceImpl implements CompileService {
  readonly state$ = new BehaviorSubject<CompileState>({
    status: CompileStatus.Idle,
    isCompiling: false,
  }).asObservable()

  compile(_options: RollupOptions): Promise<RollupOutput[]> {
    return Promise.reject(new Error('CompileService is not available in SSR context'))
  }
}
